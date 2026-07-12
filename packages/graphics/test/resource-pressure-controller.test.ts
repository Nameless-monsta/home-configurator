import { describe, expect, it } from 'vitest';

import { ResourcePressureController } from '../src/index.js';

const critical = {
  metric: 'drawCalls' as const,
  severity: 'critical' as const,
  value: 190,
  limit: 180,
  recovered: false,
};

describe('ResourcePressureController', () => {
  it('downgrades one tier for critical pressure', () => {
    const controller = new ResourcePressureController();
    expect(controller.observe([critical], 'full', 1000)).toEqual({
      previousTier: 'full',
      tier: 'balanced',
      metric: 'drawCalls',
      value: 190,
      limit: 180,
    });
  });

  it('respects cooldown and essential floor', () => {
    const controller = new ResourcePressureController(5000);
    expect(controller.observe([critical], 'full', 1000)).not.toBeNull();
    expect(controller.observe([critical], 'balanced', 3000)).toBeNull();
    expect(controller.observe([critical], 'balanced', 7000)?.tier).toBe('essential');
    expect(controller.observe([critical], 'essential', 13000)).toBeNull();
  });

  it('ignores warnings and recovery alerts', () => {
    const controller = new ResourcePressureController();
    expect(controller.observe([{ ...critical, severity: 'warning' }], 'full', 1000)).toBeNull();
    expect(controller.observe([{ ...critical, recovered: true }], 'full', 1000)).toBeNull();
  });
});
