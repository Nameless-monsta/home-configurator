import { Object3D, Scene } from 'three';
import { describe, expect, it } from 'vitest';

import { SceneGraph } from '../src/index.js';

describe('SceneGraph', () => {
  it('adds, resolves, and removes nodes deterministically', () => {
    const graph = new SceneGraph(new Scene());
    const room = new Object3D();
    const lamp = new Object3D();

    graph.add({ id: 'room.living', object: room });
    graph.add({ id: 'device.lamp', parentId: 'room.living', object: lamp });

    expect(graph.ids()).toEqual(['room.living', 'device.lamp']);
    expect(graph.get('device.lamp')).toBe(lamp);
    expect(lamp.parent).toBe(room);
    expect(graph.remove('room.living')).toBe(true);
    expect(graph.ids()).toEqual([]);
  });

  it('rejects missing parents', () => {
    const graph = new SceneGraph(new Scene());
    expect(() =>
      graph.add({ id: 'device.orphan', parentId: 'room.missing', object: new Object3D() }),
    ).toThrow('Scene parent not found');
  });
});
