import { RawDocument, SourceType, TrustTier } from '@warehouse-lead/core';
export declare class UrlScraperConnector {
    scrapeUrl(urlStr: string, sourceType?: SourceType, trustTier?: TrustTier): Promise<RawDocument>;
}
