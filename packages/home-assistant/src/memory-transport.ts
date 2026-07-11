import type {
  HAAreaRegistryEntry,
  HADeviceRegistryEntry,
  HAEntityRegistryEntry,
  HAEvent,
  HAFloorRegistryEntry,
  HAState,
  HomeAssistantTransport,
  StateChangedEventData,
  Unsubscribe,
} from './types.js';

export interface MemoryHomeAssistantFixture {
  readonly areas?: readonly HAAreaRegistryEntry[];
  readonly floors?: readonly HAFloorRegistryEntry[];
  readonly devices?: readonly HADeviceRegistryEntry[];
  readonly entities?: readonly HAEntityRegistryEntry[];
  readonly states?: readonly HAState[];
  readonly services?: Readonly<Record<string, unknown>>;
  readonly config?: Readonly<Record<string, unknown>>;
}

export interface RecordedServiceCall {
  readonly domain: string;
  readonly service: string;
  readonly target: unknown;
  readonly serviceData: unknown;
}

export class MemoryHomeAssistantTransport implements HomeAssistantTransport {
  readonly #areas: readonly HAAreaRegistryEntry[];
  readonly #floors: readonly HAFloorRegistryEntry[];
  readonly #devices: readonly HADeviceRegistryEntry[];
  readonly #entities: readonly HAEntityRegistryEntry[];
  readonly #services: Readonly<Record<string, unknown>>;
  readonly #config: Readonly<Record<string, unknown>>;
  readonly #states = new Map<string, HAState>();
  readonly #subscriptions = new Map<string, Set<(event: HAEvent<unknown>) => void>>();
  readonly #disconnectListeners = new Set<(reason?: string) => void>();
  readonly serviceCalls: RecordedServiceCall[] = [];
  #connected = false;

  public constructor(fixture: MemoryHomeAssistantFixture = {}) {
    this.#areas = fixture.areas ?? [];
    this.#floors = fixture.floors ?? [];
    this.#devices = fixture.devices ?? [];
    this.#entities = fixture.entities ?? [];
    this.#services = fixture.services ?? {};
    this.#config = fixture.config ?? {};
    for (const state of fixture.states ?? []) this.#states.set(state.entity_id, state);
  }

  public connect(): Promise<void> {
    this.#connected = true;
    return Promise.resolve();
  }

  public disconnect(): Promise<void> {
    this.#connected = false;
    return Promise.resolve();
  }

  public request<T>(message: Readonly<Record<string, unknown>>): Promise<T> {
    if (!this.#connected) return Promise.reject(new Error('Memory transport is disconnected'));
    const type = message['type'];
    let result: unknown;
    if (type === 'get_states') result = [...this.#states.values()];
    else if (type === 'config/area_registry/list') result = this.#areas;
    else if (type === 'config/floor_registry/list') result = this.#floors;
    else if (type === 'config/device_registry/list') result = this.#devices;
    else if (type === 'config/entity_registry/list') result = this.#entities;
    else if (type === 'get_services') result = this.#services;
    else if (type === 'get_config') result = this.#config;
    else if (type === 'call_service') {
      this.serviceCalls.push({
        domain: String(message['domain'] ?? ''),
        service: String(message['service'] ?? ''),
        target: message['target'],
        serviceData: message['service_data'],
      });
      result = null;
    } else if (type === 'unsubscribe_events') result = true;
    else return Promise.reject(new Error(`Unsupported memory transport request: ${String(type)}`));
    return Promise.resolve(result as T);
  }

  public subscribe<TData>(
    eventType: string,
    listener: (event: HAEvent<TData>) => void,
  ): Promise<Unsubscribe> {
    if (!this.#connected) return Promise.reject(new Error('Memory transport is disconnected'));
    const listeners =
      this.#subscriptions.get(eventType) ?? new Set<(event: HAEvent<unknown>) => void>();
    const normalized = listener as (event: HAEvent<unknown>) => void;
    listeners.add(normalized);
    this.#subscriptions.set(eventType, listeners);
    return Promise.resolve(() => {
      listeners.delete(normalized);
      if (listeners.size === 0) this.#subscriptions.delete(eventType);
    });
  }

  public onDisconnect(listener: (reason?: string) => void): Unsubscribe {
    this.#disconnectListeners.add(listener);
    return () => this.#disconnectListeners.delete(listener);
  }

  public publishState(state: HAState): void {
    const oldState = this.#states.get(state.entity_id) ?? null;
    this.#states.set(state.entity_id, state);
    this.#emit<StateChangedEventData>('state_changed', {
      entity_id: state.entity_id,
      old_state: oldState,
      new_state: state,
    });
  }

  public publishRegistryChange(eventType: string): void {
    this.#emit(eventType, {});
  }

  public simulateDisconnect(reason = 'simulated disconnect'): void {
    this.#connected = false;
    for (const listener of [...this.#disconnectListeners]) listener(reason);
  }

  public get subscriptionCount(): number {
    return [...this.#subscriptions.values()].reduce(
      (total, listeners) => total + listeners.size,
      0,
    );
  }

  #emit<TData>(eventType: string, data: TData): void {
    const event: HAEvent<TData> = { event_type: eventType, data };
    for (const listener of [...(this.#subscriptions.get(eventType) ?? [])]) {
      listener(event as HAEvent<unknown>);
    }
  }
}
