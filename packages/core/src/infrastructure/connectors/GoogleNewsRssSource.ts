import { mapWithConcurrency } from '../../common/concurrency';
import { getLogger } from '../../common/Logger';
import { ScanFocus } from '../../domains/lead/entities/Geo';
import { SourceDocument } from '../../domains/lead/entities/SourceDocument';
import { IDocumentSource } from '../../domains/lead/ports/IDocumentSource';
import { DocumentNormalizer } from '../../domains/lead/services/DocumentNormalizer';
import { FeedBlockedError, fetchFeed } from './rssFetch';

const logger = getLogger('GoogleNewsRssSource');

/**
 * The requirement vocabulary from section 5 of the master plan, grouped by the
 * kind of signal each phrase tends to surface. Kept broad deliberately: recall
 * matters more than precision here, because the relevance classifier downstream
 * discards the noise and the confidence score ranks what survives.
 */
export const REQUIREMENT_TERMS = [
  // Explicit requirement
  'warehouse required',
  'warehouse on lease',
  'godown required',
  'hiring of godown',
  'covered storage required',
  'storage space required',
  'warehouse space requirement',
  // Expansion / scouting
  'scouting warehouse',
  'looking for warehouse',
  'distribution centre expansion',
  'fulfilment centre',
  'new distribution hub',
  'logistics facility expansion',
  '3PL warehouse expansion',
  // Tender / EOI
  'warehouse tender',
  'godown tender',
  'EOI warehouse',
  'lease of warehouse',
  'hiring warehouse tender',
  'construction cum lease godown',
  'warehouse RFP',
  // Land / build-to-suit
  'logistics land',
  'built to suit warehouse',
  'industrial land logistics',
  'logistics park plot',
  'distribution hub land',
  'warehousing land acquisition',
  // Specialised facilities
  'cold storage requirement',
  'bonded warehouse requirement',
  'hazardous storage facility',
  'GMP warehouse',
  'temperature controlled warehouse'
];

interface GoogleNewsRssOptions {
  normalizer: DocumentNormalizer;
  terms?: string[];
  maxItemsPerQuery?: number;
  maxQueries?: number;
  concurrency?: number;
  /** Pause between requests, to stay under the provider's rate limit. */
  requestDelayMs?: number;
  /** Wall-clock budget for the whole fetch, in milliseconds. */
  timeBudgetMs?: number;
}

/**
 * Google News RSS connector — DISABLED BY DEFAULT.
 *
 * Two problems make it unsuitable as a primary source, both of which the master
 * plan predicted ("do not depend on search-engine scraping"):
 *
 *  1. Its item links are `news.google.com/rss/articles/CBMi...` redirects, not
 *     publisher URLs. Clicking one often lands on Google's anti-bot
 *     interstitial, so the lead's evidence cannot be opened — which breaks the
 *     product's core traceability rule. The redirect target cannot be recovered
 *     offline either: the payload is Google's opaque post-2024 format, and
 *     following the redirect server-side is itself treated as automation.
 *  2. Issuing many search queries gets the caller rate-limited, after which the
 *     endpoint returns an HTML interstitial for *every* request.
 *
 * It is kept because it is the only keyword-targeted source available without a
 * paid news API, and it may work from a residential IP or through a licensed
 * provider. Enable deliberately via the Composition Root, and expect its links
 * to be aggregator redirects rather than primary evidence.
 *
 * Volume is kept deliberately low with serial requests and a pause between
 * them; that is the difference between working and being blocked.
 */
export class GoogleNewsRssSource implements IDocumentSource {
  public readonly sourceName = 'google_news_rss';

  private readonly normalizer: DocumentNormalizer;
  private readonly terms: string[];
  private readonly maxItemsPerQuery: number;
  private readonly maxQueries: number;
  private readonly concurrency: number;
  private readonly requestDelayMs: number;
  private readonly timeBudgetMs: number;

  constructor(options: GoogleNewsRssOptions) {
    this.normalizer = options.normalizer;
    this.terms = options.terms ?? REQUIREMENT_TERMS;
    this.maxItemsPerQuery = options.maxItemsPerQuery ?? 8;
    // Low caps and serial requests: 36 parallel queries is what triggered the
    // block in the first place.
    this.maxQueries = options.maxQueries ?? 8;
    this.concurrency = options.concurrency ?? 1;
    this.requestDelayMs = options.requestDelayMs ?? 400;
    this.timeBudgetMs = options.timeBudgetMs ?? 20000;
  }

  /**
   * Pairs each requirement term with a place. Places closest to the search
   * centre come first, so when the cap truncates the list it drops the most
   * distant places rather than an arbitrary slice.
   *
   * Without a search centre the terms are issued unqualified rather than
   * against a built-in region list. The old fallback named four regions in
   * code, which quietly turned "search everywhere" into "search these four" —
   * a national scan could not surface a requirement anywhere else.
   */
  private buildQueries(focus?: ScanFocus): string[] {
    const places = focus?.placeNames ?? [];
    if (places.length === 0) return this.terms.slice(0, this.maxQueries);

    const queries: string[] = [];

    // Place-major ordering keeps the nearest place's full term coverage intact.
    for (const place of places) {
      for (const term of this.terms) {
        queries.push(`${term} ${place}`);
      }
    }

    return queries.slice(0, this.maxQueries);
  }

  public async fetchDocuments(focus?: ScanFocus): Promise<SourceDocument[]> {
    const queries = this.buildQueries(focus);
    const deadlineAt = Date.now() + this.timeBudgetMs;

    // One scan commonly matches the same article from several queries.
    const seenHashes = new Set<string>();
    const documents: SourceDocument[] = [];
    let blocked = false;

    await mapWithConcurrency(
      queries,
      async (query) => {
        // Once rate-limited, every further request returns the same
        // interstitial. Continuing would only deepen the block.
        if (blocked) return;
        if (this.requestDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.requestDelayMs));
        }
        try {
          const encoded = encodeURIComponent(query);
          const rssUrl = `https://news.google.com/rss/search?q=${encoded}&hl=en-IN&gl=IN&ceid=IN:en`;
          const feed = await fetchFeed(rssUrl);

          for (const item of (feed.items || []).slice(0, this.maxItemsPerQuery)) {
            if (!item.title || !item.link) continue;

            const rawSnippet = `${item.contentSnippet || ''} ${item.content || ''}`;
            const cleanText = this.normalizer.cleanDocumentText(rawSnippet || item.title);
            const contentHash = this.normalizer.computeContentHash(`${item.title}\n${cleanText}`);

            if (seenHashes.has(contentHash)) continue;
            seenHashes.add(contentHash);

            documents.push({
              id: `gnews_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              sourceUrl: item.link,
              canonicalUrl: this.normalizer.canonicalizeUrl(item.link),
              title: item.title,
              publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
              rawText: rawSnippet,
              cleanText,
              sourceType: 'google_news',
              trustTier: 'aggregator',
              contentHash,
              fetchedAt: new Date().toISOString()
            });
          }
        } catch (error) {
          if (error instanceof FeedBlockedError) {
            blocked = true;
            logger.warn('Google News is rate-limiting this caller; abandoning its queries', { query });
            return;
          }
          // One failing query must never abort the scan.
          logger.warn('RSS query failed', { query, error: (error as Error).message });
        }
      },
      { concurrency: this.concurrency, deadlineAt }
    );

    logger.info('Google News scan complete', {
      queriesPlanned: queries.length,
      documents: documents.length,
      focusPlaces: focus?.placeNames?.length ?? 0,
      blocked
    });

    // Surface the block to the use case so it is reported rather than looking
    // like a source that simply found nothing.
    if (blocked && documents.length === 0) {
      throw new FeedBlockedError('https://news.google.com/rss/search');
    }

    return documents;
  }
}
