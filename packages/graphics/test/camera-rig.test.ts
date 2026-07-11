import { Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';

import { CameraRig } from '../src/index.js';

describe('CameraRig', () => {
  it('interpolates to a target pose deterministically', () => {
    const rig = new CameraRig();
    rig.transitionTo(
      { position: [2, 1, 6], target: [0.5, 0.2, 0], fov: 42 },
      { durationMs: 1000 },
    );

    expect(rig.transitioning).toBe(true);
    rig.tick(1000);
    expect(rig.transitioning).toBe(false);
    expect(rig.camera.position.x).toBeCloseTo(2);
    expect(rig.camera.position.y).toBeCloseTo(1);
    expect(rig.camera.position.z).toBeCloseTo(6);
    expect(rig.camera.fov).toBeCloseTo(42);
  });

  it('computes a safe framing pose for an object', () => {
    const rig = new CameraRig();
    const mesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    const pose = rig.computeFramingPose(mesh, { padding: 1.4 });

    expect(pose.position[2]).toBeGreaterThan(2);
    expect(pose.target[0]).toBeCloseTo(0);
    expect(pose.target[1]).toBeCloseTo(0);
    expect(pose.target[2]).toBeCloseTo(0);
  });
});
