/**
 * @module index
 * @description Public entry-point for the Ascended-SDK.
 *
 * Import from `@ascendstack/sdk` to access all clients, types, utilities,
 * event definitions, and tool contracts.
 *
 * @example
 * ```ts
 * import { DELClient, EventBusClient, AscendedEventType } from "@ascendstack/sdk";
 *
 * const del = new DELClient();
 * const bus = new EventBusClient();
 *
 * const run = await del.executePipeline({ pipelineName: "my-pipeline", input: {} });
 * await bus.publishEvent({
 *   eventType: AscendedEventType.PIPELINE_STARTED,
 *   source: "my-service",
 *   payload: { pipelineId: run.runId, pipelineName: "my-pipeline", input: {} },
 * });
 * ```
 */

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------
export { config, loadConfig } from "./core/config";
export type { SDKConfig } from "./core/config";

export {
  ServiceName,
  DEFAULT_HEADERS,
  DEFAULT_RETRY_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  AUTH_HEADER,
  CORRELATION_ID_HEADER,
  EVENT_NAMESPACE,
} from "./core/constants";
export type { ServiceName as ServiceNameType } from "./core/constants";

export { withRetry } from "./core/retry";
export type { RetryOptions } from "./core/retry";

export { httpRequest, httpGet, httpPost, httpPut, httpDelete, HttpError } from "./core/http";
export type { HttpMethod, HttpRequestOptions } from "./core/http";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export { TokenProvider, envTokenFetcher } from "./auth/tokenProvider";
export type { TokenInfo, TokenFetcher, TokenProviderOptions } from "./auth/tokenProvider";

export { AuthManager } from "./auth/authManager";
export type { AuthManagerOptions } from "./auth/authManager";

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
export { Logger, logger } from "./utils/logger";
export type { LogLevel, LogEntry, LoggerOptions } from "./utils/logger";

export { validate, validateOrThrow, z } from "./utils/validator";
export type {
  ValidationResult,
  ValidationSuccess,
  ValidationFailure,
  ValidationError,
} from "./utils/validator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export { ok, err } from "./types/common.types";
export type {
  UUID,
  ISODateString,
  SemVer,
  PaginationParams,
  PaginationMeta,
  ServiceIdentity,
  SDKError,
  Result,
  Ok,
  Err,
} from "./types/common.types";

export type {
  ApiResponse,
  ApiErrorResponse,
  PaginatedApiResponse,
  RequestMeta,
  HealthCheckResponse,
} from "./types/api.types";

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export { AscendedEventType } from "./events/eventTypes";
export type {
  BaseEvent,
  AscendedEvent,
  PipelineStartedPayload,
  PipelineCompletedPayload,
  PipelineFailedPayload,
  AgentStartedPayload,
  AgentCompletedPayload,
  AgentFailedPayload,
  AgentToolCalledPayload,
  DocumentCreatedPayload,
  SystemErrorPayload,
} from "./events/eventTypes";

export {
  BaseEventSchema,
  AscendedEventSchema,
  PipelineStartedEventSchema,
  PipelineCompletedEventSchema,
  PipelineFailedEventSchema,
  AgentStartedEventSchema,
  AgentCompletedEventSchema,
  AgentFailedEventSchema,
  SystemErrorEventSchema,
  DocumentCreatedEventSchema,
} from "./events/eventSchemas";
export type { AscendedEventSchemaType } from "./events/eventSchemas";

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
export type {
  ToolDefinition,
  ToolInputSchema,
  ToolProperty,
  ToolPropertyType,
  ToolExecutionRequest,
  ToolExecutionResponse,
  ToolRegistryEntry,
} from "./tools/toolTypes";

export {
  ToolExecutionRequestSchema,
  ToolExecutionResponseSchema,
  ToolInputSchemaSchema,
} from "./tools/toolSchemas";
export type {
  ToolExecutionRequestInput,
  ToolExecutionResponseInput,
} from "./tools/toolSchemas";

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
export { BaseClient } from "./clients/baseClient";
export type { BaseClientOptions } from "./clients/baseClient";

export { DELClient } from "./clients/delClient";
export type {
  ExecutePipelineRequest,
  ExecutePipelineResponse,
  PipelineStatus,
  PipelineStatusResponse,
  PipelineStepStatus,
} from "./clients/delClient";

export { EventBusClient } from "./clients/eventBusClient";
export type {
  PublishEventRequest,
  PublishEventResponse,
  SubscribeOptions,
  SubscriptionHandle,
  EventPayload,
} from "./clients/eventBusClient";

export { AIClient } from "./clients/aiClient";
export type {
  PromptRequest,
  PromptResponse,
  ChatMessage,
  AIModel,
  EmbeddingRequest,
  EmbeddingResponse,
} from "./clients/aiClient";

export { DBClient } from "./clients/dbClient";
export type {
  QueryRequest,
  QueryResult,
  InsertRequest,
  UpdateRequest,
  VectorSearchRequest,
  VectorSearchResult,
} from "./clients/dbClient";
