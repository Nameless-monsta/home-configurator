import { DeviceStore } from '@home-configurator/runtime';
import { describe, expect, it } from 'vitest';

import {
  HomeAssistantStateAdapter,
  runtimeStateMatchesPatch,
  semanticCommandToRuntimePatch,
  toRuntimeDeviceState,
  type CanonicalDevice,
  type CommandReceipt,
  type ConfirmedRuntimeSnapshot,
  type ConfirmedStatePatch,
  type HAState,
  type SemanticCommand,
} from '../src/index.js';

const iso = '2026-07-12T00:00:00.000Z';

const state = (
  entityId: string,
  value: string,
  attributes: Readonly<Record<string, unknown>> = {},
): HAState => ({
  entity_id: entityId,
  state: value,
  attributes,
  last_changed: iso,
  last_updated: iso,
});

const lightDevice: CanonicalDevice = {
  id: 'ha-device:lamp',
  name: 'Living Lamp',
  roomId: 'ha-area:living',
  entityIds: ['light.living_lamp'],
  bindings: [
    {
      entityId: 'light.living_lamp',
      domain: 'light',
      capabilities: ['power', 'brightness', 'color', 'colorTemperature'],
      available: true,
      stale: false,
    },
  ],
  capabilities: ['power', 'brightness', 'color', 'colorTemperature'],
  available: true,
  optimistic: {},
};

const createSnapshot = (
  lightState: HAState = state('light.living_lamp', 'off', {
    brightness: 0,
    hs_color: [0, 0],
    color_temp_kelvin: 3000,
  }),
  options: {
    readonly stale?: boolean;
    readonly devices?: readonly CanonicalDevice[];
    readonly at?: number;
  } = {},
): ConfirmedRuntimeSnapshot => ({
  status: options.stale ? 'reconnecting' : 'ready',
  rooms: [
    {
      id: 'ha-area:living',
      name: 'Living Room',
      aliases: [],
      deviceIds: [lightDevice.id],
    },
  ],
  devices: options.devices ?? [lightDevice],
  states: options.devices?.length === 0 ? {} : { [lightState.entity_id]: lightState },
  observedAt: options.at ?? 100,
  stale: options.stale ?? false,
});

class FakeHomeAssistantRuntime {
  readonly #listeners = new Set<(patch: ConfirmedStatePatch) => void>();
  snapshot: ConfirmedRuntimeSnapshot;
  receipt: CommandReceipt = { commandId: 'placeholder', state: 'awaiting-confirmation' };
  readonly commands: SemanticCommand[] = [];

  public constructor(snapshot: ConfirmedRuntimeSnapshot) {
    this.snapshot = snapshot;
  }

  public getConfirmedSnapshot(): ConfirmedRuntimeSnapshot {
    return this.snapshot;
  }

  public subscribe(listener: (patch: ConfirmedStatePatch) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  public dispatch(command: SemanticCommand): Promise<CommandReceipt> {
    this.commands.push(command);
    return Promise.resolve({ ...this.receipt, commandId: command.id });
  }

  public publish(snapshot: ConfirmedRuntimeSnapshot, reason: ConfirmedStatePatch['reason']): void {
    this.snapshot = snapshot;
    const patch: ConfirmedStatePatch = {
      reason,
      snapshot,
      affectedEntityIds: ['light.living_lamp'],
      affectedDeviceIds: [lightDevice.id],
    };
    for (const listener of [...this.#listeners]) listener(patch);
  }
}

const brightnessCommand = (id: string, value: number): SemanticCommand => ({
  id,
  deviceId: lightDevice.id,
  capability: 'brightness',
  action: 'set',
  value,
  issuedAt: 100,
  policy: 'reject-offline',
});

describe('Home Assistant runtime state translation', () => {
  it('normalizes confirmed light state and command patches', () => {
    const snapshot = createSnapshot(
      state('light.living_lamp', 'on', {
        brightness: 128,
        rgb_color: [255, 128, 0],
        color_temp_kelvin: 3200,
      }),
    );

    expect(toRuntimeDeviceState(snapshot, lightDevice)).toMatchObject({
      power: true,
      brightness: 128 / 255,
      color: [30.12, 100],
      colorTemperature: 3200,
    });
    expect(semanticCommandToRuntimePatch(brightnessCommand('brightness', 1.4))).toEqual({
      brightness: 1,
    });
    expect(
      runtimeStateMatchesPatch(
        { brightness: 0.51, color: [31, 99] },
        { brightness: 0.5, color: [30, 100] },
      ),
    ).toBe(true);
  });
});

describe('HomeAssistantStateAdapter', () => {
  it('hydrates Runtime state and confirms an optimistic command', async () => {
    let now = 110;
    const homeAssistant = new FakeHomeAssistantRuntime(createSnapshot());
    const store = new DeviceStore();
    const adapter = new HomeAssistantStateAdapter({ homeAssistant, store, now: () => now });
    adapter.start();

    expect(store.get(lightDevice.id)?.snapshot()).toMatchObject({
      confirmedState: { power: false, brightness: 0 },
      connected: true,
    });

    await adapter.dispatch(brightnessCommand('brightness-1', 0.8));
    expect(store.get(lightDevice.id)?.snapshot()).toMatchObject({
      effectiveState: { brightness: 0.8 },
      pendingCommandIds: ['brightness-1'],
    });

    now = 150;
    homeAssistant.publish(
      createSnapshot(
        state('light.living_lamp', 'on', {
          brightness: 204,
          hs_color: [20, 80],
          color_temp_kelvin: 3000,
        }),
        { at: now },
      ),
      'state-changed',
    );

    expect(store.get(lightDevice.id)?.snapshot()).toMatchObject({
      optimisticState: null,
      confirmedState: { power: true, brightness: 0.8 },
      pendingCommandIds: [],
      metrics: { lastLatencyMs: 50 },
    });
    adapter.dispose();
  });

  it('reconciles concurrent capability commands independently', async () => {
    const homeAssistant = new FakeHomeAssistantRuntime(createSnapshot());
    const store = new DeviceStore();
    const adapter = new HomeAssistantStateAdapter({ homeAssistant, store });
    adapter.start();

    await adapter.dispatch({
      id: 'power-1',
      deviceId: lightDevice.id,
      capability: 'power',
      action: 'on',
      issuedAt: 100,
      policy: 'reject-offline',
    });
    await adapter.dispatch(brightnessCommand('brightness-2', 0.8));

    expect(store.get(lightDevice.id)?.snapshot().pendingCommandIds).toEqual([
      'power-1',
      'brightness-2',
    ]);

    homeAssistant.publish(
      createSnapshot(
        state('light.living_lamp', 'on', {
          brightness: 0,
          hs_color: [0, 0],
          color_temp_kelvin: 3000,
        }),
        { at: 130 },
      ),
      'state-changed',
    );

    expect(store.get(lightDevice.id)?.snapshot()).toMatchObject({
      confirmedState: { power: true, brightness: 0 },
      effectiveState: { power: true, brightness: 0.8 },
      pendingCommandIds: ['brightness-2'],
    });

    homeAssistant.publish(
      createSnapshot(
        state('light.living_lamp', 'on', {
          brightness: 204,
          hs_color: [0, 0],
          color_temp_kelvin: 3000,
        }),
        { at: 150 },
      ),
      'state-changed',
    );
    expect(store.get(lightDevice.id)?.snapshot().pendingCommandIds).toEqual([]);
    adapter.dispose();
  });

  it('rolls back failed and timed-out commands', async () => {
    let timeoutCallback: (() => void) | undefined;
    const homeAssistant = new FakeHomeAssistantRuntime(createSnapshot());
    const store = new DeviceStore();
    const adapter = new HomeAssistantStateAdapter({
      homeAssistant,
      store,
      setTimer: (callback) => {
        timeoutCallback = callback;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => undefined,
    });
    adapter.start();

    homeAssistant.receipt = { commandId: 'failed', state: 'failed' };
    await adapter.dispatch(brightnessCommand('failed', 0.7));
    expect(store.get(lightDevice.id)?.snapshot().optimisticState).toBeNull();

    homeAssistant.receipt = { commandId: 'timeout', state: 'awaiting-confirmation' };
    await adapter.dispatch(brightnessCommand('timeout', 0.9));
    expect(store.get(lightDevice.id)?.snapshot().effectiveState['brightness']).toBe(0.9);
    timeoutCallback?.();
    expect(store.get(lightDevice.id)?.snapshot()).toMatchObject({
      optimisticState: null,
      metrics: { rollbacks: 2 },
    });
    adapter.dispose();
  });

  it('marks devices disconnected and removes missing Home Assistant devices', () => {
    const homeAssistant = new FakeHomeAssistantRuntime(createSnapshot());
    const store = new DeviceStore();
    const adapter = new HomeAssistantStateAdapter({ homeAssistant, store });
    adapter.start();

    homeAssistant.publish(createSnapshot(undefined, { stale: true }), 'stale');
    expect(store.get(lightDevice.id)?.snapshot().connected).toBe(false);

    homeAssistant.publish(createSnapshot(undefined, { devices: [] }), 'registry-changed');
    expect(store.get(lightDevice.id)).toBeNull();
    adapter.dispose();
  });
});
