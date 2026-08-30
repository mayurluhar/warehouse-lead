import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { Lead, createRequestContext } from '@warehouse-lead/core';
import { createRequestContainer } from './composition/Container';
import { errorResponse, response } from './http/HttpResponse';

/**
 * Presentation layer.
 *
 * Responsibilities are strictly: match a route, parse the event into use-case
 * input, invoke the use case, shape the result. No extraction, scoring,
 * deduplication or persistence logic lives here.
 *
 * The API is stateless. Every ingestion request carries the leads the client
 * already holds; the pipeline runs against them and the full updated set comes
 * back. Nothing is retained between requests, so the React desk is the single
 * owner of POC state and a browser refresh clears it.
 *
 * Reads and workflow mutations (list, detail, status, stats, reset) have no
 * server-side endpoint any more — the client holds the leads, so it answers
 * those itself using the same domain services via `@warehouse-lead/core/client`.
 */

/** Counts shaped so the client can accumulate them uniformly across paths. */
interface IngestionCounts {
  scannedCount: number;
  relevantCount: number;
  discardedCount: number;
  newLeadsAdded: number;
}

function parseBody(event: APIGatewayProxyEventV2): Record<string, unknown> {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body) as Record<string, unknown>;
  } catch {
    throw new Error('Validation failed: request body is not valid JSON');
  }
}

/**
 * Leads the client currently holds. Absent or malformed means "start empty",
 * which simply means nothing can be deduplicated against.
 */
function parseKnownLeads(body: Record<string, unknown>): Lead[] {
  const known = body.knownLeads;
  return Array.isArray(known) ? (known as Lead[]) : [];
}

function singleDocumentCounts(isRelevant: boolean, isNew: boolean): IngestionCounts {
  return {
    scannedCount: 1,
    relevantCount: isRelevant ? 1 : 0,
    discardedCount: isRelevant ? 0 : 1,
    newLeadsAdded: isNew ? 1 : 0
  };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method.toUpperCase();
  const path = (event.requestContext.http.path || '/').replace(/\/$/, '') || '/';

  if (method === 'OPTIONS') {
    return response(200, { ok: true });
  }

  // Synthesised until Cognito exists; see RequestContext.
  const context = createRequestContext(event.requestContext.requestId);

  try {
    if (method === 'POST' && path.startsWith('/api/ingest/')) {
      const body = parseBody(event);
      const container = createRequestContainer(parseKnownLeads(body), context.tenantId);

      if (path === '/api/ingest/scan') {
        const result = await container.scanNewsSources.execute(undefined, context);
        const { leads } = await container.listLeads.execute({}, context);
        return response(200, {
          success: true,
          scannedCount: result.scannedCount,
          relevantCount: result.relevantCount,
          discardedCount: result.discardedCount,
          newLeadsAdded: result.newLeadsAdded,
          leads
        });
      }

      if (path === '/api/ingest/samples') {
        const result = await container.ingestSampleSignals.execute(undefined, context);
        return response(200, {
          success: true,
          scannedCount: result.scannedCount,
          relevantCount: result.relevantCount,
          discardedCount: result.discardedCount,
          newLeadsAdded: result.newLeadsAdded,
          leads: result.leads
        });
      }

      if (path === '/api/ingest/url') {
        const result = await container.ingestUrl.execute({ url: body.url as string }, context);
        const { leads } = await container.listLeads.execute({}, context);
        return response(200, {
          success: result.isRelevant,
          isRelevant: result.isRelevant,
          reason: result.reason,
          isNew: result.isNew,
          isCorroborated: result.isCorroborated,
          lead: result.lead,
          document: result.document,
          ...singleDocumentCounts(result.isRelevant, result.isNew),
          leads
        });
      }

      if (path === '/api/ingest/text') {
        const result = await container.ingestText.execute(
          {
            text: body.text as string,
            title: body.title as string | undefined,
            sourceUrl: body.sourceUrl as string | undefined,
            sourceType: body.sourceType as never,
            trustTier: body.trustTier as never
          },
          context
        );
        const { leads } = await container.listLeads.execute({}, context);
        return response(200, {
          success: result.isRelevant,
          isRelevant: result.isRelevant,
          reason: result.reason,
          isNew: result.isNew,
          isCorroborated: result.isCorroborated,
          lead: result.lead,
          ...singleDocumentCounts(result.isRelevant, result.isNew),
          leads
        });
      }
    }

    if (path === '' || path === '/' || path === '/api/health') {
      return response(200, {
        status: 'healthy',
        service: 'Warehouse Lead Intelligence Platform - Ingestion API',
        stateful: false,
        timestamp: new Date().toISOString()
      });
    }

    return response(404, { error: 'Not Found', path, method });
  } catch (error) {
    return errorResponse(error);
  }
}
