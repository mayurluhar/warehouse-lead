/**
 * Canonicalizes a URL by removing common tracking/marketing parameters
 */
export declare function canonicalizeUrl(urlStr: string): string;
/**
 * Computes a SHA-256 hash of the normalized content string
 */
export declare function computeContentHash(content: string): string;
/**
 * Cleans raw extracted HTML/text into normalized readable text
 */
export declare function cleanDocumentText(rawText: string): string;
