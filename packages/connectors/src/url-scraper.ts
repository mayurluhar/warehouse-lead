import axios from 'axios';
import * as cheerio from 'cheerio';
import { RawDocument, SourceType, TrustTier, canonicalizeUrl, computeContentHash, cleanDocumentText } from '@warehouse-lead/core';

export class UrlScraperConnector {
  
  public async scrapeUrl(urlStr: string, sourceType: SourceType = 'manual_url', trustTier: TrustTier = 'unverified'): Promise<RawDocument> {
    const canonical = canonicalizeUrl(urlStr);
    
    const response = await axios.get(canonical, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 12000
    });

    const $ = cheerio.load(response.data);

    // Extract Title
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const twitterTitle = $('meta[name="twitter:title"]').attr('content');
    const docTitle = $('title').text();
    const h1Title = $('h1').first().text();
    const title = ogTitle || twitterTitle || h1Title || docTitle || 'Untitled Document';

    // Remove noise elements
    $('script, style, nav, footer, header, noscript, svg, iframe, form, .advertisement, .ads').remove();

    // Extract main text content
    let extractedText = '';
    const articleSelector = $('article, main, .article-body, .story-content, .entry-content, #content');
    if (articleSelector.length > 0) {
      extractedText = articleSelector.text();
    } else {
      extractedText = $('body').text();
    }

    const cleanText = cleanDocumentText(extractedText);
    const contentHash = computeContentHash(`${title}\n${cleanText}`);

    // Auto-detect reputable source
    let resolvedTrust = trustTier;
    try {
      const hostname = new URL(canonical).hostname.toLowerCase();
      if (hostname.includes('economictimes') || hostname.includes('livemint') || hostname.includes('business-standard') || hostname.includes('financialexpress')) {
        resolvedTrust = 'reputable_media';
      } else if (hostname.includes('gov.in') || hostname.includes('nic.in')) {
        resolvedTrust = 'official';
      }
    } catch {
      // ignore
    }

    return {
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sourceUrl: urlStr,
      canonicalUrl: canonical,
      title: title.trim(),
      publishedAt: new Date().toISOString(),
      rawText: extractedText.substring(0, 10000),
      cleanText: cleanText.substring(0, 8000),
      sourceType,
      trustTier: resolvedTrust,
      contentHash,
      fetchedAt: new Date().toISOString()
    };
  }
}
