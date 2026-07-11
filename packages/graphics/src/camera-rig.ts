import { Box3, MathUtils, PerspectiveCamera, Sphere, Vector3, type Object3D } from 'three';

import type {
  CameraFramingOptions,
  CameraPose,
  CameraTransitionOptions,
  GraphicsViewport,
} from './types.js';

const clonePose = (pose: CameraPose): CameraPose => ({
  position: [...pose.position] as [number, number, number],
  target: [...pose.target] as [number, number, number],
  fov: pose.fov,
});

const interpolateTuple = (
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  progress: number,
): [number, number, number] => [
  MathUtils.lerp(from[0], to[0], progress),
  MathUtils.lerp(from[1], to[1], progress),
  MathUtils.lerp(from[2], to[2], progress),
];

export class CameraRig {
  public readonly camera: PerspectiveCamera;
  readonly #target = new Vector3();
  #pose: CameraPose;
  #fromPose: CameraPose;
  #toPose: CameraPose;
  #elapsedMs = 0;
  #durationMs = 0;
  #transitioning = false;

  public constructor(pose: CameraPose = CameraRig.defaultPose()) {
    this.camera = new PerspectiveCamera(pose.fov, 1, 0.01, 200);
    this.#pose = clonePose(pose);
    this.#fromPose = clonePose(pose);
    this.#toPose = clonePose(pose);
    this.applyPose(pose);
  }

  public static defaultPose(): CameraPose {
    return {
      position: [0, 0.35, 5.2],
      target: [0, 0, 0],
      fov: 34,
    };
  }

  public get pose(): CameraPose {
    return clonePose(this.#pose);
  }

  public get transitioning(): boolean {
    return this.#transitioning;
  }

  public applyPose(pose: CameraPose): void {
    this.#pose = clonePose(pose);
    this.#target.set(...pose.target);
    this.camera.position.set(...pose.position);
    this.camera.fov = pose.fov;
    this.camera.lookAt(this.#target);
    this.camera.updateProjectionMatrix();
  }

  public transitionTo(pose: CameraPose, options: CameraTransitionOptions = {}): void {
    const durationMs = options.reducedMotion ? 0 : Math.max(0, options.durationMs ?? 900);
    this.#fromPose = this.pose;
    this.#toPose = clonePose(pose);
    this.#elapsedMs = 0;
    this.#durationMs = durationMs;
    this.#transitioning = durationMs > 0;
    if (!this.#transitioning) this.applyPose(this.#toPose);
  }

  public tick(deltaMs: number): boolean {
    if (!this.#transitioning) return false;
    this.#elapsedMs = Math.min(this.#durationMs, this.#elapsedMs + Math.max(0, deltaMs));
    const linear = this.#durationMs === 0 ? 1 : this.#elapsedMs / this.#durationMs;
    const eased = 1 - Math.pow(1 - linear, 3);
    this.applyPose({
      position: interpolateTuple(this.#fromPose.position, this.#toPose.position, eased),
      target: interpolateTuple(this.#fromPose.target, this.#toPose.target, eased),
      fov: MathUtils.lerp(this.#fromPose.fov, this.#toPose.fov, eased),
    });
    if (linear >= 1) this.#transitioning = false;
    return true;
  }

  public computeFramingPose(object: Object3D, options: CameraFramingOptions = {}): CameraPose {
    const bounds = new Box3().setFromObject(object);
    if (bounds.isEmpty()) return this.pose;

    const sphere = bounds.getBoundingSphere(new Sphere());
    const padding = Math.max(1, options.padding ?? 1.3);
    const radius = Math.max(0.001, sphere.radius * padding);
    const fovRadians = MathUtils.degToRad(this.camera.fov);
    const distance = radius / Math.sin(Math.max(0.01, fovRadians / 2));
    const direction = this.camera.position.clone().sub(this.#target).normalize();
    if (direction.lengthSq() === 0) direction.set(0, 0, 1);
    const position = sphere.center.clone().addScaledVector(direction, distance);

    return {
      position: [position.x, position.y, position.z],
      target: [sphere.center.x, sphere.center.y, sphere.center.z],
      fov: this.camera.fov,
    };
  }

  public frameObject(object: Object3D, options: CameraFramingOptions = {}): void {
    this.transitionTo(this.computeFramingPose(object, options), options);
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
