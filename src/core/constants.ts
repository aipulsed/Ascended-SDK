/**
 * @module core/constants
 * @description Shared named constants used across the entire SDK and consuming services.
 *
 * Centralising constants here prevents magic strings from spreading into multiple
 * repos and makes rename / versioning changes a single-file operation.
 */

// ---------------------------------------------------------------------------
// Service names
// ---------------------------------------------------------------------------

/** Well-known identifiers for each AscendStack service. */
export const ServiceName = {
  DEL: "ascended-del",
  EVENT_BUS: "ascended-event-bus",
  AI_FALLBACK: "ascended-ai-fallback",
  DATABASE: "ascended-database",
  DOCUMENT_ENGINE: "ascended-document-engine",
  EMAIL_ENGINE: "ascended-email-engine",
  AGENTS: "ascended-agents",
  SDK: "ascended-sdk",
} as const;

export type ServiceName = (typeof ServiceName)[keyof typeof ServiceName];

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

/** Default headers injected into every outbound request. */
export const DEFAULT_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "X-SDK-Version": "0.1.0",
};

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

/** Maximum number of retry attempts when not overridden by caller. */
export const DEFAULT_RETRY_ATTEMPTS = 3;

/** Base delay (ms) for the first retry; subsequent retries use exponential back-off. */
export const RETRY_BASE_DELAY_MS = 200;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** HTTP header key used to transport service-to-service tokens. */
export const AUTH_HEADER = "Authorization";

/** HTTP header key used to carry per-request correlation IDs. */
export const CORRELATION_ID_HEADER = "X-Correlation-Id";

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** Namespace prefix applied to all internal event types. */
export const EVENT_NAMESPACE = "ascended";
