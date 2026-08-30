import { ExtractedLead } from '../entities/Lead';

/**
 * Turns document text into structured requirement fields.
 *
 * Deliberately says nothing about *how*. The Bedrock adapter and the rule-based
 * NLP adapter both satisfy it, which is what lets the Bedrock adapter accept
 * the heuristic one as an injected fallback rather than importing it directly —
 * and lets a test inject a stub with no AWS calls at all.
 *
 * Implementations must never invent unstated values; unknown fields are null.
 */
export interface ILeadExtractor {
  /** Identifies which extractor produced a result, recorded on the lead. */
  readonly extractorName: string;

  extract(title: string, text: string): Promise<ExtractedLead>;
}
