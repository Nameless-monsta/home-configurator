import { describe, expect, it } from 'vitest';

import { DeviceRuntime } from '../src/index.js';

describe('DeviceRuntime', () => {
  it('separates confirmed, optimistic and effective state', () => {
    let now = 100;
    const runtime = new DeviceRuntime({
      descriptor: {
        id: 'light.living',
        roomId: 'living',
        entityIds: ['light.living'],
        name: 'Living Light',
      },
      confirmedState: { power: false, brightness: 0.2 },
      now: () => now,
    });

    now = 110;
    runtime.applyOptimistic(
      { power: true, brightness: 0.8 },
      { commandId: 'command-1', issuedAt: 105 },
    );

    expect(runtime.snapshot()).toMatchObject({
      confirmedState: { power: false, brightness: 0.2 },
      optimisticState: { power: true, brightness: 0.8 },
      effectiveState: { power: true, brightness: 0.8 },
      pendingCommandId: 'command-1',
    });

    now = 145;
    runtime.confirm(
      { power: true, brightness: 0.8 },
      { commandId: 'command-1', at: now },
    );

    expect(runtime.snapshot()).toMatchObject({
      confirmedState: { power: true, brightness: 0.8 },
      optimisticState: null,
      effectiveState: { power: true, brightness: 0.8 },
      metrics: {
        optimisticUpdates: 1,
        confirmations: 1,
        lastLatencyMs: 40,
        averageLatencyMs: 40,
      },
    });
  });

  it('keeps an optimistic command when an unrelated confirmation arrives', () => {
    const runtime = new DeviceRuntime({
      descriptor: { id: 'light.one', roomId: 'room', entityIds: ['light.one'] },
      confirmedState: { power: false },
    });

    runtime.applyOptimistic({ power: true }, { commandId: 'pending' });
    runtime.confirm({ power: false, brightness: 0.5 }, { commandId: 'other' });

    expect(runtime.snapshot()).toMatchObject({
      confirmedState: { power: false, brightness: 0.5 },
      optimisticState: { power: true },
      effectiveState: { power: true },
      pendingCommandId: 'pending',
    });
  });

  it('rolls back to confirmed state and bounds transition history', () => {
    let now = 1;
    const runtime = new DeviceRuntime({
      descriptor: { id: 'cover.one', roomId: 'room', entityIds: ['cover.one'] },
      confirmedState: { position: 20 },
      historyLimit: 3,
      now: () => now,
    });

    now = 2;
    runtime.applyOptimistic({ position: 80 }, { commandId: 'cover-command' });
    now = 3;
    expect(runtime.rollback({ reason: 'service rejected' })).toBe(true);
    now = 4;
    runtime.setAvailability(false);
    now = 5;
    runtime.setSelected(true);

    const snapshot = runtime.snapshot();
    expect(snapshot.effectiveState).toEqual({ position: 20 });
    expect(snapshot.metrics.rollbacks).toBe(1);
    expect(snapshot.history).toHaveLength(3);
    expect(snapshot.history.map((transition) => transition.kind)).toEqual([
      'rollback',
      'availability',
      'selection',
    ]);
    expect(runtime.rollback({ reason: 'nothing pending' })).toBe(false);
  });

  it('updates metadata without allowing the device ID to change', () => {
    const runtime = new DeviceRuntime({
      descriptor: { id: 'sensor.one', roomId: 'old-room', entityIds: ['sensor.one'] },
    });

    expect(
      runtime.updateDescriptor({
        id: 'sensor.one',
        roomId: 'new-room',
        entityIds: ['sensor.one', 'sensor.one_secondary'],
      }),
    ).toBe(true);
    expect(runtime.snapshot()).toMatchObject({
      id: 'sensor.one',
      roomId: 'new-room',
      entityIds: ['sensor.one', 'sensor.one_secondary'],
    });
    expect(() =>
      runtime.updateDescriptor({
        id: 'sensor.two',
        roomId: 'new-room',
        entityIds: ['sensor.two'],
      }),
    ).toThrow('cannot change its device ID');
  });
});
