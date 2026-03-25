/**
 * @module clients/aiClient
 * @description Client for the AI Fallback service.
 *
 * This client is intentionally the LAST resort in the execution chain.
 * All deterministic paths through the DEL must be exhausted before falling
 * back to this client.  Usage is logged and audited by default.
 */

import { BaseClient, BaseClientOptions } from "./baseClient";
import { config } from "../core/config";
import { ApiResponse } from "../types/api.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Available AI models the fallback service may route to. */
export type AIModel =
  | "gpt-4o"
  | "gpt-4o-mini"
  | "claude-3-5-sonnet"
  | "ollama/llama3"
  | "auto";

/** A single message in a chat-style conversation. */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Request to generate a completion. */
export interface PromptRequest {
  /** The user / system prompt. */
  messages: ChatMessage[];
  /**
   * Model to use.  `"auto"` lets the fallback service choose the most
   * appropriate model based on load and availability.
   */
  model?: AIModel;
  /** Maximum tokens to generate. */
  maxTokens?: number;
  /** Sampling temperature (0 = deterministic, 1 = creative). */
  temperature?: number;
  /** Optional caller-supplied request ID for idempotency. */
  requestId?: string;
}

/** Response from a completion request. */
export interface PromptResponse {
  requestId: string;
  model: string;
  content: string;
  /** Number of tokens consumed. */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: "stop" | "length" | "content_filter" | "error";
  latencyMs: number;
}

/** Request to generate an embedding vector. */
export interface EmbeddingRequest {
  /** Text to embed. */
  text: string;
  /** Model to use for embedding. */
  model?: string;
}

/** Response containing the embedding vector. */
export interface EmbeddingResponse {
  model: string;
  vector: number[];
  dimensions: number;
}

// ---------------------------------------------------------------------------
// AIClient
// ---------------------------------------------------------------------------

/**
 * Client for the AI Fallback service.
 *
 * ⚠️  This client should only be used when deterministic execution via the
 * DEL has been exhausted or is explicitly not applicable.
 *
 * @example
 * ```ts
 * const ai = new AIClient();
 * const response = await ai.sendPrompt({
 *   messages: [{ role: "user", content: "Summarise this document." }],
 *   model: "auto",
 * });
 * console.log(response.content);
 * ```
 */
export class AIClient extends BaseClient {
  constructor(options?: Partial<BaseClientOptions>) {
    super({
      baseUrl: options?.baseUrl ?? config.aiBaseUrl,
      timeoutMs: options?.timeoutMs ?? config.defaultTimeoutMs,
      retry: options?.retry ?? { attempts: config.defaultRetries },
      auth: options?.auth,
      logger: options?.logger,
    });
  }

  // ---------------------------------------------------------------------------
  // Completion
  // ---------------------------------------------------------------------------

  /**
   * Sends a prompt to the AI fallback service and returns the completion.
   *
   * Internally the fallback service handles provider selection, retries, and
   * rate-limit back-off across multiple AI providers.
   *
   * @param request  Prompt request configuration.
   * @returns        The generated completion response.
   */
  async sendPrompt(request: PromptRequest): Promise<PromptResponse> {
    this.log.info("Sending AI prompt", {
      model: request.model ?? "auto",
      messageCount: request.messages.length,
    });

    const response = await this.request<ApiResponse<PromptResponse>>({
      path: "/completions",
      method: "POST",
      body: request,
    });

    this.log.info("AI prompt completed", {
      model: response.data.model,
      totalTokens: response.data.usage.totalTokens,
    });

    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Embeddings
  // ---------------------------------------------------------------------------

  /**
   * Generates an embedding vector for the supplied text.
   *
   * @param request  Text and optional model override.
   * @returns        The embedding vector and its dimensionality.
   */
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    this.log.info("Generating embedding");

    const response = await this.request<ApiResponse<EmbeddingResponse>>({
      path: "/embeddings",
      method: "POST",
      body: request,
    });

    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Models
  // ---------------------------------------------------------------------------

  /**
   * Returns the list of models currently available through the fallback service.
   */
  async listModels(): Promise<string[]> {
    const response = await this.request<ApiResponse<string[]>>({
      path: "/models",
      method: "GET",
    });
    return response.data;
  }
}
