/**
 * The models a user may select for extraction.
 *
 * A closed allowlist, not free text: the model ID arrives from the browser, and
 * accepting an arbitrary one would let a caller invoke any model the Lambda's
 * IAM role can reach — including far more expensive ones — or probe which
 * models the account has access to. The UI renders its options from this list
 * and the server validates against the same list, so the two cannot drift.
 *
 * IDs are bare foundation-model IDs. BedrockLeadExtractor adds the regional
 * inference-profile prefix (us./eu./apac.) automatically, so these stay
 * portable across regions.
 */
export interface ExtractionModel {
  id: string;
  label: string;
  /** Shown in the UI so the trade-off is visible at the point of choosing. */
  note: string;
}

export const EXTRACTION_MODELS: ExtractionModel[] = [
  {
    id: 'anthropic.claude-3-haiku-20240307-v1:0',
    label: 'Claude 3 Haiku',
    note: 'Default. Cheapest, highest quota, and the most widely enabled — but noticeably weaker at structured extraction, so expect more missed fields.'
  },
  {
    id: 'anthropic.claude-haiku-4-5-20251001-v1:0',
    label: 'Claude Haiku 4.5',
    note: 'Far stronger at structured extraction while staying in the Haiku price tier. Inference-profile only, which the extractor resolves automatically, and it must be enabled in your region.'
  }
];

export const DEFAULT_EXTRACTION_MODEL_ID = EXTRACTION_MODELS[0].id;

export function isSelectableModelId(modelId: string): boolean {
  return EXTRACTION_MODELS.some((model) => model.id === modelId);
}

export function findExtractionModel(modelId: string): ExtractionModel | undefined {
  return EXTRACTION_MODELS.find((model) => model.id === modelId);
}
