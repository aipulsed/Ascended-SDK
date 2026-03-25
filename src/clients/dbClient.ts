/**
 * @module clients/dbClient
 * @description Client for the Ascended Database service.
 *
 * Provides typed access to:
 * - SQL queries (Postgres)
 * - Record CRUD operations
 * - Vector similarity search (pgvector)
 */

import { BaseClient, BaseClientOptions } from "./baseClient";
import { config } from "../core/config";
import { ApiResponse, PaginatedApiResponse } from "../types/api.types";
import { UUID, PaginationParams } from "../types/common.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A raw SQL query request. */
export interface QueryRequest {
  /** Parameterised SQL statement (use `$1`, `$2`, … placeholders). */
  sql: string;
  /** Bound parameter values (must match placeholders in order). */
  params?: unknown[];
}

/** Result of a SQL query. */
export interface QueryResult<TRow = Record<string, unknown>> {
  rows: TRow[];
  rowCount: number;
  /** Wall-clock time the query took on the server in milliseconds. */
  durationMs: number;
}

/** Record insert request. */
export interface InsertRequest<TRecord = Record<string, unknown>> {
  /** Target table name. */
  table: string;
  /** Data to insert. */
  data: TRecord;
}

/** Record update request. */
export interface UpdateRequest<TRecord = Record<string, unknown>> {
  table: string;
  id: UUID;
  data: Partial<TRecord>;
}

/** Vector similarity search request. */
export interface VectorSearchRequest {
  /** Table / collection to search. */
  table: string;
  /** Column that stores the embedding vector. */
  vectorColumn: string;
  /** Query embedding vector. */
  queryVector: number[];
  /** Maximum number of results to return (default 10). */
  topK?: number;
  /** Minimum similarity threshold 0–1 (default 0.7). */
  threshold?: number;
  /** Optional additional WHERE conditions as key-value equality filters. */
  filters?: Record<string, unknown>;
}

/** A single vector search result. */
export interface VectorSearchResult<TRow = Record<string, unknown>> {
  row: TRow;
  /** Cosine similarity score (0–1). */
  score: number;
}

// ---------------------------------------------------------------------------
// DBClient
// ---------------------------------------------------------------------------

/**
 * Client for the Ascended Database service.
 *
 * @example
 * ```ts
 * const db = new DBClient();
 *
 * // SQL query
 * const result = await db.query<{ id: string; name: string }>({
 *   sql: "SELECT id, name FROM users WHERE active = $1",
 *   params: [true],
 * });
 *
 * // Vector search
 * const similar = await db.vectorSearch({
 *   table: "documents",
 *   vectorColumn: "embedding",
 *   queryVector: myEmbedding,
 *   topK: 5,
 * });
 * ```
 */
export class DBClient extends BaseClient {
  constructor(options?: Partial<BaseClientOptions>) {
    super({
      baseUrl: options?.baseUrl ?? config.dbBaseUrl,
      timeoutMs: options?.timeoutMs ?? config.defaultTimeoutMs,
      retry: options?.retry ?? { attempts: config.defaultRetries },
      auth: options?.auth,
      logger: options?.logger,
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Validates that a table name contains only safe characters (letters, digits,
   * underscores, and dots for schema-qualified names) to prevent path traversal.
   */
  private assertSafeTableName(table: string): void {
    if (!/^[a-zA-Z0-9_.]+$/.test(table)) {
      throw new Error(
        `DBClient: invalid table name "${table}". Only alphanumeric characters, underscores, and dots are permitted.`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Query
  // ---------------------------------------------------------------------------

  /**
   * Executes a raw parameterised SQL statement.
   *
   * @param request  SQL and bound parameters.
   * @returns        Query result rows and metadata.
   */
  async query<TRow = Record<string, unknown>>(
    request: QueryRequest
  ): Promise<QueryResult<TRow>> {
    this.log.debug("Executing query");

    const response = await this.request<ApiResponse<QueryResult<TRow>>>({
      path: "/query",
      method: "POST",
      body: request,
    });

    return response.data;
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  /**
   * Inserts a single record into a table.
   *
   * @param request  Table and record data.
   * @returns        The inserted record (including server-generated fields).
   */
  async insert<TRecord = Record<string, unknown>>(
    request: InsertRequest<TRecord>
  ): Promise<TRecord> {
    this.assertSafeTableName(request.table);
    this.log.debug("Inserting record", { table: request.table });

    const response = await this.request<ApiResponse<TRecord>>({
      path: "/records",
      method: "POST",
      body: request,
    });

    return response.data;
  }

  /**
   * Updates fields of an existing record.
   *
   * @param request  Table, record ID, and partial data.
   * @returns        The full updated record.
   */
  async update<TRecord = Record<string, unknown>>(
    request: UpdateRequest<TRecord>
  ): Promise<TRecord> {
    this.assertSafeTableName(request.table);
    this.log.debug("Updating record", { table: request.table, id: request.id });

    const response = await this.request<ApiResponse<TRecord>>({
      path: `/records/${request.table}/${request.id}`,
      method: "PUT",
      body: request.data,
    });

    return response.data;
  }

  /**
   * Deletes a record by its ID.
   *
   * @param table  Target table.
   * @param id     Record ID.
   */
  async delete(table: string, id: UUID): Promise<void> {
    this.assertSafeTableName(table);
    this.log.debug("Deleting record", { table, id });

    await this.request<void>({
      path: `/records/${table}/${id}`,
      method: "DELETE",
    });
  }

  /**
   * Retrieves a paginated list of records from a table.
   *
   * @param table       Target table.
   * @param pagination  Optional pagination parameters.
   */
  async list<TRecord = Record<string, unknown>>(
    table: string,
    pagination?: PaginationParams
  ): Promise<PaginatedApiResponse<TRecord>> {
    this.assertSafeTableName(table);
    const params = new URLSearchParams();
    if (pagination?.limit !== undefined) {
      params.set("limit", String(pagination.limit));
    }
    if (pagination?.cursor) {
      params.set("cursor", pagination.cursor);
    }

    const qs = params.toString() ? `?${params.toString()}` : "";

    return this.request<PaginatedApiResponse<TRecord>>({
      path: `/records/${table}${qs}`,
      method: "GET",
    });
  }

  // ---------------------------------------------------------------------------
  // Vector search
  // ---------------------------------------------------------------------------

  /**
   * Performs a vector similarity search using pgvector.
   *
   * @param request  Search configuration including the query embedding.
   * @returns        Top-K results ordered by descending similarity score.
   */
  async vectorSearch<TRow = Record<string, unknown>>(
    request: VectorSearchRequest
  ): Promise<VectorSearchResult<TRow>[]> {
    this.log.debug("Running vector search", {
      table: request.table,
      topK: request.topK ?? 10,
    });

    const response = await this.request<
      ApiResponse<VectorSearchResult<TRow>[]>
    >({
      path: "/vector/search",
      method: "POST",
      body: request,
    });

    return response.data;
  }
}
