/**
 * @module clients/eventBusClient
 * @description Client for the Ascended Event Bus.
 *
 * All event publishing and subscription in the AscendStack ecosystem flows
 * through this client.  It validates outbound events before transmission
 * and validates inbound events before delivering them to handlers.
 */

import { BaseClient, BaseClientOptions } from "./baseClient";
import { config } from "../core/config";
import {
  AscendedEventType,
  BaseEvent,
} from "../events/eventTypes";
import { AscendedEventSchema } from "../events/eventSchemas";
import { validate } from "../utils/validator";
import { ApiResponse } from "../types/api.types";
import { UUID } from "../types/common.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Generic event payload – record of unknown values. */
export type EventPayload = Record<string, unknown>;

/**
 * An outbound event to be published.
 * The `id` and `timestamp` fields are generated automatically when omitted.
 */
export interface PublishEventRequest<
  TPayload extends EventPayload = EventPayload,
> {
  eventType: AscendedEventType;
  payload: TPayload;
  source: string;
  correlationId?: UUID;
  schemaVersion?: string;
}

/** Confirmation returned after a successful publish. */
export interface PublishEventResponse {
  eventId: UUID;
  eventType: AscendedEventType;
  publishedAt: string;
}

/** Options for subscribing to events. */
export interface SubscribeOptions {
  /** Event types to subscribe to.  Empty array = subscribe to all. */
  eventTypes: AscendedEventType[];
  /** Consumer group name (used by the event bus for delivery guarantees). */
  consumerGroup: string;
}

/** An active subscription handle. */
export interface SubscriptionHandle {
  subscriptionId: UUID;
  eventTypes: AscendedEventType[];
  consumerGroup: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// EventBusClient
// ---------------------------------------------------------------------------

/**
 * Client for publishing and subscribing to AscendStack events.
 *
 * @example
 * ```ts
 * const bus = new EventBusClient();
 *
 * await bus.publishEvent({
 *   eventType: AscendedEventType.PIPELINE_STARTED,
 *   source: "my-service",
 *   payload: { pipelineId: "...", pipelineName: "...", input: {} },
 * });
 * ```
 */
export class EventBusClient extends BaseClient {
  constructor(options?: Partial<BaseClientOptions>) {
    super({
      baseUrl: options?.baseUrl ?? config.eventBusBaseUrl,
      timeoutMs: options?.timeoutMs ?? config.defaultTimeoutMs,
      retry: options?.retry ?? { attempts: config.defaultRetries },
      auth: options?.auth,
      logger: options?.logger,
    });
  }

  // ---------------------------------------------------------------------------
  // Publishing
  // ---------------------------------------------------------------------------

  /**
   * Publishes a typed event to the event bus.
   *
   * The event envelope is validated against the canonical Zod schema before
   * transmission.  An error is thrown if the envelope does not conform.
   *
   * @param event  The event to publish.
   * @returns      Confirmation with the assigned `eventId`.
   */
  async publishEvent<TPayload extends EventPayload>(
    event: PublishEventRequest<TPayload>
  ): Promise<PublishEventResponse> {
    const envelope = this.buildEnvelope(event);

    // Validate before sending
    const validation = validate(AscendedEventSchema, envelope);
    if (!validation.success) {
      const summary = validation.errors
        .map((e) => `${e.path}: ${e.message}`)
        .join("; ");
      throw new Error(`Event validation failed – ${summary}`);
    }

    this.log.info("Publishing event", { eventType: event.eventType });

    const response = await this.request<ApiResponse<PublishEventResponse>>({
      path: "/events/publish",
      method: "POST",
      body: envelope,
    });

    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Subscription management
  // ---------------------------------------------------------------------------

  /**
   * Registers a subscription for one or more event types.
   *
   * @param options  Subscription configuration.
   * @returns        A subscription handle containing the `subscriptionId`.
   */
  async subscribeEvent(
    options: SubscribeOptions
  ): Promise<SubscriptionHandle> {
    this.log.info("Subscribing to events", {
      eventTypes: options.eventTypes,
      consumerGroup: options.consumerGroup,
    });

    const response = await this.request<ApiResponse<SubscriptionHandle>>({
      path: "/events/subscribe",
      method: "POST",
      body: options,
    });

    return response.data;
  }

  /**
   * Cancels an existing subscription.
   *
   * @param subscriptionId  The subscription ID to cancel.
   */
  async unsubscribeEvent(subscriptionId: UUID): Promise<void> {
    this.log.info("Unsubscribing", { subscriptionId });

    await this.request<void>({
      path: `/events/subscriptions/${subscriptionId}`,
      method: "DELETE",
    });
  }

  /**
   * Retrieves undelivered events for a subscription (pull-based consumption).
   *
   * @param subscriptionId  The subscription to poll.
   * @param maxEvents       Maximum number of events to retrieve (default 10).
   */
  async pollEvents(
    subscriptionId: UUID,
    maxEvents = 10
  ): Promise<BaseEvent<AscendedEventType, EventPayload>[]> {
    const response = await this.request<
      ApiResponse<BaseEvent<AscendedEventType, EventPayload>[]>
    >({
      path: `/events/subscriptions/${subscriptionId}/poll?max=${maxEvents}`,
      method: "GET",
    });

    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildEnvelope<TPayload extends EventPayload>(
    event: PublishEventRequest<TPayload>
  ): BaseEvent<AscendedEventType, TPayload> {
    return {
      id: generateId(),
      eventType: event.eventType,
      timestamp: new Date().toISOString(),
      source: event.source,
      payload: event.payload,
      ...(event.correlationId ? { correlationId: event.correlationId } : {}),
      ...(event.schemaVersion ? { schemaVersion: event.schemaVersion } : {}),
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): UUID {
  return globalThis.crypto.randomUUID();
}
