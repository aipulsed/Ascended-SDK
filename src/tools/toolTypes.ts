/**
 * @module tools/toolTypes
 * @description Type definitions for the AscendStack tool system.
 *
 * Tools are discrete, deterministic units of work executed through the DEL.
 * Each tool has a strongly-typed request / response contract and is registered
 * in a central `ToolRegistry`.
 */

import { UUID, ISODateString, Result } from "../types/common.types";

// ---------------------------------------------------------------------------
// Tool parameter / property schema (JSON-Schema-compatible subset)
// ---------------------------------------------------------------------------

/** Supported JSON-Schema-like property types for tool parameters. */
export type ToolPropertyType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "null";

/** Describes a single input parameter for a tool. */
export interface ToolProperty {
  type: ToolPropertyType;
  description?: string;
  enum?: (string | number)[];
  items?: ToolProperty; // for "array" type
  properties?: Record<string, ToolProperty>; // for "object" type
  required?: string[]; // for "object" type
}

/** JSON-Schema-like input schema for a tool. */
export interface ToolInputSchema {
  type: "object";
  properties: Record<string, ToolProperty>;
  required?: string[];
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

/**
 * Metadata and execution contract for a single tool.
 *
 * @typeParam TInput   Shape of the validated input object.
 * @typeParam TOutput  Shape of the successful output object.
 */
export interface ToolDefinition<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> {
  /** Unique name used to reference the tool in pipelines (e.g. `"send-email"`). */
  name: string;
  /** Short human-readable description shown in agent planning contexts. */
  description: string;
  /** JSON-Schema-compatible schema that describes and validates the input. */
  inputSchema: ToolInputSchema;
  /**
   * The execution implementation.
   * Must be deterministic and side-effect free unless explicitly documented.
   */
  execute(input: TInput): Promise<Result<TOutput>>;
}

// ---------------------------------------------------------------------------
// Tool execution request / response
// ---------------------------------------------------------------------------

/** Request envelope sent to the DEL when executing a tool. */
export interface ToolExecutionRequest {
  /** Unique request ID for tracing. */
  requestId: UUID;
  /** Name of the tool to execute. */
  toolName: string;
  /** Validated input object for the tool. */
  input: Record<string, unknown>;
  /** Optional caller correlation ID. */
  correlationId?: UUID;
  /** ISO-8601 timestamp of request creation. */
  createdAt?: ISODateString;
}

/** Response envelope returned by the DEL after executing a tool. */
export interface ToolExecutionResponse<TOutput = unknown> {
  /** Mirrors the `requestId` from the request. */
  requestId: UUID;
  /** Name of the executed tool. */
  toolName: string;
  /** Whether execution succeeded. */
  success: boolean;
  /** The output value on success. */
  output?: TOutput;
  /** Human-readable error message on failure. */
  error?: string;
  /** Wall-clock duration of the execution in milliseconds. */
  durationMs: number;
  /** ISO-8601 timestamp of response generation. */
  completedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Tool registry entry
// ---------------------------------------------------------------------------

/**
 * Entry stored in the `ToolRegistry`.  Wraps the definition together with
 * registration metadata.
 */
export interface ToolRegistryEntry {
  definition: ToolDefinition;
  registeredAt: ISODateString;
  /** Optional semver string indicating the tool implementation version. */
  version?: string;
}
