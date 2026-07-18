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
    if (dt === 0) return this.#value;
    const displacement = this.#value - this.#target;
    const springForce = -this.#config.stiffness * displacement;
    const dampingForce = -this.#config.damping * this.#velocity;
    const acceleration = (springForce + dampingForce) / this.#config.mass;
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
    const x = origin ? origin.left + origin.width / 2 - window.innerWidth / 2 : 0;
    const y = origin ? origin.top + origin.height / 2 - window.innerHeight / 2 : 28;
    this.#active.push(
      this.#root.animate(
        [
          { opacity: 0.92, transform: `translate3d(${x * 0.08}px,${y * 0.08}px,0) scale(.985)` },
          { opacity: 1, transform: 'translate3d(0,0,0) scale(1)' },
        ],
        { duration: MOTION.travelMs, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' },
      ),
    );
  }

  /** In-place device switch inside detail: a short lateral travel, no route change. */
  public swapDetail(): void {
    this.#cancel();
    if (this.#reducedMotion()) return;
    this.#active.push(
      this.#root.animate(
        [
          { opacity: 0.94, transform: 'translate3d(0,6px,0) scale(.992)' },
          { opacity: 1, transform: 'translate3d(0,0,0) scale(1)' },
        ],
        { duration: MOTION.standardMs, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' },
      ),
    );
  }

  public leaveDetail(): void {
    this.#cancel();
    this.#root.dataset['spatialState'] = 'browse';
    if (this.#reducedMotion()) return;
    this.#active.push(
      this.#root.animate(
        [
          { opacity: 1, transform: 'translate3d(0,0,0) scale(1)' },
          { opacity: 0.96, transform: 'translate3d(0,18px,0) scale(.99)' },
        ],
        { duration: MOTION.standardMs, easing: 'cubic-bezier(.4,0,.2,1)' },
      ),
    );
  }

  public dispose(): void {
    this.#cancel();
  }

  #cancel(): void {
    for (const animation of this.#active) animation.cancel();
    this.#active = [];
  }
}
