export class RingBuffer<TValue> {
  readonly #capacity: number;
  readonly #values: TValue[] = [];

  public constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error('Ring buffer capacity must be a positive integer');
    }
    this.#capacity = capacity;
  }

  public push(value: TValue): void {
    if (this.#values.length === this.#capacity) this.#values.shift();
    this.#values.push(value);
  }

  public snapshot(): readonly TValue[] {
    return [...this.#values];
  }

  public clear(): void {
    this.#values.length = 0;
  }

  public get size(): number {
    return this.#values.length;
  }

  public get capacity(): number {
    return this.#capacity;
  }
}
