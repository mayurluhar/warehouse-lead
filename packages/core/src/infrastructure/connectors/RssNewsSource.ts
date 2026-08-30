import Parser from 'rss-parser';
import { getLogger } from '../../common/Logger';
import { SourceDocument } from '../../domains/lead/entities/SourceDocument';
import { IDocumentSource } from '../../domains/lead/ports/IDocumentSource';
import { DocumentNormalizer } from '../../domains/lead/services/DocumentNormalizer';

const logger = getLogger('RssNewsSource');

/** The default warehouse-requirement query vocabulary from the master plan. */
const DEFAULT_QUERIES = [
  'warehouse required Gujarat',
  'godown on lease Gujarat',
  'distribution centre expansion India',
  'cold storage requirement Ahmedabad',
  'logistics park land Gujarat Sanand',
  'built to suit warehouse India'
];

const MAX_ITEMS_PER_QUERY = 5;

/**
 * Google News RSS connector.
 *
 * Queries are constructor-injected so the search vocabulary becomes
 * configuration rather than a hardcoded list — the master plan wants keyword
 * rules editable per geography and requirement type without a redeploy.
 */
export class RssNewsSource implements IDocumentSource {
  public readonly sourceName = 'google_news_rss';

  private readonly parser: Parser;
  private readonly normalizer: DocumentNormalizer;
  private readonly queries: string[];

  constructor(deps: { normalizer: DocumentNormalizer; queries?: string[] }) {
    this.normalizer = deps.normalizer;
    this.queries = deps.queries ?? DEFAULT_QUERIES;
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
  }

  public async fetchDocuments(): Promise<SourceDocument[]> {
    const documents: SourceDocument[] = [];
    // Deduplicates within a single scan, since one article commonly matches
    // several of the queries.
    const seenHashes = new Set<string>();

    for (const query of this.queries) {
      try {
        const encoded = encodeURIComponent(query);
        const rssUrl = `https://news.google.com/rss/search?q=${encoded}&hl=en-IN&gl=IN&ceid=IN:en`;

        const feed = await this.parser.parseURL(rssUrl);
        const items = (feed.items || []).slice(0, MAX_ITEMS_PER_QUERY);

        for (const item of items) {
          if (!item.title || !item.link) continue;

          const rawSnippet = `${item.contentSnippet || ''} ${item.content || ''}`;
          const cleanText = this.normalizer.cleanDocumentText(rawSnippet || item.title);
          const contentHash = this.normalizer.computeContentHash(`${item.title}\n${cleanText}`);

          if (seenHashes.has(contentHash)) continue;
          seenHashes.add(contentHash);

          documents.push({
            id: `rss_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            sourceUrl: item.link,
            canonicalUrl: this.normalizer.canonicalizeUrl(item.link),
            title: item.title,
            publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
            rawText: rawSnippet,
            cleanText,
            sourceType: 'google_news',
            trustTier: 'reputable_media',
            contentHash,
            fetchedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        // One failing query must not abort the scan.
        logger.warn('RSS query failed', { query, error: (error as Error).message });
      }
    }

    return documents;
  }
}
