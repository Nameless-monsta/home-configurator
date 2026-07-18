export interface MotionTokens {
  readonly quickMs: number;
  readonly standardMs: number;
  readonly travelMs: number;
  readonly spring: Readonly<SpringConfig>;
  readonly gentleSpring: Readonly<SpringConfig>;
}

export interface SpringConfig {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
  readonly precision: number;
}

export const MOTION: MotionTokens = {
  quickMs: 180,
  standardMs: 320,
  travelMs: 620,
  spring: { stiffness: 260, damping: 28, mass: 1, precision: 0.001 },
  gentleSpring: { stiffness: 150, damping: 22, mass: 1.15, precision: 0.001 },
};

export class SpringValue {
  #value: number;
  #target: number;
  #velocity = 0;
  readonly #config: SpringConfig;
  public constructor(value: number, config: SpringConfig = MOTION.spring) {
    this.#value = value;
    this.#target = value;
    this.#config = config;
  }
  public get value(): number {
    return this.#value;
  }
  public get settled(): boolean {
    return (
      Math.abs(this.#target - this.#value) <= this.#config.precision &&
      Math.abs(this.#velocity) <= this.#config.precision
    );
  }
  public setTarget(target: number): void {
    this.#target = target;
  }
  public jump(value: number): void {
    this.#value = value;
    this.#target = value;
    this.#velocity = 0;
  }
  public tick(deltaMs: number): number {
    const dt = Math.min(0.04, Math.max(0, deltaMs / 1000));
    if (!dt) return this.#value;
    const displacement = this.#value - this.#target;
    const acceleration =
      (-this.#config.stiffness * displacement - this.#config.damping * this.#velocity) /
      this.#config.mass;
    this.#velocity += acceleration * dt;
    this.#value += this.#velocity * dt;
    if (this.settled) this.jump(this.#target);
    return this.#value;
  }
}

export interface SpatialTransitionOptions {
  readonly root: HTMLElement;
  readonly reducedMotion: () => boolean;
}

export class SpatialTransitionController {
  readonly #root: HTMLElement;
  readonly #reducedMotion: () => boolean;
  #active: Animation[] = [];
  public constructor(options: SpatialTransitionOptions) {
    this.#root = options.root;
    this.#reducedMotion = options.reducedMotion;
  }

  public enterDetail(origin?: DOMRect): void {
    this.#cancel();
    this.#root.dataset['spatialState'] = 'detail';
    if (this.#reducedMotion()) return;
    const stage = this.#root.querySelector<HTMLElement>('[data-p5-stage]');
    const detail = this.#root.querySelector<HTMLElement>('[data-p5-detail]');
    const x = origin ? (origin.left + origin.width / 2 - innerWidth / 2) * 0.04 : 0;
    this.#animate(
      stage,
      [
        { transform: `translate3d(${x}px,18px,0) scale(.98)` },
        { transform: 'translate3d(0,0,0) scale(1)' },
      ],
      MOTION.travelMs,
    );
    this.#animate(
      detail,
      [
        { opacity: 0, transform: 'translateY(28px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      MOTION.standardMs,
      120,
    );
  }

  public leaveDetail(): void {
    this.#cancel();
    this.#root.dataset['spatialState'] = 'browse';
    if (this.#reducedMotion()) return;
    const detail = this.#root.querySelector<HTMLElement>('[data-p5-detail]');
    this.#animate(
      detail,
      [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(20px)' },
      ],
      MOTION.quickMs,
    );
  }

  public switchDevice(direction: number): void {
    if (this.#reducedMotion()) return;
    const stage = this.#root.querySelector<HTMLElement>('[data-p5-stage]');
    this.#animate(
      stage,
      [
        { opacity: 0.72, transform: `translateX(${direction * 22}px) scale(.985)` },
        { opacity: 1, transform: 'translateX(0) scale(1)' },
      ],
      MOTION.standardMs,
    );
  }

  public sectionChange(): void {
    if (this.#reducedMotion()) return;
    const surface = this.#root.querySelector<HTMLElement>('[data-p5-surface]');
    this.#animate(
      surface,
      [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      MOTION.standardMs,
    );
  }

  public setScrollProgress(progress: number): void {
    this.#root.style.setProperty('--p5-scroll', String(Math.min(1, Math.max(0, progress))));
  }

  #animate(node: HTMLElement | null, frames: Keyframe[], duration: number, delay = 0): void {
    if (!node) return;
    const animation = node.animate(frames, {
      duration,
      delay,
      easing: 'cubic-bezier(.2,.8,.2,1)',
      fill: 'both',
    });
    this.#active.push(animation);
  }

  #cancel(): void {
    for (const animation of this.#active) animation.cancel();
    this.#active = [];
  }
}
