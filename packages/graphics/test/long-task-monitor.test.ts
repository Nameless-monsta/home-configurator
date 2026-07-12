import { describe, expect, it } from 'vitest';

import { LongTaskMonitor } from '../src/index.js';

describe('LongTaskMonitor', () => {
  it('ignores tasks below the threshold', () => {
    const monitor = new LongTaskMonitor();

    expect(monitor.observe(49)).toBe(false);
    expect(monitor.snapshot()).toEqual({
      count: 0,
      totalDurationMs: 0,
      maximumDurationMs: 0,
      lastDurationMs: 0,
    });
  });

  it('retains bounded rolling long-task measurements', () => {
    const monitor = new LongTaskMonitor({ thresholdMs: 50, maximumSamples: 2 });

    expect(monitor.observe(60)).toBe(true);
    expect(monitor.observe(80)).toBe(true);
    expect(monitor.observe(100)).toBe(true);

    expect(monitor.snapshot()).toEqual({
      count: 2,
      totalDurationMs: 180,
      maximumDurationMs: 100,
      lastDurationMs: 100,
    });
  });

  it('resets all retained measurements', () => {
    const monitor = new LongTaskMonitor();
    monitor.observe(75);
    monitor.reset();

    expect(monitor.snapshot().count).toBe(0);
  });
});
