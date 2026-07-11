import type { Diagnostics } from './diagnostics.js';

export interface AssetDescriptor<T = unknown> {
  readonly id: string;
  readonly uri: string;
  readonly type: string;
  readonly loader: (descriptor: AssetDescriptor<T>) => Promise<T>;
}

export type AssetState = 'registered' | 'loading' | 'ready' | 'failed';

interface AssetRecord {
  readonly descriptor: AssetDescriptor<never>;
  state: AssetState;
  value: unknown;
  error: Error | undefined;
  pending: Promise<unknown> | undefined;
}

export class AssetManager {
  readonly #diagnostics: Diagnostics;
  readonly #assets = new Map<string, AssetRecord>();

  public constructor(diagnostics: Diagnostics) {
    this.#diagnostics = diagnostics;
  }

  public register<T>(descriptor: AssetDescriptor<T>): void {
    if (this.#assets.has(descriptor.id)) {
      throw new Error(`Asset already registered: ${descriptor.id}`);
    }
    this.#assets.set(descriptor.id, {
      descriptor: descriptor as unknown as AssetDescriptor<never>,
      state: 'registered',
      value: undefined,
      error: undefined,
      pending: undefined,
    });
  }

  public async load<T>(id: string): Promise<T> {
    const record = this.#assets.get(id);
    if (!record) throw new Error(`Asset not registered: ${id}`);
    if (record.state === 'ready') return record.value as T;
    if (record.pending) return record.pending as Promise<T>;

    record.state = 'loading';
    const descriptor = record.descriptor as unknown as AssetDescriptor<T>;
    const pending = descriptor
      .loader(descriptor)
      .then((value) => {
        record.state = 'ready';
        record.value = value;
        record.error = undefined;
        this.#diagnostics.record('info', 'assets', `Asset ready: ${id}`);
        return value;
      })
      .catch((error: unknown) => {
        const assetError = error instanceof Error ? error : new Error(String(error));
        record.state = 'failed';
        record.error = assetError;
        this.#diagnostics.increment('assets.failures');
        this.#diagnostics.record('error', 'assets', `Asset failed: ${id}`, {
          error: assetError.message,
        });
        throw assetError;
      })
      .finally(() => {
        record.pending = undefined;
      });

    record.pending = pending;
    return pending;
  }

  public getState(id: string): AssetState | undefined {
    return this.#assets.get(id)?.state;
  }

  public clear(): void {
    this.#assets.clear();
  }
}
