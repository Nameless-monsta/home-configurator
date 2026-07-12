import { describe, expect, it } from 'vitest';

import { DeviceRegistry } from '../src/index.js';

describe('DeviceRegistry', () => {
  it('indexes devices by room and entity', () => {
    const registry = new DeviceRegistry();

    registry.upsert({
      id: 'device-b',
      roomId: 'living',
      entityIds: ['switch.b'],
    });
    registry.upsert({
      id: 'device-a',
      roomId: 'living',
      entityIds: ['light.a', 'sensor.a'],
    });

    expect(registry.deviceIdForEntity('sensor.a')).toBe('device-a');
    expect(registry.deviceIdsForRoom('living')).toEqual(['device-a', 'device-b']);
    expect(registry.rooms()).toEqual({ living: ['device-a', 'device-b'] });
  });

  it('moves indexes when a descriptor changes', () => {
    const registry = new DeviceRegistry();
    registry.upsert({ id: 'device-a', roomId: 'old', entityIds: ['light.old'] });

    const previous = registry.upsert({
      id: 'device-a',
      roomId: 'new',
      entityIds: ['light.new'],
    });

    expect(previous).toMatchObject({ roomId: 'old' });
    expect(registry.deviceIdForEntity('light.old')).toBeNull();
    expect(registry.deviceIdForEntity('light.new')).toBe('device-a');
    expect(registry.deviceIdsForRoom('old')).toEqual([]);
    expect(registry.deviceIdsForRoom('new')).toEqual(['device-a']);
  });

  it('rejects an entity claimed by two devices', () => {
    const registry = new DeviceRegistry();
    registry.upsert({ id: 'device-a', roomId: 'living', entityIds: ['light.shared'] });

    expect(() =>
      registry.upsert({ id: 'device-b', roomId: 'bedroom', entityIds: ['light.shared'] }),
    ).toThrow('already registered to device device-a');
  });

  it('removes all indexes for a device', () => {
    const registry = new DeviceRegistry();
    registry.upsert({ id: 'device-a', roomId: 'living', entityIds: ['light.a'] });

    expect(registry.remove('device-a')).toMatchObject({ id: 'device-a' });
    expect(registry.size).toBe(0);
    expect(registry.deviceIdForEntity('light.a')).toBeNull();
    expect(registry.remove('device-a')).toBeNull();
  });
});
