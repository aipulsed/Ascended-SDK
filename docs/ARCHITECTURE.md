# Architecture

This document describes the system design of Ascended-SDK, how it fits into the broader AscendStack ecosystem, and the principles that govern its evolution.

---

## 1. Position in the System

```
┌─────────────────────────────────────────────────────────────────┐
│                      Applications Layer                          │
│          AscendStack-AI-OS  │  Web  │  Mobile  │  CLI           │
└────────────────────────────┬────────────────────────────────────┘
                             │  imports @ascendstack/sdk
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Ascended-SDK                               │
│                                                                  │
│   DELClient   EventBusClient   DBClient   AIClient              │
│       │             │              │           │                 │
│       └─────────────┴──────────────┴───────────┘                │
│                         BaseClient                               │
│               (auth · retry · logging · http)                   │
└──────┬──────────────┬───────────────┬─────────────┬─────────────┘
       │              │               │             │
       ▼              ▼               ▼             ▼
   DEL Service   Event Bus       Database       AI Fallback
   (pipelines    (pub/sub)       (Postgres +    (OpenAI /
    + tools)                      pgvector)      Ollama)
```

**Rule:** Nothing skips the SDK layer. Applications and agents only import `@ascendstack/sdk`.

---

## 2. Module Breakdown

### 2.1 `core/`

| File | Responsibility |
|---|---|
| `config.ts` | Reads `process.env` and exposes a typed `SDKConfig` singleton. |
| `constants.ts` | Named constants — service identifiers, header keys, default values. |
| `retry.ts` | `withRetry(fn, opts)` — exponential back-off with full jitter and a pluggable `isRetryable` predicate. |
| `http.ts` | `httpRequest<T>()` — the **only** place `fetch` is called. Handles timeouts via `AbortController`, JSON parsing, and translates non-2xx into `HttpError`. |

### 2.2 `auth/`

| File | Responsibility |
|---|---|
| `tokenProvider.ts` | Caches a bearer token in memory. Proactively refreshes it before expiry. Accepts any async fetcher function. |
| `authManager.ts` | Wraps `TokenProvider`. Provides `getHeaders()` that returns `{ Authorization, X-Correlation-Id }`. Invalidates the token on 401. |

### 2.3 `utils/`

| File | Responsibility |
|---|---|
| `logger.ts` | Structured JSON logger with levels `debug / info / warn / error`. Writes to stdout/stderr. Accepts a custom `write` function for testing or log forwarding. |
| `validator.ts` | Thin Zod wrapper. `validate()` returns a typed result union; `validateOrThrow()` throws on failure. Re-exports `z` for schema construction. |

### 2.4 `types/`

| File | Responsibility |
|---|---|
| `common.types.ts` | `UUID`, `ISODateString`, `Result<T>`, `SDKError`, `PaginationParams/Meta`. |
| `api.types.ts` | `ApiResponse<T>`, `ApiErrorResponse`, `PaginatedApiResponse<T>`, `HealthCheckResponse`. |

### 2.5 `events/`

| File | Responsibility |
|---|---|
| `eventTypes.ts` | `AscendedEventType` enum (all event names). `BaseEvent<TType, TPayload>` envelope. Per-event payload interfaces. `AscendedEvent` discriminated union. |
| `eventSchemas.ts` | Zod schemas for every event type. `AscendedEventSchema` discriminated-union validator for inbound messages. |

### 2.6 `tools/`

| File | Responsibility |
|---|---|
| `toolTypes.ts` | `ToolDefinition<TInput, TOutput>` contract. `ToolExecutionRequest/Response`. `ToolInputSchema` (JSON-Schema compatible). |
| `toolSchemas.ts` | Zod schemas for tool execution requests and responses. |

### 2.7 `clients/`

| File | Responsibility |
|---|---|
| `baseClient.ts` | Abstract class providing `request<T>()` — combines auth, retry, and HTTP. All clients extend this. |
| `delClient.ts` | `executePipeline()`, `getPipelineStatus()`, `cancelPipeline()`, `executeTool()`, `listTools()`. |
| `eventBusClient.ts` | `publishEvent()` (validates envelope before sending), `subscribeEvent()`, `unsubscribeEvent()`, `pollEvents()`. |
| `aiClient.ts` | `sendPrompt()`, `generateEmbedding()`, `listModels()`. |
| `dbClient.ts` | `query()`, `insert()`, `update()`, `delete()`, `list()`, `vectorSearch()`. |

---

## 3. Request Lifecycle

```
Caller
  │
  ├─ new DELClient()
  │       │
  │       ├─ BaseClient constructor
  │       │     ├─ AuthManager (wraps TokenProvider)
  │       │     ├─ Logger
  │       │     └─ RetryOptions
  │       │
  │       └─ client.executePipeline(...)
  │               │
  │               └─ BaseClient.request<T>()
  │                       │
  │                       └─ withRetry(async () => {
  │                               auth.getHeaders()          ← injects Bearer token + correlation ID
  │                               httpRequest(url, opts)     ← the only place fetch() is called
  │                               // on HttpError(401): auth.invalidateToken()
  │                               // on other error: rethrow (retry decides)
  │                           }, retryOptions)
  │
  └─ typed response T
```

---

## 4. Event Flow

```
Service A
  └─ EventBusClient.publishEvent(event)
        │
        ├─ buildEnvelope()          ← generates id + timestamp
        ├─ validate(AscendedEventSchema, envelope)   ← Zod validation
        └─ BaseClient.request(POST /events/publish)

Event Bus Service
  └─ routes to subscribed consumers

Service B
  └─ EventBusClient.pollEvents(subscriptionId)
        └─ BaseClient.request(GET /events/subscriptions/:id/poll)
              └─ returns BaseEvent[]
```

---

## 5. Retry Strategy

All clients use exponential back-off with **full jitter** to prevent thundering herds:

```
delay = random(0, baseDelay * 2^(attempt - 1))
```

| Setting | Default |
|---|---|
| Max attempts | 3 |
| Base delay | 200 ms |
| Max delay (attempt 3) | up to 800 ms (random) |

Callers can override via `RetryOptions` in the client constructor.

---

## 6. Authentication

The SDK uses **Bearer token** authentication for all service calls.

```
┌─────────────┐     getToken()     ┌───────────────┐
│ AuthManager │ ──────────────────►│ TokenProvider  │
│             │◄────────────────── │  (cached)     │
│             │    "my-token"      │               │
│             │                    │  fetcher()    │
│             │                    │  ← envTokenFetcher()
└─────────────┘                    └───────────────┘
       │
       │  getHeaders()
       ▼
  { Authorization: "Bearer my-token", X-Correlation-Id: "uuid" }
```

For dynamic environments (OAuth, short-lived tokens), supply a custom `TokenFetcher`:

```ts
const provider = new TokenProvider({
  fetcher: async () => {
    const res = await fetchNewToken();
    return { token: res.accessToken, expiresAt: Date.now() + res.expiresIn * 1000 };
  },
});
```

---

## 7. Schema Validation

All event payloads are validated with Zod at both publish and consume boundaries:

```
publishEvent(event)
  │
  ├─ buildEnvelope()
  ├─ validate(AscendedEventSchema, envelope)  ← fails fast with field-level errors
  └─ POST /events/publish
```

This guarantees that no malformed event ever reaches the bus.

---

## 8. Design Principles

### 8.1 Determinism First
All execution flows through the DEL (`DELClient`). The AI fallback (`AIClient`) is invoked only when deterministic execution is explicitly unavailable.

### 8.2 Single Source of Truth
Event schemas, tool schemas, API response shapes — all defined once in this SDK. No duplication across repos.

### 8.3 Decoupling
Services depend on `@ascendstack/sdk`, not on each other. Swapping a service implementation (e.g., switching AI providers) only changes the SDK internals.

### 8.4 Fail-Safe
Every client retries transient failures automatically. `HttpError` carries the status code, allowing callers to distinguish retryable (5xx) from non-retryable (4xx) errors.

### 8.5 Observability
Every request is tagged with a `X-Correlation-Id` header for distributed tracing. The structured logger emits JSON compatible with Datadog, CloudWatch, and Logtail.

---

## 9. Future Additions

| Addition | Description |
|---|---|
| `DocumentEngineClient` | Client for Ascended-Document-Engine (file ingestion, OCR, chunking) |
| `EmailEngineClient` | Client for Ascended-Email-Engine (send, track, template) |
| `SchedulerClient` | Client for a job scheduler (cron, one-off, delayed) |
| `WebhookClient` | Inbound webhook validation and outbound webhook dispatch |
| OpenTelemetry integration | Span propagation through the correlation ID pipeline |
| Circuit breaker | Prevent cascading failures when a downstream service is unhealthy |
| Rate-limit handling | Automatic `Retry-After` header parsing and back-off |
| OpenAPI spec generation | Auto-generate OpenAPI 3.1 schemas from TypeScript types |
| gRPC transport | Optional gRPC client transport for high-throughput workloads |
