import type { Diagnostics } from './diagnostics.js';
import type { FrameContext, RuntimeClock } from './types.js';

export interface SchedulerTask {
  readonly id: string;
  readonly priority: number;
  tick(context: FrameContext): void;
}

const createDefaultClock = (): RuntimeClock => ({
  now: () => globalThis.performance?.now?.() ?? Date.now(),
  requestFrame: (callback) => {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      return globalThis.requestAnimationFrame(callback);
    }
    return globalThis.setTimeout(() => callback(Date.now()), 16);
  },
  cancelFrame: (handle) => {
    if (typeof handle !== 'number') return;
    if (typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(handle);
    } else {
      globalThis.clearTimeout(handle);
    }
  },
});

export class RuntimeScheduler {
  readonly #clock: RuntimeClock;
  readonly #diagnostics: Diagnostics;
  readonly #tasks = new Map<string, SchedulerTask>();
  #running = false;
  #frameHandle: unknown;
  #lastTimestampMs = 0;
  #frame = 0;

  public constructor(diagnostics: Diagnostics, clock: RuntimeClock = createDefaultClock()) {
    this.#diagnostics = diagnostics;
    this.#clock = clock;
  }

  public register(task: SchedulerTask): () => void {
    if (this.#tasks.has(task.id)) {
      throw new Error(`Scheduler task already registered: ${task.id}`);
    }
    this.#tasks.set(task.id, task);
    return () => this.#tasks.delete(task.id);
  }

  public start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#lastTimestampMs = this.#clock.now();
    this.#diagnostics.record('info', 'scheduler', 'Scheduler started');
    this.#scheduleNext();
  }

  public stop(): void {
    if (!this.#running) return;
    this.#running = false;
    if (this.#frameHandle !== undefined) this.#clock.cancelFrame(this.#frameHandle);
    this.#frameHandle = undefined;
    this.#diagnostics.record('info', 'scheduler', 'Scheduler stopped');
  }

  public get running(): boolean {
    return this.#running;
  }

  #scheduleNext(): void {
    this.#frameHandle = this.#clock.requestFrame((timestampMs) => this.#tick(timestampMs));
  }

  #tick(timestampMs: number): void {
    if (!this.#running) return;

    const deltaMs = Math.max(0, Math.min(250, timestampMs - this.#lastTimestampMs));
    this.#lastTimestampMs = timestampMs;
    this.#frame += 1;

    const context: FrameContext = { timestampMs, deltaMs, frame: this.#frame };
    const tasks = [...this.#tasks.values()].sort(
      (left, right) => left.priority - right.priority || left.id.localeCompare(right.id),
    );

    const startedAt = this.#clock.now();
    for (const task of tasks) {
      try {
        task.tick(context);
      } catch (error) {
        this.#diagnostics.increment('scheduler.taskErrors');
        this.#diagnostics.record('error', 'scheduler', `Task failed: ${task.id}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.#diagnostics.setGauge('scheduler.frame', this.#frame);
    this.#diagnostics.setGauge('scheduler.deltaMs', deltaMs);
    this.#diagnostics.setGauge('scheduler.workMs', this.#clock.now() - startedAt);
    this.#scheduleNext();
  }
}
