/**
 * A single piece of collected public evidence — a news item, a scraped page, a
 * tender notice, a forwarded newsletter — normalized into one shape before any
 * extraction happens.
 *
 * Every lead retains the documents it was built from, because the product rule
 * is that a lead must always be traceable back to its original source.
 */

export type SourceType =
  | 'google_news'
  | 'rss_feed'
  | 'tender_portal'
  | 'manual_url'
  | 'manual_text'
  | 'trade_newsletter'
  | 'linkedin';

/** How much the scoring engine is willing to believe a source. */
export type TrustTier = 'official' | 'reputable_media' | 'aggregator' | 'unverified';

export interface SourceDocument {
  id: string;
  sourceUrl: string;
  /** Tracking parameters stripped; used for exact-duplicate detection. */
  canonicalUrl: string;
  title: string;
  publishedAt: string;
  rawText: string;
  cleanText: string;
  sourceType: SourceType;
  trustTier: TrustTier;
  /** SHA-256 of the normalized content; the other exact-duplicate key. */
  contentHash: string;
  fetchedAt: string;
}
