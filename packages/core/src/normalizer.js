import crypto from 'crypto';
/**
 * Canonicalizes a URL by removing common tracking/marketing parameters
 */
export function canonicalizeUrl(urlStr) {
    try {
        const url = new URL(urlStr);
        const trackingParams = [
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'fbclid', 'gclid', 'msclkid', 'ref', 'source', 'token'
        ];
        trackingParams.forEach((param) => url.searchParams.delete(param));
        url.hash = '';
        return url.toString().replace(/\/$/, '');
    }
    catch {
        return urlStr.trim();
    }
}
/**
 * Computes a SHA-256 hash of the normalized content string
 */
export function computeContentHash(content) {
    const normalized = content
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    return crypto.createHash('sha256').update(normalized).digest('hex');
}
/**
 * Cleans raw extracted HTML/text into normalized readable text
 */
export function cleanDocumentText(rawText) {
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
