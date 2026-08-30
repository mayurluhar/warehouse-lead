import axios from 'axios';
import * as cheerio from 'cheerio';
import { SourceDocument, SourceType, TrustTier } from '../../domains/lead/entities/SourceDocument';
import { IDocumentScraper } from '../../domains/lead/ports/IDocumentSource';
import { DocumentNormalizer } from '../../domains/lead/services/DocumentNormalizer';

const MAX_RAW_TEXT = 10000;
const MAX_CLEAN_TEXT = 8000;

/** Hostname fragments that imply a trust tier higher than "unverified". */
const REPUTABLE_MEDIA_HOSTS = ['economictimes', 'livemint', 'business-standard', 'financialexpress'];
const OFFICIAL_HOSTS = ['gov.in', 'nic.in'];

/**
 * Fetches and extracts readable article text from a single URL.
 *
 * Trust tier is inferred from the hostname rather than trusted from the caller,
 * because source trust feeds the confidence score and an analyst pasting a link
 * should not be able to inflate it by accident.
 */
export class UrlScraperSource implements IDocumentScraper {
  public readonly sourceName = 'manual_url_scraper';

  private readonly normalizer: DocumentNormalizer;

  constructor(deps: { normalizer: DocumentNormalizer }) {
    this.normalizer = deps.normalizer;
  }

  public async scrape(
    urlStr: string,
    sourceType: SourceType = 'manual_url',
    trustTier: TrustTier = 'unverified'
  ): Promise<SourceDocument> {
    const canonical = this.normalizer.canonicalizeUrl(urlStr);

    const response = await axios.get(canonical, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 12000
    });

    const $ = cheerio.load(response.data);

    const ogTitle = $('meta[property="og:title"]').attr('content');
    const twitterTitle = $('meta[name="twitter:title"]').attr('content');
    const docTitle = $('title').text();
    const h1Title = $('h1').first().text();
    const title = ogTitle || twitterTitle || h1Title || docTitle || 'Untitled Document';

    $('script, style, nav, footer, header, noscript, svg, iframe, form, .advertisement, .ads').remove();

    // Prefer the article container; fall back to the whole body.
    let extractedText = '';
    const articleSelector = $('article, main, .article-body, .story-content, .entry-content, #content');
    extractedText = articleSelector.length > 0 ? articleSelector.text() : $('body').text();

    const cleanText = this.normalizer.cleanDocumentText(extractedText);
    const contentHash = this.normalizer.computeContentHash(`${title}\n${cleanText}`);

    return {
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sourceUrl: urlStr,
      canonicalUrl: canonical,
      title: title.trim(),
      publishedAt: new Date().toISOString(),
      rawText: extractedText.substring(0, MAX_RAW_TEXT),
      cleanText: cleanText.substring(0, MAX_CLEAN_TEXT),
      sourceType,
      trustTier: this.resolveTrustTier(canonical, trustTier),
      contentHash,
      fetchedAt: new Date().toISOString()
    };
  }

  private resolveTrustTier(canonicalUrl: string, fallback: TrustTier): TrustTier {
    try {
      const hostname = new URL(canonicalUrl).hostname.toLowerCase();
      if (REPUTABLE_MEDIA_HOSTS.some((h) => hostname.includes(h))) return 'reputable_media';
      if (OFFICIAL_HOSTS.some((h) => hostname.includes(h))) return 'official';
    } catch {
      // Unparseable URL keeps the caller's tier.
    }
    return fallback;
  }
}
