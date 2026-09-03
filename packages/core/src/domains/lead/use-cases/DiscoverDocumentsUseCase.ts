import { RequestContext } from '../../../common/RequestContext';
import { UseCase } from '../../../common/UseCase';
import { getLogger } from '../../../common/Logger';
import { GeoRadius, ScanFocus, isValidLatitude, isValidLongitude } from '../entities/Geo';
import { SourceDocument } from '../entities/SourceDocument';
import { IDocumentSource } from '../ports/IDocumentSource';
import { IGazetteer } from '../ports/IGazetteer';

const logger = getLogger('DiscoverDocumentsUseCase');

/** Guardrails on the radius so a request cannot ask for the whole planet. */
const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 2000;

/** Beyond this the query cross-product stops adding reach and just adds latency. */
const MAX_FOCUS_PLACES = 6;

/** Per-source outcome, so a failing source is visible instead of silent. */
export interface SourceReport {
  source: string;
  status: 'ok' | 'blocked' | 'failed';
  itemCount: number;
  message?: string;
}

export interface DiscoverDocumentsInput {
  /** Optional area of interest. Without it the scan searches nationally. */
  near?: GeoRadius;
}

export interface DiscoverDocumentsOutput {
  documents: SourceDocument[];
  sourceReports: SourceReport[];
  /** Places the scan targeted, so the UI can show what was actually searched. */
  focusPlaces: string[];
}

/**
 * Collects documents from every registered source — and stops there.
 *
 * Discovery is deliberately separated from extraction. Fetching feeds is fast
 * and cheap; extraction is a per-document AI call that is slow, rate-limited and
 * billable. Bundling them meant one scan fired 25-78 Bedrock calls inside a
 * single request, which exceeded the on-demand quota, risked the Lambda timeout,
 * and left the user staring at a spinner with no idea how far along it was.
 *
 * Splitting them lets the caller drive extraction one document at a time, with
 * visible progress and the ability to stop partway.
 *
 * When coordinates are supplied the scan resolves nearby place names from the
 * gazetteer and hands them to the connectors, so keyword sources search *around
 * that point* rather than nationally.
 */
export class DiscoverDocumentsUseCase extends UseCase<DiscoverDocumentsInput, DiscoverDocumentsOutput> {
  private readonly documentSources: IDocumentSource[];
  private readonly gazetteer: IGazetteer;

  constructor(deps: { documentSources: IDocumentSource[]; gazetteer: IGazetteer }) {
    super();
    this.documentSources = deps.documentSources;
    this.gazetteer = deps.gazetteer;
  }

  private async buildFocus(near?: GeoRadius): Promise<ScanFocus | undefined> {
    if (!near) return undefined;

    if (!isValidLatitude(near.latitude) || !isValidLongitude(near.longitude)) {
      throw new Error('Validation failed: latitude must be -90..90 and longitude -180..180');
    }
    if (!Number.isFinite(near.radiusKm) || near.radiusKm < MIN_RADIUS_KM || near.radiusKm > MAX_RADIUS_KM) {
      throw new Error(`Validation failed: radiusKm must be between ${MIN_RADIUS_KM} and ${MAX_RADIUS_KM}`);
    }

    const places = await this.gazetteer.findWithin(near, near.radiusKm);

    // Corridors name a warehousing cluster and make far better search terms
    // than a state centroid, so prefer them when the radius covers both.
    const ordered = [
      ...places.filter((p) => p.kind === 'corridor'),
      ...places.filter((p) => p.kind === 'city'),
      ...places.filter((p) => p.kind === 'state')
    ];

    return {
      centre: near,
      placeNames: Array.from(new Set(ordered.map((p) => p.name))).slice(0, MAX_FOCUS_PLACES)
    };
  }

  protected async handle(input: DiscoverDocumentsInput, context: RequestContext): Promise<DiscoverDocumentsOutput> {
    const focus = await this.buildFocus(input?.near);
    const documents: SourceDocument[] = [];
    const sourceReports: SourceReport[] = [];
    const seenHashes = new Set<string>();

    for (const source of this.documentSources) {
      try {
        const fetched = await source.fetchDocuments(focus);

        // Two sources commonly carry the same story; dropping duplicates here
        // saves an AI call per duplicate downstream.
        let kept = 0;
        for (const doc of fetched) {
          if (seenHashes.has(doc.contentHash)) continue;
          seenHashes.add(doc.contentHash);
          documents.push(doc);
          kept++;
        }

        sourceReports.push({ source: source.sourceName, status: 'ok', itemCount: kept });
        logger.info('Source discovery succeeded', {
          tenantId: context.tenantId,
          source: source.sourceName,
          fetched: fetched.length,
          kept
        });
      } catch (error) {
        // A rate-limited provider is reported distinctly from a broken one:
        // one is "come back later", the other needs a fix.
        const blocked = (error as Error).name === 'FeedBlockedError';
        sourceReports.push({
          source: source.sourceName,
          status: blocked ? 'blocked' : 'failed',
          itemCount: 0,
          message: (error as Error).message
        });
        logger.error('Source discovery failed; continuing with remaining sources', {
          tenantId: context.tenantId,
          source: source.sourceName,
          blocked,
          error: (error as Error).message
        });
      }
    }

    return { documents, sourceReports, focusPlaces: focus?.placeNames ?? [] };
  }
}
