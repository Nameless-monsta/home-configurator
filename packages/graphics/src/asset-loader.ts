import type { Diagnostics } from '@home-configurator/runtime';
import { LoadingManager, Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface ModelAsset {
  readonly id: string;
  readonly scene: Object3D;
  readonly animations: GLTF['animations'];
}

export class ModelAssetLoader {
  readonly #loader: GLTFLoader;
  readonly #diagnostics: Diagnostics;
  readonly #cache = new Map<string, Promise<ModelAsset>>();

  public constructor(diagnostics: Diagnostics, manager = new LoadingManager()) {
    this.#diagnostics = diagnostics;
    this.#loader = new GLTFLoader(manager);
  }

  public load(id: string, uri: string): Promise<ModelAsset> {
    const cached = this.#cache.get(id);
    if (cached) return cached;

    const pending = this.#loader.loadAsync(uri).then((gltf) => {
      if (gltf.scene.children.length === 0) throw new Error(`Model contains no scene nodes: ${id}`);
      gltf.scene.name = id;
      this.#diagnostics.record('info', 'graphics.assets', `Model ready: ${id}`, { uri });
      return { id, scene: gltf.scene, animations: gltf.animations };
    }).catch((error: unknown) => {
      const modelError = error instanceof Error ? error : new Error(String(error));
      this.#cache.delete(id);
      this.#diagnostics.increment('graphics.assetFailures');
      this.#diagnostics.record('error', 'graphics.assets', `Model failed: ${id}`, {
        uri,
        error: modelError.message,
      });
      throw modelError;
    });

    this.#cache.set(id, pending);
    return pending;
  }

  public clear(): void {
    this.#cache.clear();
  }
}
