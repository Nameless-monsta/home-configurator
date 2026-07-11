import type { ConfirmedRuntimeSnapshot } from '@home-configurator/home-assistant';
import { describe, expect, it } from 'vitest';

import {
  buildNavigationModel,
  createUiSnapshot,
  initialUiState,
  reduceUiState,
} from '../src/index.js';

const home: ConfirmedRuntimeSnapshot = {
  status: 'ready',
  rooms: [{ id: 'living', name: 'Living Room', aliases: [], deviceIds: ['lamp'] }],
  devices: [
    {
      id: 'lamp',
      name: 'IKEA Lamp',
      roomId: 'living',
      entityIds: ['light.lamp'],
      bindings: [],
      capabilities: ['power', 'brightness', 'color'],
      available: true,
      optimistic: {},
    },
  ],
  states: {},
  observedAt: 1,
  stale: false,
};

describe('UI state', () => {
  it('opens navigation and switches modes deterministically', () => {
    const opened = reduceUiState(initialUiState, { type: 'toggle-navigation' });
    expect(opened.navigationOpen).toBe(true);
    expect(opened.overlay).toBe('navigation');

    const devices = reduceUiState(opened, { type: 'set-navigation-mode', mode: 'devices' });
    expect(devices.navigationMode).toBe('devices');
    expect(devices.navigationOpen).toBe(true);
  });

  it('selects a device and opens its configurator', () => {
    const state = reduceUiState(initialUiState, {
      type: 'select-device',
      deviceId: 'lamp',
      roomId: 'living',
    });
    const snapshot = createUiSnapshot(state, home);
    expect(state.overlay).toBe('configurator');
    expect(snapshot.selectedRoom?.name).toBe('Living Room');
    expect(snapshot.selectedDevice?.name).toBe('IKEA Lamp');
  });

  it('builds portable room and device navigation models', () => {
    const model = buildNavigationModel(home, initialUiState);
    expect(model.rooms[0]?.meta).toBe('1 device');
    expect(model.devices[0]?.meta).toBe('power · brightness · color');
  });
});
