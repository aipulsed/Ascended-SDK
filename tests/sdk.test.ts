/**
 * @file tests/sdk.test.ts
 * @description Comprehensive tests for the Ascended-SDK.
 *
 * Tests cover:
 * - Core utilities (retry, config, constants)
 * - Auth layer (TokenProvider, AuthManager)
 * - Validation utilities
 * - Event schema validation
 * - Tool schema validation
 * - HTTP client (mocked fetch)
 * - Service clients (mocked HTTP layer)
 * - Logger
 */

// ---------------------------------------------------------------------------
// Setup: mock global fetch before any imports
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { withRetry, RetryOptions } from "../src/core/retry";
import { config, loadConfig } from "../src/core/config";
import { ServiceName, DEFAULT_RETRY_ATTEMPTS } from "../src/core/constants";
import { httpRequest, HttpError } from "../src/core/http";
import { TokenProvider, envTokenFetcher } from "../src/auth/tokenProvider";
import { AuthManager } from "../src/auth/authManager";
import { Logger, LogEntry } from "../src/utils/logger";
import { validate, validateOrThrow, z } from "../src/utils/validator";
import { ok, err } from "../src/types/common.types";
import { AscendedEventType } from "../src/events/eventTypes";
import {
  AscendedEventSchema,
  PipelineStartedEventSchema,
} from "../src/events/eventSchemas";
import {
  ToolExecutionRequestSchema,
  ToolExecutionResponseSchema,
} from "../src/tools/toolSchemas";
import { DELClient } from "../src/clients/delClient";
import { EventBusClient } from "../src/clients/eventBusClient";
import { AIClient } from "../src/clients/aiClient";
import { DBClient } from "../src/clients/dbClient";
import { BaseClientOptions } from "../src/clients/baseClient";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUUID(): string {
  return "00000000-0000-0000-0000-000000000001";
}

function makeISODate(): string {
  return "2024-01-01T00:00:00.000Z";
}

/**
 * Builds shared client options with a static token and no retries so tests
 * do not have to wait for back-off delays.
 */
function testClientOptions(baseUrl: string): Partial<BaseClientOptions> {
  return {
    baseUrl,
    timeoutMs: 5_000,
    retry: { attempts: 1 },
    auth: {
      tokenProvider: new TokenProvider({
        fetcher: async () => ({ token: "test-token" }),
      }),
    },
  };
}

/**
 * Configures `mockFetch` to return a successful JSON response.
 */
function mockFetchSuccess(data: unknown): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    text: async () => JSON.stringify({ success: true, data, timestamp: makeISODate() }),
  });
}

/**
 * Configures `mockFetch` to return an error response.
 */
function mockFetchError(status: number, body = "Internal Server Error"): void {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    text: async () => body,
  });
}

// ---------------------------------------------------------------------------
// 1. Core – retry
// ---------------------------------------------------------------------------

describe("withRetry", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the result of a successful function immediately", async () => {
    const fn = jest.fn().mockResolvedValue(42);
    const result = await withRetry(fn, { attempts: 3 });
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and eventually succeeds", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("success");

    const result = await withRetry(fn, { attempts: 3, baseDelayMs: 0 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws the last error after exhausting all attempts", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("always fails"));
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 0 })).rejects.toThrow(
      "always fails"
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("stops retrying immediately when isRetryable returns false", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("not retryable"));
    const options: RetryOptions = {
      attempts: 5,
      baseDelayMs: 0,
      isRetryable: () => false,
    };
    await expect(withRetry(fn, options)).rejects.toThrow("not retryable");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 2. Core – config
// ---------------------------------------------------------------------------

describe("config / loadConfig", () => {
  it("returns default URLs when env vars are not set", () => {
    const cfg = loadConfig();
    expect(cfg.delBaseUrl).toBeDefined();
    expect(cfg.eventBusBaseUrl).toBeDefined();
    expect(cfg.defaultRetries).toBeGreaterThan(0);
    expect(cfg.defaultTimeoutMs).toBeGreaterThan(0);
  });

  it("exports the singleton config object", () => {
    expect(config).toBeDefined();
    expect(typeof config.delBaseUrl).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// 3. Core – constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("ServiceName contains expected keys", () => {
    expect(ServiceName.DEL).toBe("ascended-del");
    expect(ServiceName.EVENT_BUS).toBe("ascended-event-bus");
    expect(ServiceName.SDK).toBe("ascended-sdk");
  });

  it("DEFAULT_RETRY_ATTEMPTS is a positive integer", () => {
    expect(Number.isInteger(DEFAULT_RETRY_ATTEMPTS)).toBe(true);
    expect(DEFAULT_RETRY_ATTEMPTS).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Auth – TokenProvider
// ---------------------------------------------------------------------------

describe("TokenProvider", () => {
  it("returns the token from the fetcher", async () => {
    const provider = new TokenProvider({
      fetcher: async () => ({ token: "my-token" }),
    });
    expect(await provider.getToken()).toBe("my-token");
  });

  it("caches the token and calls the fetcher only once", async () => {
    const fetcher = jest.fn().mockResolvedValue({ token: "cached-token" });
    const provider = new TokenProvider({ fetcher });
    await provider.getToken();
    await provider.getToken();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after invalidation", async () => {
    const fetcher = jest.fn().mockResolvedValue({ token: "fresh-token" });
    const provider = new TokenProvider({ fetcher });
    await provider.getToken();
    provider.invalidate();
    await provider.getToken();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("re-fetches when the token is expired", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      token: "expired-token",
      expiresAt: Date.now() - 1_000, // already expired
    });
    const provider = new TokenProvider({ fetcher, refreshBufferMs: 0 });
    await provider.getToken();
    await provider.getToken();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("envTokenFetcher throws when the env var is missing", async () => {
    delete process.env.MISSING_TOKEN_VAR;
    const fetcher = envTokenFetcher("MISSING_TOKEN_VAR");
    await expect(fetcher()).rejects.toThrow(
      'environment variable "MISSING_TOKEN_VAR" is not set'
    );
  });

  it("envTokenFetcher returns the token from the env var", async () => {
    process.env.TEST_TOKEN_VAR = "env-token";
    const fetcher = envTokenFetcher("TEST_TOKEN_VAR");
    const info = await fetcher();
    expect(info.token).toBe("env-token");
    delete process.env.TEST_TOKEN_VAR;
  });
});

// ---------------------------------------------------------------------------
// 5. Auth – AuthManager
// ---------------------------------------------------------------------------

describe("AuthManager", () => {
  it("returns Authorization and X-Correlation-Id headers", async () => {
    const manager = new AuthManager({
      tokenProvider: new TokenProvider({
        fetcher: async () => ({ token: "auth-token" }),
      }),
    });
    const headers = await manager.getHeaders();
    expect(headers["Authorization"]).toBe("Bearer auth-token");
    expect(headers["X-Correlation-Id"]).toBeDefined();
  });

  it("generates a unique correlation ID per call", async () => {
    const manager = new AuthManager({
      tokenProvider: new TokenProvider({
        fetcher: async () => ({ token: "t" }),
      }),
    });
    const h1 = await manager.getHeaders();
    const h2 = await manager.getHeaders();
    expect(h1["X-Correlation-Id"]).toBeDefined();
    expect(h2["X-Correlation-Id"]).toBeDefined();
    // IDs should differ between calls
    expect(h1["X-Correlation-Id"]).not.toBe(h2["X-Correlation-Id"]);
  });
});

// ---------------------------------------------------------------------------
// 6. Utils – Logger
// ---------------------------------------------------------------------------

describe("Logger", () => {
  it("calls the write function with the correct level and message", () => {
    const writes: LogEntry[] = [];
    const log = new Logger({
      write: (e) => writes.push(e),
      minLevel: "debug",
    });

    log.debug("debug msg", { foo: 1 });
    log.info("info msg");
    log.warn("warn msg");
    log.error("error msg", {}, new Error("oops"));

    expect(writes).toHaveLength(4);
    expect(writes[0].level).toBe("debug");
    expect(writes[1].level).toBe("info");
    expect(writes[2].level).toBe("warn");
    expect(writes[3].level).toBe("error");
    expect(writes[3].error?.message).toBe("oops");
  });

  it("suppresses messages below minLevel", () => {
    const writes: LogEntry[] = [];
    const log = new Logger({ write: (e) => writes.push(e), minLevel: "warn" });
    log.debug("silent");
    log.info("also silent");
    log.warn("visible");
    expect(writes).toHaveLength(1);
    expect(writes[0].level).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// 7. Utils – Validator
// ---------------------------------------------------------------------------

describe("validate / validateOrThrow", () => {
  const schema = z.object({ name: z.string(), age: z.number().positive() });

  it("returns success=true for valid data", () => {
    const result = validate(schema, { name: "Alice", age: 30 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Alice");
    }
  });

  it("returns success=false with errors for invalid data", () => {
    const result = validate(schema, { name: 123, age: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("validateOrThrow throws on invalid data", () => {
    expect(() => validateOrThrow(schema, { name: null })).toThrow(
      "Validation failed"
    );
  });

  it("validateOrThrow returns data on valid input", () => {
    const data = validateOrThrow(schema, { name: "Bob", age: 25 });
    expect(data.name).toBe("Bob");
  });
});

// ---------------------------------------------------------------------------
// 8. Types – Result helpers
// ---------------------------------------------------------------------------

describe("ok / err helpers", () => {
  it("ok creates a success result", () => {
    const result = ok({ id: "1" });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ id: "1" });
  });

  it("err creates a failure result", () => {
    const result = err("NOT_FOUND", "Resource not found", { id: "99" });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toBe("Resource not found");
  });
});

// ---------------------------------------------------------------------------
// 9. Events – schema validation
// ---------------------------------------------------------------------------

describe("Event schemas", () => {
  const validPipelineStarted = {
    id: makeUUID(),
    eventType: AscendedEventType.PIPELINE_STARTED,
    timestamp: makeISODate(),
    source: "test-service",
    payload: {
      pipelineId: makeUUID(),
      pipelineName: "my-pipeline",
      input: { key: "value" },
    },
  };

  it("validates a valid PIPELINE_STARTED event", () => {
    const result = validate(PipelineStartedEventSchema, validPipelineStarted);
    expect(result.success).toBe(true);
  });

  it("rejects an event with a missing required payload field", () => {
    const invalid = {
      ...validPipelineStarted,
      payload: { pipelineId: makeUUID() }, // missing pipelineName and input
    };
    const result = validate(PipelineStartedEventSchema, invalid);
    expect(result.success).toBe(false);
  });

  it("validates via discriminated union schema", () => {
    const result = validate(AscendedEventSchema, validPipelineStarted);
    expect(result.success).toBe(true);
  });

  it("rejects an unknown event type via discriminated union", () => {
    const invalid = { ...validPipelineStarted, eventType: "unknown.event" };
    const result = validate(AscendedEventSchema, invalid);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10. Tools – schema validation
// ---------------------------------------------------------------------------

describe("Tool schemas", () => {
  const validRequest = {
    requestId: makeUUID(),
    toolName: "send-email",
    input: { to: "user@example.com", subject: "Hello" },
  };

  it("validates a valid ToolExecutionRequest", () => {
    const result = validate(ToolExecutionRequestSchema, validRequest);
    expect(result.success).toBe(true);
  });

  it("rejects a request with an empty toolName", () => {
    const result = validate(ToolExecutionRequestSchema, {
      ...validRequest,
      toolName: "",
    });
    expect(result.success).toBe(false);
  });

  it("validates a valid ToolExecutionResponse", () => {
    const validResponse = {
      requestId: makeUUID(),
      toolName: "send-email",
      success: true,
      output: { messageId: "msg_123" },
      durationMs: 150,
      completedAt: makeISODate(),
    };
    const result = validate(ToolExecutionResponseSchema, validResponse);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 11. HTTP – httpRequest
// ---------------------------------------------------------------------------

describe("httpRequest", () => {
  beforeEach(() => mockFetch.mockReset());

  it("returns parsed JSON on a 2xx response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ hello: "world" }),
    });
    const result = await httpRequest<{ hello: string }>({
      url: "http://localhost/test",
      method: "GET",
    });
    expect(result.hello).toBe("world");
  });

  it("throws HttpError on a non-2xx response", async () => {
    mockFetchError(404, "Not found");
    await expect(
      httpRequest({ url: "http://localhost/missing", method: "GET" })
    ).rejects.toBeInstanceOf(HttpError);
  });

  it("throws on timeout via AbortController", async () => {
    mockFetch.mockImplementationOnce(
      () => new Promise((_, reject) => {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        reject(err);
      })
    );
    await expect(
      httpRequest({ url: "http://localhost/slow", method: "GET", timeoutMs: 1 })
    ).rejects.toThrow();
  });

  it("includes the request body in POST requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "{}",
    });
    await httpRequest({
      url: "http://localhost/post",
      method: "POST",
      body: { key: "value" },
    });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ key: "value" }));
  });
});

// ---------------------------------------------------------------------------
// 12. DELClient
// ---------------------------------------------------------------------------

describe("DELClient", () => {
  const BASE = "http://del-test.local";
  let client: DELClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new DELClient(testClientOptions(BASE) as Partial<BaseClientOptions>);
  });

  it("executePipeline calls POST /pipelines/execute and returns runId", async () => {
    const runResponse = { runId: makeUUID(), status: "pending", createdAt: makeISODate() };
    mockFetchSuccess(runResponse);

    const result = await client.executePipeline({
      pipelineName: "test-pipeline",
      input: { foo: "bar" },
    });

    expect(result.runId).toBe(runResponse.runId);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/pipelines/execute"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("getPipelineStatus calls GET /pipelines/:id/status", async () => {
    const statusResponse = {
      runId: makeUUID(),
      pipelineName: "test-pipeline",
      status: "completed",
      createdAt: makeISODate(),
      updatedAt: makeISODate(),
      steps: [],
    };
    mockFetchSuccess(statusResponse);

    const result = await client.getPipelineStatus(makeUUID());
    expect(result.status).toBe("completed");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/pipelines/"),
      expect.objectContaining({ method: "GET" })
    );
  });

  it("throws on HTTP errors", async () => {
    mockFetchError(500);
    await expect(
      client.executePipeline({ pipelineName: "bad", input: {} })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 13. EventBusClient
// ---------------------------------------------------------------------------

describe("EventBusClient", () => {
  const BASE = "http://eventbus-test.local";
  let client: EventBusClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new EventBusClient(testClientOptions(BASE) as Partial<BaseClientOptions>);
  });

  it("publishEvent validates the envelope and calls POST /events/publish", async () => {
    const publishResponse = {
      eventId: makeUUID(),
      eventType: AscendedEventType.PIPELINE_STARTED,
      publishedAt: makeISODate(),
    };
    mockFetchSuccess(publishResponse);

    const result = await client.publishEvent({
      eventType: AscendedEventType.PIPELINE_STARTED,
      source: "test-service",
      payload: {
        pipelineId: makeUUID(),
        pipelineName: "my-pipeline",
        input: {},
      },
    });

    expect(result.eventId).toBe(publishResponse.eventId);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/events/publish"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("subscribeEvent calls POST /events/subscribe", async () => {
    const subscriptionResponse = {
      subscriptionId: makeUUID(),
      eventTypes: [AscendedEventType.PIPELINE_STARTED],
      consumerGroup: "my-group",
      createdAt: makeISODate(),
    };
    mockFetchSuccess(subscriptionResponse);

    const result = await client.subscribeEvent({
      eventTypes: [AscendedEventType.PIPELINE_STARTED],
      consumerGroup: "my-group",
    });

    expect(result.subscriptionId).toBe(subscriptionResponse.subscriptionId);
  });
});

// ---------------------------------------------------------------------------
// 14. AIClient
// ---------------------------------------------------------------------------

describe("AIClient", () => {
  const BASE = "http://ai-test.local";
  let client: AIClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new AIClient(testClientOptions(BASE) as Partial<BaseClientOptions>);
  });

  it("sendPrompt calls POST /completions and returns content", async () => {
    const promptResponse = {
      requestId: makeUUID(),
      model: "gpt-4o",
      content: "Hello, world!",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: "stop",
      latencyMs: 200,
    };
    mockFetchSuccess(promptResponse);

    const result = await client.sendPrompt({
      messages: [{ role: "user", content: "Say hello" }],
    });

    expect(result.content).toBe("Hello, world!");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/completions"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("generateEmbedding calls POST /embeddings", async () => {
    const embeddingResponse = {
      model: "text-embedding-3-small",
      vector: [0.1, 0.2, 0.3],
      dimensions: 3,
    };
    mockFetchSuccess(embeddingResponse);

    const result = await client.generateEmbedding({ text: "hello" });
    expect(result.dimensions).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 15. DBClient
// ---------------------------------------------------------------------------

describe("DBClient", () => {
  const BASE = "http://db-test.local";
  let client: DBClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new DBClient(testClientOptions(BASE) as Partial<BaseClientOptions>);
  });

  it("rejects table names with path traversal characters", async () => {
    await expect(
      client.delete("../secret", makeUUID())
    ).rejects.toThrow("invalid table name");
  });

  it("query calls POST /query and returns rows", async () => {
    const queryResponse = {
      rows: [{ id: "1", name: "Alice" }],
      rowCount: 1,
      durationMs: 5,
    };
    mockFetchSuccess(queryResponse);

    const result = await client.query({
      sql: "SELECT id, name FROM users",
    });

    expect(result.rowCount).toBe(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/query"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("insert calls POST /records", async () => {
    const insertedRecord = { id: makeUUID(), name: "Bob" };
    mockFetchSuccess(insertedRecord);

    const result = await client.insert({
      table: "users",
      data: { name: "Bob" },
    });

    expect(result).toEqual(insertedRecord);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/records"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("vectorSearch calls POST /vector/search and returns results", async () => {
    const searchResults = [
      { row: { id: "doc-1", content: "hello" }, score: 0.95 },
    ];
    mockFetchSuccess(searchResults);

    const result = await client.vectorSearch({
      table: "documents",
      vectorColumn: "embedding",
      queryVector: [0.1, 0.2, 0.3],
      topK: 5,
    });

    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(0.95);
  });
});
