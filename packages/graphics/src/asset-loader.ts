import type { Diagnostics } from '@home-configurator/runtime';
import { LoadingManager, type AnimationClip, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

import { AssetCachePolicy, type AssetCachePolicySnapshot } from './asset-cache-policy.js';

export interface ModelAsset {
  readonly id: string;
  readonly scene: Object3D;
  readonly animations: readonly AnimationClip[];
  readonly uri: string;
}

export interface ModelAssetLoaderOptions {
  readonly maximumCacheEntries?: number;
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
  readonly #inFlight = new Set<string>();
  readonly #policy: AssetCachePolicy;

  public constructor(
    diagnostics: Diagnostics,
    manager = new LoadingManager(),
    options: ModelAssetLoaderOptions = {},
  ) {
    this.#diagnostics = diagnostics;
    this.#loader = new GLTFLoader(manager);
    this.#policy = new AssetCachePolicy({ maximumEntries: options.maximumCacheEntries });
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
    if (!this.#cache.delete(id)) return;
    this.#policy.remove(id);
    this.#diagnostics.increment('graphics.assets.manualEvictions');
    this.#publishCacheMetrics();
  }

  public clear(): void {
    this.#cache.clear();
    this.#inFlight.clear();
    this.#policy.clear();
    this.#publishCacheMetrics();
  }

  public snapshot(): AssetCachePolicySnapshot {
    return this.#policy.snapshot();
  }

  #loadSource(id: string, uri: string): Promise<CachedModel> {
    const cached = this.#cache.get(id);
    if (cached) {
      this.#policy.observeHit(id);
      this.#diagnostics.increment('graphics.assets.cacheHits');
      this.#publishCacheMetrics();
      return cached;
    }

    this.#policy.observeMiss(id);
    this.#diagnostics.increment('graphics.assets.cacheMisses');
    this.#inFlight.add(id);

    const pending = this.#loader
      .loadAsync(uri)
      .then((gltf) => {
        if (gltf.scene.children.length === 0)
          throw new Error(`Model contains no scene nodes: ${id}`);
        this.#diagnostics.record('info', 'graphics.assets', `Model ready: ${id}`, { uri });
        return { scene: gltf.scene, animations: gltf.animations, uri };
      })
      .catch((error: unknown) => {
        const modelError = error instanceof Error ? error : new Error(String(error));
        this.#cache.delete(id);
        this.#policy.remove(id);
        this.#diagnostics.increment('graphics.assetFailures');
        this.#diagnostics.record('error', 'graphics.assets', `Model failed: ${id}`, {
          uri,
          error: modelError.message,
        });
        throw modelError;
      })
      .finally(() => {
        this.#inFlight.delete(id);
        this.#enforceLimit();
        this.#publishCacheMetrics();
      });

    this.#cache.set(id, pending);
    this.#publishCacheMetrics();
    return pending;
  }

  #enforceLimit(): void {
    const evictions = this.#policy.selectEvictions(this.#inFlight);
    for (const id of evictions) this.#cache.delete(id);
    if (evictions.length === 0) return;
    this.#diagnostics.increment('graphics.assets.cacheEvictions', evictions.length);
    this.#diagnostics.record('info', 'graphics.assets', 'Asset cache evicted least-recently-used models', {
      evicted: evictions,
      maximumEntries: this.#policy.snapshot().maximumEntries,
    });
  }

  #publishCacheMetrics(): void {
    const snapshot = this.#policy.snapshot();
    this.#diagnostics.setGauge('graphics.assets.cacheEntries', snapshot.entries);
    this.#diagnostics.setGauge('graphics.assets.cacheMaximumEntries', snapshot.maximumEntries);
    this.#diagnostics.setGauge('graphics.assets.cacheHits', snapshot.hits);
    this.#diagnostics.setGauge('graphics.assets.cacheMisses', snapshot.misses);
    this.#diagnostics.setGauge('graphics.assets.cacheEvictions', snapshot.evictions);
  }
}
