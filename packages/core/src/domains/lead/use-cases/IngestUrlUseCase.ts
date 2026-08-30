import { RequestContext } from '../../../common/RequestContext';
import { UseCase } from '../../../common/UseCase';
import { Lead } from '../entities/Lead';
import { SourceDocument } from '../entities/SourceDocument';
import { IDocumentScraper } from '../ports/IDocumentSource';
import { IIngestionMetricsRepository } from '../ports/IIngestionMetricsRepository';
import { LeadIngestionService } from '../services/LeadIngestionService';

export interface IngestUrlInput {
  url: string;
}

export interface IngestUrlOutput {
  isRelevant: boolean;
  reason: string;
  lead: Lead | null;
  isNew: boolean;
  isCorroborated: boolean;
  /** Returned when the document was rejected, so a reviewer can inspect it. */
  document: SourceDocument;
}

/**
 * Ingests a single analyst-submitted URL — the manual discovery path in the
 * master plan's MVP source order.
 */
export class IngestUrlUseCase extends UseCase<IngestUrlInput, IngestUrlOutput> {
  private readonly scraper: IDocumentScraper;
  private readonly ingestionService: LeadIngestionService;
  private readonly metricsRepository: IIngestionMetricsRepository;

  constructor(deps: {
    scraper: IDocumentScraper;
    ingestionService: LeadIngestionService;
    metricsRepository: IIngestionMetricsRepository;
  }) {
    super();
    this.scraper = deps.scraper;
    this.ingestionService = deps.ingestionService;
    this.metricsRepository = deps.metricsRepository;
  }

  protected async handle(input: IngestUrlInput, context: RequestContext): Promise<IngestUrlOutput> {
    if (!input.url?.trim()) {
      throw new Error('Validation failed: url is required');
    }

    const document = await this.scraper.scrape(input.url);
    await this.metricsRepository.incrementScanned(1, context.tenantId);

    const outcome = await this.ingestionService.ingestDocument(document, context.tenantId);

    return { ...outcome, document };
  }
}
