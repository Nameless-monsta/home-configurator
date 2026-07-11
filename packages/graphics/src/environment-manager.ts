import {
  Color,
  EquirectangularReflectionMapping,
  PMREMGenerator,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

import type { Diagnostics } from '@home-configurator/runtime';

import type { EnvironmentLoadOptions, LoadedEnvironment } from './types.js';

export class EnvironmentManager {
  readonly #renderer: WebGLRenderer;
  readonly #scene: Scene;
  readonly #diagnostics: Diagnostics;
  readonly #loader = new RGBELoader();
  #texture?: Texture;
  #uri?: string;

  public constructor(renderer: WebGLRenderer, scene: Scene, diagnostics: Diagnostics) {
    this.#renderer = renderer;
    this.#scene = scene;
    this.#diagnostics = diagnostics;
  }

  public get ready(): boolean {
    return this.#texture !== undefined;
  }

  public get uri(): string | undefined {
    return this.#uri;
  }

  public async load(uri: string, options: EnvironmentLoadOptions = {}): Promise<LoadedEnvironment> {
    const source = await this.#loader.loadAsync(uri);
    source.mapping = EquirectangularReflectionMapping;
    const generator = new PMREMGenerator(this.#renderer);
    generator.compileEquirectangularShader();

    try {
      const target = generator.fromEquirectangular(source);
      const texture = target.texture;
      this.#texture?.dispose();
      this.#texture = texture;
      this.#uri = uri;
      this.#scene.environment = texture;
      if (options.useAsBackground) this.#scene.background = texture;
      this.#diagnostics.record('info', 'graphics.environment', 'Environment ready', { uri });
      return { texture, uri };
    } finally {
      source.dispose();
      generator.dispose();
    }
  }

  public setFallbackColor(color: number | string): void {
    if (this.#scene.background === this.#texture) this.#scene.background = null;
    this.#scene.background = new Color(color);
  }

  public clear(): void {
    if (this.#scene.environment === this.#texture) this.#scene.environment = null;
    if (this.#scene.background === this.#texture) this.#scene.background = null;
    this.#texture?.dispose();
    this.#texture = undefined;
    this.#uri = undefined;
  }

  public dispose(): void {
    this.clear();
  }
}
