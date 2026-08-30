import crypto from 'crypto';

/**
 * Normalization applied to every document before extraction, so that identical
 * content always produces an identical hash and URL regardless of which
 * connector collected it. Exact-duplicate detection depends on this being
 * deterministic.
 */
export class DocumentNormalizer {
  /** Strips tracking/marketing parameters and the fragment from a URL. */
  public canonicalizeUrl(urlStr: string): string {
    try {
      const url = new URL(urlStr);
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'msclkid', 'ref', 'source', 'token'
      ];
      trackingParams.forEach((param) => url.searchParams.delete(param));
      url.hash = '';
      return url.toString().replace(/\/$/, '');
    } catch {
      return urlStr.trim();
    }
  }

  /** SHA-256 over whitespace- and case-normalized content. */
  public computeContentHash(content: string): string {
    const normalized = content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /** Reduces raw HTML/text to readable plain text. */
  public cleanDocumentText(rawText: string): string {
    return rawText
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\r\n|\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }
}
