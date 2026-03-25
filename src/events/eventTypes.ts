/**
 * @module events/eventTypes
 * @description Canonical event-type definitions for the AscendStack event bus.
 *
 * All event names are namespaced under `"ascended."` to avoid collisions with
 * third-party or infrastructure events.  Every event that flows through the
 * event bus MUST use one of these typed strings as its `eventType` field.
 */

import { UUID, ISODateString } from "../types/common.types";

// ---------------------------------------------------------------------------
// Event type enum
// ---------------------------------------------------------------------------

/**
 * Exhaustive list of first-party AscendStack event types.
 *
 * Add new entries here and update the corresponding Zod schemas in
 * `eventSchemas.ts` to keep validation in sync.
 */
export enum AscendedEventType {
  // --- Pipeline / DEL ---
  PIPELINE_STARTED = "ascended.pipeline.started",
  PIPELINE_COMPLETED = "ascended.pipeline.completed",
  PIPELINE_FAILED = "ascended.pipeline.failed",
  PIPELINE_STEP_COMPLETED = "ascended.pipeline.step.completed",

  // --- Agent lifecycle ---
  AGENT_STARTED = "ascended.agent.started",
  AGENT_COMPLETED = "ascended.agent.completed",
  AGENT_FAILED = "ascended.agent.failed",
  AGENT_TOOL_CALLED = "ascended.agent.tool.called",

  // --- Database ---
  DB_QUERY_EXECUTED = "ascended.db.query.executed",
  DB_RECORD_CREATED = "ascended.db.record.created",
  DB_RECORD_UPDATED = "ascended.db.record.updated",
  DB_RECORD_DELETED = "ascended.db.record.deleted",

  // --- Document engine ---
  DOCUMENT_CREATED = "ascended.document.created",
  DOCUMENT_PROCESSED = "ascended.document.processed",
  DOCUMENT_FAILED = "ascended.document.failed",

  // --- Auth ---
  AUTH_TOKEN_ISSUED = "ascended.auth.token.issued",
  AUTH_TOKEN_REVOKED = "ascended.auth.token.revoked",

  // --- System ---
  SYSTEM_ERROR = "ascended.system.error",
  SYSTEM_HEALTH_CHANGED = "ascended.system.health.changed",
}

// ---------------------------------------------------------------------------
// Base event envelope
// ---------------------------------------------------------------------------

/**
 * Base shape shared by every event that flows through the bus.
 * Service-specific payloads extend this type.
 */
export interface BaseEvent<
  TType extends AscendedEventType,
  TPayload extends object,
> {
  /** Unique identifier for this event instance. */
  id: UUID;
  /** Namespaced event type string. */
  eventType: TType;
  /** ISO-8601 timestamp of when the event was emitted. */
  timestamp: ISODateString;
  /** Name of the service that emitted the event. */
  source: string;
  /** Structured, event-specific payload. */
  payload: TPayload;
  /** Optional correlation ID linking related events. */
  correlationId?: UUID;
  /** Schema version of this event (for forward compatibility). */
  schemaVersion?: string;
}

// ---------------------------------------------------------------------------
// Typed event definitions
// ---------------------------------------------------------------------------

export interface PipelineStartedPayload {
  pipelineId: UUID;
  pipelineName: string;
  input: Record<string, unknown>;
}

export interface PipelineCompletedPayload {
  pipelineId: UUID;
  pipelineName: string;
  durationMs: number;
  output: unknown;
}

export interface PipelineFailedPayload {
  pipelineId: UUID;
  pipelineName: string;
  error: string;
  step?: string;
}

export interface AgentStartedPayload {
  agentId: UUID;
  agentName: string;
  input: Record<string, unknown>;
}

export interface AgentCompletedPayload {
  agentId: UUID;
  agentName: string;
  durationMs: number;
  output: unknown;
}

export interface AgentFailedPayload {
  agentId: UUID;
  agentName: string;
  error: string;
}

export interface AgentToolCalledPayload {
  agentId: UUID;
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
}

export interface DocumentCreatedPayload {
  documentId: UUID;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface SystemErrorPayload {
  service: string;
  error: string;
  stack?: string;
}

// Convenience union of all strongly-typed events
export type AscendedEvent =
  | BaseEvent<AscendedEventType.PIPELINE_STARTED, PipelineStartedPayload>
  | BaseEvent<AscendedEventType.PIPELINE_COMPLETED, PipelineCompletedPayload>
  | BaseEvent<AscendedEventType.PIPELINE_FAILED, PipelineFailedPayload>
  | BaseEvent<AscendedEventType.AGENT_STARTED, AgentStartedPayload>
  | BaseEvent<AscendedEventType.AGENT_COMPLETED, AgentCompletedPayload>
  | BaseEvent<AscendedEventType.AGENT_FAILED, AgentFailedPayload>
  | BaseEvent<AscendedEventType.AGENT_TOOL_CALLED, AgentToolCalledPayload>
  | BaseEvent<AscendedEventType.DOCUMENT_CREATED, DocumentCreatedPayload>
  | BaseEvent<AscendedEventType.SYSTEM_ERROR, SystemErrorPayload>;
