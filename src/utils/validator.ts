/**
 * @module utils/validator
 * @description Thin wrapper around Zod providing a consistent validation
 * interface for all SDK schemas.
 *
 * Using this wrapper means consuming code never needs to import Zod directly
 * and gives us a single place to swap out the validation library in future.
 */

import { z, ZodSchema, ZodError } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Successful validation result. */
export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

/** Failed validation result. */
export interface ValidationFailure {
  success: false;
  errors: ValidationError[];
}

/** A single field-level validation error. */
export interface ValidationError {
  /** Dot-separated path to the invalid field (e.g. `"payload.eventType"`). */
  path: string;
  /** Human-readable description of the constraint violation. */
  message: string;
}

/** Union of possible validation outcomes. */
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validates `data` against `schema`, returning a typed {@link ValidationResult}.
 *
 * This function never throws; validation errors are captured in the result.
 *
 * @param schema  A Zod schema describing the expected shape.
 * @param data    The raw value to validate (typically `unknown`).
 * @returns       A {@link ValidationResult} – check `result.success` before
 *                accessing `result.data`.
 *
 * @example
 * ```ts
 * const result = validate(MySchema, rawInput);
 * if (!result.success) {
 *   console.error(result.errors);
 * } else {
 *   processData(result.data);
 * }
 * ```
 */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const parsed = schema.safeParse(data);

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  return {
    success: false,
    errors: mapZodErrors(parsed.error),
  };
}

/**
 * Validates `data` against `schema`, throwing a {@link ValidationError} array
 * if validation fails.
 *
 * Prefer {@link validate} when you need non-throwing behaviour.
 *
 * @param schema  A Zod schema.
 * @param data    The value to validate.
 * @returns       The strongly-typed, validated value.
 * @throws        Array of {@link ValidationError} on failure.
 */
export function validateOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = validate(schema, data);
  if (!result.success) {
    const summary = result.errors
      .map((e) => `${e.path}: ${e.message}`)
      .join("; ");
    throw new Error(`Validation failed – ${summary}`);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapZodErrors(error: ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

// Re-export `z` so consumers can build schemas without an additional import.
export { z };
