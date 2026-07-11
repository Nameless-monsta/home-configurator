import type { Camera, LOD } from 'three';

import type { Diagnostics } from '@home-configurator/runtime';

import type { GraphicsQualityTier } from './types.js';

export class LodManager {
  readonly #diagnostics: Diagnostics;
  readonly #items = new Map<string, LOD>();
  #tier: GraphicsQualityTier;

  public constructor(diagnostics: Diagnostics, tier: GraphicsQualityTier = 'balanced') {
    this.#diagnostics = diagnostics;
    this.#tier = tier;
  }

  public register(id: string, lod: LOD): () => void {
    if (this.#items.has(id)) throw new Error(`LOD already registered: ${id}`);
    lod.autoUpdate = false;
    this.#items.set(id, lod);
    this.#diagnostics.setGauge('graphics.lodObjects', this.#items.size);
    return () => {
      this.#items.delete(id);
      this.#diagnostics.setGauge('graphics.lodObjects', this.#items.size);
    };
  }

  public setTier(tier: GraphicsQualityTier): void {
    this.#tier = tier;
  }

  public update(camera: Camera): void {
    for (const lod of this.#items.values()) {
      lod.update(camera);
      this.#applyTierLimit(lod);
    }
  }

  public clear(): void {
    this.#items.clear();
    this.#diagnostics.setGauge('graphics.lodObjects', 0);
  }

  #applyTierLimit(lod: LOD): void {
    const minimumLevel = this.#tier === 'full' ? 0 : this.#tier === 'balanced' ? 1 : 2;
    const levels = lod.levels;
    if (levels.length <= 1) return;
    const visibleLevel = levels.findIndex((level) => level.object.visible);
    if (visibleLevel >= minimumLevel) return;
    for (let index = 0; index < levels.length; index += 1) {
      const level = levels[index];
      if (level) level.object.visible = index === Math.min(minimumLevel, levels.length - 1);
    }
  }
}
