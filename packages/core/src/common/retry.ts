/**
 * Retry with exponential backoff and full jitter.
 *
 * Jitter is not decoration: when a batch of documents is throttled together,
 * a fixed backoff makes every one of them retry at the same instant and
 * re-trigger the same throttle. Randomising each delay spreads the retries out.
 *
 * Only errors the caller marks retryable are retried — a throttle will clear on
 * its own, whereas an access-denied or validation error will fail identically
 * three times and just waste the caller's time budget.
 */
export interface RetryOptions {
  /** Total attempts including the first, so 3 means one call plus two retries. */
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  isRetryable: (error: unknown) => boolean;
  /**
   * Replaces the computed backoff for a particular error.
   *
   * The default schedule assumes a transient blip that clears in milliseconds.
   * Some failures are governed by a slower clock — a per-minute service quota,
   * or a server-sent Retry-After — and retrying on the default schedule means
   * every attempt lands inside the window that is already exhausted. Returning
   * a number here overrides the wait entirely; returning undefined keeps the
   * exponential schedule. The value is used verbatim, so a caller that wants
   * jitter applies its own (the default path's full jitter would otherwise
   * shorten a deliberate wait back below the quota window).
   */
  delayOverrideMs?: (error: unknown, attempt: number) => number | undefined;
  /** Observability hook; called before each wait. */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
}

export class RetryExhaustedError extends Error {
  public readonly attempts: number;
  public readonly lastError: unknown;

  constructor(attempts: number, lastError: unknown) {
    const detail = lastError instanceof Error ? lastError.message : String(lastError);
    super(`Failed after ${attempts} attempt${attempts === 1 ? '' : 's'}: ${detail}`);
    this.name = 'RetryExhaustedError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // A non-retryable failure is final: surface it as-is so the caller sees
      // the real cause rather than a retry wrapper.
      if (!options.isRetryable(error)) throw error;

      if (attempt === options.maxAttempts) break;

      const override = options.delayOverrideMs?.(error, attempt);
      const ceiling = Math.min(options.maxDelayMs, options.initialDelayMs * 2 ** (attempt - 1));
      const delayMs = override ?? Math.round(Math.random() * ceiling);

      options.onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs);
    }
  }

  throw new RetryExhaustedError(options.maxAttempts, lastError);
}
