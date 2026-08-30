/**
 * Browser-safe subset of the core package, imported as
 * `@warehouse-lead/core/client`.
 *
 * The package root pulls in connectors and the Bedrock SDK, which depend on
 * Node built-ins and must never reach a browser bundle. This entry point
 * exposes only the pure pieces: the domain types plus the two calculations the
 * React desk needs to own leads locally.
 *
 * Anything added here must stay free of Node built-ins and of I/O — no
 * DocumentNormalizer (it uses `crypto`), no repositories, no adapters.
 */
export * from './domains/lead/entities';
export { LeadQueryService } from './domains/lead/services/LeadQueryService';
export { PipelineStatsService } from './domains/lead/services/PipelineStatsService';
