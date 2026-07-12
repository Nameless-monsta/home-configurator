export type PerformanceBudgetSeverity = 'warning' | 'critical';

export interface PerformanceBudgetSample {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly programs: number;
  readonly textures: number;
  readonly geometries: number;
  readonly longTasks: number;
}

export interface PerformanceBudgetLimits {
  readonly drawCallsWarning: number;
  readonly drawCallsCritical: number;
  readonly trianglesWarning: number;
  readonly trianglesCritical: number;
  readonly programsWarning: number;
  readonly texturesWarning: number;
  readonly geometriesWarning: number;
  readonly longTasksWarning: number;
}

export interface PerformanceBudgetAlert {
  readonly metric: keyof PerformanceBudgetSample;
  readonly severity: PerformanceBudgetSeverity;
  readonly value: number;
  readonly limit: number;
  readonly recovered: boolean;
}

const defaultLimits: PerformanceBudgetLimits = {
  drawCallsWarning: 120,
  drawCallsCritical: 180,
  trianglesWarning: 750_000,
  trianglesCritical: 1_200_000,
  programsWarning: 32,
  texturesWarning: 96,
  geometriesWarning: 256,
  longTasksWarning: 1,
};

export class PerformanceBudgetMonitor {
  readonly #limits: PerformanceBudgetLimits;
  readonly #active = new Map<keyof PerformanceBudgetSample, PerformanceBudgetSeverity>();

  public constructor(limits: Partial<PerformanceBudgetLimits> = {}) {
    this.#limits = { ...defaultLimits, ...limits };
  }

  public observe(sample: PerformanceBudgetSample): readonly PerformanceBudgetAlert[] {
    const alerts: PerformanceBudgetAlert[] = [];
    this.#check(alerts, 'drawCalls', sample.drawCalls, this.#limits.drawCallsWarning, this.#limits.drawCallsCritical);
    this.#check(alerts, 'triangles', sample.triangles, this.#limits.trianglesWarning, this.#limits.trianglesCritical);
    this.#check(alerts, 'programs', sample.programs, this.#limits.programsWarning);
    this.#check(alerts, 'textures', sample.textures, this.#limits.texturesWarning);
    this.#check(alerts, 'geometries', sample.geometries, this.#limits.geometriesWarning);
    this.#check(alerts, 'longTasks', sample.longTasks, this.#limits.longTasksWarning);
    return alerts;
  }

  public reset(): void {
    this.#active.clear();
  }

  #check(
    alerts: PerformanceBudgetAlert[],
    metric: keyof PerformanceBudgetSample,
    value: number,
    warningLimit: number,
    criticalLimit?: number,
  ): void {
    const severity: PerformanceBudgetSeverity | null =
      criticalLimit !== undefined && value > criticalLimit
        ? 'critical'
        : value > warningLimit
          ? 'warning'
          : null;
    const previous = this.#active.get(metric);

    if (severity === null) {
      if (previous) {
        this.#active.delete(metric);
        alerts.push({ metric, severity: previous, value, limit: warningLimit, recovered: true });
      }
      return;
    }

    if (previous === severity) return;
    this.#active.set(metric, severity);
    alerts.push({
      metric,
      severity,
      value,
      limit: severity === 'critical' ? (criticalLimit ?? warningLimit) : warningLimit,
      recovered: false,
    });
  }
}
