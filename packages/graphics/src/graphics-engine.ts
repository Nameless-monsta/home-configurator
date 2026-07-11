import {
  ACESFilmicToneMapping,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  PCFSoftShadowMap,
  PointLight,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
  type Object3D,
} from 'three';

import type { Diagnostics, FrameContext, SchedulerTask } from '@home-configurator/runtime';

import { ModelAssetLoader } from './asset-loader.js';
import { CameraRig } from './camera-rig.js';
import { WebGLContextGuard } from './context-guard.js';
import { EnvironmentManager } from './environment-manager.js';
import { StudioLightingRig } from './lighting.js';
import { LodManager } from './lod-manager.js';
import { PostProcessingPipeline } from './post-processing.js';
import { QualityManager } from './quality-manager.js';
import { ResourceTracker } from './resource-tracker.js';
import { SceneGraph } from './scene-graph.js';
import type {
  EnvironmentLoadOptions,
  GraphicsDiagnosticsSnapshot,
  GraphicsQualityTier,
  GraphicsViewport,
  LoadedEnvironment,
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
  public readonly lighting: StudioLightingRig;
  public readonly resources = new ResourceTracker();
  public readonly assets: ModelAssetLoader;
  public readonly lod: LodManager;
  public readonly environment: EnvironmentManager;
  public readonly postProcessing: PostProcessingPipeline;

  readonly #diagnostics: Diagnostics;
  readonly #context: WebGLContextGuard;
  #viewport: GraphicsViewport = { width: 1, height: 1, devicePixelRatio: 1 };
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
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.scene.background = new Color(options.background ?? 0x11100f);

    this.lighting = new StudioLightingRig();
    this.scene.add(this.lighting);
    this.assets = new ModelAssetLoader(this.#diagnostics);
    this.lod = new LodManager(this.#diagnostics, this.quality.tier);
    this.environment = new EnvironmentManager(this.renderer, this.scene, this.#diagnostics);
    this.postProcessing = new PostProcessingPipeline(
      this.renderer,
      this.scene,
      this.cameraRig.camera,
      {
        enabled: this.quality.profile.postProcessing,
        bloomStrength: this.quality.profile.bloomStrength,
      },
    );
    this.#context = new WebGLContextGuard({
      canvas: options.canvas,
      diagnostics: this.#diagnostics,
      onRestored: () => {
        this.renderer.resetState();
        this.resize(this.#viewport);
      },
    });
    this.#applyQuality();
    this.#diagnostics.record('info', 'graphics', 'Graphics engine initialized', {
      qualityTier: this.quality.tier,
    });
  }

  public resize(viewport: GraphicsViewport): void {
    if (this.#disposed) return;
    this.#viewport = {
      width: Math.max(1, Math.round(viewport.width)),
      height: Math.max(1, Math.round(viewport.height)),
      devicePixelRatio: viewport.devicePixelRatio,
    };
    const pixelRatio = this.quality.resolvePixelRatio(this.#viewport.devicePixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(this.#viewport.width, this.#viewport.height, false);
    this.postProcessing.resize(this.#viewport.width, this.#viewport.height, pixelRatio);
    this.cameraRig.resize(this.#viewport);
    this.#diagnostics.setGauge('graphics.pixelRatio', pixelRatio);
    this.#diagnostics.setGauge('graphics.width', this.#viewport.width);
    this.#diagnostics.setGauge('graphics.height', this.#viewport.height);
  }

  public setQualityTier(tier: GraphicsQualityTier): void {
    if (!this.quality.setTier(tier)) return;
    this.lod.setTier(tier);
    this.#applyQuality();
    this.resize(this.#viewport);
    this.#diagnostics.record('info', 'graphics', 'Graphics quality changed', { tier });
  }

  public tick(context: FrameContext): void {
    if (this.#disposed || this.#context.lost) return;
    this.#frame = context.frame;
    this.cameraRig.tick(context.deltaMs);
    this.lod.update(this.cameraRig.camera);
    this.postProcessing.render();

    const renderInfo = this.renderer.info.render;
    const memoryInfo = this.renderer.info.memory;
    this.#diagnostics.setGauge('graphics.drawCalls', renderInfo.calls);
    this.#diagnostics.setGauge('graphics.triangles', renderInfo.triangles);
    this.#diagnostics.setGauge('graphics.geometries', memoryInfo.geometries);
    this.#diagnostics.setGauge('graphics.textures', memoryInfo.textures);
    this.#diagnostics.setGauge('graphics.frame', context.frame);
  }

  public createFallbackHero(): Group {
    const hero = new Group();
    hero.name = 'hero.fallback';

    const structureMaterial = new MeshPhysicalMaterial({
      color: 0x8f887f,
      roughness: 0.28,
      metalness: 0.28,
      clearcoat: 0.35,
      clearcoatRoughness: 0.2,
    });
    const shadeMaterial = new MeshPhysicalMaterial({
      color: 0xd7d0c6,
      roughness: 0.16,
      metalness: 0.02,
      transmission: 0.12,
      transparent: true,
      opacity: 0.94,
      side: DoubleSide,
    });
    const bulbMaterial = new MeshPhysicalMaterial({
      color: 0xffe6c2,
      emissive: 0xffc987,
      emissiveIntensity: 1.25,
      roughness: 0.08,
      transmission: 0.3,
    });

    const base = new Mesh(new CylinderGeometry(0.7, 0.78, 0.2, 64), structureMaterial);
    const stem = new Mesh(new CylinderGeometry(0.075, 0.075, 1.45, 32), structureMaterial);
    const shade = new Mesh(new CylinderGeometry(0.64, 0.34, 0.76, 64, 1, true), shadeMaterial);
    const bulb = new Mesh(new SphereGeometry(0.22, 48, 32), bulbMaterial);
    const glow = new PointLight(0xffd6a4, 6, 5, 2);

    base.position.y = -0.76;
    stem.position.y = 0.02;
    shade.position.y = 0.9;
    bulb.position.y = 0.76;
    glow.position.y = 0.78;
    for (const mesh of [base, stem, shade, bulb]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }

    hero.add(base, stem, shade, bulb, glow);
    this.resources.trackObject(hero);
    this.graph.add({ id: 'hero.fallback', object: hero });
    return hero;
  }

  public async loadModel(id: string, uri: string, parentId?: string): Promise<Object3D> {
    const asset = await this.assets.load(id, uri);
    this.resources.trackObject(asset.scene);
    if (parentId) {
      this.graph.add({ id, parentId, object: asset.scene });
    } else {
      this.graph.add({ id, object: asset.scene });
    }
    return asset.scene;
  }

  public loadEnvironment(
    uri: string,
    options: EnvironmentLoadOptions = {},
  ): Promise<LoadedEnvironment> {
    return this.environment.load(uri, options);
  }

  public setBackground(color: number | string): void {
    this.environment.setFallbackColor(color);
  }

  public snapshot(): GraphicsDiagnosticsSnapshot {
    const renderInfo = this.renderer.info.render;
    const memoryInfo = this.renderer.info.memory;
    return {
      frame: this.#frame,
      drawCalls: renderInfo.calls,
      triangles: renderInfo.triangles,
      points: renderInfo.points,
      lines: renderInfo.lines,
      geometries: memoryInfo.geometries,
      textures: memoryInfo.textures,
      programs: this.renderer.info.programs?.length ?? 0,
      qualityTier: this.quality.tier,
      pixelRatio: this.renderer.getPixelRatio(),
      contextLost: this.#context.lost,
      postProcessing: this.postProcessing.enabled,
      environmentReady: this.environment.ready,
    };
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#context.dispose();
    this.postProcessing.dispose();
    this.environment.dispose();
    this.lod.clear();
    this.assets.clear();
    this.graph.clear();
    const disposedResources = this.resources.disposeAll();
    this.renderer.dispose();
    this.#diagnostics.record('info', 'graphics', 'Graphics engine disposed', {
      disposedResources,
    });
  }

  #applyQuality(): void {
    const profile = this.quality.profile;
    this.renderer.shadowMap.enabled = profile.shadows;
    this.lighting.applyQuality(profile);
    this.postProcessing.setEnabled(profile.postProcessing);
    this.postProcessing.setBloomStrength(profile.bloomStrength);
  }
}
