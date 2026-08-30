import { APIGatewayProxyResultV2 } from 'aws-lambda';

/**
 * CORS is emitted here and nowhere else.
 *
 * The Lambda Function URL is configured with `cors: false` in sst.config.ts
 * precisely so this stays the single source: when both the Function URL and the
 * handler set Access-Control-Allow-Origin, the browser receives two values and
 * blocks every response.
 */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, X-Requested-With, Accept, Origin',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};

export function response(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body)
  };
}

/**
 * Maps a thrown domain error onto an HTTP status by keyword, so use cases can
 * throw plain descriptive errors without importing anything HTTP-shaped.
 *
 * The blueprint's `{ success, message }` envelope is deliberately not used: the
 * existing React client reads the current body shapes, and changing the API
 * contract was out of scope for a structural pass.
 */
export function errorResponse(error: unknown): APIGatewayProxyResultV2 {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes('validation failed')) {
    return response(400, { error: message });
  }
  if (lower.includes('forbidden')) {
    return response(403, { error: message });
  }
  if (lower.includes('not found')) {
    return response(404, { error: message });
  }
  if (lower.includes('conflict') || lower.includes('already')) {
    return response(409, { error: message });
  }

  console.error(JSON.stringify({
    level: 'ERROR',
    logger: 'HttpResponse',
    message: 'Unhandled error',
    error: message,
    stack: error instanceof Error ? error.stack : undefined
  }));

  return response(500, { error: 'Internal Server Error', message });
}
