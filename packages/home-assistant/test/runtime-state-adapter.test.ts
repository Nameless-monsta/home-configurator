import { DeviceStore, Diagnostics } from '@home-configurator/runtime';
import { describe, expect, it } from 'vitest';

import {
  HomeAssistantEngine,
  HomeAssistantStateAdapter,
  MemoryHomeAssistantTransport,
  semanticCommandToDeviceState,
  toRuntimeDeviceState,
  type CommandLifecycleEvent,
  type HAState,
} from '../src/index.js';

const observedAt = '2026-07-12T00:00:00.000Z';

const state = (
  entityId: string,
  value: string,
  attributes: Readonly<Record<string, unknown>> = {},
): HAState => ({
  entity_id: entityId,
  state: value,
  attributes,
  last_changed: observedAt,
  last_updated: observedAt,
});

const fixture = () => ({
  floors: [{ floor_id: 'ground', name: 'Ground Floor', level: 0 }],
  areas: [{ area_id: 'living', name: 'Living Room', floor_id: 'ground' }],
  devices: [
    {
      id: 'lamp',
      name: 'IKEA Lamp',
      area_id: 'living',
      manufacturer: 'IKEA',
      model: 'TRADFRI',
    },
  ],
  entities: [
    {
      entity_id: 'light.ikea_lamp',
      unique_id: 'lamp-light',
      platform: 'zha',
      device_id: 'lamp',
    },
  ],
  states: [
    state('light.ikea_lamp', 'off', {
      friendly_name: 'IKEA Lamp',
      brightness: 0,
      hs_color: [30, 50],
      color_temp_kelvin: 3000,
      supported_color_modes: ['hs', 'color_temp'],
    }),
  ],
});

const createHarness = () => {
  const transport = new MemoryHomeAssistantTransport(fixture());
  const engine = new HomeAssistantEngine({
    config: {
      url: 'http://homeassistant.local',
      accessToken: 'redacted',
      reconnect: { enabled: false },
      commandTimeoutMs: 1000,
    },
    diagnostics: new Diagnostics(),
    transport,
  });
  const store = new DeviceStore();
  const adapter = new HomeAssistantStateAdapter({
    source: engine,
    store,
    confirmationTimeoutMs: 1200,
  });
  return { adapter, engine, store, transport };
};

describe('Home Assistant runtime state translation', () => {
  it('normalizes confirmed Home Assistant values to semantic runtime state', async () => {
    const { adapter, engine, store } = createHarness();
    await adapter.connect();

    const snapshot = engine.getConfirmedSnapshot();
    expect(toRuntimeDeviceState(snapshot, 'ha-device:lamp')).toMatchObject({
      power: false,
      brightness: 0,
      color: [30, 50],
      colorTemperature: 3000,
      integrationStatus: 'ready',
    });
    expect(store.get('ha-device:lamp')?.snapshot()).toMatchObject({
      roomId: 'ha-area:living',
      available: true,
      connected: true,
      effectiveState: { power: false, brightness: 0 },
    });

    await adapter.disconnect();
    adapter.dispose();
    engine.dispose();
    store.dispose();
  });

  it('maps semantic commands to the same runtime state contract', () => {
    expect(
      semanticCommandToDeviceState({
        id: 'brightness-1',
        deviceId: 'ha-device:lamp',
        capability: 'brightness',
        action: 'set',
        value: 0.64,
        issuedAt: 1,
        policy: 'reject-offline',
      }),
    ).toEqual({ brightness: 0.64 });
    expect(
      semanticCommandToDeviceState({
        id: 'cover-open-1',
        deviceId: 'ha-device:shade',
        capability: 'coverPosition',
        action: 'open',
        issuedAt: 1,
        policy: 'reject-offline',
      }),
    ).toEqual({ coverPosition: 100 });
  });
});

describe('HomeAssistantStateAdapter', () => {
  it('reconciles optimistic commands when authoritative state arrives', async () => {
    const { adapter, engine, store, transport } = createHarness();
    const lifecycle: CommandLifecycleEvent[] = [];
    adapter.subscribeCommandLifecycle((event) => lifecycle.push(event));
    await adapter.connect();

    const receipt = await adapter.dispatch({
      id: 'brightness-1',
      deviceId: 'ha-device:lamp',
      capability: 'brightness',
      action: 'set',
      value: 0.5,
      issuedAt: Date.now(),
      policy: 'reject-offline',
    });

    expect(receipt.state).toBe('awaiting-confirmation');
    expect(store.get('ha-device:lamp')?.snapshot()).toMatchObject({
      optimisticState: { brightness: 0.5 },
      effectiveState: { brightness: 0.5 },
      pendingCommandId: 'brightness-1',
    });

    transport.publishState(
      state('light.ikea_lamp', 'on', {
        friendly_name: 'IKEA Lamp',
        brightness: 128,
        hs_color: [210, 75],
        color_temp_kelvin: 3500,
        supported_color_modes: ['hs', 'color_temp'],
      }),
    );

    const confirmed = store.get('ha-device:lamp')?.snapshot();
    expect(confirmed?.optimisticState).toBeNull();
    expect(confirmed?.confirmedState['power']).toBe(true);
    expect(confirmed?.confirmedState['brightness']).toBeCloseTo(128 / 255);
    expect(confirmed?.confirmedState['color']).toEqual([210, 75]);
    expect(lifecycle.map((event) => event.state)).toEqual([
      'dispatching',
      'awaiting-confirmation',
      'confirmed',
    ]);

    await adapter.disconnect();
    adapter.dispose();
    engine.dispose();
    store.dispose();
  });

  it('marks devices disconnected and rolls back commands rejected while offline', async () => {
    const { adapter, engine, store, transport } = createHarness();
    const lifecycle: CommandLifecycleEvent[] = [];
    adapter.subscribeCommandLifecycle((event) => lifecycle.push(event));
    await adapter.connect();
    transport.simulateDisconnect();

    expect(store.get('ha-device:lamp')?.snapshot().connected).toBe(false);
    const receipt = await adapter.dispatch({
      id: 'power-offline-1',
      deviceId: 'ha-device:lamp',
      capability: 'power',
      action: 'on',
      issuedAt: Date.now(),
      policy: 'reject-offline',
    });

    expect(receipt.state).toBe('failed');
    const runtime = store.get('ha-device:lamp')?.snapshot();
    expect(runtime?.optimisticState).toBeNull();
    expect(runtime?.effectiveState['power']).toBe(false);
    expect(runtime?.metrics.rollbacks).toBe(1);
    expect(lifecycle.at(-1)).toMatchObject({ state: 'failed', reason: 'connection' });

    await adapter.disconnect();
    adapter.dispose();
    engine.dispose();
    store.dispose();
  });
});
