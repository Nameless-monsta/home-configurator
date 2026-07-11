import type { Diagnostics, FrameContext, SchedulerTask } from '@home-configurator/runtime';

import type { AnimationDefinition } from './types.js';

interface ActiveAnimation {
  readonly definition: AnimationDefinition;
  elapsedMs: number;
}

export class AnimationDirector implements SchedulerTask {
  public readonly id = 'interaction.animations';
  public readonly priority = 70;
  readonly #diagnostics: Diagnostics;
  readonly #animations = new Map<string, ActiveAnimation>();

  public constructor(diagnostics: Diagnostics) {
    this.#diagnostics = diagnostics;
  }

  public play(definition: AnimationDefinition): () => void {
    this.stop(definition.id);
    this.#animations.set(definition.id, { definition, elapsedMs: 0 });
    this.#diagnostics.setGauge('interaction.animations', this.#animations.size);
    return () => this.stop(definition.id);
  }

  public stop(id: string): boolean {
    const removed = this.#animations.delete(id);
    if (removed) this.#diagnostics.setGauge('interaction.animations', this.#animations.size);
    return removed;
  }

  public tick(context: FrameContext): void {
    for (const [id, active] of [...this.#animations]) {
      const durationMs = Math.max(1, active.definition.durationMs);
      active.elapsedMs += Math.max(0, context.deltaMs);
      const raw = active.elapsedMs / durationMs;
      const progress = active.definition.loop ? raw % 1 : Math.min(1, raw);
      active.definition.onUpdate(progress, context.deltaMs);
      if (!active.definition.loop && raw >= 1) {
        this.#animations.delete(id);
        active.definition.onComplete?.();
      }
    }
    this.#diagnostics.setGauge('interaction.animations', this.#animations.size);
  }

  public clear(): void {
    this.#animations.clear();
    this.#diagnostics.setGauge('interaction.animations', 0);
  }
}
