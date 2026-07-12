import { describe, expect, it } from 'vitest';

import { PerformanceBudgetMonitor } from '../src/index.js';

const healthy = {
  drawCalls: 80,
  triangles: 300_000,
  programs: 12,
  textures: 24,
  geometries: 40,
  longTasks: 0,
};

describe('PerformanceBudgetMonitor', () => {
  it('emits warning and critical alerts only when pressure changes', () => {
    const monitor = new PerformanceBudgetMonitor();

    expect(monitor.observe({ ...healthy, drawCalls: 121 })).toEqual([
      {
        metric: 'drawCalls',
        severity: 'warning',
        value: 121,
        limit: 120,
        recovered: false,
      },
    ]);
    expect(monitor.observe({ ...healthy, drawCalls: 130 })).toEqual([]);
    expect(monitor.observe({ ...healthy, drawCalls: 181 })).toEqual([
      {
        metric: 'drawCalls',
        severity: 'critical',
        value: 181,
        limit: 180,
        recovered: false,
      },
    ]);
  });

  it('emits a recovery alert when a metric returns inside budget', () => {
    const monitor = new PerformanceBudgetMonitor();
    monitor.observe({ ...healthy, triangles: 800_000 });

    expect(monitor.observe(healthy)).toEqual([
      {
        metric: 'triangles',
        severity: 'warning',
        value: 300_000,
        limit: 750_000,
        recovered: true,
      },
    ]);
  });

  it('tracks long tasks and independent renderer resources', () => {
    const monitor = new PerformanceBudgetMonitor({ longTasksWarning: 0 });
    const alerts = monitor.observe({
      ...healthy,
      programs: 40,
      textures: 120,
      longTasks: 2,
    });

    expect(alerts.map(({ metric }) => metric)).toEqual(['programs', 'textures', 'longTasks']);
  });
});
