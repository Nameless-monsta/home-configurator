import type { Diagnostics } from '@home-configurator/runtime';
import { LoadingManager, type AnimationClip, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface ModelAsset {
  readonly id: string;
  readonly scene: Object3D;
  readonly animations: readonly AnimationClip[];
  readonly uri: string;
}

interface CachedModel {
  readonly scene: Object3D;
  readonly animations: readonly AnimationClip[];
  readonly uri: string;
}

export class ModelAssetLoader {
  readonly #loader: GLTFLoader;
  readonly #diagnostics: Diagnostics;
  readonly #cache = new Map<string, Promise<CachedModel>>();

  public constructor(diagnostics: Diagnostics, manager = new LoadingManager()) {
    this.#diagnostics = diagnostics;
    this.#loader = new GLTFLoader(manager);
  }

  public async load(id: string, uri: string): Promise<ModelAsset> {
    const source = await this.#loadSource(id, uri);
    const scene = clone(source.scene);
    scene.name = id;
    return { id, scene, animations: source.animations, uri: source.uri };
  }

  public async preload(id: string, uri: string): Promise<void> {
    await this.#loadSource(id, uri);
  }

  public evict(id: string): void {
    this.#cache.delete(id);
  }

  public clear(): void {
    this.#cache.clear();
  }

  #loadSource(id: string, uri: string): Promise<CachedModel> {
    const cached = this.#cache.get(id);
    if (cached) return cached;

    const pending = this.#loader
      .loadAsync(uri)
      .then((gltf) => {
        if (gltf.scene.children.length === 0) throw new Error(`Model contains no scene nodes: ${id}`);
        this.#diagnostics.record('info', 'graphics.assets', `Model ready: ${id}`, { uri });
        return { scene: gltf.scene, animations: gltf.animations, uri };
      })
      .catch((error: unknown) => {
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
}
