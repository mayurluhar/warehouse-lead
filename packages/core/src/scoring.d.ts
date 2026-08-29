import { ExtractedLeadData, RawDocument, ScoreBreakdown } from './types';
/**
 * Deterministic Explainable Lead Confidence Scoring Engine (0 - 100)
 * Evaluates 7 distinct business-rule components as defined in Section 6.1.
 */
export declare class LeadScoringEngine {
    calculateScore(extracted: ExtractedLeadData, primarySource: RawDocument, corroboratingSources?: RawDocument[]): ScoreBreakdown;
}
