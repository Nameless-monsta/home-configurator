import { describe, expect, it } from 'vitest';

import { mapBrightnessGesture, mapColourGesture } from '../src/light-gesture-mapping.js';

describe('light gesture mapping', () => {
  it('maps horizontal drag to hue and vertical drag to saturation', () => {
    expect(
      mapColourGesture({ deltaX: 100, deltaY: -40 }, { hue: 350, saturation: 60, brightness: 0.5 }),
    ).toEqual([55, 74]);
  });

  it('clamps saturation and wraps hue', () => {
    expect(
      mapColourGesture(
        { deltaX: -1000, deltaY: 1000 },
        { hue: 20, saturation: 50, brightness: 0.5 },
      ),
    ).toEqual([90, 0]);
  });

  it('maps upward movement and wheel deltas to brightness', () => {
    expect(mapBrightnessGesture({ deltaY: -50 }, 0.5)).toBe(0.7);
    expect(mapBrightnessGesture({ value: 500 }, 0.6)).toBe(0);
    expect(mapBrightnessGesture({ value: -500 }, 0.6)).toBe(1);
  });
});
