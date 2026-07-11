import type { Object3D, PerspectiveCamera, Scene, WebGLRenderer } from 'three';

export type GraphicsQualityTier = 'essential' | 'balanced' | 'full';

export interface GraphicsViewport {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
}

export interface CameraPose {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly fov: number;
}

export interface SceneNodeDescriptor {
  readonly id: string;
  readonly parentId?: string;
  readonly object: Object3D;
  readonly visible?: boolean;
}

export interface GraphicsDiagnosticsSnapshot {
  readonly frame: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly points: number;
  readonly lines: number;
  readonly qualityTier: GraphicsQualityTier;
  readonly pixelRatio: number;
}

export interface GraphicsContext {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
}
