import { describe, expect, it } from 'vitest';

import { AssetCachePolicy } from '../src/index.js';

describe('AssetCachePolicy', () => {
  it('evicts the least recently used entry beyond the limit', () => {
    const policy = new AssetCachePolicy({ maximumEntries: 2 });
    policy.observeMiss('a');
    policy.observeMiss('b');
    policy.observeHit('a');
    policy.observeMiss('c');

    expect(policy.selectEvictions()).toEqual(['b']);
    expect(policy.snapshot()).toMatchObject({ entries: 2, hits: 1, misses: 3, evictions: 1 });
    expect(policy.snapshot().keys).toEqual(['c', 'a']);
  });

  it('protects in-flight entries from eviction', () => {
    const policy = new AssetCachePolicy({ maximumEntries: 1 });
    policy.observeMiss('a');
    policy.observeMiss('b');

    expect(policy.selectEvictions(new Set(['a']))).toEqual(['b']);
    expect(policy.snapshot().keys).toEqual(['a']);
  });

  it('supports explicit removal and clearing', () => {
    const policy = new AssetCachePolicy({ maximumEntries: 3 });
    policy.observeMiss('a');
    policy.observeMiss('b');
    policy.remove('a');
    expect(policy.snapshot().keys).toEqual(['b']);
    policy.clear();
    expect(policy.snapshot().entries).toBe(0);
  });
});
