import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { getLogger } from '../../common/Logger';
import { RetryExhaustedError, withRetry } from '../../common/retry';
import { findExtractionModel } from '../../domains/lead/entities/ExtractionModel';
import { ExtractedLead } from '../../domains/lead/entities/Lead';
import { ExtractionOptions, ILeadExtractor } from '../../domains/lead/ports/ILeadExtractor';

const logger = getLogger('BedrockLeadExtractor');

const SYSTEM_PROMPT = `You are an expert Warehouse Lead Intelligence extraction system.
Your task is to analyze documents, tenders, RFPs, news articles, and trade newsletters to extract structured occupier warehouse space requirements.

Strict Extraction Rules:
1. isRelevant: true ONLY if there is an occupier or government body expressing a requirement, tender, RFP, expansion, or scouting for warehouse/godown/logistics space. Set false for general market articles, stock reports, or residential real estate.
2. intent: one of 'tender', 'rfp', 'scouting', 'expansion', 'land', 'watch'.
3. requirementType: one of 'lease', 'hire', 'build_to_suit', 'buy', 'land', 'unknown'.
4. size: extract value and unit ('sqft', 'lakh_sqft', 'acres', 'sqm'). Normalize lakh sqft (1 lakh = 100,000 sqft) and acres (1 acre = 43,560 sqft).
5. location: state, city, micro-corridor (e.g. Sanand, Changodar, Aslali, Bhiwandi, Dahej, Hazira, etc.), and rawText.
6. specialRequirements: array of tags like 'cold_storage', 'bonded', 'grade_a', 'hazmat', 'fm2_floor'.
7. evidence: Provide an array of exact quotes from the text for every key field extracted: size, location, organization, specialRequirements, deadline.
8. NEVER invent missing details. Output null explicitly for unstated fields.

Return ONLY a valid JSON object strictly adhering to this schema:
{
  "isRelevant": boolean,
  "organizationName": string | null,
  "industry": string | null,
  "intent": "tender" | "rfp" | "scouting" | "expansion" | "land" | "watch",
  "requirementType": "lease" | "hire" | "build_to_suit" | "buy" | "land" | "unknown",
  "size": {
    "value": number | null,
    "unit": "sqft" | "acres" | "lakh_sqft" | "sqm" | null,
    "normalizedSqft": number | null
  },
  "location": {
    "state": string | null,
    "city": string | null,
    "corridor": string | null,
    "rawText": string | null
  },
  "specialRequirements": string[],
  "deadline": string | null,
  "leaseTermMonths": number | null,
  "contact": {
    "name": string | null,
    "role": string | null,
    "organization": string | null,
    "email": string | null,
    "phone": string | null
  },
  "tenderReference": string | null,
  "evidence": [
    { "field": string, "quote": string }
  ],
  "reasoningSummary": string
}`;

/**
 * Maps an AWS region to its Bedrock cross-region inference-profile prefix.
 *
 * Most current Anthropic models on Bedrock cannot be invoked by bare foundation
 * model ID — Bedrock rejects them with "Invocation of model ID <id> with
 * on-demand throughput isn't supported. Retry your request with the ID or ARN
 * of an inference profile that contains this model."
 *
 * Regions outside these three geographies return undefined, and the model ID is
 * used unchanged rather than guessing at a prefix that would 400.
 */
function inferenceProfilePrefix(region: string): string | undefined {
  if (region.startsWith('us-')) return 'us';
  if (region.startsWith('eu-')) return 'eu';
  if (region.startsWith('ap-')) return 'apac';
  return undefined;
}

/** True when the id already carries a geography prefix or is a full ARN. */
function isAlreadyQualified(modelId: string): boolean {
  return /^(us|eu|apac|global)\./.test(modelId) || modelId.startsWith('arn:');
}

function needsInferenceProfile(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /on-demand throughput isn.?t supported|inference profile/i.test(message);
}

/**
 * True for Bedrock's quota rejection, whatever shape it arrives in.
 *
 * The SDK surfaces it as ThrottlingException, but the message ("Too many
 * requests, please wait before trying again.") and the 429 status are checked
 * too, because the exception name is absent when the error is reconstructed
 * across a boundary.
 */
function isThrottlingError(error: unknown): boolean {
  const name = (error as { name?: string })?.name ?? '';
  const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  const message = error instanceof Error ? error.message : String(error);

  return (
    /Throttling|TooManyRequests/i.test(name) ||
    /too many requests|throttl|rate exceeded|please wait/i.test(message) ||
    status === 429
  );
}

/**
 * Distinguishes failures a retry can fix from failures it cannot.
 *
 * Throttling and transient server errors clear on their own. Access denied,
 * validation errors and a missing model fail identically every time, so
 * retrying them only burns the Lambda's time budget and delays the fallback.
 */
function isRetryableBedrockError(error: unknown): boolean {
  const name = (error as { name?: string })?.name ?? '';
  const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  const message = error instanceof Error ? error.message : String(error);

  if (/AccessDenied|Validation|ResourceNotFound|UnrecognizedClient/i.test(name)) return false;
  if (needsInferenceProfile(error)) return false;

  if (isThrottlingError(error)) return true;
  if (/ServiceUnavailable|InternalServer|ModelTimeout|Timeout/i.test(name)) return true;
  if (status !== undefined && status >= 500) return true;

  return false;
}

/**
 * Backoff for a throttle, which is governed by a per-minute quota rather than
 * by momentary load.
 *
 * The default sub-second schedule is actively harmful here: three attempts land
 * within a couple of seconds of the rejection, so all three fall inside the
 * same exhausted minute and cannot do anything but fail. These delays are an
 * order of magnitude longer, and use *equal* jitter (half fixed, half random)
 * instead of full jitter — full jitter can return a near-zero wait, which
 * defeats the point of waiting for a quota window at all.
 *
 * With three attempts the ceilings are 10s then 20s, so a throttled document
 * spends 15-30s spread across the rejection rather than 2s bunched against it.
 * That is deliberately capped below a full minute: a document is one HTTP
 * request now, and a browser waiting a minute per document is worse than an
 * honest fallback plus the banner telling the user to switch model.
 *
 * Bedrock's own Retry-After, when it sends one, wins over the schedule.
 */
const THROTTLE_INITIAL_DELAY_MS = 10000;
const THROTTLE_MAX_DELAY_MS = 30000;

/** Server-specified wait, in ms. Accepts both the seconds and HTTP-date forms. */
function retryAfterMs(error: unknown): number | undefined {
  const headers = (error as { $response?: { headers?: Record<string, string> } })?.$response?.headers;
  const raw = headers?.['retry-after'] ?? headers?.['Retry-After'];
  if (!raw) return undefined;

  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const at = Date.parse(raw);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
}

function throttleDelayMs(error: unknown, attempt: number): number | undefined {
  if (!isThrottlingError(error)) return undefined;

  const hinted = retryAfterMs(error);
  if (hinted !== undefined) return Math.min(hinted, THROTTLE_MAX_DELAY_MS);

  const ceiling = Math.min(THROTTLE_MAX_DELAY_MS, THROTTLE_INITIAL_DELAY_MS * 2 ** (attempt - 1));
  return Math.round(ceiling / 2 + Math.random() * (ceiling / 2));
}

/**
 * Human-readable cause for the UI, derived from the underlying failure.
 *
 * The throttling text names the model and region and says plainly that
 * retrying will not help. An earlier version advised "wait a minute and scan
 * again", which was misleading: when the account's limit for a model is a
 * request or two per minute, the next scan throttles on its second document
 * exactly like the last one did. The two things that actually resolve it are
 * choosing a different model or raising the quota, so those are what it says.
 */
function describeFailure(error: unknown, baseModelId: string, region: string): string {
  const inner = error instanceof RetryExhaustedError ? error.lastError : error;
  const name = (inner as { name?: string })?.name ?? '';
  const message = inner instanceof Error ? inner.message : String(inner);

  if (isThrottlingError(inner)) {
    const label = findExtractionModel(baseModelId)?.label ?? baseModelId;
    const attempts = error instanceof RetryExhaustedError ? error.attempts : 1;

    return (
      `Your AWS account hit its Bedrock request-rate limit for ${label} in ${region} — ` +
      `${attempts} attempt${attempts === 1 ? '' : 's'} with increasing backoff were all rejected, so ` +
      'leads were extracted with the rule-based fallback, which is less accurate. This is a per-minute ' +
      'account quota, so scanning again shortly will hit it again. Either switch to another model ' +
      'with the model selector, or raise the quota in AWS Service Quotas → Amazon Bedrock.'
    );
  }
  if (/AccessDenied/i.test(name)) {
    return 'Amazon Bedrock denied access to the model. Grant model access in the Bedrock console, then scan again.';
  }
  if (needsInferenceProfile(inner)) {
    return 'The configured Bedrock model needs an inference profile ID. Set DEFAULT_MODEL_ID to a profile ID for your region.';
  }
  return `Amazon Bedrock could not be reached (${message}). Leads were extracted with the rule-based fallback.`;
}

/** Per-model resolution and circuit-breaker state. */
interface ModelState {
  /** Cached after the first success so the profile probe costs one call total. */
  resolvedId: string | null;
  consecutiveFailures: number;
  circuitOpenUntil: number;
  /**
   * The reason that tripped the breaker, replayed while it stays open. Without
   * this, documents skipped by the breaker would report a guessed cause —
   * telling a user to request a quota increase when the real problem was
   * expired credentials.
   */
  circuitReason: string | null;
}

interface BedrockOptions {
  fallback: ILeadExtractor;
  region?: string;
  modelId?: string;
  /** Total attempts per document, including the first. */
  maxAttempts?: number;
  /** Minimum gap between invocations, to stay under the account's quota. */
  minIntervalMs?: number;
  /** Consecutive exhausted failures before Bedrock is skipped for a while. */
  circuitBreakerThreshold?: number;
  circuitCooldownMs?: number;
}

/**
 * Amazon Bedrock structured extraction, with a rule-based fallback.
 *
 * Three layers protect a batch from Bedrock's on-demand quota, which a scan of
 * 25+ documents otherwise exceeds within seconds:
 *
 *  1. **Pacing** — a minimum interval between invocations, so a batch does not
 *     arrive as one burst.
 *  2. **Retry with jittered backoff** — throttles clear on their own, and three
 *     attempts rides out a brief one.
 *  3. **Circuit breaker** — once several documents in a row exhaust their
 *     retries, Bedrock is skipped for a cooldown. Without it, a sustained
 *     throttle would make every remaining document wait through its own
 *     retries, exhausting the Lambda timeout to produce nothing better.
 *
 * Failure is never fatal: extraction degrades to the heuristic path and the
 * reason is recorded on the result, so the UI can say leads were extracted at
 * reduced accuracy rather than silently pretending all is well.
 */
export class BedrockLeadExtractor implements ILeadExtractor {
  public readonly extractorName = 'bedrock';

  private readonly client: BedrockRuntimeClient | null;
  private readonly configuredModelId: string;
  private readonly region: string;
  private readonly fallback: ILeadExtractor;
  private readonly maxAttempts: number;
  private readonly minIntervalMs: number;
  private readonly circuitBreakerThreshold: number;
  private readonly circuitCooldownMs: number;

  /**
   * Resolution and circuit state are tracked per model, because quotas are
   * per model: a throttled model must not disable an untouched one, which
   * is the entire point of letting the user switch between them.
   */
  private readonly states = new Map<string, ModelState>();

  /** Pacing is global — it protects the account's overall request rate. */
  private lastInvokedAt = 0;

  constructor(deps: BedrockOptions) {
    this.fallback = deps.fallback;
    this.region = deps.region || process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1';
    this.configuredModelId =
      deps.modelId || process.env.DEFAULT_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';
    this.maxAttempts = deps.maxAttempts ?? Number(process.env.BEDROCK_MAX_ATTEMPTS ?? 3);
    this.minIntervalMs = deps.minIntervalMs ?? Number(process.env.BEDROCK_MIN_INTERVAL_MS ?? 250);
    this.circuitBreakerThreshold = deps.circuitBreakerThreshold ?? 3;
    this.circuitCooldownMs = deps.circuitCooldownMs ?? 60000;

    let client: BedrockRuntimeClient | null = null;
    try {
      client = new BedrockRuntimeClient({
        region: this.region,
        // Retries are handled here, not by the SDK, so "3 attempts" means
        // exactly three calls rather than three times the SDK's own retries.
        maxAttempts: 1
      });
    } catch (error) {
      logger.warn('Bedrock client construction failed; extraction will use the fallback', {
        region: this.region,
        error: (error as Error).message
      });
    }
    this.client = client;
  }

  private stateFor(modelId: string): ModelState {
    let state = this.states.get(modelId);
    if (!state) {
      state = { resolvedId: null, consecutiveFailures: 0, circuitOpenUntil: 0, circuitReason: null };
      this.states.set(modelId, state);
    }
    return state;
  }

  private candidateModelIds(baseModelId: string, state: ModelState): string[] {
    if (state.resolvedId) return [state.resolvedId];

    const candidates = [baseModelId];
    if (!isAlreadyQualified(baseModelId)) {
      const prefix = inferenceProfilePrefix(this.region);
      if (prefix) candidates.push(`${prefix}.${baseModelId}`);
    }
    return candidates;
  }

  private circuitIsOpen(state: ModelState): boolean {
    return Date.now() < state.circuitOpenUntil;
  }

  private recordFailure(state: ModelState, modelId: string, reason: string): void {
    state.consecutiveFailures++;
    if (state.consecutiveFailures >= this.circuitBreakerThreshold && !this.circuitIsOpen(state)) {
      state.circuitOpenUntil = Date.now() + this.circuitCooldownMs;
      state.circuitReason = reason;
      logger.warn('Bedrock circuit opened for model; skipping it until the cooldown expires', {
        modelId,
        consecutiveFailures: state.consecutiveFailures,
        cooldownMs: this.circuitCooldownMs,
        reason
      });
    }
  }

  /** Spaces invocations so a batch does not arrive as a burst. */
  private async pace(): Promise<void> {
    if (this.minIntervalMs <= 0) return;
    const waitFor = this.lastInvokedAt + this.minIntervalMs - Date.now();
    if (waitFor > 0) await new Promise((resolve) => setTimeout(resolve, waitFor));
    this.lastInvokedAt = Date.now();
  }

  private async degrade(title: string, text: string, reason: string): Promise<ExtractedLead> {
    const result = await this.fallback.extract(title, text);
    return { ...result, extractionFallback: { reason } };
  }

  public async extract(title: string, text: string, options?: ExtractionOptions): Promise<ExtractedLead> {
    if (!this.client) {
      return this.degrade(title, text, 'Amazon Bedrock client is not configured; used rule-based extraction.');
    }

    // The caller validated this against the allowlist; fall back to the
    // configured default when unset.
    const baseModelId = options?.modelId || this.configuredModelId;
    const state = this.stateFor(baseModelId);

    // Skip straight to the fallback while the breaker is open, rather than
    // making every remaining document wait through its own doomed retries.
    if (this.circuitIsOpen(state)) {
      return this.degrade(
        title,
        text,
        state.circuitReason ?? 'Amazon Bedrock is unavailable; used rule-based extraction.'
      );
    }

    const documentText = `${title}\n\n${text}`;
    const candidates = this.candidateModelIds(baseModelId, state);

    for (let i = 0; i < candidates.length; i++) {
      const modelId = candidates[i];

      try {
        const result = await withRetry(
          async () => {
            await this.pace();
            return this.invokeConverse(documentText, modelId);
          },
          {
            maxAttempts: this.maxAttempts,
            initialDelayMs: 1000,
            maxDelayMs: 8000,
            isRetryable: isRetryableBedrockError,
            delayOverrideMs: throttleDelayMs,
            onRetry: ({ attempt, delayMs, error }) =>
              logger.warn('Bedrock call failed; retrying after backoff', {
                modelId,
                attempt,
                of: this.maxAttempts,
                delayMs,
                error: (error as Error).message
              })
          }
        );

        if (result) {
          if (state.resolvedId !== modelId) {
            state.resolvedId = modelId;
            logger.info('Bedrock model resolved', { modelId, region: this.region });
          }
          // Only *consecutive* failures should trip the breaker.
          state.consecutiveFailures = 0;
          state.circuitReason = null;
          return { ...result, modelUsed: `bedrock:${modelId}` };
        }

        logger.warn('Bedrock returned no parsable JSON; using fallback', { modelId });
        return this.degrade(title, text, 'Amazon Bedrock returned an unparsable response; used rule-based extraction.');
      } catch (error) {
        const hasAnotherCandidate = i < candidates.length - 1;

        if (needsInferenceProfile(error) && hasAnotherCandidate) {
          logger.info('Model requires an inference profile; retrying with the regional profile id', {
            attempted: modelId,
            retryingWith: candidates[i + 1]
          });
          continue;
        }

        const reason = describeFailure(error, baseModelId, this.region);
        this.recordFailure(state, modelId, reason);

        logger.warn('Bedrock invocation failed; using fallback', {
          modelId,
          region: this.region,
          attempts: error instanceof RetryExhaustedError ? error.attempts : 1,
          error: (error as Error).message
        });

        return this.degrade(title, text, reason);
      }
    }

    return this.degrade(title, text, 'Amazon Bedrock could not be reached; used rule-based extraction.');
  }

  private async invokeConverse(documentText: string, modelId: string): Promise<ExtractedLead | null> {
    if (!this.client) return null;

    const command = new ConverseCommand({
      modelId,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [
        {
          role: 'user',
          content: [{ text: `Extract warehouse requirement intelligence from this document:\n\n${documentText}` }]
        }
      ],
      inferenceConfig: {
        maxTokens: 2000,
        temperature: 0.1
      }
    });

    const response = await this.client.send(command);
    const textOutput = response.output?.message?.content?.[0]?.text;
    if (!textOutput) return null;

    // The model is asked for bare JSON but may wrap it in prose or a fence.
    const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as ExtractedLead;

    // The prompt deliberately does not ask for coordinates — a model guessing
    // latitudes would violate the no-invented-values rule. The gazetteer
    // resolves them from the named place instead.
    parsed.location = { ...parsed.location, latitude: null, longitude: null };

    return parsed;
  }
}
