import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/index.js';

interface TestEvents {
  first: { readonly value: number };
  second: { readonly value: number };
}

describe('EventBus', () => {
  it('queues re-entrant events deterministically', () => {
    const events = new EventBus<TestEvents>();
    const order: string[] = [];
    events.on('first', ({ value }) => {
      order.push(`first:${value}`);
      events.emit('second', { value: value + 1 });
    });
    events.on('second', ({ value }) => order.push(`second:${value}`));

    events.emit('first', { value: 1 });
    expect(order).toEqual(['first:1', 'second:2']);
  });
});
