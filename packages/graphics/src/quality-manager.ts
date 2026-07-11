import type { GraphicsQualityTier } from './types.js';

export interface QualityProfile {
  readonly pixelRatioCap: number;
  readonly antialias: boolean;
  readonly shadows: boolean;
  readonly shadowMapSize: number;
  readonly postProcessing: boolean;
  readonly bloomStrength: number;
  readonly maximumLodLevel: number;
}

const profiles: Record<GraphicsQualityTier, QualityProfile> = {
  essential: {
    pixelRatioCap: 1,
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    postProcessing: false,
    bloomStrength: 0,
    maximumLodLevel: 2,
  },
  balanced: {
    pixelRatioCap: 1.5,
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    postProcessing: true,
    bloomStrength: 0.12,
    maximumLodLevel: 1,
  },
  full: {
    pixelRatioCap: 2,
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    postProcessing: true,
    bloomStrength: 0.2,
    maximumLodLevel: 0,
  },
};

export class QualityManager {
  #tier: GraphicsQualityTier;

  public constructor(tier: GraphicsQualityTier = 'balanced') {
    this.#tier = tier;
  }

  public get tier(): GraphicsQualityTier {
    return this.#tier;
  }

  public get profile(): QualityProfile {
    return profiles[this.#tier];
  }

  public setTier(tier: GraphicsQualityTier): boolean {
    if (tier === this.#tier) return false;
    this.#tier = tier;
    return true;
  }

  public resolvePixelRatio(devicePixelRatio: number): number {
    const ratio = Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
    return Math.max(0.75, Math.min(ratio, this.profile.pixelRatioCap));
  }
}
