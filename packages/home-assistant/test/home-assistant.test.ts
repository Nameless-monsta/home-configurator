import { Diagnostics } from '@home-configurator/runtime';
import { describe, expect, it } from 'vitest';

import {
  HomeAssistantEngine,
  MemoryHomeAssistantTransport,
  discoverCanonicalHome,
  type HARegistrySnapshot,
  type HAState,
} from '../src/index.js';

const iso = '2026-07-11T12:00:00.000Z';

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

const fixture = () => ({
  areas: [{ area_id: 'living', name: 'Living Room', floor_id: 'ground' }],
  floors: [{ floor_id: 'ground', name: 'Ground Floor', level: 0 }],
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
      supported_color_modes: ['hs', 'color_temp'],
      brightness: 0,
    }),
  ],
});

const createEngine = (transport = new MemoryHomeAssistantTransport(fixture())) => {
  const diagnostics = new Diagnostics();
  const engine = new HomeAssistantEngine({
    config: {
      url: 'http://homeassistant.local',
      accessToken: 'redacted',
      commandTimeoutMs: 1000,
    },
    diagnostics,
    transport,
  });
  return { diagnostics, engine, transport };
};

describe('Home Assistant discovery', () => {
  it('automatically maps areas, devices and capabilities', () => {
    const data = fixture();
    const registry: HARegistrySnapshot = {
      ...data,
      services: {},
      config: {},
      observedAt: 1,
    };
    const result = discoverCanonicalHome(registry);
    expect(result.rooms).toHaveLength(1);
    expect(result.rooms[0]?.name).toBe('Living Room');
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0]?.capabilities).toContain('brightness');
    expect(result.devices[0]?.capabilities).toContain('color');
    expect(result.devices[0]?.roomId).toBe('ha-area:living');
  });

  it('keeps a composed device available when one supporting entity is unavailable', () => {
    const data = fixture();
    const registry: HARegistrySnapshot = {
      ...data,
      entities: [
        ...data.entities,
        {
          entity_id: 'sensor.ikea_battery',
          unique_id: 'lamp-battery',
          platform: 'zha',
          device_id: 'lamp',
        },
      ],
      states: [...data.states, state('sensor.ikea_battery', 'unavailable')],
      services: {},
      config: {},
      observedAt: 1,
    };
    const result = discoverCanonicalHome(registry);
    expect(result.devices[0]?.available).toBe(true);
    expect(result.devices[0]?.bindings).toHaveLength(2);
  });
});

describe('HomeAssistantEngine', () => {
  it('publishes one coherent initial snapshot', async () => {
    const { engine, transport } = createEngine();
    const reasons: string[] = [];
    engine.subscribe((patch) => reasons.push(patch.reason));
    await engine.connect();
    expect(engine.getStatus()).toBe('ready');
    expect(engine.getConfirmedSnapshot().devices).toHaveLength(1);
    expect(reasons).toEqual(['initial-sync']);
    expect(transport.subscriptionCount).toBe(5);
    await engine.disconnect();
    engine.dispose();
  });

  it('treats service success as acknowledgement until an authoritative state arrives', async () => {
    const { engine, transport } = createEngine();
    await engine.connect();
    const receipt = await engine.dispatch({
      id: 'brightness-1',
      deviceId: 'ha-device:lamp',
      capability: 'brightness',
      action: 'set',
      value: 0.5,
      issuedAt: 1,
      policy: 'reject-offline',
    });
    expect(receipt.state).toBe('awaiting-confirmation');
    expect(engine.getConfirmedSnapshot().devices[0]?.optimistic['brightness']).toBe(0.5);
    expect(transport.serviceCalls[0]?.service).toBe('turn_on');

    transport.publishState(
      state('light.ikea_lamp', 'on', {
        friendly_name: 'IKEA Lamp',
        supported_color_modes: ['hs', 'color_temp'],
        brightness: 128,
      }),
    );
    expect(engine.getConfirmedSnapshot().devices[0]?.optimistic['brightness']).toBe(
      undefined,
    );
    await engine.disconnect();
    engine.dispose();
  });

  it('marks cached values stale and rejects commands while disconnected', async () => {
    const { engine, transport } = createEngine();
    await engine.connect();
    transport.simulateDisconnect();
    expect(engine.getStatus()).toBe('reconnecting');
    expect(engine.getConfirmedSnapshot().stale).toBe(true);
    const receipt = await engine.dispatch({
      id: 'offline-1',
      deviceId: 'ha-device:lamp',
      capability: 'power',
      action: 'on',
      issuedAt: 1,
      policy: 'reject-offline',
    });
    expect(receipt.state).toBe('failed');
    await engine.disconnect();
    engine.dispose();
  });

  it('coalesces superseded continuous commands', async () => {
    const { diagnostics, engine } = createEngine();
    await engine.connect();
    await engine.dispatch({
      id: 'brightness-a',
      deviceId: 'ha-device:lamp',
      capability: 'brightness',
      action: 'set',
      value: 0.2,
      issuedAt: 1,
      policy: 'reject-offline',
      continuous: true,
    });
    await engine.dispatch({
      id: 'brightness-b',
      deviceId: 'ha-device:lamp',
      capability: 'brightness',
      action: 'set',
      value: 0.8,
      issuedAt: 2,
      policy: 'reject-offline',
      continuous: true,
      final: true,
    });
    expect(diagnostics.snapshot().counters['ha.commands.coalesced']).toBe(1);
    expect(engine.getConfirmedSnapshot().devices[0]?.optimistic['brightness']).toBe(0.8);
    await engine.disconnect();
    engine.dispose();
  });
});
