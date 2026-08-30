import { SourceDocument } from '../entities/SourceDocument';
import { SourceType, TrustTier } from '../entities/SourceDocument';

/**
 * A connector that pulls a batch of documents from one public source.
 *
 * Implemented by the Google News RSS connector and the benchmark signal bank.
 * The master plan calls for connectors to be isolated adapters so a source can
 * be added, swapped or disabled without touching the intelligence pipeline —
 * this Port is that isolation boundary. Adding a CPPP/eProcure tender connector
 * means writing one more implementation and registering it at the Composition
 * Root; no use case changes.
 */
export interface IDocumentSource {
  /** Stable identifier used in logs and, later, the source registry. */
  readonly sourceName: string;

  fetchDocuments(): Promise<SourceDocument[]>;
}

/**
 * A connector that retrieves one specific document on demand, for analyst-
 * submitted URLs rather than scheduled collection.
 */
export interface IDocumentScraper {
  readonly sourceName: string;

  scrape(url: string, sourceType?: SourceType, trustTier?: TrustTier): Promise<SourceDocument>;
}
