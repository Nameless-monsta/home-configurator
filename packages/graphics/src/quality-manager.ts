import type { GraphicsQualityTier } from './types.js';

export interface QualityProfile {
  readonly pixelRatioCap: number;
  readonly antialias: boolean;
  readonly shadows: boolean;
  readonly postProcessing: boolean;
}

const profiles: Record<GraphicsQualityTier, QualityProfile> = {
  essential: { pixelRatioCap: 1, antialias: false, shadows: false, postProcessing: false },
  balanced: { pixelRatioCap: 1.5, antialias: true, shadows: true, postProcessing: false },
  full: { pixelRatioCap: 2, antialias: true, shadows: true, postProcessing: true },
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

  public setTier(tier: GraphicsQualityTier): void {
    this.#tier = tier;
  }

  public resolvePixelRatio(devicePixelRatio: number): number {
    return Math.max(0.75, Math.min(devicePixelRatio, this.profile.pixelRatioCap));
  }
}
