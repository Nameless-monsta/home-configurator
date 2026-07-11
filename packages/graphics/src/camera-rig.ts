import { PerspectiveCamera, Vector3 } from 'three';

import type { CameraPose, GraphicsViewport } from './types.js';

export class CameraRig {
  public readonly camera: PerspectiveCamera;
  readonly #target = new Vector3();

  public constructor(pose: CameraPose = CameraRig.defaultPose()) {
    this.camera = new PerspectiveCamera(pose.fov, 1, 0.01, 200);
    this.applyPose(pose);
  }

  public static defaultPose(): CameraPose {
    return {
      position: [0, 0.35, 5.2],
      target: [0, 0, 0],
      fov: 34,
    };
  }

  public applyPose(pose: CameraPose): void {
    this.camera.position.set(...pose.position);
    this.#target.set(...pose.target);
    this.camera.fov = pose.fov;
    this.camera.lookAt(this.#target);
    this.camera.updateProjectionMatrix();
  }

  public resize(viewport: GraphicsViewport): void {
    this.camera.aspect = Math.max(1, viewport.width) / Math.max(1, viewport.height);
    this.camera.updateProjectionMatrix();
  }

  public setClipping(near: number, far: number): void {
    if (near <= 0 || far <= near) throw new Error('Invalid camera clipping range');
    this.camera.near = near;
    this.camera.far = far;
    this.camera.updateProjectionMatrix();
  }
}
