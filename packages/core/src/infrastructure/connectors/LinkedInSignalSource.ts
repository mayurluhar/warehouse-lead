import { getLogger } from '../../common/Logger';
import { ScanFocus } from '../../domains/lead/entities/Geo';
import { SourceDocument } from '../../domains/lead/entities/SourceDocument';
import { IDocumentSource } from '../../domains/lead/ports/IDocumentSource';
import { DocumentNormalizer } from '../../domains/lead/services/DocumentNormalizer';
import { SearchNotConfiguredError, WebSearchClient } from './webSearch';

const logger = getLogger('LinkedInSignalSource');

/**
 * Warehouse requirements posted publicly on LinkedIn.
 *
 * LinkedIn is where a lot of real occupier demand actually surfaces first — a
 * supply-chain head posting "we need 80,000 sq ft in Bhiwandi by March" reaches
 * the market before any tender does. It is also the hardest source to collect
 * from legitimately, and the design here is shaped entirely by that:
 *
 *   - LinkedIn publishes no API for searching posts. The Marketing and Sales
 *     Navigator APIs are partner-gated and do not expose post search at all.
 *   - Its own pages sit behind an authentication wall, and its User Agreement
 *     prohibits automated access to them. So this connector does not fetch
 *     linkedin.com directly, ever.
 *
 * What it does instead is ask a web-search provider for LinkedIn pages that are
 * *already publicly indexed*, restricted with a site: filter. That is the same
 * content any person gets from a search engine, obtained the way search engines
 * intend it to be obtained.
 *
 * The honest consequence: this sees a fraction of LinkedIn — public posts that
 * a search provider has crawled — and it will miss anything posted to a
 * restricted audience or too recently to be indexed. It complements the feed
 * connectors rather than replacing a human with a LinkedIn account.
 *
 * Everything reaching the pipeline from here is `unverified`, the lowest trust
 * tier, because a LinkedIn post is self-reported and unedited. Scoring already
 * discounts it accordingly.
 */

/** Requirement phrasings that occur in genuine occupier posts. */
const REQUIREMENT_TERMS = [
  'warehouse requirement',
  'warehouse space required',
  'godown required',
  'looking for warehouse',
  'warehouse on lease',
  'storage space required'
];

/** Only these paths carry substantive posts; the rest are profile noise. */
const LINKEDIN_SITE_FILTER = '(site:linkedin.com/posts OR site:linkedin.com/pulse)';

/** A snippet shorter than this carries no extractable requirement. */
const MIN_SNIPPET_LENGTH = 60;

interface LinkedInSourceOptions {
  normalizer: DocumentNormalizer;
  search: WebSearchClient;
  terms?: string[];
  /** Results requested per query. Providers bill per query, not per result. */
  resultsPerQuery?: number;
  /** Hard cap on queries per scan, so one scan cannot drain a free tier. */
  maxQueries?: number;
  /** Abandons remaining queries once exceeded, to protect the Lambda timeout. */
  timeBudgetMs?: number;
}

export class LinkedInSignalSource implements IDocumentSource {
  public readonly sourceName = 'linkedin_public';

  private readonly normalizer: DocumentNormalizer;
  private readonly search: WebSearchClient;
  private readonly terms: string[];
  private readonly resultsPerQuery: number;
  private readonly maxQueries: number;
  private readonly timeBudgetMs: number;

  constructor(options: LinkedInSourceOptions) {
    this.normalizer = options.normalizer;
    this.search = options.search;
    this.terms = options.terms ?? REQUIREMENT_TERMS;
    this.resultsPerQuery = options.resultsPerQuery ?? Number(process.env.LINKEDIN_RESULTS_PER_QUERY ?? 10);
    this.maxQueries = options.maxQueries ?? Number(process.env.LINKEDIN_MAX_QUERIES ?? 8);
    this.timeBudgetMs = options.timeBudgetMs ?? 20000;
  }

  /**
   * Pairs each requirement phrase with a place from the search area.
   *
   * Place-major ordering means the cap drops the most distant places rather
   * than an arbitrary slice — the places nearest the user's point keep their
   * full term coverage. Without a focus the terms run unqualified, which is a
   * far broader and much noisier search.
   */
  private buildQueries(focus?: ScanFocus): string[] {
    const places = focus?.placeNames ?? [];
    const queries: string[] = [];

    if (places.length === 0) {
      for (const term of this.terms) {
        queries.push(`${LINKEDIN_SITE_FILTER} "${term}"`);
      }
    } else {
      for (const place of places) {
        for (const term of this.terms) {
          queries.push(`${LINKEDIN_SITE_FILTER} "${term}" ${place}`);
        }
      }
    }

    return queries.slice(0, this.maxQueries);
  }

  public async fetchDocuments(focus?: ScanFocus): Promise<SourceDocument[]> {
    // Surfaces as a failed source report, so a missing key reads as a setup
    // problem rather than as "LinkedIn had nothing this week".
    if (!this.search.isConfigured) {
      throw new SearchNotConfiguredError(
        'LinkedIn search needs a web search provider. Set SEARCH_PROVIDER (serper or brave) and SEARCH_API_KEY — see .env.example.'
      );
    }

    const deadlineAt = Date.now() + this.timeBudgetMs;
    const queries = this.buildQueries(focus);
    const seenUrls = new Set<string>();
    const documents: SourceDocument[] = [];
    let executed = 0;

    // Serial, not concurrent: search providers meter by request and several
    // queries in flight is the quickest way to a 429 on a free tier.
    for (const query of queries) {
      if (Date.now() > deadlineAt) {
        logger.warn('LinkedIn search budget exhausted; skipping remaining queries', {
          executed,
          planned: queries.length
        });
        break;
      }

      try {
        const results = await this.search.search(query, this.resultsPerQuery);
        executed++;

        for (const result of results) {
          const canonicalUrl = this.normalizer.canonicalizeUrl(result.url);
          if (seenUrls.has(canonicalUrl)) continue;
          seenUrls.add(canonicalUrl);

          // The snippet is all the body text available — the page itself cannot
          // be fetched. Too short means nothing to extract from.
          const text = `${result.title}. ${result.snippet}`.trim();
          if (result.snippet.length < MIN_SNIPPET_LENGTH) continue;

          documents.push({
            id: `li_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            sourceUrl: result.url,
            canonicalUrl,
            title: result.title,
            // Providers rarely date LinkedIn results. Falling back to "now"
            // would fake a fresh signal and win the recency points that a
            // genuinely fresh source earns, so an unknown date stays unknown
            // and scoring handles it.
            publishedAt: result.publishedAt ?? '',
            rawText: text,
            cleanText: this.normalizer.cleanDocumentText(text),
            sourceType: 'linkedin',
            trustTier: 'unverified',
            contentHash: this.normalizer.computeContentHash(text),
            fetchedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        // One failed query should not lose the results already gathered.
        logger.warn('LinkedIn search query failed; continuing', {
          query,
          error: (error as Error).message
        });
      }
    }

    logger.info('LinkedIn discovery complete', {
      provider: this.search.providerName,
      queriesPlanned: queries.length,
      queriesExecuted: executed,
      documents: documents.length,
      places: focus?.placeNames ?? []
    });

    return documents;
  }
}
