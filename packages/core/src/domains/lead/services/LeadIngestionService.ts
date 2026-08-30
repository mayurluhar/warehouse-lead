import { getLogger } from '../../../common/Logger';
import { Lead } from '../entities/Lead';
import { SourceDocument } from '../entities/SourceDocument';
import { ILeadExtractor } from '../ports/ILeadExtractor';
import { ILeadRepository } from '../ports/ILeadRepository';
import { IIngestionMetricsRepository } from '../ports/IIngestionMetricsRepository';
import { LeadDeduplicationService } from './LeadDeduplicationService';

const logger = getLogger('LeadIngestionService');

/** What happened to one document as it moved through the pipeline. */
export interface DocumentIngestionOutcome {
  isRelevant: boolean;
  /** The extractor's explanation, useful when a document was rejected. */
  reason: string;
  lead: Lead | null;
  isNew: boolean;
  isCorroborated: boolean;
}

/** Rollup for a batch of documents from a scheduled or bulk scan. */
export interface BatchIngestionSummary {
  scannedCount: number;
  relevantCount: number;
  discardedCount: number;
  newLeadsAdded: number;
}

/**
 * The extract → classify → deduplicate → score → persist pipeline that every
 * ingestion path shares, regardless of whether the document arrived from an RSS
 * scan, an analyst-submitted URL, pasted newsletter text or the benchmark bank.
 *
 * Consolidating it here is the main reason this restructure exists: the same
 * loop was previously copy-pasted four times inside the Lambda router, so a fix
 * to the pipeline had to be made in four places and could silently diverge.
 */
export class LeadIngestionService {
  private readonly extractor: ILeadExtractor;
  private readonly deduplicationService: LeadDeduplicationService;
  private readonly leadRepository: ILeadRepository;
  private readonly metricsRepository: IIngestionMetricsRepository;

  constructor(deps: {
    extractor: ILeadExtractor;
    deduplicationService: LeadDeduplicationService;
    leadRepository: ILeadRepository;
    metricsRepository: IIngestionMetricsRepository;
  }) {
    this.extractor = deps.extractor;
    this.deduplicationService = deps.deduplicationService;
    this.leadRepository = deps.leadRepository;
    this.metricsRepository = deps.metricsRepository;
  }

  /**
   * Runs one document through the pipeline. The caller is responsible for
   * having counted it as scanned.
   */
  public async ingestDocument(doc: SourceDocument, tenantId: string): Promise<DocumentIngestionOutcome> {
    const extracted = await this.extractor.extract(doc.title, doc.cleanText);

    if (!extracted.isRelevant) {
      await this.metricsRepository.incrementFalsePositives(1, tenantId);
      logger.debug('Document rejected as not a warehouse requirement', {
        tenantId,
        documentId: doc.id,
        sourceType: doc.sourceType
      });
      return {
        isRelevant: false,
        reason: extracted.reasoningSummary,
        lead: null,
        isNew: false,
        isCorroborated: false
      };
    }

    const existingLeads = await this.leadRepository.findMany({}, tenantId);
    const { lead, isNew, isCorroborated } = this.deduplicationService.reconcile(extracted, doc, existingLeads);

    await this.leadRepository.save(lead, tenantId);

    logger.debug('Document ingested', {
      tenantId,
      documentId: doc.id,
      leadId: lead.id,
      isNew,
      isCorroborated,
      confidence: lead.confidence
    });

    return { isRelevant: true, reason: extracted.reasoningSummary, lead, isNew, isCorroborated };
  }

  /**
   * Runs a batch through the pipeline sequentially.
   *
   * Sequential is deliberate, not an oversight: deduplication compares each
   * document against the leads already stored, so processing in parallel would
   * race and could create duplicate cards for the same requirement.
   */
  public async ingestBatch(documents: SourceDocument[], tenantId: string): Promise<BatchIngestionSummary> {
    await this.metricsRepository.incrementScanned(documents.length, tenantId);

    let relevantCount = 0;
    let discardedCount = 0;
    let newLeadsAdded = 0;

    for (const doc of documents) {
      const outcome = await this.ingestDocument(doc, tenantId);
      if (!outcome.isRelevant) {
        discardedCount++;
        continue;
      }
      relevantCount++;
      if (outcome.isNew) newLeadsAdded++;
    }

    logger.info('Batch ingestion complete', {
      tenantId,
      scannedCount: documents.length,
      relevantCount,
      discardedCount,
      newLeadsAdded
    });

    return { scannedCount: documents.length, relevantCount, discardedCount, newLeadsAdded };
  }
}
