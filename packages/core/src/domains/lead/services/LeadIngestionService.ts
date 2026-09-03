import { getLogger } from '../../../common/Logger';
import { GeoRadius } from '../entities/Geo';
import { Lead } from '../entities/Lead';
import { SourceDocument } from '../entities/SourceDocument';
import { IGazetteer } from '../ports/IGazetteer';
import { ExtractionOptions, ILeadExtractor } from '../ports/ILeadExtractor';
import { ILeadRepository } from '../ports/ILeadRepository';
import { IIngestionMetricsRepository } from '../ports/IIngestionMetricsRepository';
import { LeadDeduplicationService } from './LeadDeduplicationService';

const logger = getLogger('LeadIngestionService');

/** What happened to one document as it moved through the pipeline. */
/**
 * Per-ingestion settings. Extends the extractor's options rather than
 * duplicating them, so a caller passes one object down the whole pipeline.
 */
export interface IngestionOptions extends ExtractionOptions {
  /**
   * The area the caller searched. Scoring measures location relevance against
   * it, so results are ranked by proximity to what was actually asked for
   * rather than to a geography baked into the code.
   */
  searchCentre?: GeoRadius;
}

export interface DocumentIngestionOutcome {
  isRelevant: boolean;
  /** The extractor's explanation, useful when a document was rejected. */
  reason: string;
  lead: Lead | null;
  isNew: boolean;
  isCorroborated: boolean;
  /** Set when this document was extracted by a degraded fallback path. */
  extractionFallbackReason?: string;
}

/**
 * Why extraction ran at reduced quality, if it did.
 *
 * Surfaced all the way to the UI: a scan that quietly fell back to rule-based
 * extraction produces markedly worse leads, and a user comparing results across
 * runs deserves to know that rather than concluding the product is inconsistent.
 */
export interface ExtractionHealth {
  degraded: boolean;
  /** Documents that fell back, out of those the extractor processed. */
  fallbackCount: number;
  processedCount: number;
  reason?: string;
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
  private readonly gazetteer: IGazetteer;

  constructor(deps: {
    extractor: ILeadExtractor;
    deduplicationService: LeadDeduplicationService;
    leadRepository: ILeadRepository;
    metricsRepository: IIngestionMetricsRepository;
    gazetteer: IGazetteer;
  }) {
    this.extractor = deps.extractor;
    this.deduplicationService = deps.deduplicationService;
    this.leadRepository = deps.leadRepository;
    this.metricsRepository = deps.metricsRepository;
    this.gazetteer = deps.gazetteer;
  }

  /**
   * Runs one document through the pipeline. The caller is responsible for
   * having counted it as scanned.
   */
  public async ingestDocument(
    doc: SourceDocument,
    tenantId: string,
    options?: IngestionOptions
  ): Promise<DocumentIngestionOutcome> {
    const extracted = await this.extractor.extract(doc.title, doc.cleanText, options);
    const extractionFallbackReason = extracted.extractionFallback?.reason;

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
        isCorroborated: false,
        extractionFallbackReason
      };
    }

    // Attach coordinates to the named place so the lead can be found by radius.
    // Left null when the gazetteer does not know the place — never guessed.
    const point = await this.gazetteer.resolve(extracted.location);
    extracted.location = {
      ...extracted.location,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null
    };

    const existingLeads = await this.leadRepository.findMany({}, tenantId);
    const { lead, isNew, isCorroborated } = this.deduplicationService.reconcile(
      extracted,
      doc,
      existingLeads,
      options?.searchCentre
    );

    await this.leadRepository.save(lead, tenantId);

    logger.debug('Document ingested', {
      tenantId,
      documentId: doc.id,
      leadId: lead.id,
      isNew,
      isCorroborated,
      confidence: lead.confidence
    });

    return { isRelevant: true, reason: extracted.reasoningSummary, lead, isNew, isCorroborated, extractionFallbackReason };
  }

}
