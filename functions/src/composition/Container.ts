import {
  BedrockLeadExtractor,
  DocumentNormalizer,
  GeoService,
  DiscoverDocumentsUseCase,
  GoogleNewsRssSource,
  HeuristicLeadExtractor,
  ILeadExtractor,
  NominatimGazetteer,
  InMemoryIngestionMetricsRepository,
  InMemoryLeadRepository,
  IngestDocumentUseCase,
  IngestTextUseCase,
  IngestUrlUseCase,
  Lead,
  LeadDeduplicationService,
  LeadIngestionService,
  LeadQueryService,
  LeadScoringService,
  ListLeadsUseCase,
  PublicationRssSource,
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
const queryService = new LeadQueryService();
const geoService = new GeoService();
const scoringService = new LeadScoringService({ geoService });
const deduplicationService = new LeadDeduplicationService({ scoringService });

// Live geocoding: no place names or coordinates are held in the codebase.
// Swapping in a commercial geocoder means replacing this one line with another
// IGazetteer implementation.
const gazetteer = new NominatimGazetteer({ geoService });

const extractor: ILeadExtractor = new BedrockLeadExtractor({
  fallback: new HeuristicLeadExtractor()
});

const googleNewsSource = new GoogleNewsRssSource({ normalizer });
const publicationSource = new PublicationRssSource({ normalizer });
const scraper = new UrlScraperSource({ normalizer });

/**
 * The scheduled-scan source registry. Tender-portal connectors (CPPP/eProcure,
 * Gujarat state portals) get added here — the pipeline needs no other change.
 *
 * Publication feeds are the primary source because they carry direct publisher
 * article URLs, which is what makes a lead's evidence openable.
 *
 * Google News is opt-in via ENABLE_GOOGLE_NEWS=true. It is off by default
 * because its links are news.google.com redirects that frequently serve an
 * anti-bot interstitial instead of the article, and because issuing search
 * queries at scan volume gets the caller rate-limited. See GoogleNewsRssSource.
 */
const documentSources = [
  publicationSource,
  ...(process.env.ENABLE_GOOGLE_NEWS === 'true' ? [googleNewsSource] : [])
];

/**
 * Free-text place lookup for the UI's location picker.
 *
 * Exported directly rather than as a use case because it neither reads nor
 * writes lead state, so it needs none of the per-request object graph. It is
 * proxied through the API rather than called from the browser so that the
 * geocoder's rate limit and User-Agent stay under server control.
 */
export function searchPlaces(query: string, limit?: number) {
  return gazetteer.search(query, limit);
}

export interface RequestContainer {
  /** Fetches the document list from the live sources — no extraction. */
  discoverLive: DiscoverDocumentsUseCase;
  /** Processes exactly one already-discovered document. */
  ingestDocument: IngestDocumentUseCase;
  ingestUrl: IngestUrlUseCase;
  ingestText: IngestTextUseCase;
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
    metricsRepository,
    gazetteer
  });

  return {
    discoverLive: new DiscoverDocumentsUseCase({ documentSources, gazetteer }),
    ingestDocument: new IngestDocumentUseCase({ ingestionService }),
    ingestUrl: new IngestUrlUseCase({ scraper, ingestionService, metricsRepository }),
    ingestText: new IngestTextUseCase({ ingestionService, metricsRepository }),
    listLeads: new ListLeadsUseCase({ leadRepository })
  };
}
