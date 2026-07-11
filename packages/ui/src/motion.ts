export type UiMotionSpeed = 'instant' | 'fast' | 'standard' | 'slow';

export interface UiMotionTokens {
  readonly duration: Readonly<Record<UiMotionSpeed, number>>;
  readonly easing: {
    readonly enter: string;
    readonly exit: string;
    readonly emphasis: string;
    readonly linear: string;
  };
  readonly distance: {
    readonly subtle: number;
    readonly standard: number;
    readonly pronounced: number;
  };
}

export const iyoMotionTokens: UiMotionTokens = {
  duration: { instant: 0, fast: 140, standard: 260, slow: 420 },
  easing: {
    enter: 'cubic-bezier(0.16, 1, 0.3, 1)',
    exit: 'cubic-bezier(0.7, 0, 0.84, 0)',
    emphasis: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    linear: 'linear',
  },
  distance: { subtle: 6, standard: 14, pronounced: 28 },
};

export interface UiMotionOptions {
  readonly reducedMotion?: () => boolean;
  readonly tokens?: UiMotionTokens;
}

export interface UiMotionDefinition {
  readonly keyframes: Keyframe[];
  readonly speed?: UiMotionSpeed;
  readonly easing?: keyof UiMotionTokens['easing'];
  readonly fill?: FillMode;
}

export class UiMotionController {
  readonly #tokens: UiMotionTokens;
  readonly #reducedMotion: () => boolean;
  readonly #active = new WeakMap<Element, Animation>();

  public constructor(options: UiMotionOptions = {}) {
    this.#tokens = options.tokens ?? iyoMotionTokens;
    this.#reducedMotion =
      options.reducedMotion ??
      (() => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  }

  public get tokens(): UiMotionTokens {
    return this.#tokens;
  }

  public animate(element: Element, definition: UiMotionDefinition): Animation | null {
    this.cancel(element);
    if (this.#reducedMotion() || definition.speed === 'instant' || !('animate' in element)) {
      const finalFrame = definition.keyframes.at(-1);
      if (
        finalFrame &&
        typeof HTMLElement !== 'undefined' &&
        element instanceof HTMLElement
      ) {
        Object.assign(element.style, finalFrame);
      }
      return null;
    }
    const animation = element.animate(definition.keyframes, {
      duration: this.#tokens.duration[definition.speed ?? 'standard'],
      easing: this.#tokens.easing[definition.easing ?? 'enter'],
      fill: definition.fill ?? 'both',
    });
    this.#active.set(element, animation);
    animation.addEventListener('finish', () => this.#active.delete(element), { once: true });
    animation.addEventListener('cancel', () => this.#active.delete(element), { once: true });
    return animation;
  }

  public enterPanel(element: Element): Animation | null {
    return this.animate(element, {
      keyframes: [
        { opacity: 0, transform: `translateY(${this.#tokens.distance.standard}px) scale(0.985)` },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ],
      speed: 'standard',
      easing: 'enter',
    });
  }

  public exitPanel(element: Element): Animation | null {
    return this.animate(element, {
      keyframes: [
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0, transform: `translateY(${this.#tokens.distance.subtle}px) scale(0.99)` },
      ],
      speed: 'fast',
      easing: 'exit',
    });
  }

  public reveal(element: Element): Animation | null {
    return this.animate(element, {
      keyframes: [
        { opacity: 0, transform: `translateY(${this.#tokens.distance.subtle}px)` },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      speed: 'fast',
      easing: 'enter',
    });
  }

  public press(element: Element): Animation | null {
    return this.animate(element, {
      keyframes: [
        { transform: 'scale(1)' },
        { transform: 'scale(0.965)' },
        { transform: 'scale(1)' },
      ],
      speed: 'fast',
      easing: 'emphasis',
    });
  }

  public cancel(element: Element): void {
    this.#active.get(element)?.cancel();
    this.#active.delete(element);
  }

  public dispose(root?: ParentNode): void {
    if (!root) return;
    for (const element of root.querySelectorAll('*')) this.cancel(element);
  }
}
