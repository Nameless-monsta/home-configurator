import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { ResourceTracker } from '../src/index.js';

describe('ResourceTracker', () => {
  it('tracks and disposes object resources exactly once', () => {
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial();
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const tracker = new ResourceTracker();

    tracker.trackObject(new Mesh(geometry, material));
    expect(tracker.size).toBe(2);
    expect(tracker.disposeAll()).toBe(2);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(tracker.size).toBe(0);
  });
});
