/**
 * @module tools/toolSchemas
 * @description Zod schemas for validating tool execution requests and responses.
 */

import { z } from "../utils/validator";

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

const uuidSchema = z.string().uuid();
const isoDateSchema = z.string().datetime();

// ---------------------------------------------------------------------------
// Tool property / input schema
// ---------------------------------------------------------------------------

const ToolPropertyTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "null",
]);

/** Recursive Zod schema for a single tool property definition. */
export const ToolPropertySchema: z.ZodType<{
  type: "string" | "number" | "boolean" | "object" | "array" | "null";
  description?: string;
  enum?: (string | number)[];
}> = z.object({
  type: ToolPropertyTypeSchema,
  description: z.string().optional(),
  enum: z.array(z.union([z.string(), z.number()])).optional(),
});

/** Zod schema for a tool's JSON-Schema-like input specification. */
export const ToolInputSchemaSchema = z.object({
  type: z.literal("object"),
  properties: z.record(ToolPropertySchema),
  required: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Execution request / response
// ---------------------------------------------------------------------------

/** Validates a {@link ToolExecutionRequest}. */
export const ToolExecutionRequestSchema = z.object({
  requestId: uuidSchema,
  toolName: z.string().min(1, "toolName must not be empty"),
  input: z.record(z.unknown()),
  correlationId: uuidSchema.optional(),
  createdAt: isoDateSchema.optional(),
});

/** Validates a {@link ToolExecutionResponse}. */
export const ToolExecutionResponseSchema = z.object({
  requestId: uuidSchema,
  toolName: z.string().min(1),
  success: z.boolean(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  durationMs: z.number().nonnegative(),
  completedAt: isoDateSchema,
});

// ---------------------------------------------------------------------------
// Exported inferred types
// ---------------------------------------------------------------------------

export type ToolExecutionRequestInput = z.infer<
  typeof ToolExecutionRequestSchema
>;
export type ToolExecutionResponseInput = z.infer<
  typeof ToolExecutionResponseSchema
>;
