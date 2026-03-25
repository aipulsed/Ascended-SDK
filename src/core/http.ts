/**
 * @module core/http
 * @description Low-level HTTP wrapper used exclusively by SDK clients.
 *
 * All network communication in the SDK flows through this module.
 * It handles JSON serialisation, response parsing, and translates
 * non-2xx responses into structured {@link HttpError} instances.
 */

import { DEFAULT_HEADERS } from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported HTTP verbs. */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/** Options accepted by {@link httpRequest}. */
export interface HttpRequestOptions {
  /** Destination URL. */
  url: string;
  /** HTTP method. */
  method: HttpMethod;
  /** Request body – will be JSON-serialised. */
  body?: unknown;
  /** Additional / override headers. */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
}

/** Structured error thrown for non-2xx HTTP responses. */
export class HttpError extends Error {
  /** HTTP status code (e.g. 404, 500). */
  public readonly status: number;
  /** Raw response body text. */
  public readonly body: string;

  constructor(status: number, body: string, url: string) {
    super(`HTTP ${status} from ${url}: ${body}`);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

// ---------------------------------------------------------------------------
// Core request function
// ---------------------------------------------------------------------------

/**
 * Performs a single HTTP request and returns the parsed JSON body.
 *
 * @param options  Request configuration.
 * @returns        Parsed JSON response body typed as `T`.
 * @throws {@link HttpError} on non-2xx responses.
 * @throws {@link Error} on network / timeout failures.
 */
export async function httpRequest<T>(options: HttpRequestOptions): Promise<T> {
  const { url, method, body, headers = {}, timeoutMs = 10_000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const mergedHeaders: Record<string, string> = {
    ...DEFAULT_HEADERS,
    ...headers,
  };

  const requestInit: RequestInit = {
    method,
    headers: mergedHeaders,
    signal: controller.signal,
  };

  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
  }

  let response: Response;

  try {
    response = await fetch(url, requestInit);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const responseText = await response.text();

  if (!response.ok) {
    throw new HttpError(response.status, responseText, url);
  }

  if (!responseText) {
    return undefined as unknown as T;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error(
      `Failed to parse JSON response from ${url}: ${responseText}`
    );
  }
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

/**
 * Performs a GET request.
 * @param url      Target URL.
 * @param headers  Optional extra headers.
 * @param timeoutMs Request timeout in ms.
 */
export function httpGet<T>(
  url: string,
  headers?: Record<string, string>,
  timeoutMs?: number
): Promise<T> {
  return httpRequest<T>({ url, method: "GET", headers, timeoutMs });
}

/**
 * Performs a POST request.
 * @param url      Target URL.
 * @param body     Request body.
 * @param headers  Optional extra headers.
 * @param timeoutMs Request timeout in ms.
 */
export function httpPost<T>(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
  timeoutMs?: number
): Promise<T> {
  return httpRequest<T>({ url, method: "POST", body, headers, timeoutMs });
}

/**
 * Performs a PUT request.
 * @param url      Target URL.
 * @param body     Request body.
 * @param headers  Optional extra headers.
 * @param timeoutMs Request timeout in ms.
 */
export function httpPut<T>(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
  timeoutMs?: number
): Promise<T> {
  return httpRequest<T>({ url, method: "PUT", body, headers, timeoutMs });
}

/**
 * Performs a DELETE request.
 * @param url      Target URL.
 * @param headers  Optional extra headers.
 * @param timeoutMs Request timeout in ms.
 */
export function httpDelete<T>(
  url: string,
  headers?: Record<string, string>,
  timeoutMs?: number
): Promise<T> {
  return httpRequest<T>({ url, method: "DELETE", headers, timeoutMs });
}
