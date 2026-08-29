import Parser from 'rss-parser';
import { RawDocument, canonicalizeUrl, computeContentHash, cleanDocumentText } from '@warehouse-lead/core';

export class RssNewsConnector {
  private parser: Parser;

  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
  }

  public async fetchWarehouseFeeds(): Promise<RawDocument[]> {
    const queries = [
      'warehouse required Gujarat',
      'godown on lease Gujarat',
      'distribution centre expansion India',
      'cold storage requirement Ahmedabad',
      'logistics park land Gujarat Sanand',
      'built to suit warehouse India'
    ];

    const documents: RawDocument[] = [];
    const seenHashes = new Set<string>();

    for (const query of queries) {
      try {
        const encoded = encodeURIComponent(query);
        const rssUrl = `https://news.google.com/rss/search?q=${encoded}&hl=en-IN&gl=IN&ceid=IN:en`;
        
        const feed = await this.parser.parseURL(rssUrl);
        const items = (feed.items || []).slice(0, 5);

        for (const item of items) {
          if (!item.title || !item.link) continue;
          
          const rawSnippet = `${item.contentSnippet || ''} ${item.content || ''}`;
          const cleanText = cleanDocumentText(rawSnippet || item.title);
          const contentHash = computeContentHash(`${item.title}\n${cleanText}`);

          if (seenHashes.has(contentHash)) continue;
          seenHashes.add(contentHash);

          documents.push({
            id: `rss_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            sourceUrl: item.link,
            canonicalUrl: canonicalizeUrl(item.link),
            title: item.title,
            publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
            rawText: rawSnippet,
            cleanText: cleanText,
            sourceType: 'google_news',
            trustTier: 'reputable_media',
            contentHash,
            fetchedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.warn(`Failed fetching RSS query "${query}":`, (err as Error).message);
      }
    }

    return documents;
  }
}
