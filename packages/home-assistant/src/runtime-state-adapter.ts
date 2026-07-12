import type {
  DeviceDescriptor,
  DeviceState,
  DeviceStore,
  RuntimeUnsubscribe,
} from '@home-configurator/runtime';

import type {
  CanonicalDevice,
  CapabilityKind,
  CommandReceipt,
  ConfirmedRuntimeSnapshot,
  ConfirmedStatePatch,
  HAState,
  HomeAssistantRuntime,
  SemanticCommand,
} from './types.js';

interface PendingRuntimeCommand {
  readonly command: SemanticCommand;
  readonly patch: DeviceState;
  timeout: ReturnType<typeof setTimeout> | undefined;
}

export interface HomeAssistantStateAdapterOptions {
  readonly homeAssistant: Pick<
    HomeAssistantRuntime,
    'dispatch' | 'getConfirmedSnapshot' | 'subscribe'
  >;
  readonly store: DeviceStore;
  readonly commandTimeoutMs?: number;
  readonly now?: () => number;
  readonly setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  readonly clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const numberAttribute = (state: HAState | undefined, key: string): number | undefined => {
  const value = state?.attributes[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const stringAttribute = (state: HAState | undefined, key: string): string | undefined => {
  const value = state?.attributes[key];
  return typeof value === 'string' ? value : undefined;
};

const stateForCapability = (
  snapshot: ConfirmedRuntimeSnapshot,
  device: CanonicalDevice,
  capability: CapabilityKind,
): HAState | undefined => {
  const binding = device.bindings.find((candidate) => candidate.capabilities.includes(capability));
  return binding === undefined ? undefined : snapshot.states[binding.entityId];
};

const rgbToHs = (rgb: readonly [number, number, number]): readonly [number, number] => {
  const red = clamp(rgb[0], 0, 255) / 255;
  const green = clamp(rgb[1], 0, 255) / 255;
  const blue = clamp(rgb[2], 0, 255) / 255;
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

const colorValue = (state: HAState | undefined): readonly [number, number] | undefined => {
  const hs = state?.attributes['hs_color'];
  if (Array.isArray(hs)) {
    const hue = hs[0];
    const saturation = hs[1];
    if (typeof hue === 'number' && typeof saturation === 'number') {
      return [clamp(hue, 0, 360), clamp(saturation, 0, 100)];
    }
  }
  const rgb = state?.attributes['rgb_color'];
  if (Array.isArray(rgb)) {
    const red = rgb[0];
    const green = rgb[1];
    const blue = rgb[2];
    if (typeof red === 'number' && typeof green === 'number' && typeof blue === 'number') {
      return rgbToHs([red, green, blue]);
    }
  }
  return undefined;
};

const powerValue = (state: HAState | undefined): boolean | undefined => {
  if (state === undefined) return undefined;
  const domain = state.entity_id.split('.', 1)[0];
  if (domain === 'climate') return state.state !== 'off';
  if (domain === 'media_player') return !['off', 'unavailable', 'unknown'].includes(state.state);
  return state.state === 'on';
};

export const toRuntimeDeviceDescriptor = (
  snapshot: ConfirmedRuntimeSnapshot,
  device: CanonicalDevice,
): DeviceDescriptor => ({
  id: device.id,
  roomId: device.roomId,
  entityIds: [...device.entityIds],
  name: device.name,
  available: device.available,
  connected: !snapshot.stale,
});

export const toRuntimeDeviceState = (
  snapshot: ConfirmedRuntimeSnapshot,
  device: CanonicalDevice,
): DeviceState => {
  const values: Record<string, unknown> = {};
  const power = powerValue(stateForCapability(snapshot, device, 'power'));
  if (power !== undefined) values['power'] = power;

  const brightness = numberAttribute(
    stateForCapability(snapshot, device, 'brightness'),
    'brightness',
  );
  if (brightness !== undefined) values['brightness'] = clamp(brightness / 255, 0, 1);

  const color = colorValue(stateForCapability(snapshot, device, 'color'));
  if (color !== undefined) values['color'] = color;

  const colorTemperature = numberAttribute(
    stateForCapability(snapshot, device, 'colorTemperature'),
    'color_temp_kelvin',
  );
  if (colorTemperature !== undefined) values['colorTemperature'] = colorTemperature;

  const climate = stateForCapability(snapshot, device, 'hvacMode');
  if (climate !== undefined) values['hvacMode'] = climate.state;
  const targetTemperature = numberAttribute(
    stateForCapability(snapshot, device, 'targetTemperature'),
    'temperature',
  );
  if (targetTemperature !== undefined) values['targetTemperature'] = targetTemperature;
  const fanMode = stringAttribute(stateForCapability(snapshot, device, 'fanMode'), 'fan_mode');
  if (fanMode !== undefined) values['fanMode'] = fanMode;

  const media = stateForCapability(snapshot, device, 'mediaPlayback');
  if (media !== undefined) values['mediaPlayback'] = media.state;
  const volume = numberAttribute(stateForCapability(snapshot, device, 'volume'), 'volume_level');
  if (volume !== undefined) values['volume'] = clamp(volume, 0, 1);
  const mediaSource = stringAttribute(
    stateForCapability(snapshot, device, 'mediaSource'),
    'source',
  );
  if (mediaSource !== undefined) values['mediaSource'] = mediaSource;

  const coverPosition = numberAttribute(
    stateForCapability(snapshot, device, 'coverPosition'),
    'current_position',
  );
  if (coverPosition !== undefined) values['coverPosition'] = clamp(coverPosition, 0, 100);

  const lock = stateForCapability(snapshot, device, 'lock');
  if (lock !== undefined) values['lock'] = lock.state === 'locked';

  const sensors: Record<string, unknown> = {};
  for (const binding of device.bindings.filter((candidate) =>
    candidate.capabilities.includes('sensor'),
  )) {
    const state = snapshot.states[binding.entityId];
    if (state === undefined) continue;
    const numeric = Number(state.state);
    sensors[binding.entityId] = Number.isFinite(numeric) ? numeric : state.state;
  }
  if (Object.keys(sensors).length > 0) values['sensors'] = sensors;

  return values;
};

export const semanticCommandToRuntimePatch = (command: SemanticCommand): DeviceState | null => {
  if (command.capability === 'power') {
    const power =
      typeof command.value === 'boolean'
        ? command.value
        : command.action === 'on' || command.action === 'turn_on';
    return { power };
  }
  if (command.capability === 'brightness' && typeof command.value === 'number') {
    return { brightness: clamp(command.value, 0, 1) };
  }
  if (command.capability === 'color' && Array.isArray(command.value)) {
    const hue = command.value[0];
    const saturation = command.value[1];
    if (typeof hue === 'number' && typeof saturation === 'number') {
      return { color: [clamp(hue, 0, 360), clamp(saturation, 0, 100)] };
    }
  }
  if (command.capability === 'colorTemperature' && typeof command.value === 'number') {
    return { colorTemperature: command.value };
  }
  if (command.capability === 'targetTemperature' && typeof command.value === 'number') {
    return { targetTemperature: command.value };
  }
  if (command.capability === 'hvacMode' && typeof command.value === 'string') {
    return { hvacMode: command.value };
  }
  if (command.capability === 'fanMode' && typeof command.value === 'string') {
    return { fanMode: command.value };
  }
  if (command.capability === 'volume' && typeof command.value === 'number') {
    return { volume: clamp(command.value, 0, 1) };
  }
  if (command.capability === 'mediaSource' && typeof command.value === 'string') {
    return { mediaSource: command.value };
  }
  if (command.capability === 'coverPosition' && typeof command.value === 'number') {
    return { coverPosition: clamp(command.value, 0, 100) };
  }
  if (command.capability === 'lock') {
    return { lock: command.action === 'lock' || command.value === true };
  }
  return null;
};

const numericTolerance: Readonly<Record<string, number>> = {
  brightness: 0.02,
  volume: 0.02,
  targetTemperature: 0.2,
  colorTemperature: 50,
  coverPosition: 2,
  color: 2,
};

const valueMatches = (key: string, actual: unknown, expected: unknown): boolean => {
  const tolerance = numericTolerance[key] ?? 0;
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      actual.every((value, index) => {
        const expectedValue = expected[index];
        return (
          typeof value === 'number' &&
          typeof expectedValue === 'number' &&
          Math.abs(value - expectedValue) <= tolerance
        );
      })
    );
  }
  if (typeof actual === 'number' && typeof expected === 'number') {
    return Math.abs(actual - expected) <= tolerance;
  }
  return Object.is(actual, expected);
};

export const runtimeStateMatchesPatch = (state: DeviceState, patch: DeviceState): boolean =>
  Object.entries(patch).every(([key, value]) => valueMatches(key, state[key], value));

const failedReceipt = (receipt: CommandReceipt): boolean =>
  receipt.state === 'failed' || receipt.state === 'timed-out' || receipt.state === 'canceled';

export class HomeAssistantStateAdapter {
  readonly #homeAssistant: Pick<
    HomeAssistantRuntime,
    'dispatch' | 'getConfirmedSnapshot' | 'subscribe'
  >;
  readonly #store: DeviceStore;
  readonly #commandTimeoutMs: number;
  readonly #now: () => number;
  readonly #setTimer: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  readonly #clearTimer: (handle: ReturnType<typeof setTimeout>) => void;
  readonly #pending = new Map<string, PendingRuntimeCommand>();
  readonly #managedDeviceIds = new Set<string>();
  #unsubscribe: RuntimeUnsubscribe | undefined;

  public constructor(options: HomeAssistantStateAdapterOptions) {
    this.#homeAssistant = options.homeAssistant;
    this.#store = options.store;
    this.#commandTimeoutMs = Math.max(500, options.commandTimeoutMs ?? 8500);
    this.#now = options.now ?? Date.now;
    this.#setTimer =
      options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.#clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));
  }

  public start(): void {
    if (this.#unsubscribe !== undefined) return;
    this.#synchronize({
      reason: 'initial-sync',
      snapshot: this.#homeAssistant.getConfirmedSnapshot(),
      affectedEntityIds: [],
      affectedDeviceIds: [],
    });
    this.#unsubscribe = this.#homeAssistant.subscribe((patch) => this.#synchronize(patch));
  }

  public async dispatch(command: SemanticCommand): Promise<CommandReceipt> {
    const patch = semanticCommandToRuntimePatch(command);
    if (patch !== null && this.#store.get(command.deviceId) !== null) {
      if (command.continuous) this.#cancelSuperseded(command);
      this.#store.applyOptimistic(command.deviceId, patch, {
        commandId: command.id,
        issuedAt: command.issuedAt,
        at: this.#now(),
      });
      this.#pending.set(command.id, { command, patch, timeout: undefined });
    }

    let receipt: CommandReceipt;
    try {
      receipt = await this.#homeAssistant.dispatch(command);
    } catch (error) {
      this.#rollback(
        command.id,
        error instanceof Error ? error.message : 'Command dispatch failed',
      );
      throw error;
    }

    if (failedReceipt(receipt)) {
      this.#rollback(command.id, receipt.error?.userMessage ?? receipt.state);
    } else if (receipt.state === 'awaiting-confirmation') {
      const pending = this.#pending.get(command.id);
      if (pending !== undefined) {
        pending.timeout = this.#setTimer(
          () => this.#rollback(command.id, 'Authoritative state confirmation timed out'),
          this.#commandTimeoutMs,
        );
      }
    } else {
      this.#rollback(command.id, 'Command completed without authoritative state confirmation');
    }
    return receipt;
  }

  public dispose(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    for (const commandId of [...this.#pending.keys()])
      this.#rollback(commandId, 'Adapter disposed');
    this.#managedDeviceIds.clear();
  }

  #synchronize(patch: ConfirmedStatePatch): void {
    const currentDeviceIds = new Set(patch.snapshot.devices.map((device) => device.id));
    for (const device of patch.snapshot.devices) this.#synchronizeDevice(patch.snapshot, device);
    for (const deviceId of [...this.#managedDeviceIds]) {
      if (currentDeviceIds.has(deviceId)) continue;
      this.#store.remove(deviceId);
      this.#managedDeviceIds.delete(deviceId);
      this.#clearPendingForDevice(deviceId, 'Device removed from Home Assistant');
    }
    if (patch.snapshot.stale) {
      for (const commandId of [...this.#pending.keys()]) {
        this.#rollback(commandId, 'Home Assistant connection became stale');
      }
    }
  }

  #synchronizeDevice(snapshot: ConfirmedRuntimeSnapshot, device: CanonicalDevice): void {
    const descriptor = toRuntimeDeviceDescriptor(snapshot, device);
    const confirmedState = toRuntimeDeviceState(snapshot, device);
    const existing = this.#store.get(device.id);
    if (existing === null) {
      this.#store.upsert({ descriptor, confirmedState });
      this.#managedDeviceIds.add(device.id);
      return;
    }

    this.#store.upsert({ descriptor });
    const matching = [...this.#pending.values()].filter(
      (pending) =>
        pending.command.deviceId === device.id &&
        runtimeStateMatchesPatch(confirmedState, pending.patch),
    );
    if (matching.length === 0) {
      this.#store.confirm(device.id, confirmedState, { at: snapshot.observedAt });
      return;
    }
    for (const pending of matching) {
      this.#store.confirm(device.id, confirmedState, {
        commandId: pending.command.id,
        at: snapshot.observedAt,
      });
      this.#clearPending(pending.command.id);
    }
  }

  #cancelSuperseded(command: SemanticCommand): void {
    for (const pending of [...this.#pending.values()]) {
      if (
        pending.command.deviceId === command.deviceId &&
        pending.command.capability === command.capability
      ) {
        this.#rollback(pending.command.id, 'Superseded by a newer continuous command');
      }
    }
  }

  #clearPendingForDevice(deviceId: string, reason: string): void {
    for (const pending of [...this.#pending.values()]) {
      if (pending.command.deviceId === deviceId) this.#rollback(pending.command.id, reason);
    }
  }

  #rollback(commandId: string, reason: string): void {
    const pending = this.#pending.get(commandId);
    if (pending === undefined) return;
    this.#store.rollback(pending.command.deviceId, { commandId, reason, at: this.#now() });
    this.#clearPending(commandId);
  }

  #clearPending(commandId: string): void {
    const pending = this.#pending.get(commandId);
    if (pending?.timeout !== undefined) this.#clearTimer(pending.timeout);
    this.#pending.delete(commandId);
  }
}
