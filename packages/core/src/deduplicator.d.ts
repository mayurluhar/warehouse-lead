import { ExtractedLeadData, LeadRecord, RawDocument } from './types';
export declare class LeadDeduplicator {
    private scoringEngine;
    constructor();
    processExtractedLead(extracted: ExtractedLeadData, doc: RawDocument, existingLeads: LeadRecord[]): {
        lead: LeadRecord;
        isNew: boolean;
        isCorroborated: boolean;
    };
}
