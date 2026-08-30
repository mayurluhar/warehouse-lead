import {
  BedrockLeadExtractor,
  DocumentNormalizer,
  HeuristicLeadExtractor,
  ILeadExtractor,
  InMemoryIngestionMetricsRepository,
  InMemoryLeadRepository,
  IngestSampleSignalsUseCase,
  IngestTextUseCase,
  IngestUrlUseCase,
  Lead,
  LeadDeduplicationService,
  LeadIngestionService,
  LeadQueryService,
  LeadScoringService,
  ListLeadsUseCase,
  RssNewsSource,
  SampleSignalBank,
  ScanNewsSourcesUseCase,
  UrlScraperSource
} from '@warehouse-lead/core';

/**
 * The Composition Root.
 *
 * The only place in the codebase that names a concrete repository, connector or
 * extractor. Everything upstream depends on Ports, so introducing a real
 * datastore later is an edit here and nowhere else.
 *
 * Two scopes, deliberately:
 *
 *   - Stateless singletons (extractor, connectors, pure services) are built
 *     once per Lambda container and reused across invocations. Constructing the
 *     Bedrock client per request would add latency for no benefit.
 *
 *   - Repositories are built per request and seeded with the leads the client
 *     sent. The API stores nothing between calls; the React desk owns the state.
 *     This is what makes a browser refresh reset the POC, and it also removes
 *     the multi-container inconsistency that server-held memory would cause
 *     once the function is deployed and Lambda runs several containers.
 */

const normalizer = new DocumentNormalizer();
const scoringService = new LeadScoringService();
const queryService = new LeadQueryService();
const deduplicationService = new LeadDeduplicationService({ scoringService });

const extractor: ILeadExtractor = new BedrockLeadExtractor({
  fallback: new HeuristicLeadExtractor()
});

const rssNewsSource = new RssNewsSource({ normalizer });
const sampleSource = new SampleSignalBank({ normalizer });
const scraper = new UrlScraperSource({ normalizer });

/** The scheduled-scan source registry. Tender-portal connectors get added here. */
const documentSources = [rssNewsSource];

export interface RequestContainer {
  scanNewsSources: ScanNewsSourcesUseCase;
  ingestUrl: IngestUrlUseCase;
  ingestText: IngestTextUseCase;
  ingestSampleSignals: IngestSampleSignalsUseCase;
  listLeads: ListLeadsUseCase;
}

/**
 * Builds the per-request object graph.
 *
 * @param seedLeads Leads the client already holds, so deduplication and
 *                  corroboration still work across separate ingestion calls
 *                  even though the server remembers nothing.
 * @param tenantId  Tenant the seeded leads belong to.
 */
export function createRequestContainer(seedLeads: Lead[], tenantId: string): RequestContainer {
  const leadRepository = new InMemoryLeadRepository({ queryService });
  leadRepository.seed(seedLeads, tenantId);

  const metricsRepository = new InMemoryIngestionMetricsRepository();

  const ingestionService = new LeadIngestionService({
    extractor,
    deduplicationService,
    leadRepository,
    metricsRepository
  });

  return {
    scanNewsSources: new ScanNewsSourcesUseCase({ documentSources, ingestionService, leadRepository }),
    ingestUrl: new IngestUrlUseCase({ scraper, ingestionService, metricsRepository }),
    ingestText: new IngestTextUseCase({ ingestionService, metricsRepository }),
    ingestSampleSignals: new IngestSampleSignalsUseCase({ sampleSource, ingestionService, leadRepository }),
    listLeads: new ListLeadsUseCase({ leadRepository })
  };
}
