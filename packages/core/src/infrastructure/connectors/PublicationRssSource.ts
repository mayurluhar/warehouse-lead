import { getLogger } from '../../common/Logger';
import { SourceDocument, TrustTier } from '../../domains/lead/entities/SourceDocument';
import { IDocumentSource } from '../../domains/lead/ports/IDocumentSource';
import { DocumentNormalizer } from '../../domains/lead/services/DocumentNormalizer';
import { DEFAULT_PUBLICATION_FEEDS, PublicationFeed } from './publicationFeeds';
import { fetchFeed } from './rssFetch';

const logger = getLogger('PublicationRssSource');

export type { PublicationFeed } from './publicationFeeds';

/**
 * Where the feed list comes from.
 *
 * The list lives in code (publicationFeeds.ts) so a fresh clone scans without
 * setup and adding a publication is a reviewable diff. PUBLICATION_FEEDS still
 * overrides it entirely when set, which is what a deployment uses to swap
 * sources without a build.
 *
 * The env format is one feed per line (or semicolon-separated), `name | url |
 * tier`, with the trust tier optional and defaulting to reputable_media:
 *
 *   ET Industry | https://economictimes.indiatimes.com/.../13352306.cms | reputable_media
 *
 * A malformed entry is skipped with a warning rather than failing the scan, so
 * one typo cannot take every source down.
 */
const TRUST_TIERS: TrustTier[] = ['official', 'reputable_media', 'aggregator', 'unverified'];

export function parseFeedConfig(raw: string): PublicationFeed[] {
  return raw
    .split(/[\n;]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .flatMap((line) => {
      const [name, url, tier] = line.split('|').map((part) => part.trim());

      if (!name || !url || !/^https?:\/\//i.test(url)) {
        logger.warn('Skipping malformed feed entry in PUBLICATION_FEEDS', { entry: line });
        return [];
      }

      const trustTier = TRUST_TIERS.includes(tier as TrustTier)
        ? (tier as TrustTier)
        : 'reputable_media';

      return [{ name, url, trustTier }];
    });
}

function resolveFeeds(): PublicationFeed[] {
  const raw = process.env.PUBLICATION_FEEDS?.trim();
  if (!raw) return DEFAULT_PUBLICATION_FEEDS;

  const parsed = parseFeedConfig(raw);
  if (parsed.length === 0) {
    // Every line was malformed. Falling back beats scanning nothing, and the
    // warning names the real problem instead of reporting an empty news day.
    logger.warn('PUBLICATION_FEEDS is set but no entry parsed; using the built-in feed list');
    return DEFAULT_PUBLICATION_FEEDS;
  }
  return parsed;
}

/**
 * Terms that must appear for an item to be worth extracting.
 *
 * These feeds are general business news, so the overwhelming majority of items
 * are irrelevant. This is a cheap keyword gate applied before extraction, not a
 * relevance decision — that still belongs to the classifier. Its purpose is
 * cost: without it every scan would push hundreds of unrelated articles through
 * Bedrock at roughly a cent each.
 */
const RELEVANCE_KEYWORDS = [
  'warehouse', 'warehousing', 'godown', 'logistics', 'distribution centre',
  'distribution center', 'fulfilment', 'fulfillment', 'cold storage',
  'industrial park', 'logistics park', 'built-to-suit', 'built to suit',
  '3pl', 'supply chain', 'storage space', 'dark store', 'freight'
];

interface PublicationRssOptions {
  normalizer: DocumentNormalizer;
  feeds?: PublicationFeed[];
  /**
   * Items read per feed. Unset means every item the feed publishes, which is
   * the intended behaviour — see the note on fetchDocuments about why that is
   * still a bounded number.
   */
  maxItemsPerFeed?: number;
  /** Wall-clock ceiling for the whole pass, so one dead host cannot hang a scan. */
  timeBudgetMs?: number;
}

export class PublicationRssSource implements IDocumentSource {
  public readonly sourceName = 'publication_rss';

  private readonly normalizer: DocumentNormalizer;
  private readonly feeds: PublicationFeed[];
  private readonly maxItemsPerFeed: number;
  private readonly timeBudgetMs: number;

  constructor(options: PublicationRssOptions) {
    this.normalizer = options.normalizer;
    this.feeds = options.feeds ?? resolveFeeds();
    // 0 means no cap. Anything non-numeric in the env is treated the same way,
    // so a typo widens the scan rather than silently truncating it to zero items.
    const configuredCap = Number(process.env.RSS_MAX_ITEMS_PER_FEED);
    this.maxItemsPerFeed =
      options.maxItemsPerFeed ?? (Number.isFinite(configuredCap) && configuredCap > 0 ? configuredCap : 0);
    // Sequential fetching needs a far larger budget than the old concurrent
    // pass: ~22 feeds at up to 8s each. Still well inside the 300s Lambda.
    this.timeBudgetMs = options.timeBudgetMs ?? Number(process.env.RSS_TIME_BUDGET_MS ?? 120000);
  }

  private looksRelevant(text: string): boolean {
    const lower = text.toLowerCase();
    return RELEVANCE_KEYWORDS.some((keyword) => lower.includes(keyword));
  }

  /**
   * Reads every configured feed, one at a time.
   *
   * Sequential rather than concurrent so each feed is a discrete, attributable
   * step: the log names which publication produced what, a failure points at one
   * host, and no publisher sees six simultaneous requests from us — which is
   * what tends to trigger the soft blocks the fetcher already detects.
   *
   * Every item a feed publishes is read; there is no per-feed cap by default.
   * That is still a bounded number, and the bound is not ours: RSS serves a
   * rolling window of the latest items (typically 20-50), not an archive. No
   * setting on this side reaches yesterday's articles once they roll off — that
   * needs either repeated scans over time or a different kind of source.
   *
   * Geography is applied later by the radius filter; these feeds are national.
   */
  public async fetchDocuments(): Promise<SourceDocument[]> {
    // Surfaces as a failed source report rather than an empty-but-healthy scan,
    // so a missing configuration looks like a problem instead of a quiet news day.
    if (this.feeds.length === 0) {
      throw new Error(
        'No feeds configured. Set PUBLICATION_FEEDS ("name | url | tier" per line) — see .env.example.'
      );
    }

    const deadlineAt = Date.now() + this.timeBudgetMs;
    const seenHashes = new Set<string>();
    const documents: SourceDocument[] = [];
    let inspected = 0;
    let skipped = 0;

    for (const [index, feed] of this.feeds.entries()) {
      if (Date.now() > deadlineAt) {
        skipped = this.feeds.length - index;
        logger.warn('Publication time budget exhausted; remaining feeds skipped', {
          completed: index,
          skipped
        });
        break;
      }

      try {
        const parsed = await fetchFeed(feed.url);
        const items = parsed.items || [];
        const considered = this.maxItemsPerFeed > 0 ? items.slice(0, this.maxItemsPerFeed) : items;
        let keptFromFeed = 0;

        for (const item of considered) {
          if (!item.title || !item.link) continue;
          inspected++;

          const rawSnippet = `${item.contentSnippet || ''} ${item.content || ''}`;
          const combined = `${item.title} ${rawSnippet}`;
          if (!this.looksRelevant(combined)) continue;

          const cleanText = this.normalizer.cleanDocumentText(rawSnippet || item.title);
          const contentHash = this.normalizer.computeContentHash(`${item.title}\n${cleanText}`);
          if (seenHashes.has(contentHash)) continue;
          seenHashes.add(contentHash);

          documents.push({
            id: `pub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            sourceUrl: item.link,
            canonicalUrl: this.normalizer.canonicalizeUrl(item.link),
            title: item.title,
            publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
            rawText: rawSnippet,
            cleanText,
            sourceType: 'rss_feed',
            trustTier: feed.trustTier,
            contentHash,
            fetchedAt: new Date().toISOString()
          });
          keptFromFeed++;
        }

        // Per-feed accounting is the only way to tell "this publication carries
        // no warehousing news" from "this feed has been broken for weeks".
        logger.info('Feed read', {
          feed: feed.name,
          published: items.length,
          considered: considered.length,
          kept: keptFromFeed
        });
      } catch (error) {
        logger.warn('Publication feed failed', { feed: feed.name, error: (error as Error).message });
      }
    }

    logger.info('Publication scan complete', {
      feeds: this.feeds.length,
      feedsSkipped: skipped,
      itemsInspected: inspected,
      documentsKept: documents.length,
      itemCap: this.maxItemsPerFeed || 'none'
    });

    return documents;
  }
}
