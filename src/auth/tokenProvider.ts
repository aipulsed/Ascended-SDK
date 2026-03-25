/**
 * @module auth/tokenProvider
 * @description Manages access-token retrieval and optional refresh for the SDK.
 *
 * Tokens are cached in memory and re-fetched when they expire or are absent.
 * In server-side deployments the service token is typically a static API key
 * supplied via an environment variable; in browser/edge contexts it can be
 * swapped for a dynamic fetch.
 */

/** A bearer token together with its expiry information. */
export interface TokenInfo {
  /** The raw bearer token string. */
  token: string;
  /**
   * Unix epoch (ms) at which the token expires.
   * When `undefined` the token is treated as non-expiring.
   */
  expiresAt?: number;
}

/** Async function that fetches a fresh {@link TokenInfo}. */
export type TokenFetcher = () => Promise<TokenInfo>;

/** Configuration for {@link TokenProvider}. */
export interface TokenProviderOptions {
  /** A function that returns a fresh token when called. */
  fetcher: TokenFetcher;
  /**
   * How many milliseconds before actual expiry to proactively refresh.
   * Default: 30 000 (30 s).
   */
  refreshBufferMs?: number;
}

/**
 * Provides bearer tokens for outbound SDK requests.
 *
 * Caches the current token in memory and transparently refreshes it when
 * it is about to expire, ensuring that callers always receive a valid token.
 *
 * @example
 * ```ts
 * const provider = new TokenProvider({
 *   fetcher: async () => ({ token: process.env.SERVICE_TOKEN! }),
 * });
 * const token = await provider.getToken();
 * ```
 */
export class TokenProvider {
  private cached: TokenInfo | null = null;
  private readonly fetcher: TokenFetcher;
  private readonly refreshBufferMs: number;

  constructor(options: TokenProviderOptions) {
    this.fetcher = options.fetcher;
    this.refreshBufferMs = options.refreshBufferMs ?? 30_000;
  }

  /**
   * Returns a valid bearer token, refreshing the cache if necessary.
   *
   * @returns The current bearer token string.
   */
  async getToken(): Promise<string> {
    if (this.isValid(this.cached)) {
      return this.cached!.token;
    }
    this.cached = await this.fetcher();
    return this.cached.token;
  }

  /**
   * Invalidates the cached token, forcing the next {@link getToken} call to
   * fetch a fresh one.
   */
  invalidate(): void {
    this.cached = null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private isValid(info: TokenInfo | null): info is TokenInfo {
    if (!info) return false;
    if (info.expiresAt === undefined) return true;
    return Date.now() < info.expiresAt - this.refreshBufferMs;
  }
}

// ---------------------------------------------------------------------------
// Built-in fetchers
// ---------------------------------------------------------------------------

/**
 * Creates a {@link TokenFetcher} that reads a static token from an environment
 * variable.  Useful for server-to-server authentication.
 *
 * @param envVar  Name of the environment variable (default: `SERVICE_TOKEN`).
 */
export function envTokenFetcher(envVar = "SERVICE_TOKEN"): TokenFetcher {
  return async (): Promise<TokenInfo> => {
    const token = process.env[envVar];
    if (!token) {
      throw new Error(
        `envTokenFetcher: environment variable "${envVar}" is not set.`
      );
    }
    return { token };
  };
}
