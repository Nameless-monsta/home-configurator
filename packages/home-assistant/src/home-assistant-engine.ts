import type { Diagnostics } from '@home-configurator/runtime';

import {
  affectedDeviceIdsForEntity,
  discoverCanonicalHome,
} from './capability-discovery.js';
import {
  stateMatchesExpectation,
  translateSemanticCommand,
  type ExpectedState,
  type TranslatedServiceCall,
} from './command-translator.js';
import type {
  CapabilityKind,
  CommandReceipt,
  ConfirmedRuntimeSnapshot,
  ConfirmedStatePatch,
  HAAreaRegistryEntry,
  HAConnectionStatus,
  HADeviceRegistryEntry,
  HAEntityRegistryEntry,
  HAEvent,
  HAFloorRegistryEntry,
  HARegistrySnapshot,
  HAState,
  HomeAssistantConnectionConfig,
  HomeAssistantRuntime,
  HomeAssistantTransport,
  SemanticCommand,
  StateChangedEventData,
  Unsubscribe,
} from './types.js';

interface PendingCommand {
  readonly command: SemanticCommand;
  readonly call: TranslatedServiceCall;
  readonly expected: ExpectedState;
  readonly timeout: ReturnType<typeof setTimeout>;
}

export interface HomeAssistantEngineOptions {
  readonly config: HomeAssistantConnectionConfig;
  readonly diagnostics: Diagnostics;
  readonly transport: HomeAssistantTransport;
  readonly now?: () => number;
  readonly random?: () => number;
  readonly setTimer?: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>;
  readonly clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
}

const emptyRegistry = (observedAt: number): HARegistrySnapshot => ({
  areas: [],
  floors: [],
  devices: [],
  entities: [],
  states: [],
  services: {},
  config: {},
  observedAt,
});

const stateRecord = (states: readonly HAState[]): Readonly<Record<string, HAState>> =>
  Object.fromEntries(states.map((state) => [state.entity_id, state]));

const commandError = (
  command: SemanticCommand,
  category: 'connection' | 'service' | 'validation' | 'timeout',
  message: string,
  recoverable: boolean,
): CommandReceipt => ({
  commandId: command.id,
  state: category === 'timeout' ? 'timed-out' : 'failed',
  error: {
    code: `ha.${category}`,
    category,
    recoverable,
    userMessage: message,
    commandId: command.id,
  },
});

export class HomeAssistantEngine implements HomeAssistantRuntime {
  readonly #config: HomeAssistantConnectionConfig;
  readonly #diagnostics: Diagnostics;
  readonly #transport: HomeAssistantTransport;
  readonly #now: () => number;
  readonly #random: () => number;
  readonly #setTimer: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>;
  readonly #clearTimer: (handle: ReturnType<typeof setTimeout>) => void;
  readonly #listeners = new Set<(patch: ConfirmedStatePatch) => void>();
  readonly #subscriptions: Unsubscribe[] = [];
  readonly #pending = new Map<string, PendingCommand>();
  readonly #optimisticByDevice = new Map<
    string,
    Readonly<Partial<Record<CapabilityKind, unknown>>>
  >();
  #registry: HARegistrySnapshot;
  #snapshot: ConfirmedRuntimeSnapshot;
  #status: HAConnectionStatus = 'uninitialized';
  #disconnectUnsubscribe: Unsubscribe | undefined;
  #reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  #reconnectAttempt = 0;
  #manualDisconnect = false;
  #connecting: Promise<void> | undefined;

  public constructor(options: HomeAssistantEngineOptions) {
    this.#config = options.config;
    this.#diagnostics = options.diagnostics;
    this.#transport = options.transport;
    this.#now = options.now ?? Date.now;
    this.#random = options.random ?? Math.random;
    this.#setTimer = options.setTimer ?? setTimeout;
    this.#clearTimer = options.clearTimer ?? clearTimeout;
    this.#registry = emptyRegistry(this.#now());
    this.#snapshot = {
      status: this.#status,
      rooms: [],
      devices: [],
      states: {},
      observedAt: this.#now(),
      stale: true,
    };
    this.#disconnectUnsubscribe = this.#transport.onDisconnect((reason) => {
      if (!this.#manualDisconnect) this.#handleUnexpectedDisconnect(reason);
    });
  }

  public connect(): Promise<void> {
    if (this.#status === 'ready' || this.#status === 'degraded') {
      return Promise.resolve();
    }
    if (this.#connecting) return this.#connecting;
    this.#manualDisconnect = false;
    this.#connecting = this.#connectAndSync(false).finally(() => {
      this.#connecting = undefined;
    });
    return this.#connecting;
  }

  public async disconnect(): Promise<void> {
    this.#manualDisconnect = true;
    if (this.#reconnectTimer) {
      this.#clearTimer(this.#reconnectTimer);
      this.#reconnectTimer = undefined;
    }
    this.#clearSubscriptions();
    this.#clearPending('canceled');
    await this.#transport.disconnect();
    this.#setStatus('disconnected');
    this.#publish('stale', [], []);
  }

  public getStatus(): HAConnectionStatus {
    return this.#status;
  }

  public getConfirmedSnapshot(): ConfirmedRuntimeSnapshot {
    return this.#snapshot;
  }

  public subscribe(listener: (patch: ConfirmedStatePatch) => void): Unsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  public async dispatch(command: SemanticCommand): Promise<CommandReceipt> {
    if (command.policy === 'read-only') {
      return commandError(command, 'validation', 'This capability is read-only', false);
    }
    if (this.#status !== 'ready' && this.#status !== 'degraded') {
      return commandError(command, 'connection', 'Home Assistant is not connected', true);
    }

    const device = this.#snapshot.devices.find(
      (candidate) => candidate.id === command.deviceId,
    );
    if (!device) {
      return commandError(
        command,
        'validation',
        'The selected device is no longer available',
        false,
      );
    }

    let call: TranslatedServiceCall;
    try {
      call = translateSemanticCommand(device, command);
    } catch (error) {
      return commandError(
        command,
        'validation',
        error instanceof Error ? error.message : 'Unable to translate command',
        false,
      );
    }

    if (command.continuous) this.#cancelSuperseded(command);
    this.#setOptimistic(command);
    this.#publish('optimistic', [], [command.deviceId]);
    this.#diagnostics.increment('ha.commands.dispatched');

    try {
      await this.#transport.request({
        type: 'call_service',
        domain: call.domain,
        service: call.service,
        target: call.target,
        service_data: call.data,
        return_response: false,
      });
      const acknowledgedAt = this.#now();
      this.#diagnostics.increment('ha.commands.acknowledged');

      if (!call.expected) {
        this.#clearOptimistic(command.deviceId, command.capability);
        this.#publish('optimistic', [], [command.deviceId]);
        return { commandId: command.id, state: 'acknowledged', acknowledgedAt };
      }

      const timeoutMs = Math.max(500, this.#config.commandTimeoutMs ?? 8000);
      const timeout = this.#setTimer(() => this.#timeoutCommand(command.id), timeoutMs);
      this.#pending.set(command.id, {
        command,
        call,
        expected: call.expected,
        timeout,
      });
      this.#diagnostics.setGauge('ha.commands.pending', this.#pending.size);
      return {
        commandId: command.id,
        state: 'awaiting-confirmation',
        acknowledgedAt,
      };
    } catch (error) {
      this.#clearOptimistic(command.deviceId, command.capability);
      this.#publish('optimistic', [], [command.deviceId]);
      this.#diagnostics.increment('ha.commands.failed');
      return commandError(
        command,
        'service',
        error instanceof Error ? error.message : 'Home Assistant rejected the command',
        true,
      );
    }
  }

  public async refresh(
    scope: 'all' | 'states' | 'registries' = 'all',
  ): Promise<void> {
    if (
      this.#status !== 'ready' &&
      this.#status !== 'degraded' &&
      this.#status !== 'syncing'
    ) {
      throw new Error('Home Assistant is not connected');
    }
    if (scope === 'states') {
      const states = await this.#transport.request<HAState[]>({ type: 'get_states' });
      this.#registry = { ...this.#registry, states, observedAt: this.#now() };
      this.#publish(
        'state-changed',
        states.map((state) => state.entity_id),
        [],
      );
      return;
    }
    await this.#sync(scope === 'all');
  }

  public dispose(): void {
    this.#disconnectUnsubscribe?.();
    this.#disconnectUnsubscribe = undefined;
    this.#clearSubscriptions();
    this.#clearPending('canceled');
    this.#listeners.clear();
  }

  async #connectAndSync(reconnecting: boolean): Promise<void> {
    this.#setStatus(reconnecting ? 'reconnecting' : 'connecting');
    try {
      this.#setStatus('authenticating');
      await this.#transport.connect();
      await this.#sync(true);
      this.#reconnectAttempt = 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const authentication = /auth|token|credential/i.test(message);
      this.#setStatus(
        authentication
          ? 'auth-failed'
          : reconnecting
            ? 'reconnecting'
            : 'disconnected',
      );
      this.#diagnostics.record('error', 'home-assistant', 'Connection failed', {
        category: authentication ? 'authentication' : 'connection',
        message,
      });
      if (reconnecting && !authentication) this.#scheduleReconnect();
      throw error;
    }
  }

  async #sync(includeStaticMetadata: boolean): Promise<void> {
    this.#setStatus('syncing');
    this.#clearSubscriptions();
    const statesPromise = this.#transport.request<HAState[]>({ type: 'get_states' });
    const areasPromise = this.#transport.request<HAAreaRegistryEntry[]>({
      type: 'config/area_registry/list',
    });
    const devicesPromise = this.#transport.request<HADeviceRegistryEntry[]>({
      type: 'config/device_registry/list',
    });
    const entitiesPromise = this.#transport.request<HAEntityRegistryEntry[]>({
      type: 'config/entity_registry/list',
    });
    const floorsPromise = this.#optionalRequest<HAFloorRegistryEntry[]>(
      { type: 'config/floor_registry/list' },
      [],
    );
    const servicesPromise = includeStaticMetadata
      ? this.#optionalRequest<Readonly<Record<string, unknown>>>(
          { type: 'get_services' },
          {},
        )
      : Promise.resolve(this.#registry.services);
    const configPromise = includeStaticMetadata
      ? this.#optionalRequest<Readonly<Record<string, unknown>>>(
          { type: 'get_config' },
          {},
        )
      : Promise.resolve(this.#registry.config);

    const [states, areas, devices, entities, floors, services, config] =
      await Promise.all([
        statesPromise,
        areasPromise,
        devicesPromise,
        entitiesPromise,
        floorsPromise,
        servicesPromise,
        configPromise,
      ]);

    this.#registry = {
      states,
      areas,
      devices,
      entities,
      floors,
      services,
      config,
      observedAt: this.#now(),
    };
    const degraded = floors.length === 0;
    await this.#subscribeLiveEvents();
    this.#setStatus(degraded ? 'degraded' : 'ready');
    this.#publish(
      'initial-sync',
      states.map((state) => state.entity_id),
      [],
    );
    this.#diagnostics.setGauge('ha.registry.areas', areas.length);
    this.#diagnostics.setGauge('ha.registry.devices', devices.length);
    this.#diagnostics.setGauge('ha.registry.entities', entities.length);
    this.#diagnostics.setGauge('ha.subscriptions', this.#subscriptions.length);
  }

  async #subscribeLiveEvents(): Promise<void> {
    this.#subscriptions.push(
      await this.#transport.subscribe<StateChangedEventData>(
        'state_changed',
        (event) => {
          this.#handleStateChanged(event);
        },
      ),
    );

    const registryEvents = [
      'entity_registry_updated',
      'device_registry_updated',
      'area_registry_updated',
      'floor_registry_updated',
    ];
    for (const eventType of registryEvents) {
      try {
        const unsubscribe = await this.#transport.subscribe(eventType, () => {
          void this.refresh('registries').catch((error: unknown) => {
            this.#diagnostics.record(
              'warn',
              'home-assistant',
              'Registry refresh failed',
              {
                eventType,
                message: error instanceof Error ? error.message : String(error),
              },
            );
          });
        });
        this.#subscriptions.push(unsubscribe);
      } catch (error) {
        this.#diagnostics.record(
          'warn',
          'home-assistant',
          'Optional registry subscription unavailable',
          {
            eventType,
            message: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }
  }

  #handleStateChanged(event: HAEvent<StateChangedEventData>): void {
    const { entity_id: entityId, new_state: newState } = event.data;
    const states = new Map(
      this.#registry.states.map((state) => [state.entity_id, state] as const),
    );
    if (newState) states.set(entityId, newState);
    else states.delete(entityId);
    const previousDevices = this.#snapshot.devices;
    this.#registry = {
      ...this.#registry,
      states: [...states.values()],
      observedAt: this.#now(),
    };
    const affectedDeviceIds = affectedDeviceIdsForEntity(previousDevices, entityId);
    if (newState) this.#confirmCommands(newState);
    this.#publish('state-changed', [entityId], affectedDeviceIds);
    this.#diagnostics.increment('ha.events.stateChanged');
  }

  #publish(
    reason: ConfirmedStatePatch['reason'],
    affectedEntityIds: readonly string[],
    affectedDeviceIds: readonly string[],
  ): void {
    const discovery = discoverCanonicalHome(this.#registry, this.#optimisticByDevice);
    const stale = !['ready', 'degraded'].includes(this.#status);
    this.#snapshot = {
      status: this.#status,
      rooms: discovery.rooms,
      devices: discovery.devices,
      states: stateRecord(this.#registry.states),
      observedAt: this.#registry.observedAt,
      stale,
    };
    const patch: ConfirmedStatePatch = {
      reason,
      snapshot: this.#snapshot,
      affectedEntityIds,
      affectedDeviceIds,
    };
    for (const listener of [...this.#listeners]) listener(patch);
    this.#diagnostics.setGauge(
      'ha.entities.stale',
      stale ? this.#registry.states.length : 0,
    );
  }

  #setStatus(status: HAConnectionStatus): void {
    this.#status = status;
    this.#snapshot = {
      ...this.#snapshot,
      status,
      stale: !['ready', 'degraded'].includes(status),
    };
    const values: readonly HAConnectionStatus[] = [
      'uninitialized',
      'connecting',
      'authenticating',
      'syncing',
      'ready',
      'degraded',
      'reconnecting',
      'disconnected',
      'auth-failed',
      'fatal',
    ];
    this.#diagnostics.setGauge('ha.status', values.indexOf(status));
    this.#diagnostics.record('info', 'home-assistant', 'Connection status changed', {
      status,
    });
  }

  #handleUnexpectedDisconnect(reason?: string): void {
    this.#clearSubscriptions();
    this.#setStatus('reconnecting');
    this.#publish('stale', [], []);
    this.#diagnostics.record('warn', 'home-assistant', 'Connection lost', {
      reason: reason ?? 'unknown',
    });
    this.#scheduleReconnect();
  }

  #scheduleReconnect(): void {
    if (
      this.#manualDisconnect ||
      this.#config.reconnect?.enabled === false ||
      this.#reconnectTimer
    ) {
      return;
    }
    const minimum = Math.max(250, this.#config.reconnect?.minimumDelayMs ?? 1000);
    const maximum = Math.max(
      minimum,
      this.#config.reconnect?.maximumDelayMs ?? 30000,
    );
    const jitterRatio = Math.min(
      1,
      Math.max(0, this.#config.reconnect?.jitterRatio ?? 0.2),
    );
    const base = Math.min(maximum, minimum * 2 ** this.#reconnectAttempt++);
    const delay = Math.round(
      base * (1 - jitterRatio + this.#random() * jitterRatio * 2),
    );
    this.#diagnostics.increment('ha.reconnect.attempts');
    this.#reconnectTimer = this.#setTimer(() => {
      this.#reconnectTimer = undefined;
      void this.#connectAndSync(true).catch(() => undefined);
    }, delay);
  }

  #confirmCommands(state: HAState): void {
    for (const [id, pending] of [...this.#pending]) {
      if (!stateMatchesExpectation(state, pending.expected)) continue;
      this.#clearTimer(pending.timeout);
      this.#pending.delete(id);
      this.#clearOptimistic(pending.command.deviceId, pending.command.capability);
      this.#diagnostics.increment('ha.commands.confirmed');
      this.#diagnostics.record('info', 'home-assistant.command', 'Command confirmed', {
        commandId: id,
        entityId: state.entity_id,
      });
    }
    this.#diagnostics.setGauge('ha.commands.pending', this.#pending.size);
  }

  #timeoutCommand(commandId: string): void {
    const pending = this.#pending.get(commandId);
    if (!pending) return;
    this.#pending.delete(commandId);
    this.#clearOptimistic(pending.command.deviceId, pending.command.capability);
    this.#publish('optimistic', [], [pending.command.deviceId]);
    this.#diagnostics.increment('ha.commands.timedOut');
    this.#diagnostics.setGauge('ha.commands.pending', this.#pending.size);
  }

  #cancelSuperseded(command: SemanticCommand): void {
    for (const [id, pending] of [...this.#pending]) {
      if (
        pending.command.deviceId === command.deviceId &&
        pending.command.capability === command.capability
      ) {
        this.#clearTimer(pending.timeout);
        this.#pending.delete(id);
        this.#diagnostics.increment('ha.commands.coalesced');
      }
    }
  }

  #setOptimistic(command: SemanticCommand): void {
    const current = this.#optimisticByDevice.get(command.deviceId) ?? {};
    const value = command.value ?? command.action;
    this.#optimisticByDevice.set(command.deviceId, {
      ...current,
      [command.capability]: value,
    });
  }

  #clearOptimistic(deviceId: string, capability: CapabilityKind): void {
    const current = this.#optimisticByDevice.get(deviceId);
    if (!current) return;
    const next = { ...current };
    delete next[capability];
    if (Object.keys(next).length === 0) this.#optimisticByDevice.delete(deviceId);
    else this.#optimisticByDevice.set(deviceId, next);
  }

  #clearSubscriptions(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) unsubscribe();
    this.#diagnostics.setGauge('ha.subscriptions', 0);
  }

  #clearPending(state: 'canceled'): void {
    for (const pending of this.#pending.values()) {
      this.#clearTimer(pending.timeout);
      this.#diagnostics.record(
        'debug',
        'home-assistant.command',
        'Pending command cleared',
        {
          commandId: pending.command.id,
          state,
        },
      );
    }
    this.#pending.clear();
    this.#optimisticByDevice.clear();
    this.#diagnostics.setGauge('ha.commands.pending', 0);
  }

  async #optionalRequest<T>(
    message: Readonly<Record<string, unknown>>,
    fallback: T,
  ): Promise<T> {
    try {
      return await this.#transport.request<T>(message);
    } catch (error) {
      this.#diagnostics.record(
        'warn',
        'home-assistant',
        'Optional Home Assistant request failed',
        {
          type: String(message['type'] ?? 'unknown'),
          message: error instanceof Error ? error.message : String(error),
        },
      );
      return fallback;
    }
  }
}
