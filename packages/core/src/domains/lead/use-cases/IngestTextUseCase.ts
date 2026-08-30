import { RequestContext } from '../../../common/RequestContext';
import { UseCase } from '../../../common/UseCase';
import { Lead } from '../entities/Lead';
import { SourceDocument, SourceType, TrustTier } from '../entities/SourceDocument';
import { IIngestionMetricsRepository } from '../ports/IIngestionMetricsRepository';
import { LeadIngestionService } from '../services/LeadIngestionService';

export interface IngestTextInput {
  text: string;
  title?: string;
  sourceUrl?: string;
  sourceType?: SourceType;
  trustTier?: TrustTier;
}

export interface IngestTextOutput {
  isRelevant: boolean;
  reason: string;
  lead: Lead | null;
  isNew: boolean;
  isCorroborated: boolean;
}

/**
 * Ingests raw pasted text — a forwarded trade newsletter or an analyst's notes,
 * covering requirements that never get a public URL.
 */
export class IngestTextUseCase extends UseCase<IngestTextInput, IngestTextOutput> {
  private readonly ingestionService: LeadIngestionService;
  private readonly metricsRepository: IIngestionMetricsRepository;

  constructor(deps: {
    ingestionService: LeadIngestionService;
    metricsRepository: IIngestionMetricsRepository;
  }) {
    super();
    this.ingestionService = deps.ingestionService;
    this.metricsRepository = deps.metricsRepository;
  }

  protected async handle(input: IngestTextInput, context: RequestContext): Promise<IngestTextOutput> {
    if (!input.text?.trim()) {
      throw new Error('Validation failed: text is required');
    }

    const now = new Date().toISOString();
    const title = input.title || 'Direct Ingestion Signal';

    const document: SourceDocument = {
      id: `raw_${Date.now()}`,
      sourceUrl: input.sourceUrl || 'direct_input',
      canonicalUrl: input.sourceUrl || `direct_input://${Date.now()}`,
      title,
      publishedAt: now,
      rawText: input.text,
      cleanText: input.text,
      sourceType: input.sourceType || 'manual_text',
      trustTier: input.trustTier || 'unverified',
      // TODO: this is a timestamp placeholder, not a content hash, carried over
      // unchanged from the previous implementation. It makes every pasted
      // document unique, so exact-duplicate detection never fires on this path
      // and pasting the same newsletter twice creates two leads. Replacing it
      // with DocumentNormalizer.computeContentHash is a behaviour change, so it
      // was left for a separate fix rather than folded into this restructure.
      contentHash: `hash_${Date.now()}`,
      fetchedAt: now
    };

    await this.metricsRepository.incrementScanned(1, context.tenantId);

    return this.ingestionService.ingestDocument(document, context.tenantId);
  }
}
