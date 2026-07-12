import type { Diagnostics, FrameContext, SchedulerTask } from '@home-configurator/runtime';

import type { GraphicsEngine } from './graphics-engine.js';
import { LongTaskMonitor } from './long-task-monitor.js';
import {
  PerformanceBudgetMonitor,
  type PerformanceBudgetAlert,
  type PerformanceBudgetSample,
} from './performance-budget-monitor.js';
import { ResourcePressureController } from './resource-pressure-controller.js';

export class GraphicsPerformanceObservabilityTask implements SchedulerTask {
  public readonly id = 'graphics.performance-observability';
  public readonly priority = 90;

  readonly #budget = new PerformanceBudgetMonitor();
  readonly #longTasks = new LongTaskMonitor();
  readonly #pressure = new ResourcePressureController();
  readonly #active = new Map<
    PerformanceBudgetAlert['metric'],
    PerformanceBudgetAlert['severity']
  >();
  readonly #observer: PerformanceObserver | null;

  public constructor(
    private readonly engine: GraphicsEngine,
    private readonly diagnostics: Diagnostics,
  ) {
    this.#observer = this.#createLongTaskObserver();
  }

  public tick(context: FrameContext): void {
    const graphics = this.engine.snapshot();
    const longTasks = this.#longTasks.snapshot();
    const sample: PerformanceBudgetSample = {
      drawCalls: graphics.drawCalls,
      triangles: graphics.triangles,
      programs: graphics.programs,
      textures: graphics.textures,
      geometries: graphics.geometries,
      longTasks: longTasks.count,
    };
    const alerts = this.#budget.observe(sample);

    for (const alert of alerts) this.#recordAlert(alert);

    const decision = this.#pressure.observe(alerts, graphics.qualityTier, context.timestampMs);
    if (decision) {
      this.engine.setQualityTier(decision.tier);
      this.diagnostics.record('warn', 'graphics.performance', 'Resource pressure reduced quality', {
        previousTier: decision.previousTier,
        tier: decision.tier,
        metric: decision.metric,
        value: decision.value,
        limit: decision.limit,
      });
      this.diagnostics.increment(`graphics.pressure.${decision.previousTier}.${decision.tier}`);
    }

    const criticalCount = [...this.#active.values()].filter(
      (severity) => severity === 'critical',
    ).length;
    this.diagnostics.setGauge('graphics.pressure.active', this.#active.size);
    this.diagnostics.setGauge('graphics.pressure.critical', criticalCount);
    this.diagnostics.setGauge('graphics.longTasks.count', longTasks.count);
    this.diagnostics.setGauge('graphics.longTasks.totalDurationMs', longTasks.totalDurationMs);
    this.diagnostics.setGauge('graphics.longTasks.maximumDurationMs', longTasks.maximumDurationMs);
  }

  public dispose(): void {
    this.#observer?.disconnect();
    this.#budget.reset();
    this.#longTasks.reset();
    this.#pressure.reset();
    this.#active.clear();
  }

  #recordAlert(alert: PerformanceBudgetAlert): void {
    if (alert.recovered) {
      this.#active.delete(alert.metric);
      this.diagnostics.record('info', 'graphics.performance', 'Performance budget recovered', {
        metric: alert.metric,
        value: alert.value,
        limit: alert.limit,
      });
      return;
    }

    this.#active.set(alert.metric, alert.severity);
    this.diagnostics.record(
      alert.severity === 'critical' ? 'error' : 'warn',
      'graphics.performance',
      'Performance budget exceeded',
      {
        metric: alert.metric,
        severity: alert.severity,
        value: alert.value,
        limit: alert.limit,
      },
    );
    this.diagnostics.increment(`graphics.budget.${alert.metric}.${alert.severity}`);
  }

  #createLongTaskObserver(): PerformanceObserver | null {
    if (typeof PerformanceObserver === 'undefined') return null;
    const supported = PerformanceObserver.supportedEntryTypes;
    if (!supported.includes('longtask')) return null;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (this.#longTasks.observe(entry.duration)) {
          this.diagnostics.increment('graphics.longTasks.observed');
        }
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
    return observer;
  }
}
