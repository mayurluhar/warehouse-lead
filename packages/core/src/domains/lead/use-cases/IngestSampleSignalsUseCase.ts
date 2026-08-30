import { RequestContext } from '../../../common/RequestContext';
import { UseCase } from '../../../common/UseCase';
import { Lead } from '../entities/Lead';
import { IDocumentSource } from '../ports/IDocumentSource';
import { ILeadRepository } from '../ports/ILeadRepository';
import { LeadIngestionService } from '../services/LeadIngestionService';

export interface IngestSampleSignalsOutput {
  scannedCount: number;
  relevantCount: number;
  discardedCount: number;
  newLeadsAdded: number;
  leads: Lead[];
}

/**
 * Ingests the curated benchmark signal bank.
 *
 * The bank deliberately includes a document that is *not* a warehouse
 * requirement, so a run exercises the relevance classifier's rejection path as
 * well as extraction, scoring and deduplication.
 */
export class IngestSampleSignalsUseCase extends UseCase<void, IngestSampleSignalsOutput> {
  private readonly sampleSource: IDocumentSource;
  private readonly ingestionService: LeadIngestionService;
  private readonly leadRepository: ILeadRepository;

  constructor(deps: {
    sampleSource: IDocumentSource;
    ingestionService: LeadIngestionService;
    leadRepository: ILeadRepository;
  }) {
    super();
    this.sampleSource = deps.sampleSource;
    this.ingestionService = deps.ingestionService;
    this.leadRepository = deps.leadRepository;
  }

  protected async handle(_input: void, context: RequestContext): Promise<IngestSampleSignalsOutput> {
    const documents = await this.sampleSource.fetchDocuments();
    const summary = await this.ingestionService.ingestBatch(documents, context.tenantId);
    const leads = await this.leadRepository.findMany({}, context.tenantId);

    return { ...summary, leads };
  }
}
