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

/** Per-call extraction settings. */
export interface ExtractionOptions {
  /**
   * Model to use for this call, overriding the configured default. Must be one
   * of EXTRACTION_MODELS — callers validate before reaching here. Extractors
   * that do not use a model ignore it.
   */
  modelId?: string;
}

export interface ILeadExtractor {
  /** Identifies which extractor produced a result, recorded on the lead. */
  readonly extractorName: string;

  extract(title: string, text: string, options?: ExtractionOptions): Promise<ExtractedLead>;
}
