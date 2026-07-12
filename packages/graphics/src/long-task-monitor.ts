export interface LongTaskSnapshot {
  readonly count: number;
  readonly totalDurationMs: number;
  readonly maximumDurationMs: number;
  readonly lastDurationMs: number;
}

export interface LongTaskMonitorOptions {
  readonly thresholdMs?: number;
  readonly maximumSamples?: number;
}

export class LongTaskMonitor {
  readonly #thresholdMs: number;
  readonly #maximumSamples: number;
  readonly #durations: number[] = [];

  public constructor(options: LongTaskMonitorOptions = {}) {
    this.#thresholdMs = options.thresholdMs ?? 50;
    this.#maximumSamples = options.maximumSamples ?? 120;
  }

  public observe(durationMs: number): boolean {
    if (!Number.isFinite(durationMs) || durationMs < this.#thresholdMs) return false;
    this.#durations.push(durationMs);
    if (this.#durations.length > this.#maximumSamples) this.#durations.shift();
    return true;
  }

  public snapshot(): LongTaskSnapshot {
    const totalDurationMs = this.#durations.reduce((total, duration) => total + duration, 0);
    return {
      count: this.#durations.length,
      totalDurationMs,
      maximumDurationMs: this.#durations.length === 0 ? 0 : Math.max(...this.#durations),
      lastDurationMs: this.#durations.at(-1) ?? 0,
    };
  }

  public reset(): void {
    this.#durations.length = 0;
  }
}
