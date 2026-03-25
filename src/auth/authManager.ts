/**
 * @module auth/authManager
 * @description Builds and injects authentication headers into outbound SDK requests.
 *
 * The `AuthManager` wraps a {@link TokenProvider} and exposes a single method
 * (`getHeaders`) that returns a header map ready to be merged into any HTTP
 * request.  All SDK clients delegate header construction to this class.
 */

import { AUTH_HEADER, CORRELATION_ID_HEADER } from "../core/constants";
import { TokenProvider, TokenProviderOptions, envTokenFetcher } from "./tokenProvider";

/** Options accepted by {@link AuthManager}. */
export interface AuthManagerOptions {
  /**
   * Custom {@link TokenProvider} instance.
   * When omitted a default provider backed by the `SERVICE_TOKEN` environment
   * variable is created automatically.
   */
  tokenProvider?: TokenProvider;
}

/**
 * Manages authentication for all SDK clients.
 *
 * @example
 * ```ts
 * const auth = new AuthManager();
 * const headers = await auth.getHeaders();
 * // { Authorization: "Bearer <token>", "X-Correlation-Id": "..." }
 * ```
 */
export class AuthManager {
  private readonly tokenProvider: TokenProvider;

  constructor(options: AuthManagerOptions = {}) {
    this.tokenProvider =
      options.tokenProvider ??
      new TokenProvider({ fetcher: envTokenFetcher() } satisfies TokenProviderOptions);
  }

  /**
   * Returns a header map that includes:
   * - `Authorization: Bearer <token>`
   * - `X-Correlation-Id: <uuid>`
   *
   * @returns An object suitable for merging into an HTTP request's headers.
   */
  async getHeaders(): Promise<Record<string, string>> {
    const token = await this.tokenProvider.getToken();
    return {
      [AUTH_HEADER]: `Bearer ${token}`,
      [CORRELATION_ID_HEADER]: generateCorrelationId(),
    };
  }

  /**
   * Forces re-fetching the underlying token on the next call to
   * {@link getHeaders}.  Call this when receiving a 401 from a service.
   */
  invalidateToken(): void {
    this.tokenProvider.invalidate();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a lightweight correlation ID for request tracing using
 * `crypto.randomUUID()` (available in Node ≥ 15 / modern browsers).
 */
function generateCorrelationId(): string {
  return globalThis.crypto.randomUUID();
}
