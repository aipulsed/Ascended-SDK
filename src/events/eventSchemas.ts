/**
 * @module events/eventSchemas
 * @description Zod schemas for validating AscendStack event envelopes.
 *
 * Every event published to or consumed from the event bus is validated
 * against the corresponding schema before processing, preventing malformed
 * payloads from propagating through the system.
 */

import { z } from "../utils/validator";
import { AscendedEventType } from "./eventTypes";

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

const uuidSchema = z.string().uuid();
const isoDateSchema = z.string().datetime();

// ---------------------------------------------------------------------------
// Base event schema
// ---------------------------------------------------------------------------

/**
 * Schema for the fields present in every event envelope.
 * Payload-specific schemas extend this.
 */
export const BaseEventSchema = z.object({
  id: uuidSchema,
  eventType: z.nativeEnum(AscendedEventType),
  timestamp: isoDateSchema,
  source: z.string().min(1),
  correlationId: uuidSchema.optional(),
  schemaVersion: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Payload schemas
// ---------------------------------------------------------------------------

export const PipelineStartedPayloadSchema = z.object({
  pipelineId: uuidSchema,
  pipelineName: z.string().min(1),
  input: z.record(z.unknown()),
});

export const PipelineCompletedPayloadSchema = z.object({
  pipelineId: uuidSchema,
  pipelineName: z.string().min(1),
  durationMs: z.number().nonnegative(),
  output: z.unknown(),
});

export const PipelineFailedPayloadSchema = z.object({
  pipelineId: uuidSchema,
  pipelineName: z.string().min(1),
  error: z.string().min(1),
  step: z.string().optional(),
});

export const AgentStartedPayloadSchema = z.object({
  agentId: uuidSchema,
  agentName: z.string().min(1),
  input: z.record(z.unknown()),
});

export const AgentCompletedPayloadSchema = z.object({
  agentId: uuidSchema,
  agentName: z.string().min(1),
  durationMs: z.number().nonnegative(),
  output: z.unknown(),
});

export const AgentFailedPayloadSchema = z.object({
  agentId: uuidSchema,
  agentName: z.string().min(1),
  error: z.string().min(1),
});

export const AgentToolCalledPayloadSchema = z.object({
  agentId: uuidSchema,
  toolName: z.string().min(1),
  input: z.record(z.unknown()),
  output: z.unknown(),
});

export const DocumentCreatedPayloadSchema = z.object({
  documentId: uuidSchema,
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().nonnegative(),
});

export const SystemErrorPayloadSchema = z.object({
  service: z.string().min(1),
  error: z.string().min(1),
  stack: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Full event schemas (envelope + payload)
// ---------------------------------------------------------------------------

export const PipelineStartedEventSchema = BaseEventSchema.extend({
  eventType: z.literal(AscendedEventType.PIPELINE_STARTED),
  payload: PipelineStartedPayloadSchema,
});

export const PipelineCompletedEventSchema = BaseEventSchema.extend({
  eventType: z.literal(AscendedEventType.PIPELINE_COMPLETED),
  payload: PipelineCompletedPayloadSchema,
});

export const PipelineFailedEventSchema = BaseEventSchema.extend({
  eventType: z.literal(AscendedEventType.PIPELINE_FAILED),
  payload: PipelineFailedPayloadSchema,
});

export const AgentStartedEventSchema = BaseEventSchema.extend({
  eventType: z.literal(AscendedEventType.AGENT_STARTED),
  payload: AgentStartedPayloadSchema,
});

export const AgentCompletedEventSchema = BaseEventSchema.extend({
  eventType: z.literal(AscendedEventType.AGENT_COMPLETED),
  payload: AgentCompletedPayloadSchema,
});

export const AgentFailedEventSchema = BaseEventSchema.extend({
  eventType: z.literal(AscendedEventType.AGENT_FAILED),
  payload: AgentFailedPayloadSchema,
});

export const AgentToolCalledEventSchema = BaseEventSchema.extend({
  eventType: z.literal(AscendedEventType.AGENT_TOOL_CALLED),
  payload: AgentToolCalledPayloadSchema,
});

export const DocumentCreatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal(AscendedEventType.DOCUMENT_CREATED),
  payload: DocumentCreatedPayloadSchema,
});

export const SystemErrorEventSchema = BaseEventSchema.extend({
  eventType: z.literal(AscendedEventType.SYSTEM_ERROR),
  payload: SystemErrorPayloadSchema,
});

/**
 * Discriminated-union schema that validates any known AscendStack event.
 * Use this at the event-bus consumer boundary to parse inbound messages.
 */
export const AscendedEventSchema = z.discriminatedUnion("eventType", [
  PipelineStartedEventSchema,
  PipelineCompletedEventSchema,
  PipelineFailedEventSchema,
  AgentStartedEventSchema,
  AgentCompletedEventSchema,
  AgentFailedEventSchema,
  AgentToolCalledEventSchema,
  DocumentCreatedEventSchema,
  SystemErrorEventSchema,
]);

export type AscendedEventSchemaType = z.infer<typeof AscendedEventSchema>;
