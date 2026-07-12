import {
  type DeviceRuntimeSnapshot,
  type DeviceState,
  DeviceStore,
  type RuntimeUnsubscribe,
} from '@home-configurator/runtime';

import type { CommandLifecycleEvent, CommandLifecycleSource } from './command-lifecycle.js';
import type {
  CapabilityKind,
  CommandReceipt,
  ConfirmedRuntimeSnapshot,
  ConfirmedStatePatch,
  HAConnectionStatus,
  HAState,
  HomeAssistantRuntime,
  SemanticCommand,
  Unsubscribe,
} from './types.js';

interface PendingRuntimeCommand {
  readonly command: SemanticCommand;
  timeout?: ReturnType<typeof setTimeout>;
}

export interface HomeAssistantStateAdapterOptions {
  readonly source: HomeAssistantRuntime;
  readonly store: DeviceStore;
  readonly confirmationTimeoutMs?: number;
  readonly now?: () => number;
  readonly setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  readonly clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
}

const connectedStatus = (status: HAConnectionStatus): boolean =>
  status === 'ready' || status === 'degraded';

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const stringValue = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const rgbToHs = (redByte: number, greenByte: number, blueByte: number): readonly [number, number] => {
  const red = clamp(redByte, 0, 255) / 255;
  const green = clamp(greenByte, 0, 255) / 255;
  const blue = clamp(blueByte, 0, 255) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta > 0) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;
  const saturation = maximum === 0 ? 0 : (delta / maximum) * 100;
  return [Number(hue.toFixed(2)), Number(saturation.toFixed(2))];
};

const colourValue = (state: HAState | undefined): readonly [number, number] | undefined => {
  const hs = state?.attributes['hs_color'];
  if (
    Array.isArray(hs) &&
    hs.length >= 2 &&
    typeof hs[0] === 'number' &&
    typeof hs[1] === 'number'
  ) {
    return [clamp(hs[0], 0, 360), clamp(hs[1], 0, 100)];
  }
  const rgb = state?.attributes['rgb_color'];
  if (
    Array.isArray(rgb) &&
    rgb.length >= 3 &&
    typeof rgb[0] === 'number' &&
    typeof rgb[1] === 'number' &&
    typeof rgb[2] === 'number'
  ) {
    return rgbToHs(rgb[0], rgb[1], rgb[2]);
  }
  return undefined;
};

const entityStateForCapability = (
  snapshot: ConfirmedRuntimeSnapshot,
  deviceId: string,
  capability: CapabilityKind,
): HAState | undefined => {
  const device = snapshot.devices.find((candidate) => candidate.id === deviceId);
  const binding = device?.bindings.find((candidate) => candidate.capabilities.includes(capability));
  return binding ? snapshot.states[binding.entityId] : undefined;
};

const powerValue = (state: HAState | undefined): boolean | undefined => {
  if (!state || state.state === 'unknown' || state.state === 'unavailable') return undefined;
  if (state.entity_id.startsWith('lock.')) return state.state === 'locked';
  return state.state !== 'off' && state.state !== 'idle' && state.state !== 'standby';
};

export const toRuntimeDeviceState = (
  snapshot: ConfirmedRuntimeSnapshot,
  deviceId: string,
): DeviceState => {
  const device = snapshot.devices.find((candidate) => candidate.id === deviceId);
  if (!device) throw new Error(`Unknown Home Assistant device: ${deviceId}`);

  const result: Record<string, unknown> = {
    observedAt: snapshot.observedAt,
    integrationStatus: snapshot.status,
    entities: Object.fromEntries(
      device.entityIds.flatMap((entityId) => {
        const state = snapshot.states[entityId];
        return state
          ? [
              [
                entityId,
                {
                  state: state.state,
                  attributes: state.attributes,
                  lastChanged: state.last_changed,
                  lastUpdated: state.last_updated,
                },
              ],
            ]
          : [];
      }),
    ),
  };

  for (const capability of device.capabilities) {
    const state = entityStateForCapability(snapshot, device.id, capability);
    if (capability === 'power') {
      const value = powerValue(state);
      if (value !== undefined) result['power'] = value;
    } else if (capability === 'brightness') {
      const value = finiteNumber(state?.attributes['brightness']);
      if (value !== undefined) result['brightness'] = clamp(value / 255, 0, 1);
    } else if (capability === 'color') {
      const value = colourValue(state);
      if (value !== undefined) result['color'] = value;
    } else if (capability === 'colorTemperature') {
      const value = finiteNumber(state?.attributes['color_temp_kelvin']);
      if (value !== undefined) result['colorTemperature'] = value;
    } else if (capability === 'targetTemperature') {
      const value = finiteNumber(state?.attributes['temperature']);
      if (value !== undefined) result['targetTemperature'] = value;
    } else if (capability === 'hvacMode') {
      if (state) result['hvacMode'] = state.state;
    } else if (capability === 'fanMode') {
      const value = stringValue(state?.attributes['fan_mode']);
      if (value !== undefined) result['fanMode'] = value;
    } else if (capability === 'volume') {
      const value = finiteNumber(state?.attributes['volume_level']);
      if (value !== undefined) result['volume'] = clamp(value, 0, 1);
    } else if (capability === 'mediaPlayback') {
      if (state) result['mediaPlayback'] = state.state;
    } else if (capability === 'mediaSource') {
      const value = stringValue(state?.attributes['source']);
      if (value !== undefined) result['mediaSource'] = value;
    } else if (capability === 'vacuumCleaning') {
      if (state) result['vacuumCleaning'] = state.state;
    } else if (capability === 'coverPosition') {
      const value = finiteNumber(state?.attributes['current_position']);
      if (value !== undefined) result['coverPosition'] = clamp(value, 0, 100);
    } else if (capability === 'lock') {
      if (state) result['lock'] = state.state === 'locked';
    } else if (capability === 'sensor') {
      result['sensor'] = Object.fromEntries(
        device.bindings
          .filter((binding) => binding.capabilities.includes('sensor'))
          .flatMap((binding) => {
            const sensor = snapshot.states[binding.entityId];
            return sensor
              ? [
                  [
                    binding.entityId,
                    {
                      value: sensor.state,
                      unit: stringValue(sensor.attributes['unit_of_measurement']),
                      name: stringValue(sensor.attributes['friendly_name']),
                    },
                  ],
                ]
              : [];
          }),
      );
    }
  }
  return result;
};

export const semanticCommandToDeviceState = (command: SemanticCommand): DeviceState => {
  const value = command.value;
  if (command.capability === 'power') {
    return { power: typeof value === 'boolean' ? value : command.action === 'on' };
  }
  if (command.capability === 'brightness' && typeof value === 'number') {
    return { brightness: clamp(value, 0, 1) };
  }
  if (command.capability === 'color' && value !== undefined) return { color: value };
  if (command.capability === 'colorTemperature' && typeof value === 'number') {
    return { colorTemperature: value };
  }
  if (command.capability === 'targetTemperature' && typeof value === 'number') {
    return { targetTemperature: value };
  }
  if (command.capability === 'hvacMode' && typeof value === 'string') return { hvacMode: value };
  if (command.capability === 'fanMode' && typeof value === 'string') return { fanMode: value };
  if (command.capability === 'volume' && typeof value === 'number') {
    return { volume: clamp(value, 0, 1) };
  }
  if (command.capability === 'mediaPlayback') return { mediaPlayback: command.action };
  if (command.capability === 'mediaSource' && typeof value === 'string') {
    return { mediaSource: value };
  }
  if (command.capability === 'vacuumCleaning') return { vacuumCleaning: command.action };
  if (command.capability === 'coverPosition') {
    if (typeof value === 'number') return { coverPosition: clamp(value, 0, 100) };
    if (command.action === 'open') return { coverPosition: 100 };
    if (command.action === 'close') return { coverPosition: 0 };
  }
  if (command.capability === 'lock') {
    return { lock: command.action === 'lock' || value === true };
  }
  return {};
};

const hasState = (state: DeviceState): boolean => Object.keys(state).length > 0;

export class HomeAssistantStateAdapter implements HomeAssistantRuntime, CommandLifecycleSource {
  readonly #source: HomeAssistantRuntime;
  readonly #store: DeviceStore;
  readonly #confirmationTimeoutMs: number;
  readonly #now: () => number;
  readonly #setTimer: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  readonly #clearTimer: (handle: ReturnType<typeof setTimeout>) => void;
  readonly #lifecycleListeners = new Set<(event: CommandLifecycleEvent) => void>();
  readonly #pendingByDevice = new Map<string, PendingRuntimeCommand>();
  #snapshotUnsubscribe: Unsubscribe | undefined;

  public constructor(options: HomeAssistantStateAdapterOptions) {
    this.#source = options.source;
    this.#store = options.store;
    this.#confirmationTimeoutMs = Math.max(500, options.confirmationTimeoutMs ?? 8500);
    this.#now = options.now ?? Date.now;
    this.#setTimer = options.setTimer ?? setTimeout;
    this.#clearTimer = options.clearTimer ?? clearTimeout;
  }

  public start(): void {
    if (this.#snapshotUnsubscribe) return;
    this.#snapshotUnsubscribe = this.#source.subscribe((patch) => this.#handlePatch(patch));
    const snapshot = this.#source.getConfirmedSnapshot();
    if (snapshot.devices.length > 0) this.#syncSnapshot(snapshot, 'initial-sync', []);
  }

  public stop(): void {
    this.#snapshotUnsubscribe?.();
    this.#snapshotUnsubscribe = undefined;
    for (const pending of this.#pendingByDevice.values()) {
      if (pending.timeout) this.#clearTimer(pending.timeout);
    }
    this.#pendingByDevice.clear();
  }

  public connect(): Promise<void> {
    this.start();
    return this.#source.connect();
  }

  public disconnect(): Promise<void> {
    return this.#source.disconnect();
  }

  public getStatus(): HAConnectionStatus {
    return this.#source.getStatus();
  }

  public getConfirmedSnapshot(): ConfirmedRuntimeSnapshot {
    return this.#source.getConfirmedSnapshot();
  }

  public subscribe(listener: (patch: ConfirmedStatePatch) => void): Unsubscribe {
    return this.#source.subscribe(listener);
  }

  public subscribeCommandLifecycle(
    listener: (event: CommandLifecycleEvent) => void,
  ): RuntimeUnsubscribe {
    this.#lifecycleListeners.add(listener);
    return () => this.#lifecycleListeners.delete(listener);
  }

  public async dispatch(command: SemanticCommand): Promise<CommandReceipt> {
    this.start();
    const runtime = this.#store.get(command.deviceId);
    const optimistic = semanticCommandToDeviceState(command);
    const previous = this.#pendingByDevice.get(command.deviceId);
    if (previous) {
      if (previous.timeout) this.#clearTimer(previous.timeout);
      this.#pendingByDevice.delete(command.deviceId);
      this.#emitLifecycle(previous.command, 'canceled', undefined, 'superseded');
    }

    if (runtime && hasState(optimistic)) {
      this.#store.applyOptimistic(command.deviceId, optimistic, {
        commandId: command.id,
        issuedAt: command.issuedAt,
        at: this.#now(),
      });
      this.#pendingByDevice.set(command.deviceId, { command });
    }
    this.#emitLifecycle(command, 'dispatching');

    const receipt = await this.#source.dispatch(command);
    if (receipt.state === 'failed' || receipt.state === 'timed-out' || receipt.state === 'canceled') {
      this.#rollback(command, receipt.state);
      this.#emitLifecycle(
        command,
        receipt.state,
        receipt,
        receipt.state === 'timed-out' ? 'timeout' : receipt.error?.category === 'connection' ? 'connection' : 'service',
      );
      return receipt;
    }

    if (receipt.state === 'acknowledged') {
      this.#confirmWithoutStateChange(command, receipt);
      this.#emitLifecycle(command, receipt.state, receipt, 'confirmation');
      return receipt;
    }

    if (receipt.state === 'awaiting-confirmation') {
      const pending = this.#pendingByDevice.get(command.deviceId);
      if (pending?.command.id === command.id) {
        pending.timeout = this.#setTimer(
          () => this.#timeout(command.deviceId, command.id),
          this.#confirmationTimeoutMs,
        );
      }
    }
    this.#emitLifecycle(command, receipt.state, receipt);
    return receipt;
  }

  public refresh(scope?: 'all' | 'states' | 'registries'): Promise<void> {
    return this.#source.refresh(scope);
  }

  public dispose(): void {
    this.stop();
    this.#lifecycleListeners.clear();
  }

  #handlePatch(patch: ConfirmedStatePatch): void {
    this.#syncSnapshot(patch.snapshot, patch.reason, patch.affectedDeviceIds);
  }

  #syncSnapshot(
    snapshot: ConfirmedRuntimeSnapshot,
    reason: ConfirmedStatePatch['reason'],
    affectedDeviceIds: readonly string[],
  ): void {
    const structural =
      reason === 'initial-sync' ||
      reason === 'registry-changed' ||
      reason === 'reconnect' ||
      reason === 'stale';
    const targets =
      structural || affectedDeviceIds.length === 0
        ? snapshot.devices
        : snapshot.devices.filter((device) => affectedDeviceIds.includes(device.id));
    const connected = connectedStatus(snapshot.status) && !snapshot.stale;
    const confirmState = reason !== 'optimistic' && reason !== 'stale';

    for (const device of targets) {
      const pending = this.#pendingByDevice.get(device.id);
      this.#store.upsert({
        descriptor: {
          id: device.id,
          roomId: device.roomId,
          entityIds: device.entityIds,
          name: device.name,
          available: device.available,
          connected,
        },
        ...(confirmState ? { confirmedState: toRuntimeDeviceState(snapshot, device.id) } : {}),
      });
      if (confirmState && pending) {
        if (pending.timeout) this.#clearTimer(pending.timeout);
        this.#pendingByDevice.delete(device.id);
        this.#emitLifecycle(
          pending.command,
          'confirmed',
          {
            commandId: pending.command.id,
            state: 'confirmed',
            confirmedAt: this.#now(),
          },
          'confirmation',
        );
      }
    }

    if (structural) {
      const active = new Set(snapshot.devices.map((device) => device.id));
      for (const runtime of this.#store.snapshot().devices) {
        if (!active.has(runtime.id)) this.#store.remove(runtime.id);
      }
    }
  }

  #confirmWithoutStateChange(command: SemanticCommand, receipt: CommandReceipt): void {
    const runtime = this.#store.get(command.deviceId)?.snapshot();
    if (runtime?.pendingCommandId === command.id) {
      this.#store.confirm(command.deviceId, runtime.confirmedState, {
        commandId: command.id,
        at: receipt.acknowledgedAt ?? this.#now(),
      });
    }
    this.#clearPending(command.deviceId, command.id);
  }

  #rollback(command: SemanticCommand, state: CommandReceipt['state']): void {
    const runtime = this.#store.get(command.deviceId)?.snapshot();
    if (runtime?.pendingCommandId === command.id) {
      this.#store.rollback(command.deviceId, { reason: `home-assistant-${state}`, at: this.#now() });
    }
    this.#clearPending(command.deviceId, command.id);
  }

  #timeout(deviceId: string, commandId: string): void {
    const pending = this.#pendingByDevice.get(deviceId);
    if (pending?.command.id !== commandId) return;
    const runtime = this.#store.get(deviceId)?.snapshot();
    if (runtime?.pendingCommandId === commandId) {
      this.#store.rollback(deviceId, { reason: 'home-assistant-confirmation-timeout', at: this.#now() });
    }
    this.#pendingByDevice.delete(deviceId);
    const receipt: CommandReceipt = { commandId, state: 'timed-out' };
    this.#emitLifecycle(pending.command, 'timed-out', receipt, 'timeout');
  }

  #clearPending(deviceId: string, commandId: string): void {
    const pending = this.#pendingByDevice.get(deviceId);
    if (pending?.command.id !== commandId) return;
    if (pending.timeout) this.#clearTimer(pending.timeout);
    this.#pendingByDevice.delete(deviceId);
  }

  #emitLifecycle(
    command: SemanticCommand,
    state: CommandLifecycleEvent['state'],
    receipt?: CommandReceipt,
    reason?: CommandLifecycleEvent['reason'],
  ): void {
    const event: CommandLifecycleEvent = {
      command,
      state,
      at: this.#now(),
      ...(receipt === undefined ? {} : { receipt }),
      ...(reason === undefined ? {} : { reason }),
    };
    for (const listener of [...this.#lifecycleListeners]) listener(event);
  }
}
