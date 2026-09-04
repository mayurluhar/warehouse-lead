import { RequestContext } from '../../../common/RequestContext';
import { UseCase } from '../../../common/UseCase';
import { GeoRadius } from '../entities/Geo';
import { Lead } from '../entities/Lead';
import { SourceDocument } from '../entities/SourceDocument';
import { LeadIngestionService } from '../services/LeadIngestionService';
import { assertSelectableModel } from './assertSelectableModel';

export interface IngestDocumentInput {
  document: SourceDocument;
  /** Overrides the default extraction model; must be on the allowlist. */
  modelId?: string;
  /** The area the caller searched; scoring ranks by distance from it. */
  near?: GeoRadius;
  /**
   * Reviewer override: qualify this document even if the classifier rejects it.
   * Set only by the "approve" action on the unqualified list.
   */
  forceRelevant?: boolean;
}

export interface IngestDocumentOutput {
  isRelevant: boolean;
  reason: string;
  lead: Lead | null;
  isNew: boolean;
  isCorroborated: boolean;
  /** Set when a degraded fallback extractor produced this result. */
  extractionFallbackReason?: string;
}

/**
 * Runs exactly one already-discovered document through the pipeline.
 *
 * This is the unit the caller drives a scan with: discover once, then call this
 * per document. One AI call per HTTP request keeps every request well inside
 * the Lambda timeout, paces Bedrock naturally by the round-trip, and confines
 * a throttle to a single document instead of failing an entire scan.
 */
export class IngestDocumentUseCase extends UseCase<IngestDocumentInput, IngestDocumentOutput> {
  private readonly ingestionService: LeadIngestionService;

  constructor(deps: { ingestionService: LeadIngestionService }) {
    super();
    this.ingestionService = deps.ingestionService;
  }

  protected async handle(input: IngestDocumentInput, context: RequestContext): Promise<IngestDocumentOutput> {
    const document = input?.document;

    if (!document?.contentHash || !document?.title) {
      throw new Error('Validation failed: a document with a title and contentHash is required');
    }

    assertSelectableModel(input.modelId);

    return this.ingestionService.ingestDocument(document, context.tenantId, {
      modelId: input.modelId,
      searchCentre: input.near,
      forceRelevant: input.forceRelevant === true
    });
  }
}
