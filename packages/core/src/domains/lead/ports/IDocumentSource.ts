import { ScanFocus } from '../entities/Geo';
import { SourceDocument, SourceType, TrustTier } from '../entities/SourceDocument';

/**
 * A connector that pulls a batch of documents from one public source.
 *
 * Implemented by the news connectors and the benchmark signal bank. The master
 * plan calls for connectors to be isolated adapters so a source can be added,
 * swapped or disabled without touching the intelligence pipeline — this Port is
 * that isolation boundary. Adding a CPPP/eProcure tender connector means writing
 * one more implementation and registering it at the Composition Root.
 *
 * `focus` is optional and advisory. Keyword-driven sources use the nearby place
 * names to target their queries at the user's area of interest; sources that
 * cannot target geographically (a fixed publication feed, the sample bank)
 * ignore it and return everything, letting the radius filter do the work.
 */
export interface IDocumentSource {
  /** Stable identifier used in logs and, later, the source registry. */
  readonly sourceName: string;

  fetchDocuments(focus?: ScanFocus): Promise<SourceDocument[]>;
}

/**
 * A connector that retrieves one specific document on demand, for analyst-
 * submitted URLs rather than scheduled collection.
 */
export interface IDocumentScraper {
  readonly sourceName: string;

  scrape(url: string, sourceType?: SourceType, trustTier?: TrustTier): Promise<SourceDocument>;
}
