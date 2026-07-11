import { Vector2, type Camera, type Scene, type WebGLRenderer } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export interface PostProcessingOptions {
  readonly enabled: boolean;
  readonly bloomStrength: number;
}

export class PostProcessingPipeline {
  readonly #renderer: WebGLRenderer;
  readonly #scene: Scene;
  readonly #camera: Camera;
  readonly #composer: EffectComposer;
  readonly #bloom: UnrealBloomPass;
  #enabled: boolean;

  public constructor(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    options: PostProcessingOptions,
  ) {
    this.#renderer = renderer;
    this.#scene = scene;
    this.#camera = camera;
    this.#enabled = options.enabled;
    this.#composer = new EffectComposer(renderer);
    this.#composer.addPass(new RenderPass(scene, camera));
    this.#bloom = new UnrealBloomPass(new Vector2(1, 1), options.bloomStrength, 0.55, 0.88);
    this.#composer.addPass(this.#bloom);
  }

  public get enabled(): boolean {
    return this.#enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
  }

  public setBloomStrength(strength: number): void {
    this.#bloom.strength = Math.max(0, strength);
  }

  public resize(width: number, height: number, pixelRatio: number): void {
    this.#composer.setPixelRatio(pixelRatio);
    this.#composer.setSize(Math.max(1, width), Math.max(1, height));
  }

  public render(): void {
    if (this.#enabled) {
      this.#composer.render();
      return;
    }
    this.#renderer.render(this.#scene, this.#camera);
  }

  public dispose(): void {
    this.#bloom.dispose();
    this.#composer.dispose();
  }
}
