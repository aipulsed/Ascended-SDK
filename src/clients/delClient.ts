/**
 * @module clients/delClient
 * @description Client for the Deterministic Execution Layer (DEL).
 *
 * All tool and pipeline execution in the AscendStack ecosystem MUST flow
 * through this client.  Direct service-to-service calls that bypass the DEL
 * are explicitly prohibited by the architecture.
 */

import { BaseClient, BaseClientOptions } from "./baseClient";
import { config } from "../core/config";
import { ToolExecutionRequest, ToolExecutionResponse } from "../tools/toolTypes";
import { ApiResponse, HealthCheckResponse } from "../types/api.types";
import { UUID, ISODateString } from "../types/common.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status of a running or completed pipeline. */
export type PipelineStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/** Request to start a pipeline. */
export interface ExecutePipelineRequest {
  /** Name of the registered pipeline to execute. */
  pipelineName: string;
  /** Input data passed to the first pipeline step. */
  input: Record<string, unknown>;
  /** Optional caller-supplied correlation ID. */
  correlationId?: UUID;
}

/** Response returned when a pipeline is started. */
export interface ExecutePipelineResponse {
  /** Unique pipeline run ID assigned by the DEL. */
  runId: UUID;
  status: PipelineStatus;
  /** ISO-8601 timestamp when the run was created. */
  createdAt: ISODateString;
}

/** Detailed pipeline run status. */
export interface PipelineStatusResponse {
  runId: UUID;
  pipelineName: string;
  status: PipelineStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  /** Output of the final step (only present when `status === "completed"`). */
  output?: unknown;
  /** Error message (only present when `status === "failed"`). */
  error?: string;
  /** Per-step execution details. */
  steps: PipelineStepStatus[];
}

/** Status of a single pipeline step. */
export interface PipelineStepStatus {
  stepIndex: number;
  toolName: string;
  status: PipelineStatus;
  durationMs?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// DELClient
// ---------------------------------------------------------------------------

/**
 * Client for communicating with the Deterministic Execution Layer.
 *
 * @example
 * ```ts
 * const del = new DELClient();
 *
 * const run = await del.executePipeline({
 *   pipelineName: "invoice-generation",
 *   input: { customerId: "cust_123" },
 * });
 *
 * const status = await del.getPipelineStatus(run.runId);
 * ```
 */
export class DELClient extends BaseClient {
  constructor(options?: Partial<BaseClientOptions>) {
    super({
      baseUrl: options?.baseUrl ?? config.delBaseUrl,
      timeoutMs: options?.timeoutMs ?? config.defaultTimeoutMs,
      retry: options?.retry ?? { attempts: config.defaultRetries },
      auth: options?.auth,
      logger: options?.logger,
    });
  }

  // ---------------------------------------------------------------------------
  // Pipeline API
  // ---------------------------------------------------------------------------

  /**
   * Starts a named pipeline with the given input and returns a run handle.
   *
   * @param request  Pipeline name and input data.
   * @returns        A {@link ExecutePipelineResponse} containing the `runId`.
   */
  async executePipeline(
    request: ExecutePipelineRequest
  ): Promise<ExecutePipelineResponse> {
    this.log.info("Executing pipeline", { pipelineName: request.pipelineName });

    const response = await this.request<ApiResponse<ExecutePipelineResponse>>({
      path: "/pipelines/execute",
      method: "POST",
      body: request,
    });

    return response.data;
  }

  /**
   * Returns the current status and details of a pipeline run.
   *
   * @param runId  The run ID returned by {@link executePipeline}.
   * @returns      A {@link PipelineStatusResponse}.
   */
  async getPipelineStatus(runId: UUID): Promise<PipelineStatusResponse> {
    this.log.info("Fetching pipeline status", { runId });

    const response = await this.request<ApiResponse<PipelineStatusResponse>>({
      path: `/pipelines/${runId}/status`,
      method: "GET",
    });

    return response.data;
  }

  /**
   * Requests cancellation of a running pipeline.
   *
   * @param runId  The run ID to cancel.
   */
  async cancelPipeline(runId: UUID): Promise<void> {
    this.log.info("Cancelling pipeline", { runId });

    await this.request<void>({
      path: `/pipelines/${runId}/cancel`,
      method: "POST",
    });
  }

  // ---------------------------------------------------------------------------
  // Tool API
  // ---------------------------------------------------------------------------

  /**
   * Executes a single registered tool directly (outside a pipeline).
   *
   * @param request  Tool name and input.
   * @returns        The tool's typed execution response.
   */
  async executeTool<TOutput = unknown>(
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResponse<TOutput>> {
    this.log.info("Executing tool", { toolName: request.toolName });

    const response = await this.request<
      ApiResponse<ToolExecutionResponse<TOutput>>
    >({
      path: "/tools/execute",
      method: "POST",
      body: request,
    });

    return response.data;
  }

  /**
   * Returns the names of all tools registered in the DEL.
   */
  async listTools(): Promise<string[]> {
    const response = await this.request<ApiResponse<string[]>>({
      path: "/tools",
      method: "GET",
    });
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  /**
   * Returns the health status of the DEL service.
   */
  async health(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>({ path: "/health", method: "GET" });
  }
}
