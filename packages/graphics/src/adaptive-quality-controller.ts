import type { GraphicsQualityTier } from './types.js';

export interface AdaptiveQualityDecision {
  readonly previousTier: GraphicsQualityTier;
  readonly tier: GraphicsQualityTier;
  readonly reason: 'average-frame-time' | 'slow-frame-ratio' | 'stable-frame-time';
  readonly averageFrameTimeMs: number;
  readonly slowFrameRatio: number;
}

export interface AdaptiveQualityControllerOptions {
  readonly initialTier?: GraphicsQualityTier;
  readonly downgradeWindowMs?: number;
  readonly slowFrameWindowMs?: number;
  readonly upgradeWindowMs?: number;
}

const budgets: Record<GraphicsQualityTier, number> = {
  full: 16.67,
  balanced: 22.22,
  essential: 33.33,
};

const downgradeTier = (tier: GraphicsQualityTier): GraphicsQualityTier => {
  if (tier === 'full') return 'balanced';
  return 'essential';
};

const upgradeTier = (tier: GraphicsQualityTier): GraphicsQualityTier => {
  if (tier === 'essential') return 'balanced';
  return 'full';
};

export class AdaptiveQualityController {
  readonly #downgradeWindowMs: number;
  readonly #slowFrameWindowMs: number;
  readonly #upgradeWindowMs: number;
  #tier: GraphicsQualityTier;
  #elapsedMs = 0;
  #frameTimeTotalMs = 0;
  #frames = 0;
  #slowFrames = 0;

  public constructor(options: AdaptiveQualityControllerOptions = {}) {
    this.#tier = options.initialTier ?? 'balanced';
    this.#downgradeWindowMs = options.downgradeWindowMs ?? 2000;
    this.#slowFrameWindowMs = options.slowFrameWindowMs ?? 3000;
    this.#upgradeWindowMs = options.upgradeWindowMs ?? 10000;
  }

  public get tier(): GraphicsQualityTier {
    return this.#tier;
  }

  public setTier(tier: GraphicsQualityTier): void {
    this.#tier = tier;
    this.reset();
  }

  public observe(frameTimeMs: number): AdaptiveQualityDecision | null {
    if (!Number.isFinite(frameTimeMs) || frameTimeMs <= 0) return null;

    const budget = budgets[this.#tier];
    this.#elapsedMs += frameTimeMs;
    this.#frameTimeTotalMs += frameTimeMs;
    this.#frames += 1;
    if (frameTimeMs > budget * 1.5) this.#slowFrames += 1;

    const averageFrameTimeMs = this.#frameTimeTotalMs / this.#frames;
    const slowFrameRatio = this.#slowFrames / this.#frames;

    if (
      this.#tier !== 'essential' &&
      this.#elapsedMs >= this.#downgradeWindowMs &&
      averageFrameTimeMs > budget
    ) {
      return this.#changeTier(
        downgradeTier(this.#tier),
        'average-frame-time',
        averageFrameTimeMs,
        slowFrameRatio,
      );
    }

    if (
      this.#tier !== 'essential' &&
      this.#elapsedMs >= this.#slowFrameWindowMs &&
      slowFrameRatio > 0.1
    ) {
      return this.#changeTier(
        downgradeTier(this.#tier),
        'slow-frame-ratio',
        averageFrameTimeMs,
        slowFrameRatio,
      );
    }

    if (
      this.#tier !== 'full' &&
      this.#elapsedMs >= this.#upgradeWindowMs &&
      averageFrameTimeMs < budget * 0.75
    ) {
      return this.#changeTier(
        upgradeTier(this.#tier),
        'stable-frame-time',
        averageFrameTimeMs,
        slowFrameRatio,
      );
    }

    if (this.#elapsedMs >= this.#upgradeWindowMs && averageFrameTimeMs >= budget * 0.75) {
      this.reset();
    }

    return null;
  }

  public reset(): void {
    this.#elapsedMs = 0;
    this.#frameTimeTotalMs = 0;
    this.#frames = 0;
    this.#slowFrames = 0;
  }

  #changeTier(
    tier: GraphicsQualityTier,
    reason: AdaptiveQualityDecision['reason'],
    averageFrameTimeMs: number,
    slowFrameRatio: number,
  ): AdaptiveQualityDecision {
    const previousTier = this.#tier;
    this.#tier = tier;
    this.reset();
    return { previousTier, tier, reason, averageFrameTimeMs, slowFrameRatio };
  }
}
