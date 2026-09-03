import { isSelectableModelId } from '../entities/ExtractionModel';

/**
 * Rejects a model the allowlist does not contain.
 *
 * The ID arrives from the browser, so this is a trust boundary: without it a
 * caller could invoke any model the Lambda's IAM role can reach.
 */
export function assertSelectableModel(modelId?: string): void {
  if (modelId && !isSelectableModelId(modelId)) {
    throw new Error(`Validation failed: unsupported model "${modelId}"`);
  }
}
