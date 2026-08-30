/**
 * Ambient context for a single request, threaded from the Composition Root
 * (the Lambda handler) down through use cases into repositories.
 *
 * There is no authentication in the platform yet — no Cognito, no JWT. The
 * shape is nevertheless established now because the master plan requires
 * `tenantId` on every business record from day one, and retrofitting tenant
 * scoping later would mean touching every repository method and use case
 * signature. Handlers currently synthesise a context for DEFAULT_TENANT_ID;
 * when Cognito lands, only the handler changes.
 */
export interface RequestContext {
  /** Owning organization. Required on every repository call. */
  tenantId: string;
  /** Cognito `sub` of the acting user. Absent until authentication exists. */
  userSub?: string;
  /** Correlates log lines belonging to one request. */
  requestId?: string;
}

/**
 * The single tenant every record belongs to until multi-tenancy is switched on.
 */
export const DEFAULT_TENANT_ID = 'default';

export function createRequestContext(requestId?: string): RequestContext {
  return { tenantId: DEFAULT_TENANT_ID, requestId };
}

/**
 * Fail-closed tenant guard.
 *
 * Today this only proves a tenant was supplied. Once JWTs are parsed it also
 * becomes the place that rejects a mismatch between the token's tenant and a
 * tenant named in the request.
 */
export function assertTenantAccess(context: RequestContext | undefined): asserts context is RequestContext {
  if (!context?.tenantId) {
    throw new Error('Forbidden: request context is missing a tenantId');
  }
}
