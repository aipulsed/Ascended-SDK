/**
 * @module core/config
 * @description Loads and exposes environment-based configuration for all SDK clients.
 *
 * Values are read from `process.env` at import time. Consuming applications should
 * set these variables before importing the SDK (e.g., via a `.env` file and a loader
 * such as `dotenv`).
 */

/** Root configuration for the Ascended-SDK. */
export interface SDKConfig {
  /** Base URL of the Deterministic Execution Layer (DEL) service. */
  delBaseUrl: string;
  /** Base URL of the Event Bus service. */
  eventBusBaseUrl: string;
  /** Base URL of the AI Fallback service. */
  aiBaseUrl: string;
  /** Base URL of the Database (query) service. */
  dbBaseUrl: string;
  /** Default HTTP request timeout in milliseconds (default: 10 000). */
  defaultTimeoutMs: number;
  /** Default number of retry attempts for failed requests (default: 3). */
  defaultRetries: number;
}

/**
 * Loads SDK configuration from environment variables.
 *
 * @returns A fully populated {@link SDKConfig} object.
 */
export function loadConfig(): SDKConfig {
  return {
    delBaseUrl: process.env.DEL_BASE_URL ?? "http://localhost:4000",
    eventBusBaseUrl: process.env.EVENT_BUS_BASE_URL ?? "http://localhost:4001",
    aiBaseUrl: process.env.AI_BASE_URL ?? "http://localhost:4002",
    dbBaseUrl: process.env.DB_BASE_URL ?? "http://localhost:4003",
    defaultTimeoutMs: parseInt(process.env.SDK_TIMEOUT_MS ?? "10000", 10),
    defaultRetries: parseInt(process.env.SDK_RETRIES ?? "3", 10),
  };
}

/** Singleton configuration instance used throughout the SDK. */
export const config: SDKConfig = loadConfig();
