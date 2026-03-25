/**
 * @module types/common.types
 * @description Primitive and shared types reused across the entire SDK and
 * all consuming services.
 */

// ---------------------------------------------------------------------------
// Primitive identifiers
// ---------------------------------------------------------------------------

/** A UUID v4 string (e.g. `"123e4567-e89b-12d3-a456-426614174000"`). */
export type UUID = string;

/** ISO-8601 date-time string (e.g. `"2024-01-15T12:30:00.000Z"`). */
export type ISODateString = string;

/** Semantic version string (e.g. `"1.2.3"`). */
export type SemVer = string;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Cursor-based pagination parameters. */
export interface PaginationParams {
  /** Maximum number of items to return. */
  limit?: number;
  /** Opaque cursor pointing to the next page. */
  cursor?: string;
}

/** Metadata returned alongside paginated results. */
export interface PaginationMeta {
  /** Total number of items (when countable). */
  total?: number;
  /** Cursor to fetch the next page; absent when on the last page. */
  nextCursor?: string;
  /** Whether more pages exist. */
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Service metadata
// ---------------------------------------------------------------------------

/** Lightweight identifier for a service + version. */
export interface ServiceIdentity {
  name: string;
  version: SemVer;
}

// ---------------------------------------------------------------------------
// Error representation
// ---------------------------------------------------------------------------

/** Normalised, serialisable error payload returned by all SDK methods. */
export interface SDKError {
  /** Machine-readable error code (e.g. `"NOT_FOUND"`, `"TIMEOUT"`). */
  code: string;
  /** Human-readable error description. */
  message: string;
  /** Optional additional context. */
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Generic result type
// ---------------------------------------------------------------------------

/** Represents a successful outcome. */
export interface Ok<T> {
  ok: true;
  data: T;
}

/** Represents a failed outcome. */
export interface Err {
  ok: false;
  error: SDKError;
}

/**
 * A discriminated union that wraps either a success value or a structured error.
 * Use `result.ok` to narrow the type.
 */
export type Result<T> = Ok<T> | Err;

/** Creates a successful {@link Result}. */
export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

/** Creates a failed {@link Result}. */
export function err(code: string, message: string, details?: Record<string, unknown>): Err {
  return { ok: false, error: { code, message, details } };
}
