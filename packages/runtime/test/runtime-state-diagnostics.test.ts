import { describe, expect, it } from 'vitest';

import { DeviceStore, summarizeRuntimeState } from '../src/index.js';

describe('runtime-state diagnostics', () => {
  it('summarizes availability, optimistic state, rollbacks and latency', () => {
    const store = new DeviceStore();
    store.upsert({
      descriptor: { id: 'light-a', roomId: 'living', entityIds: ['light.a'] },
      confirmedState: { power: false },
      now: () => 100,
    });
    store.upsert({
      descriptor: {
        id: 'sensor-a',
        roomId: 'living',
        entityIds: ['sensor.a'],
        available: false,
        connected: false,
      },
      confirmedState: { value: 22 },
    });

    store.applyOptimistic(
      'light-a',
      { power: true },
      { commandId: 'command-1', issuedAt: 100, at: 100 },
    );
    store.confirm('light-a', { power: true }, { commandId: 'command-1', at: 140 });
    store.applyOptimistic('light-a', { power: false }, { commandId: 'command-2' });
    store.rollback('light-a', { reason: 'rejected' });
    store.setSelected('light-a', true);

    expect(summarizeRuntimeState(store.snapshot())).toEqual({
      deviceCount: 2,
      availableCount: 1,
      connectedCount: 1,
      selectedCount: 1,
      optimisticCount: 0,
      rollbackCount: 1,
      transitionCount: 7,
      averageLatencyMs: 40,
    });
  });
});
