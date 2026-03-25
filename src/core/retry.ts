/**
 * @module core/retry
 * @description Exponential back-off retry utility used by all SDK clients.
 *
 * Uses a full-jitter strategy to avoid thundering-herd issues when many
 * clients retry simultaneously.
 */

import { DEFAULT_RETRY_ATTEMPTS, RETRY_BASE_DELAY_MS } from "./constants";

/** Options that control retry behaviour. */
export interface RetryOptions {
  /** Maximum number of attempts (including the initial attempt). Default: 3. */
  attempts?: number;
  /** Base delay in milliseconds before the first retry. Default: 200. */
  baseDelayMs?: number;
  /**
   * Optional predicate that determines whether a thrown error is retryable.
   * When omitted, all errors are considered retryable.
   */
  isRetryable?: (error: unknown) => boolean;
}

/**
 * Executes `fn` with exponential back-off retry logic.
 *
 * @param fn       The async function to execute.
 * @param options  Retry configuration.
 * @returns        The resolved value of `fn` on success.
 * @throws         The last error if all attempts are exhausted.
 *
 * @example
 * ```ts
 * const data = await withRetry(() => fetchSomething(), { attempts: 5 });
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.attempts ?? DEFAULT_RETRY_ATTEMPTS;
  const baseDelay = options.baseDelayMs ?? RETRY_BASE_DELAY_MS;
  const isRetryable = options.isRetryable ?? (() => true);

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isLast = attempt === maxAttempts;
      if (isLast || !isRetryable(err)) {
        break;
      }

      const delay = jitteredDelay(baseDelay, attempt);
      await sleep(delay);
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes a jittered exponential delay.
 * Formula: `random(0, baseDelay * 2^(attempt-1))`
 */
function jitteredDelay(baseDelayMs: number, attempt: number): number {
  const cap = baseDelayMs * Math.pow(2, attempt - 1);
  return Math.random() * cap;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
