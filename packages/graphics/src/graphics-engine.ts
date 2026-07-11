import {
  ACESFilmicToneMapping,
  Color,
  Mesh,
  MeshPhysicalMaterial,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';

import type { Diagnostics, FrameContext, SchedulerTask } from '@home-configurator/runtime';

import { CameraRig } from './camera-rig.js';
import { StudioLightingRig } from './lighting.js';
import { QualityManager } from './quality-manager.js';
import { SceneGraph } from './scene-graph.js';
import type {
  GraphicsDiagnosticsSnapshot,
  GraphicsQualityTier,
  GraphicsViewport,
} from './types.js';

export interface GraphicsEngineOptions {
  readonly canvas: HTMLCanvasElement;
  readonly diagnostics: Diagnostics;
  readonly qualityTier?: GraphicsQualityTier;
  readonly background?: number | string;
}

export class GraphicsEngine implements SchedulerTask {
  public readonly id = 'graphics.render';
  public readonly priority = 100;
  public readonly renderer: WebGLRenderer;
  public readonly scene = new Scene();
  public readonly cameraRig = new CameraRig();
  public readonly graph = new SceneGraph(this.scene);
  public readonly quality: QualityManager;

  readonly #diagnostics: Diagnostics;
  #frame = 0;
  #disposed = false;

  public constructor(options: GraphicsEngineOptions) {
    this.#diagnostics = options.diagnostics;
    this.quality = new QualityManager(options.qualityTier);
    this.renderer = new WebGLRenderer({
      canvas: options.canvas,
      antialias: this.quality.profile.antialias,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = this.quality.profile.shadows;
    this.scene.background = new Color(options.background ?? 0x11100f);
    this.scene.add(new StudioLightingRig());
  }

  public resize(viewport: GraphicsViewport): void {
    if (this.#disposed) return;
    const pixelRatio = this.quality.resolvePixelRatio(viewport.devicePixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(viewport.width, viewport.height, false);
    this.cameraRig.resize(viewport);
    this.#diagnostics.setGauge('graphics.pixelRatio', pixelRatio);
    this.#diagnostics.setGauge('graphics.width', viewport.width);
    this.#diagnostics.setGauge('graphics.height', viewport.height);
  }

  public tick(context: FrameContext): void {
    if (this.#disposed) return;
    this.#frame = context.frame;
    this.renderer.render(this.scene, this.cameraRig.camera);
    const info = this.renderer.info.render;
    this.#diagnostics.setGauge('graphics.drawCalls', info.calls);
    this.#diagnostics.setGauge('graphics.triangles', info.triangles);
    this.#diagnostics.setGauge('graphics.frame', context.frame);
  }

  public createFallbackHero(): Mesh<SphereGeometry, MeshPhysicalMaterial> {
    const hero = new Mesh(
      new SphereGeometry(1, 96, 64),
      new MeshPhysicalMaterial({
        color: 0xd7d0c6,
        roughness: 0.18,
        metalness: 0.05,
        clearcoat: 0.55,
        clearcoatRoughness: 0.15,
      }),
    );
    hero.castShadow = true;
    hero.receiveShadow = true;
    this.graph.add({ id: 'hero.fallback', object: hero });
    return hero;
  }

  public snapshot(): GraphicsDiagnosticsSnapshot {
    const info = this.renderer.info.render;
    return {
      frame: this.#frame,
      drawCalls: info.calls,
      triangles: info.triangles,
      points: info.points,
      lines: info.lines,
      qualityTier: this.quality.tier,
      pixelRatio: this.renderer.getPixelRatio(),
    };
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.graph.clear();
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
    this.renderer.dispose();
    this.#diagnostics.record('info', 'graphics', 'Graphics engine disposed');
  }
}
