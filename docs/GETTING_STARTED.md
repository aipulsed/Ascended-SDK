# Getting Started with Ascended-SDK

This guide walks through integrating `@ascendstack/sdk` into a new service from scratch.

---

## Prerequisites

- Node.js ≥ 18
- TypeScript ≥ 5
- Access to one or more AscendStack services (DEL, Event Bus, Database, AI Fallback)

---

## Step 1 – Install the SDK

```bash
npm install @ascendstack/sdk
```

The SDK has a single runtime dependency: **Zod** (schema validation). Everything else is standard Node.js built-ins.

---

## Step 2 – Configure Environment Variables

Create a `.env` file in your project root (use `dotenv` or your framework's env loader):

```dotenv
# Required – authentication token for service-to-service calls
SERVICE_TOKEN=your-service-token-here

# Service base URLs (override defaults if your services run elsewhere)
DEL_BASE_URL=http://del.internal:4000
EVENT_BUS_BASE_URL=http://event-bus.internal:4001
AI_BASE_URL=http://ai-fallback.internal:4002
DB_BASE_URL=http://database.internal:4003

# Optional tuning
SDK_TIMEOUT_MS=15000
SDK_RETRIES=3
```

Load the variables before using the SDK:

```ts
import "dotenv/config"; // or your preferred env loader
import { DELClient } from "@ascendstack/sdk";
```

---

## Step 3 – Create Clients

Instantiate clients once (e.g., in a module-level singleton) and reuse them:

```ts
// src/sdk.ts
import { DELClient, EventBusClient, DBClient, AIClient } from "@ascendstack/sdk";

export const del = new DELClient();
export const bus = new EventBusClient();
export const db = new DBClient();
export const ai = new AIClient();
```

---

## Step 4 – Execute a Pipeline

```ts
import { del } from "./sdk";

const run = await del.executePipeline({
  pipelineName: "onboard-customer",
  input: {
    customerId: "cust_abc123",
    plan: "pro",
  },
});

console.log(`Pipeline started: ${run.runId}`);

// Poll until complete (in production, prefer event-driven status updates)
let status = await del.getPipelineStatus(run.runId);
while (status.status === "running" || status.status === "pending") {
  await new Promise((r) => setTimeout(r, 1_000));
  status = await del.getPipelineStatus(run.runId);
}

if (status.status === "completed") {
  console.log("Pipeline output:", status.output);
} else {
  console.error("Pipeline failed:", status.error);
}
```

---

## Step 5 – Publish and Subscribe to Events

### Publishing

```ts
import { bus } from "./sdk";
import { AscendedEventType } from "@ascendstack/sdk";

await bus.publishEvent({
  eventType: AscendedEventType.AGENT_COMPLETED,
  source: "my-agent-service",
  payload: {
    agentId: "agent_001",
    agentName: "onboarding-agent",
    durationMs: 1250,
    output: { status: "done" },
  },
});
```

### Subscribing (pull-based)

```ts
import { bus } from "./sdk";
import { AscendedEventType } from "@ascendstack/sdk";

// Register subscription once (e.g., at service startup)
const subscription = await bus.subscribeEvent({
  eventTypes: [AscendedEventType.PIPELINE_COMPLETED, AscendedEventType.PIPELINE_FAILED],
  consumerGroup: "my-service-consumers",
});

// Poll for events in a loop (or use a scheduled job)
const events = await bus.pollEvents(subscription.subscriptionId, 10);
for (const event of events) {
  console.log(`Received: ${event.eventType}`, event.payload);
}
```

---

## Step 6 – Query the Database

### SQL query

```ts
import { db } from "./sdk";

const result = await db.query<{ id: string; email: string }>({
  sql: "SELECT id, email FROM users WHERE tenant_id = $1 AND active = $2",
  params: ["tenant_abc", true],
});

console.log(`Found ${result.rowCount} users`);
```

### Insert a record

```ts
const newUser = await db.insert({
  table: "users",
  data: {
    id: crypto.randomUUID(),
    email: "alice@example.com",
    tenantId: "tenant_abc",
    active: true,
  },
});
```

### Vector similarity search

```ts
import { ai, db } from "./sdk";

// Generate embedding for the query
const { vector } = await ai.generateEmbedding({ text: "invoice payment overdue" });

// Find the most similar documents
const results = await db.vectorSearch({
  table: "documents",
  vectorColumn: "embedding",
  queryVector: vector,
  topK: 5,
  threshold: 0.75,
});

for (const { row, score } of results) {
  console.log(`Score: ${score.toFixed(3)}`, row);
}
```

---

## Step 7 – Use the AI Fallback

> ⚠️ Only use `AIClient` when deterministic execution via the DEL is not possible.

```ts
import { ai } from "./sdk";

const response = await ai.sendPrompt({
  messages: [
    { role: "system", content: "You are a concise summarisation assistant." },
    { role: "user", content: documentText },
  ],
  model: "auto",           // let the fallback service choose the best available model
  maxTokens: 512,
  temperature: 0.3,
});

console.log(response.content);
console.log(`Tokens used: ${response.usage.totalTokens}`);
```

---

## Step 8 – Validate Schemas

Use the built-in validation helpers to ensure data conforms to contracts:

```ts
import { validate, validateOrThrow, AscendedEventSchema } from "@ascendstack/sdk";

// Non-throwing – inspect result.success
const result = validate(AscendedEventSchema, inboundMessage);
if (!result.success) {
  console.error("Invalid event:", result.errors);
  return;
}
processEvent(result.data);

// Throwing – simpler when errors should propagate
const event = validateOrThrow(AscendedEventSchema, inboundMessage);
processEvent(event);
```

---

## Step 9 – Custom Auth (Advanced)

If your service uses dynamic tokens (e.g., OAuth client credentials):

```ts
import { TokenProvider, AuthManager, DELClient } from "@ascendstack/sdk";

const tokenProvider = new TokenProvider({
  fetcher: async () => {
    const res = await fetch("https://auth.example.com/token", {
      method: "POST",
      body: new URLSearchParams({ grant_type: "client_credentials", ... }),
    });
    const data = await res.json();
    return {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  },
  refreshBufferMs: 60_000, // refresh 1 minute before expiry
});

const del = new DELClient({
  auth: { tokenProvider },
});
```

---

## Step 10 – Custom Logger (Advanced)

Redirect SDK logs to your existing logging infrastructure:

```ts
import { Logger, DELClient } from "@ascendstack/sdk";

const myLogger = new Logger({
  service: "my-service",
  minLevel: "info",
  write: (entry) => {
    // Forward to your logging provider (Datadog, CloudWatch, etc.)
    myLoggingProvider.log(entry);
  },
});

const del = new DELClient({ logger: myLogger });
```

---

## Retry Configuration

Override retry behaviour per client:

```ts
import { DELClient } from "@ascendstack/sdk";
import { HttpError } from "@ascendstack/sdk";

const del = new DELClient({
  retry: {
    attempts: 5,
    baseDelayMs: 500,
    // Only retry on 5xx errors, not 4xx
    isRetryable: (err) => err instanceof HttpError && err.status >= 500,
  },
});
```

---

## Testing Your Service

Mock the SDK clients in tests using Jest:

```ts
import { DELClient } from "@ascendstack/sdk";

jest.mock("@ascendstack/sdk", () => ({
  DELClient: jest.fn().mockImplementation(() => ({
    executePipeline: jest.fn().mockResolvedValue({
      runId: "test-run-id",
      status: "pending",
      createdAt: new Date().toISOString(),
    }),
  })),
}));

describe("MyService", () => {
  it("starts a pipeline", async () => {
    const service = new MyService();
    const result = await service.processCustomer("cust_123");
    expect(result.runId).toBe("test-run-id");
  });
});
```

---

## Complete Example — Agent Service Skeleton

```ts
import "dotenv/config";
import {
  DELClient,
  EventBusClient,
  DBClient,
  AscendedEventType,
  Logger,
} from "@ascendstack/sdk";

const log = new Logger({ service: "onboarding-agent" });
const del = new DELClient();
const bus = new EventBusClient();
const db = new DBClient();

async function onboardCustomer(customerId: string): Promise<void> {
  log.info("Starting onboarding", { customerId });

  // 1. Run deterministic pipeline
  const run = await del.executePipeline({
    pipelineName: "onboard-customer",
    input: { customerId },
  });

  // 2. Store run reference
  await db.insert({
    table: "pipeline_runs",
    data: { id: run.runId, customerId, status: run.status },
  });

  // 3. Emit event
  await bus.publishEvent({
    eventType: AscendedEventType.PIPELINE_STARTED,
    source: "onboarding-agent",
    payload: {
      pipelineId: run.runId,
      pipelineName: "onboard-customer",
      input: { customerId },
    },
  });

  log.info("Onboarding pipeline started", { runId: run.runId });
}

onboardCustomer("cust_123").catch(console.error);
```

---

## Next Steps

- Read [docs/ARCHITECTURE.md](ARCHITECTURE.md) to understand how the SDK fits into the broader system.
- Explore the TypeScript types in `src/types/`, `src/events/`, and `src/tools/` — they are the contracts every service must honour.
- When building a new AscendStack service, copy this skeleton and swap in your own pipeline names and domain logic.
