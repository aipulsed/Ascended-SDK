/**
 * @module types/api.types
 * @description Canonical API request / response envelope types shared by all
 * SDK clients and the services they communicate with.
 *
 * Every service in the AscendStack ecosystem MUST wrap its HTTP responses in
 * {@link ApiResponse} to guarantee consistency for consumers.
 */

import { ISODateString, PaginationMeta, SDKError } from "./common.types";

// ---------------------------------------------------------------------------
// Response envelope
// ---------------------------------------------------------------------------

/** Standard success response envelope. */
export interface ApiResponse<T> {
  /** Always `true` for success responses. */
  success: true;
  /** The response payload. */
  data: T;
  /** ISO-8601 timestamp of when the response was generated. */
  timestamp: ISODateString;
  /** Optional human-readable status description. */
  message?: string;
}

/** Standard error response envelope. */
export interface ApiErrorResponse {
  /** Always `false` for error responses. */
  success: false;
  /** Structured error details. */
  error: SDKError;
  /** ISO-8601 timestamp. */
  timestamp: ISODateString;
}

/** Paginated success response envelope. */
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

// ---------------------------------------------------------------------------
// Request metadata
// ---------------------------------------------------------------------------

/**
 * Common metadata that can be attached to any outbound API request.
 * Services may log or forward these fields for observability.
 */
export interface RequestMeta {
  /** Correlation ID for distributed tracing. */
  correlationId?: string;
  /** Caller service identity (name + version). */
  caller?: string;
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/** Standard health-check response returned by all services. */
export interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  uptime: number;
  timestamp: ISODateString;
  checks?: Record<string, "ok" | "fail">;
}
