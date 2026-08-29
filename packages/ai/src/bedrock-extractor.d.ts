import { ExtractedLeadData } from '@warehouse-lead/core';
export declare class BedrockLeadExtractor {
    private client;
    private modelId;
    private region;
    constructor();
    extract(title: string, text: string): Promise<ExtractedLeadData>;
    private extractWithBedrockConverse;
}
