import { describe, expect, it } from 'vitest';
import { createRuntime, type RuntimeClock } from '../src/index.js';

class FakeClock implements RuntimeClock {
  #now = 0;
  #callback: ((timestampMs: number) => void) | undefined;

  public now(): number {
    return this.#now;
  }

  public requestFrame(callback: (timestampMs: number) => void): unknown {
    this.#callback = callback;
    return 1;
  }

  public cancelFrame(): void {
    this.#callback = undefined;
  }

  public step(milliseconds = 16): void {
    this.#now += milliseconds;
    const callback = this.#callback;
    this.#callback = undefined;
    callback?.(this.#now);
  }
}

describe('HomeConfiguratorRuntime', () => {
  it('boots, schedules frames, and stops cleanly', async () => {
    const clock = new FakeClock();
    const runtime = createRuntime({ clock, config: { application: { environment: 'test' } } });

    await runtime.start();
    expect(runtime.phase).toBe('running');
    clock.step();
    expect(runtime.diagnostics.snapshot().gauges['scheduler.frame']).toBe(1);

    await runtime.stop();
    expect(runtime.phase).toBe('stopped');
    expect(runtime.scheduler.running).toBe(false);
  });
});
