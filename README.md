# Ascended-SDK

> **The unified communication, contract, and integration layer for the entire AscendStack ecosystem.**

[![CI](https://github.com/aipulsed/Ascended-SDK/actions/workflows/ci.yml/badge.svg)](https://github.com/aipulsed/Ascended-SDK/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## What Is Ascended-SDK?

Ascended-SDK is the **single dependency** that enables every service, agent, engine, and application in the AscendStack ecosystem to communicate with each other safely, reliably, and with guaranteed type safety.

Without the SDK, every service must discover, authenticate against, and parse responses from every other service it calls — creating a fragile mesh of incompatible HTTP calls, duplicated schemas, and inconsistent error handling.

With the SDK, **any service is accessible through a single, typed, retry-safe client**.

---

## Key Capabilities

| Capability | What it gives you |
|---|---|
| **Typed clients** | DEL, Event Bus, AI Fallback, Database — each exposed through a strongly-typed class |
| **Retry + back-off** | Every client automatically retries on transient failures using exponential back-off with jitter |
| **Auth management** | Token caching, proactive refresh, and header injection — transparent to callers |
| **Event contracts** | Canonical event types, Zod-validated envelopes, discriminated-union schemas |
| **Tool contracts** | Typed tool request/response, JSON-Schema-compatible input schemas |
| **Shared types** | `Result<T>`, `ApiResponse<T>`, `PaginatedApiResponse<T>` — used system-wide |
| **Structured logging** | JSON-structured, levelled logger ready for any log aggregation platform |
| **Schema validation** | Zod-powered `validate()` / `validateOrThrow()` helpers |

---

## Installation

```bash
npm install @ascendstack/sdk
# or
pnpm add @ascendstack/sdk
# or
yarn add @ascendstack/sdk
```

---

## Quick Start

```ts
import {
  DELClient,
  EventBusClient,
  DBClient,
  AIClient,
  AscendedEventType,
} from "@ascendstack/sdk";

// ── 1. Execute a pipeline via DEL ───────────────────────────────────────────
const del = new DELClient();

const run = await del.executePipeline({
  pipelineName: "invoice-generation",
  input: { customerId: "cust_123", items: [] },
});

console.log(run.runId); // "550e8400-e29b-41d4-a716-446655440000"

// ── 2. Publish an event ──────────────────────────────────────────────────────
const bus = new EventBusClient();

await bus.publishEvent({
  eventType: AscendedEventType.PIPELINE_STARTED,
  source: "my-service",
  payload: {
    pipelineId: run.runId,
    pipelineName: "invoice-generation",
    input: {},
  },
});

// ── 3. Query the database ────────────────────────────────────────────────────
const db = new DBClient();

const result = await db.query<{ id: string; name: string }>({
  sql: "SELECT id, name FROM customers WHERE active = $1",
  params: [true],
});

console.log(result.rows);

// ── 4. AI fallback (last resort only) ───────────────────────────────────────
const ai = new AIClient();

const completion = await ai.sendPrompt({
  messages: [{ role: "user", content: "Summarise this invoice." }],
  model: "auto",
});

console.log(completion.content);
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DEL_BASE_URL` | `http://localhost:4000` | DEL service base URL |
| `EVENT_BUS_BASE_URL` | `http://localhost:4001` | Event Bus base URL |
| `AI_BASE_URL` | `http://localhost:4002` | AI Fallback base URL |
| `DB_BASE_URL` | `http://localhost:4003` | Database service base URL |
| `SDK_TIMEOUT_MS` | `10000` | Default request timeout (ms) |
| `SDK_RETRIES` | `3` | Default retry attempts |
| `SERVICE_TOKEN` | *(required)* | Bearer token for service-to-service auth |

---

## Repository Structure

```
ascended-sdk/
├─ src/
│  ├─ clients/
│  │  ├─ baseClient.ts       ← Abstract HTTP base (all clients extend this)
│  │  ├─ delClient.ts        ← Deterministic Execution Layer client
│  │  ├─ eventBusClient.ts   ← Event Bus client
│  │  ├─ aiClient.ts         ← AI Fallback client
│  │  └─ dbClient.ts         ← Database / vector-store client
│  │
│  ├─ core/
│  │  ├─ config.ts           ← Env-based configuration loader
│  │  ├─ constants.ts        ← Shared named constants
│  │  ├─ retry.ts            ← Exponential back-off retry utility
│  │  └─ http.ts             ← Low-level fetch wrapper
│  │
│  ├─ auth/
│  │  ├─ authManager.ts      ← Header injection + token refresh
│  │  └─ tokenProvider.ts    ← Token cache + fetcher abstraction
│  │
│  ├─ events/
│  │  ├─ eventTypes.ts       ← Event enums + typed event interfaces
│  │  └─ eventSchemas.ts     ← Zod schemas for every event type
│  │
│  ├─ tools/
│  │  ├─ toolTypes.ts        ← Tool definition + execution request/response
│  │  └─ toolSchemas.ts      ← Zod schemas for tool contracts
│  │
│  ├─ types/
│  │  ├─ api.types.ts        ← API response envelopes
│  │  └─ common.types.ts     ← UUID, Result<T>, SDKError, pagination
│  │
│  ├─ utils/
│  │  ├─ logger.ts           ← Structured JSON logger
│  │  └─ validator.ts        ← Zod validation helpers
│  │
│  └─ index.ts               ← Public exports
│
├─ tests/
│  └─ sdk.test.ts            ← 45 unit tests
│
├─ docs/
│  ├─ ARCHITECTURE.md        ← System design and data-flow diagrams
│  └─ GETTING_STARTED.md     ← Step-by-step integration guide
│
├─ .github/
│  └─ workflows/
│     └─ ci.yml              ← CI pipeline (build + test on Node 20 & 22)
│
├─ package.json
├─ tsconfig.json
└─ README.md
```

---

## Development

```bash
# Install dependencies
npm install

# Type-check (no emit)
npm run lint

# Compile to dist/
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Clean build artifacts
npm run clean
```

---

## Documentation

| Document | Description |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data-flow diagrams, design principles |
| [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) | Step-by-step integration guide for new services |

---

## Design Rules

1. **Apps talk to SDK only** — no direct service-to-service HTTP calls outside the SDK.
2. **SDK never talks to apps** — it is a library, not a server.
3. **All execution flows through DEL** — agents and apps must use `DELClient`, never raw HTTP to tool endpoints.
4. **All events flow through Event Bus** — use `EventBusClient`, never raw HTTP to service event endpoints.
5. **AI is last resort** — `AIClient` is invoked only when deterministic paths are exhausted.

---

## License

MIT © AscendStack