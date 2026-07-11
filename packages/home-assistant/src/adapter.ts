import type {
  Diagnostics,
  HomeAssistantAdapter,
  HomeAssistantEntityState,
  HomeAssistantServiceCall,
} from '@home-configurator/runtime';

import { HomeAssistantEngine } from './home-assistant-engine.js';
import type { HomeAssistantConnectionConfig, HomeAssistantTransport } from './types.js';
import { HomeAssistantWebSocketClient, type WebSocketFactory } from './websocket-client.js';

export class HomeAssistantRuntimeAdapter implements HomeAssistantAdapter {
  public readonly id = 'home-assistant.live';
  readonly #engine: HomeAssistantEngine;
  readonly #transport: HomeAssistantTransport;
  readonly #listeners = new Set<(state: HomeAssistantEntityState) => void>();
  #unsubscribe: (() => void) | undefined;

  public constructor(engine: HomeAssistantEngine, transport: HomeAssistantTransport) {
    this.#engine = engine;
    this.#transport = transport;
  }

  public async start(): Promise<void> {
    await this.#engine.connect();
    this.#unsubscribe = this.#engine.subscribe((patch) => {
      for (const entityId of patch.affectedEntityIds) {
        const state = patch.snapshot.states[entityId];
        if (!state) continue;
        const normalized: HomeAssistantEntityState = {
          entityId: state.entity_id,
          state: state.state,
          attributes: state.attributes,
          updatedAt: state.last_updated,
        };
        for (const listener of [...this.#listeners]) listener(normalized);
      }
    });
  }

  public async stop(): Promise<void> {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    await this.#engine.disconnect();
  }

  public getState(entityId: string): HomeAssistantEntityState | undefined {
    const state = this.#engine.getConfirmedSnapshot().states[entityId];
    if (!state) return undefined;
    return {
      entityId: state.entity_id,
      state: state.state,
      attributes: state.attributes,
      updatedAt: state.last_updated,
    };
  }

  public subscribe(listener: (state: HomeAssistantEntityState) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  public async callService(call: HomeAssistantServiceCall): Promise<void> {
    await this.#transport.request({
      type: 'call_service',
      domain: call.domain,
      service: call.service,
      ...(call.target ? { target: call.target } : {}),
      ...(call.data ? { service_data: call.data } : {}),
      return_response: false,
    });
  }
}

export interface HomeAssistantIntegration {
  readonly engine: HomeAssistantEngine;
  readonly adapter: HomeAssistantRuntimeAdapter;
  readonly transport: HomeAssistantWebSocketClient;
}

export const createHomeAssistantIntegration = (
  config: HomeAssistantConnectionConfig,
  diagnostics: Diagnostics,
  factory?: WebSocketFactory,
): HomeAssistantIntegration => {
  const transport = new HomeAssistantWebSocketClient(config, diagnostics, factory);
  const engine = new HomeAssistantEngine({ config, diagnostics, transport });
  const adapter = new HomeAssistantRuntimeAdapter(engine, transport);
  return { engine, adapter, transport };
};
