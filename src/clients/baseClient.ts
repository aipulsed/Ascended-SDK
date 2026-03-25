/**
 * @module clients/baseClient
 * @description Abstract base class for all SDK service clients.
 *
 * Provides:
 * - Centralised HTTP communication via `http.ts`
 * - Automatic auth-header injection
 * - Retry logic with exponential back-off
 * - Structured logging
 * - Consistent error normalisation
 *
 * Every concrete client (DELClient, EventBusClient, etc.) MUST extend this
 * class and MUST NOT make network calls outside of the `request()` helper.
 */

import { httpRequest, HttpMethod, HttpError } from "../core/http";
import { withRetry, RetryOptions } from "../core/retry";
import { AuthManager, AuthManagerOptions } from "../auth/authManager";
import { Logger } from "../utils/logger";
import { SDKError } from "../types/common.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options accepted by every concrete client constructor. */
export interface BaseClientOptions {
  /** Base URL of the target service (e.g. `"http://localhost:4000"`). */
  baseUrl: string;
  /** Request timeout in milliseconds. Default: 10 000. */
  timeoutMs?: number;
  /** Retry configuration. */
  retry?: RetryOptions;
  /** Authentication configuration. */
  auth?: AuthManagerOptions;
  /** Override the logger (useful for testing). */
  logger?: Logger;
}

/** Internal request descriptor used by {@link BaseClient.request}. */
interface ClientRequestOptions {
  path: string;
  method: HttpMethod;
  body?: unknown;
  /** Additional headers to merge for this specific request. */
  headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// BaseClient
// ---------------------------------------------------------------------------

/**
 * Abstract base class that all SDK service clients extend.
 *
 * @example
 * ```ts
 * class MyClient extends BaseClient {
 *   async getItem(id: string) {
 *     return this.request<Item>({ path: `/items/${id}`, method: "GET" });
 *   }
 * }
 * ```
 */
export abstract class BaseClient {
  protected readonly baseUrl: string;
  protected readonly timeoutMs: number;
  protected readonly retryOptions: RetryOptions;
  protected readonly auth: AuthManager;
  protected readonly log: Logger;

  constructor(options: BaseClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ""); // strip trailing slash
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.retryOptions = options.retry ?? {};
    this.auth = new AuthManager(options.auth ?? {});
    this.log = options.logger ?? new Logger({ service: this.constructor.name });
  }

  // ---------------------------------------------------------------------------
  // Protected helpers
  // ---------------------------------------------------------------------------

  /**
   * Executes an HTTP request with auth headers, retry, and error normalisation.
   *
   * @param options  Request descriptor.
   * @returns        Parsed JSON response typed as `T`.
   * @throws {@link SDKError}-shaped `Error` on non-retryable failures.
   */
  protected async request<T>(options: ClientRequestOptions): Promise<T> {
    const url = `${this.baseUrl}${options.path}`;

    return withRetry(async () => {
      const authHeaders = await this.auth.getHeaders();
      const headers: Record<string, string> = {
        ...authHeaders,
        ...(options.headers ?? {}),
      };

      this.log.debug("HTTP request", {
        method: options.method,
        url,
      });

      try {
        const result = await httpRequest<T>({
          url,
          method: options.method,
          body: options.body,
          headers,
          timeoutMs: this.timeoutMs,
        });

        this.log.debug("HTTP response ok", { url });
        return result;
      } catch (err) {
        this.log.warn("HTTP request failed", { url });
        throw this.normaliseError(err, url);
      }
    }, this.retryOptions);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Converts raw errors into a consistent shape.
   * 401 responses invalidate the cached auth token so the next retry fetches a
   * fresh one.
   */
  private normaliseError(err: unknown, url: string): Error {
    if (err instanceof HttpError) {
      if (err.status === 401) {
        this.auth.invalidateToken();
      }
      const sdkError: SDKError = {
        code: `HTTP_${err.status}`,
        message: err.message,
        details: { url, body: err.body },
      };
      const e = new Error(sdkError.message);
      Object.assign(e, { sdkError });
      return e;
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
