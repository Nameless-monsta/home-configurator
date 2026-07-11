export type DiagnosticLevel = 'debug' | 'info' | 'warn' | 'error';

export interface DiagnosticEntry {
  readonly id: number;
  readonly timestampMs: number;
  readonly level: DiagnosticLevel;
  readonly source: string;
  readonly message: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface DiagnosticsSnapshot {
  readonly entries: readonly DiagnosticEntry[];
  readonly counters: Readonly<Record<string, number>>;
  readonly gauges: Readonly<Record<string, number>>;
}

export type DiagnosticsListener = (snapshot: DiagnosticsSnapshot) => void;

export class Diagnostics {
  readonly #entries: DiagnosticEntry[] = [];
  readonly #counters = new Map<string, number>();
  readonly #gauges = new Map<string, number>();
  readonly #listeners = new Set<DiagnosticsListener>();
  readonly #capacity: number;
  #nextId = 1;

  public constructor(capacity = 250) {
    this.#capacity = Math.max(25, capacity);
  }

  public record(
    level: DiagnosticLevel,
    source: string,
    message: string,
    data?: Readonly<Record<string, unknown>>,
  ): void {
    const base = {
      id: this.#nextId++,
      timestampMs: Date.now(),
      level,
      source,
      message,
    } as const;
    const entry: DiagnosticEntry = data ? { ...base, data } : base;
    this.#entries.push(entry);
    if (this.#entries.length > this.#capacity) {
      this.#entries.splice(0, this.#entries.length - this.#capacity);
    }
    this.#notify();
  }

  public increment(name: string, amount = 1): number {
    const next = (this.#counters.get(name) ?? 0) + amount;
    this.#counters.set(name, next);
    this.#notify();
    return next;
  }

  public setGauge(name: string, value: number): void {
    this.#gauges.set(name, value);
    this.#notify();
  }

  public snapshot(): DiagnosticsSnapshot {
    return {
      entries: [...this.#entries],
      counters: Object.fromEntries(this.#counters),
      gauges: Object.fromEntries(this.#gauges),
    };
  }

  public subscribe(listener: DiagnosticsListener): () => void {
    this.#listeners.add(listener);
    listener(this.snapshot());
    return () => this.#listeners.delete(listener);
  }

  #notify(): void {
    if (this.#listeners.size === 0) return;
    const snapshot = this.snapshot();
    for (const listener of [...this.#listeners]) listener(snapshot);
  }
}
