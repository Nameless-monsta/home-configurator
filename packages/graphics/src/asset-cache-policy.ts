export interface AssetCachePolicySnapshot {
  readonly maximumEntries: number;
  readonly entries: number;
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly keys: readonly string[];
}

export interface AssetCachePolicyOptions {
  readonly maximumEntries?: number;
}

export class AssetCachePolicy {
  readonly #maximumEntries: number;
  readonly #accessOrder = new Map<string, number>();
  #sequence = 0;
  #hits = 0;
  #misses = 0;
  #evictions = 0;

  public constructor(options: AssetCachePolicyOptions = {}) {
    this.#maximumEntries = Math.max(1, Math.floor(options.maximumEntries ?? 12));
  }

  public observeHit(key: string): void {
    this.#hits += 1;
    this.#touch(key);
  }

  public observeMiss(key: string): void {
    this.#misses += 1;
    this.#touch(key);
  }

  public remove(key: string): void {
    this.#accessOrder.delete(key);
  }

  public clear(): void {
    this.#accessOrder.clear();
  }

  public selectEvictions(protectedKeys: ReadonlySet<string> = new Set()): readonly string[] {
    const evictions: string[] = [];
    while (this.#accessOrder.size - evictions.length > this.#maximumEntries) {
      const candidate = [...this.#accessOrder.entries()]
        .filter(([key]) => !protectedKeys.has(key) && !evictions.includes(key))
        .sort((left, right) => left[1] - right[1])[0]?.[0];
      if (!candidate) break;
      evictions.push(candidate);
    }
    for (const key of evictions) this.#accessOrder.delete(key);
    this.#evictions += evictions.length;
    return evictions;
  }

  public snapshot(): AssetCachePolicySnapshot {
    return {
      maximumEntries: this.#maximumEntries,
      entries: this.#accessOrder.size,
      hits: this.#hits,
      misses: this.#misses,
      evictions: this.#evictions,
      keys: [...this.#accessOrder.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([key]) => key),
    };
  }

  #touch(key: string): void {
    this.#sequence += 1;
    this.#accessOrder.set(key, this.#sequence);
  }
}
