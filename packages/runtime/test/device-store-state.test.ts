import { describe, expect, it } from 'vitest';

import { DeviceStore } from '../src/index.js';

describe('DeviceStore', () => {
  it('provides indexed lookup and fine-grained device subscriptions', () => {
    const store = new DeviceStore();
    store.upsert({
      descriptor: { id: 'light-a', roomId: 'living', entityIds: ['light.a'] },
      confirmedState: { power: false },
    });
    store.upsert({
      descriptor: { id: 'light-b', roomId: 'bedroom', entityIds: ['light.b'] },
      confirmedState: { power: false },
    });

    const lightAUpdates: unknown[] = [];
    const lightBUpdates: unknown[] = [];
    store.subscribeDevice('light-a', (snapshot) => lightAUpdates.push(snapshot.effectiveState));
    store.subscribeDevice('light-b', (snapshot) => lightBUpdates.push(snapshot.effectiveState));

    store.applyOptimistic('light-a', { power: true }, { commandId: 'command-a' });

    expect(lightAUpdates).toEqual([{ power: true }]);
    expect(lightBUpdates).toEqual([]);
    expect(store.getByEntity('light.a')?.snapshot().id).toBe('light-a');
    expect(store.devicesForRoom('living').map((device) => device.snapshot().id)).toEqual([
      'light-a',
    ]);
  });

  it('notifies only affected room subscribers', () => {
    const store = new DeviceStore();
    store.upsert({
      descriptor: { id: 'light-a', roomId: 'living', entityIds: ['light.a'] },
      confirmedState: { power: false },
    });
    store.upsert({
      descriptor: { id: 'light-b', roomId: 'bedroom', entityIds: ['light.b'] },
      confirmedState: { power: false },
    });

    const livingSnapshots: number[] = [];
    const bedroomSnapshots: number[] = [];
    store.subscribeRoom('living', (snapshot) => livingSnapshots.push(snapshot.version));
    store.subscribeRoom('bedroom', (snapshot) => bedroomSnapshots.push(snapshot.version));

    store.confirm('light-a', { power: true });

    expect(livingSnapshots).toHaveLength(1);
    expect(bedroomSnapshots).toHaveLength(0);
  });

  it('updates room indexes and emits removal patches', () => {
    const store = new DeviceStore();
    store.upsert({
      descriptor: { id: 'sensor-a', roomId: 'living', entityIds: ['sensor.a'] },
    });
    const patches: string[] = [];
    const oldRoomSizes: number[] = [];
    store.subscribe((patch) => patches.push(patch.kind));
    store.subscribeRoom('living', (snapshot) => oldRoomSizes.push(snapshot.devices.length));

    store.upsert({
      descriptor: { id: 'sensor-a', roomId: 'kitchen', entityIds: ['sensor.a'] },
    });

    expect(store.snapshot().rooms).toEqual({ kitchen: ['sensor-a'] });
    expect(oldRoomSizes.at(-1)).toBe(0);
    expect(store.remove('sensor-a')).toBe(true);
    expect(store.remove('sensor-a')).toBe(false);
    expect(patches).toContain('updated');
    expect(patches.at(-1)).toBe('removed');
  });

  it('delegates rollback, availability and selection state', () => {
    const store = new DeviceStore();
    store.upsert({
      descriptor: { id: 'cover-a', roomId: 'terrace', entityIds: ['cover.a'] },
      confirmedState: { position: 10 },
    });

    store.applyOptimistic('cover-a', { position: 90 }, { commandId: 'cover-command' });
    expect(store.rollback('cover-a', { reason: 'rejected' })).toBe(true);
    expect(store.setAvailability('cover-a', false, { connected: false })).toBe(true);
    expect(store.setSelected('cover-a', true)).toBe(true);

    expect(store.get('cover-a')?.snapshot()).toMatchObject({
      effectiveState: { position: 10 },
      available: false,
      connected: false,
      selected: true,
      metrics: { rollbacks: 1 },
    });
    expect(() => store.confirm('missing', {})).toThrow('Unknown device: missing');
  });
});
