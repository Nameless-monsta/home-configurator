export type RuntimeUnsubscribe = () => void;

export class SubscriptionSet<TValue> {
  readonly #listeners = new Set<(value: TValue) => void>();

  public subscribe(listener: (value: TValue) => void): RuntimeUnsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  public emit(value: TValue): void {
    for (const listener of [...this.#listeners]) listener(value);
  }

  public clear(): void {
    this.#listeners.clear();
  }

  public get size(): number {
    return this.#listeners.size;
  }
}
