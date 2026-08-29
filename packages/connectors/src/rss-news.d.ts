import { RawDocument } from '@warehouse-lead/core';
export declare class RssNewsConnector {
    private parser;
    constructor();
    fetchWarehouseFeeds(): Promise<RawDocument[]>;
}
