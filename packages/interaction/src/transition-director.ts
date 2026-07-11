import type { Diagnostics, FrameContext, SchedulerTask } from '@home-configurator/runtime';

import type { TransitionDefinition } from './types.js';

interface ActiveTransition {
  readonly definition: TransitionDefinition;
  readonly durationMs: number;
  elapsedMs: number;
}

export class TransitionDirector implements SchedulerTask {
  public readonly id = 'interaction.transitions';
  public readonly priority = 80;
  readonly #diagnostics: Diagnostics;
  readonly #reducedMotion: () => boolean;
  #active?: ActiveTransition;

  public constructor(diagnostics: Diagnostics, reducedMotion: () => boolean = () => false) {
    this.#diagnostics = diagnostics;
    this.#reducedMotion = reducedMotion;
  }

  public get active(): boolean {
    return this.#active !== undefined;
  }

  public play(definition: TransitionDefinition): void {
    this.cancel('replaced');
    const durationMs = this.#reducedMotion()
      ? Math.max(0, definition.reducedMotionDurationMs ?? 0)
      : Math.max(0, definition.durationMs);
    this.#active = { definition, durationMs, elapsedMs: 0 };
    this.#diagnostics.setGauge('interaction.transitionActive', 1);
    if (durationMs === 0) this.#completeImmediately();
  }

  public tick(context: FrameContext): void {
    const active = this.#active;
    if (!active) return;
    active.elapsedMs = Math.min(active.durationMs, active.elapsedMs + Math.max(0, context.deltaMs));
    const linear = active.durationMs === 0 ? 1 : active.elapsedMs / active.durationMs;
    const eased = 1 - Math.pow(1 - linear, 3);
    active.definition.onUpdate(eased);
    if (linear >= 1) {
      active.definition.onComplete?.();
      this.#active = undefined;
      this.#diagnostics.increment('interaction.transitionsCompleted');
      this.#diagnostics.setGauge('interaction.transitionActive', 0);
    }
  }

  public cancel(reason = 'canceled'): void {
    if (!this.#active) return;
    const active = this.#active;
    this.#active = undefined;
    active.definition.onCancel?.();
    this.#diagnostics.increment('interaction.transitionsCanceled');
    this.#diagnostics.record('debug', 'interaction.transition', 'Transition canceled', { reason });
    this.#diagnostics.setGauge('interaction.transitionActive', 0);
  }

  #completeImmediately(): void {
    const active = this.#active;
    if (!active) return;
    active.definition.onUpdate(1);
    active.definition.onComplete?.();
    this.#active = undefined;
    this.#diagnostics.setGauge('interaction.transitionActive', 0);
  }
}
