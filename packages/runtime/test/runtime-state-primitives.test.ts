import { describe, expect, it, vi } from 'vitest';

import { RingBuffer, SubscriptionSet } from '../src/index.js';

describe('runtime-state primitives', () => {
  it('bounds ring-buffer values and validates capacity', () => {
    expect(() => new RingBuffer(0)).toThrow('positive integer');
    const buffer = new RingBuffer<number>(2);
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);

    expect(buffer.snapshot()).toEqual([2, 3]);
    expect(buffer.size).toBe(2);
    expect(buffer.capacity).toBe(2);
    buffer.clear();
    expect(buffer.snapshot()).toEqual([]);
  });

  it('subscribes, unsubscribes and clears listeners', () => {
    const subscriptions = new SubscriptionSet<number>();
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribe = subscriptions.subscribe(first);
    subscriptions.subscribe(second);

    subscriptions.emit(1);
    unsubscribe();
    subscriptions.emit(2);
    subscriptions.clear();
    subscriptions.emit(3);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    expect(subscriptions.size).toBe(0);
  });
});
