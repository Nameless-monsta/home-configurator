import { describe, expect, it } from 'vitest';

import { buildRailModel, formatRailIndex, railNeighbour } from '../src/phase5/device-rail.js';

const items = [
  { id: 'lamp', name: 'Floor Lamp' },
  { id: 'ac', name: 'Bedroom Climate' },
  { id: 'vac', name: 'Robot Vacuum' },
] as const;

describe('device rail model', () => {
  it('annotates entries with index and active flag', () => {
    const model = buildRailModel(items, 'ac');
    expect(model.map((entry) => entry.index)).toEqual([0, 1, 2]);
    expect(model.map((entry) => entry.active)).toEqual([false, true, false]);
    expect(model[1]?.name).toBe('Bedroom Climate');
  });

  it('marks nothing active for an unknown id', () => {
    expect(buildRailModel(items, 'missing').every((entry) => !entry.active)).toBe(true);
  });

  it('formats a two-digit editorial counter and clamps out-of-range indices', () => {
    expect(formatRailIndex(0, 3)).toBe('01 — 03');
    expect(formatRailIndex(2, 3)).toBe('03 — 03');
    expect(formatRailIndex(9, 3)).toBe('03 — 03');
    expect(formatRailIndex(-2, 3)).toBe('01 — 03');
    expect(formatRailIndex(0, 0)).toBe('');
  });

  it('resolves neighbours and returns null at the ends or for unknown ids', () => {
    expect(railNeighbour(items, 'lamp', 1)).toBe('ac');
    expect(railNeighbour(items, 'ac', -1)).toBe('lamp');
    expect(railNeighbour(items, 'lamp', -1)).toBeNull();
    expect(railNeighbour(items, 'vac', 1)).toBeNull();
    expect(railNeighbour(items, 'missing', 1)).toBeNull();
  });
});
