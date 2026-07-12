import type { Object3D, PerspectiveCamera, Scene, Texture, WebGLRenderer } from 'three';

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

export interface CameraTransitionOptions {
  readonly durationMs?: number;
  readonly reducedMotion?: boolean;
}

export interface CameraFramingOptions extends CameraTransitionOptions {
  readonly padding?: number;
}

export interface SceneNodeDescriptor {
  readonly id: string;
  readonly parentId?: string;
  readonly object: Object3D;
  readonly visible?: boolean;
}

export interface EnvironmentLoadOptions {
  readonly useAsBackground?: boolean;
}

export interface GraphicsDiagnosticsSnapshot {
  readonly frame: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly points: number;
  readonly lines: number;
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
  readonly qualityTier: GraphicsQualityTier;
  readonly pixelRatio: number;
  readonly contextLost: boolean;
  readonly postProcessing: boolean;
  readonly environmentReady: boolean;
  readonly fps: number;
  readonly frameTimeAverageMs: number;
  readonly frameTimeP95Ms: number;
  readonly hidden: boolean;
  readonly longTaskCount: number;
  readonly longTaskTotalDurationMs: number;
  readonly longTaskMaximumDurationMs: number;
  readonly activePressureCount: number;
  readonly criticalPressureCount: number;
}

export interface GraphicsContext {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
}

export interface LoadedEnvironment {
  readonly texture: Texture;
  readonly uri: string;
}
