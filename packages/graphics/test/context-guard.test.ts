import { Diagnostics } from '@home-configurator/runtime';
import { describe, expect, it, vi } from 'vitest';

import { WebGLContextGuard } from '../src/index.js';

describe('WebGLContextGuard', () => {
  it('tracks context loss and restoration', () => {
    const canvas = new EventTarget() as HTMLCanvasElement;
    const diagnostics = new Diagnostics();
    const restored = vi.fn();
    const guard = new WebGLContextGuard({ canvas, diagnostics, onRestored: restored });

    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(guard.lost).toBe(true);
    expect(diagnostics.snapshot().counters['graphics.contextLosses']).toBe(1);

    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(guard.lost).toBe(false);
    expect(restored).toHaveBeenCalledTimes(1);

    guard.dispose();
  });
});
