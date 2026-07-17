import type { Group } from 'three';

export interface LivingObjectContext {
  readonly object: Group;
  readonly reducedMotion: () => boolean;
  readonly state: () => Readonly<Record<string, unknown>>;
}

export interface LivingObjectBehaviour {
  tick(deltaMs: number): void;
  pulse?(strength?: number): void;
  dispose(): void;
}

export type LivingObjectFactory = (context: LivingObjectContext) => LivingObjectBehaviour;

export class LivingObjectRegistry {
  readonly #factories = new Map<string, LivingObjectFactory>();

  public register(category: string, factory: LivingObjectFactory): () => void {
    this.#factories.set(category, factory);
    return () => this.#factories.delete(category);
  }

  public create(category: string, context: LivingObjectContext): LivingObjectBehaviour {
    return this.#factories.get(category)?.(context) ?? idleFloat(context);
  }
}

const idleFloat = (context: LivingObjectContext): LivingObjectBehaviour => {
  let phase = Math.random() * Math.PI * 2;
  let impulse = 0;
  const baseY = context.object.position.y;
  return {
    tick(deltaMs) {
      if (context.reducedMotion()) {
        context.object.position.y = baseY;
        return;
      }
      phase += deltaMs / 4300;
      impulse *= Math.pow(0.9, deltaMs / 16.67);
      context.object.position.y = baseY + Math.sin(phase * Math.PI * 2) * 0.035 + impulse * 0.02;
      context.object.rotation.y += deltaMs * 0.000035;
    },
    pulse(strength = 1) {
      impulse = Math.min(1.5, impulse + strength);
    },
    dispose() {
      context.object.position.y = baseY;
    },
  };
};

export const createDefaultLivingObjectRegistry = (): LivingObjectRegistry => {
  const registry = new LivingObjectRegistry();

  registry.register('light', (context) => {
    let phase = 0;
    let response = 0;
    const baseScale = context.object.scale.clone();
    return {
      tick(deltaMs) {
        if (context.reducedMotion()) return;
        phase += deltaMs / 3600;
        response *= Math.pow(0.86, deltaMs / 16.67);
        const brightness = Number(context.state()['brightness'] ?? 0.5);
        const breath = 1 + Math.sin(phase * Math.PI * 2) * (0.006 + brightness * 0.006) + response * 0.008;
        context.object.scale.copy(baseScale).multiplyScalar(breath);
        context.object.rotation.y += deltaMs * 0.000045;
      },
      pulse(strength = 1) {
        response = Math.min(1.25, response + strength);
      },
      dispose() {
        context.object.scale.copy(baseScale);
      },
    };
  });

  registry.register('thermostat', (context) => {
    let settle = 0;
    return {
      tick(deltaMs) {
        settle *= Math.pow(0.82, deltaMs / 16.67);
        if (!context.reducedMotion()) context.object.rotation.z = Math.sin(settle * Math.PI) * 0.006;
      },
      pulse(strength = 1) {
        settle = Math.min(1, settle + strength * 0.45);
      },
      dispose() {
        context.object.rotation.z = 0;
      },
    };
  });

  registry.register('vacuum', (context) => {
    let phase = 0;
    return {
      tick(deltaMs) {
        if (context.reducedMotion()) return;
        phase += deltaMs / 2200;
        const cleaning = Boolean(context.state()['cleaning']);
        context.object.rotation.y += deltaMs * (cleaning ? 0.00022 : 0.00004);
        context.object.position.y += Math.sin(phase * Math.PI * 2) * 0.00003;
      },
      dispose() {},
    };
  });

  return registry;
};
