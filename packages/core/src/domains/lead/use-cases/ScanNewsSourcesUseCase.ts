import { RequestContext } from '../../../common/RequestContext';
import { UseCase } from '../../../common/UseCase';
import { getLogger } from '../../../common/Logger';
import { SourceDocument } from '../entities/SourceDocument';
import { IDocumentSource } from '../ports/IDocumentSource';
import { ILeadRepository } from '../ports/ILeadRepository';
import { LeadIngestionService } from '../services/LeadIngestionService';

const logger = getLogger('ScanNewsSourcesUseCase');

export interface ScanNewsSourcesOutput {
  scannedCount: number;
  relevantCount: number;
  discardedCount: number;
  newLeadsAdded: number;
  totalLeads: number;
}

/**
 * Sweeps every registered document source and ingests what they return.
 *
 * Takes a list of sources rather than one connector so that adding the tender
 * portals the master plan calls for is a registration change at the Composition
 * Root. A failing source is logged and skipped, never allowed to abort the
 * scan, per the reliability requirement that source failures stay isolated.
 */
export class ScanNewsSourcesUseCase extends UseCase<void, ScanNewsSourcesOutput> {
  private readonly documentSources: IDocumentSource[];
  private readonly ingestionService: LeadIngestionService;
  private readonly leadRepository: ILeadRepository;

  constructor(deps: {
    documentSources: IDocumentSource[];
    ingestionService: LeadIngestionService;
    leadRepository: ILeadRepository;
  }) {
    super();
    this.documentSources = deps.documentSources;
    this.ingestionService = deps.ingestionService;
    this.leadRepository = deps.leadRepository;
  }

  protected async handle(_input: void, context: RequestContext): Promise<ScanNewsSourcesOutput> {
    const documents: SourceDocument[] = [];

    for (const source of this.documentSources) {
      try {
        const fetched = await source.fetchDocuments();
        documents.push(...fetched);
        logger.info('Source scan succeeded', {
          tenantId: context.tenantId,
          source: source.sourceName,
          itemCount: fetched.length
        });
      } catch (error) {
        logger.error('Source scan failed; continuing with remaining sources', {
          tenantId: context.tenantId,
          source: source.sourceName,
          error: (error as Error).message
        });
      }
    }

    const summary = await this.ingestionService.ingestBatch(documents, context.tenantId);
    const totalLeads = (await this.leadRepository.findMany({}, context.tenantId)).length;

    return { ...summary, totalLeads };
  }
}
