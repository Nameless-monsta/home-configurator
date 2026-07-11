import type { Diagnostics } from './diagnostics.js';
import type { MaybePromise } from './types.js';

export interface HomeAssistantEntityState {
  readonly entityId: string;
  readonly state: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly updatedAt: string;
}

export interface HomeAssistantServiceCall {
  readonly domain: string;
  readonly service: string;
  readonly target?: Readonly<Record<string, unknown>>;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface HomeAssistantAdapter {
  readonly id: string;
  start(): MaybePromise<void>;
  stop(): MaybePromise<void>;
  getState(entityId: string): HomeAssistantEntityState | undefined;
  subscribe(listener: (state: HomeAssistantEntityState) => void): () => void;
  callService(call: HomeAssistantServiceCall): MaybePromise<void>;
}

export class MockHomeAssistantAdapter implements HomeAssistantAdapter {
  public readonly id = 'home-assistant.mock';
  readonly #diagnostics: Diagnostics;
  readonly #states = new Map<string, HomeAssistantEntityState>();
  readonly #listeners = new Set<(state: HomeAssistantEntityState) => void>();
  #started = false;

  public constructor(
    diagnostics: Diagnostics,
    initialStates: readonly HomeAssistantEntityState[] = [],
  ) {
    this.#diagnostics = diagnostics;
    for (const state of initialStates) this.#states.set(state.entityId, state);
  }

  public start(): void {
    if (this.#started) return;
    this.#started = true;
    this.#diagnostics.record('info', 'home-assistant', 'Mock adapter connected');
  }

  public stop(): void {
    if (!this.#started) return;
    this.#started = false;
    this.#diagnostics.record('info', 'home-assistant', 'Mock adapter disconnected');
  }

  public getState(entityId: string): HomeAssistantEntityState | undefined {
    return this.#states.get(entityId);
  }

  public subscribe(listener: (state: HomeAssistantEntityState) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  public callService(call: HomeAssistantServiceCall): void {
    if (!this.#started) throw new Error('Mock Home Assistant adapter is not started');
    this.#diagnostics.record('info', 'home-assistant', 'Mock service call', {
      domain: call.domain,
      service: call.service,
    });
  }

  public publish(state: HomeAssistantEntityState): void {
    this.#states.set(state.entityId, state);
    for (const listener of [...this.#listeners]) listener(state);
  }
}
