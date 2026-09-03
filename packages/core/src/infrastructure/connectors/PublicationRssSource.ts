import { mapWithConcurrency } from '../../common/concurrency';
import { getLogger } from '../../common/Logger';
import { SourceDocument, TrustTier } from '../../domains/lead/entities/SourceDocument';
import { IDocumentSource } from '../../domains/lead/ports/IDocumentSource';
import { DocumentNormalizer } from '../../domains/lead/services/DocumentNormalizer';
import { fetchFeed } from './rssFetch';

const logger = getLogger('PublicationRssSource');

export interface PublicationFeed {
  name: string;
  url: string;
  trustTier: TrustTier;
}

/**
 * Feeds are configuration, not code.
 *
 * The list used to be a hardcoded array here, which meant adding a publication
 * or dropping a dead feed required a code change and a redeploy. It now comes
 * from PUBLICATION_FEEDS, so the set of sources is owned by the environment —
 * see .env.example for the format and a working starter list.
 *
 * Something has to name which feeds to fetch; there is no way to discover them
 * from nothing. What matters is that the name lives in configuration where an
 * operator can change it, rather than baked into a build artifact.
 *
 * Format is one feed per line (or semicolon-separated), `name | url | tier`,
 * with the trust tier optional and defaulting to reputable_media:
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

function feedsFromEnvironment(): PublicationFeed[] {
  const raw = process.env.PUBLICATION_FEEDS?.trim();
  if (!raw) {
    // Deliberately not a thrown error: a misconfigured deployment should show
    // "no feeds configured" in the source report, where an operator will see
    // it, rather than turning every scan into a 500.
    logger.warn('PUBLICATION_FEEDS is not set; the publication source has nothing to fetch');
    return [];
  }
  return parseFeedConfig(raw);
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
  maxItemsPerFeed?: number;
  concurrency?: number;
  timeBudgetMs?: number;
}

export class PublicationRssSource implements IDocumentSource {
  public readonly sourceName = 'publication_rss';

  private readonly normalizer: DocumentNormalizer;
  private readonly feeds: PublicationFeed[];
  private readonly maxItemsPerFeed: number;
  private readonly concurrency: number;
  private readonly timeBudgetMs: number;

  constructor(options: PublicationRssOptions) {
    this.normalizer = options.normalizer;
    this.feeds = options.feeds ?? feedsFromEnvironment();
    this.maxItemsPerFeed = options.maxItemsPerFeed ?? 25;
    this.concurrency = options.concurrency ?? 6;
    this.timeBudgetMs = options.timeBudgetMs ?? 25000;
  }

  private looksRelevant(text: string): boolean {
    const lower = text.toLowerCase();
    return RELEVANCE_KEYWORDS.some((keyword) => lower.includes(keyword));
  }

  /** Publication feeds are national; geography is applied by the radius filter. */
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

    await mapWithConcurrency(
      this.feeds,
      async (feed) => {
        try {
          const parsed = await fetchFeed(feed.url);

          for (const item of (parsed.items || []).slice(0, this.maxItemsPerFeed)) {
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
          }
        } catch (error) {
          logger.warn('Publication feed failed', { feed: feed.name, error: (error as Error).message });
        }
      },
      { concurrency: this.concurrency, deadlineAt }
    );

    logger.info('Publication scan complete', {
      feeds: this.feeds.length,
      itemsInspected: inspected,
      documentsKept: documents.length
    });

    return documents;
  }
}
