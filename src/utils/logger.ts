/**
 * @module utils/logger
 * @description Structured logging utility for all SDK components.
 *
 * Provides levelled logging (`debug`, `info`, `warn`, `error`) with
 * JSON-serialisable output that is compatible with log aggregation
 * platforms (Datadog, Logtail, CloudWatch, etc.).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Available log levels in ascending severity order. */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** A single structured log entry. */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/** Logger configuration. */
export interface LoggerOptions {
  /**
   * Minimum level to emit.  Messages below this level are silently discarded.
   * Default: `"info"`.
   */
  minLevel?: LogLevel;
  /** Service / module name included in every log entry. Default: `"ascended-sdk"`. */
  service?: string;
  /**
   * Custom write function.  Defaults to `process.stdout.write` (structured JSON)
   * or `console.*` depending on the environment.
   */
  write?: (entry: LogEntry) => void;
}

// ---------------------------------------------------------------------------
// Level ordering
// ---------------------------------------------------------------------------

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ---------------------------------------------------------------------------
// Logger class
// ---------------------------------------------------------------------------

/**
 * Structured logger used throughout the Ascended-SDK.
 *
 * @example
 * ```ts
 * const log = new Logger({ service: "del-client" });
 * log.info("Pipeline executed", { pipelineId: "abc" });
 * log.error("Request failed", {}, new Error("timeout"));
 * ```
 */
export class Logger {
  private readonly service: string;
  private readonly minLevel: LogLevel;
  private readonly write: (entry: LogEntry) => void;

  constructor(options: LoggerOptions = {}) {
    this.service = options.service ?? "ascended-sdk";
    this.minLevel = options.minLevel ?? "info";
    this.write = options.write ?? defaultWrite;
  }

  /**
   * Emits a debug-level log entry.
   * @param message  Human-readable message.
   * @param context  Optional structured context key-value pairs.
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.emit("debug", message, context);
  }

  /**
   * Emits an info-level log entry.
   * @param message  Human-readable message.
   * @param context  Optional structured context key-value pairs.
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.emit("info", message, context);
  }

  /**
   * Emits a warn-level log entry.
   * @param message  Human-readable message.
   * @param context  Optional structured context key-value pairs.
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.emit("warn", message, context);
  }

  /**
   * Emits an error-level log entry.
   * @param message  Human-readable message.
   * @param context  Optional structured context key-value pairs.
   * @param err      Optional error object – `name`, `message`, and `stack` are extracted.
   */
  error(
    message: string,
    context?: Record<string, unknown>,
    err?: unknown
  ): void {
    const entry = this.buildEntry("error", message, context);
    if (err instanceof Error) {
      entry.error = {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    }
    this.writeIfEnabled("error", entry);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private emit(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    const entry = this.buildEntry(level, message, context);
    this.writeIfEnabled(level, entry);
  }

  private buildEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      ...(context ? { context } : {}),
    };
  }

  private writeIfEnabled(level: LogLevel, entry: LogEntry): void {
    if (LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel]) {
      this.write(entry);
    }
  }
}

// ---------------------------------------------------------------------------
// Default write strategy
// ---------------------------------------------------------------------------

function defaultWrite(entry: LogEntry): void {
  const line = JSON.stringify(entry);
  if (entry.level === "error" || entry.level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

// ---------------------------------------------------------------------------
// Shared singleton
// ---------------------------------------------------------------------------

/** Default SDK-level logger instance. */
export const logger = new Logger({ service: "ascended-sdk" });
