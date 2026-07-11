export type EventHandler<T> = (payload: T) => void;
export type EventUnsubscribe = () => void;

export interface EventEnvelope<TType extends string = string, TPayload = unknown> {
  readonly type: TType;
  readonly payload: TPayload;
  readonly timestampMs: number;
}

export class EventBus<TEvents extends object> {
  readonly #handlers = new Map<keyof TEvents, Set<EventHandler<unknown>>>();
  readonly #allHandlers = new Set<EventHandler<EventEnvelope>>();
  readonly #queue: EventEnvelope[] = [];
  #dispatching = false;

  public on<TKey extends keyof TEvents>(
    type: TKey,
    handler: EventHandler<TEvents[TKey]>,
  ): EventUnsubscribe {
    const handlers = this.#handlers.get(type) ?? new Set<EventHandler<unknown>>();
    handlers.add(handler as EventHandler<unknown>);
    this.#handlers.set(type, handlers);

    return () => {
      handlers.delete(handler as EventHandler<unknown>);
      if (handlers.size === 0) this.#handlers.delete(type);
    };
  }

  public onAny(handler: EventHandler<EventEnvelope>): EventUnsubscribe {
    this.#allHandlers.add(handler);
    return () => this.#allHandlers.delete(handler);
  }

  public emit<TKey extends keyof TEvents & string>(type: TKey, payload: TEvents[TKey]): void {
    this.#queue.push({ type, payload, timestampMs: Date.now() });
    if (this.#dispatching) return;

    this.#dispatching = true;
    try {
      while (this.#queue.length > 0) {
        const envelope = this.#queue.shift();
        if (!envelope) continue;

        const handlers = this.#handlers.get(envelope.type as keyof TEvents);
        if (handlers) {
          for (const handler of [...handlers]) handler(envelope.payload);
        }

        for (const handler of [...this.#allHandlers]) handler(envelope);
      }
    } finally {
      this.#dispatching = false;
    }
  }

  public clear(): void {
    this.#handlers.clear();
    this.#allHandlers.clear();
    this.#queue.length = 0;
  }
}
