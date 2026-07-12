import type { PerformanceBudgetAlert } from './performance-budget-monitor.js';
import type { GraphicsQualityTier } from './types.js';

export interface ResourcePressureDecision {
  readonly previousTier: GraphicsQualityTier;
  readonly tier: GraphicsQualityTier;
  readonly metric: PerformanceBudgetAlert['metric'];
  readonly value: number;
  readonly limit: number;
}

const lowerTier = (tier: GraphicsQualityTier): GraphicsQualityTier =>
  tier === 'full' ? 'balanced' : 'essential';

export class ResourcePressureController {
  #lastDowngradeAt = Number.NEGATIVE_INFINITY;

  public constructor(private readonly cooldownMs = 5000) {}

  public observe(
    alerts: readonly PerformanceBudgetAlert[],
    tier: GraphicsQualityTier,
    nowMs: number,
  ): ResourcePressureDecision | null {
    if (tier === 'essential' || nowMs - this.#lastDowngradeAt < this.cooldownMs) return null;
    const critical = alerts.find((alert) => !alert.recovered && alert.severity === 'critical');
    if (!critical) return null;

    this.#lastDowngradeAt = nowMs;
    return {
      previousTier: tier,
      tier: lowerTier(tier),
      metric: critical.metric,
      value: critical.value,
      limit: critical.limit,
    };
  }

  public reset(): void {
    this.#lastDowngradeAt = Number.NEGATIVE_INFINITY;
  }
}
