import { describe, expect, it } from 'vitest';

import { DeviceRuntime } from '../src/index.js';

describe('DeviceRuntime pending command layers', () => {
  it('reconciles concurrent optimistic commands independently', () => {
    const runtime = new DeviceRuntime({
      descriptor: { id: 'light.one', roomId: 'living', entityIds: ['light.one'] },
      confirmedState: { power: false, brightness: 0.2 },
      now: () => 100,
    });

    runtime.applyOptimistic({ power: true }, { commandId: 'power-1', issuedAt: 90 });
    runtime.applyOptimistic({ brightness: 0.8 }, { commandId: 'brightness-1', issuedAt: 95 });

    expect(runtime.snapshot()).toMatchObject({
      effectiveState: { power: true, brightness: 0.8 },
      pendingCommandIds: ['power-1', 'brightness-1'],
      pendingCommandId: 'brightness-1',
    });

    runtime.confirm({ power: true, brightness: 0.2 }, { commandId: 'power-1', at: 120 });
    expect(runtime.snapshot()).toMatchObject({
      confirmedState: { power: true, brightness: 0.2 },
      effectiveState: { power: true, brightness: 0.8 },
      pendingCommandIds: ['brightness-1'],
      metrics: { lastLatencyMs: 30 },
    });

    expect(
      runtime.rollback({
        commandId: 'brightness-1',
        reason: 'rejected',
        at: 130,
      }),
    ).toBe(true);
    expect(runtime.snapshot()).toMatchObject({
      optimisticState: null,
      effectiveState: { power: true, brightness: 0.2 },
      pendingCommandIds: [],
    });
  });

  it('preserves pending layers during unrelated authoritative updates', () => {
    const runtime = new DeviceRuntime({
      descriptor: { id: 'climate.one', roomId: 'bedroom', entityIds: ['climate.one'] },
      confirmedState: { hvacMode: 'cool', targetTemperature: 22 },
    });

    runtime.applyOptimistic({ targetTemperature: 20 }, { commandId: 'temperature-1' });
    runtime.confirm({ hvacMode: 'fan_only', targetTemperature: 22 });

    expect(runtime.snapshot()).toMatchObject({
      confirmedState: { hvacMode: 'fan_only', targetTemperature: 22 },
      effectiveState: { hvacMode: 'fan_only', targetTemperature: 20 },
      pendingCommandIds: ['temperature-1'],
    });
  });
});
