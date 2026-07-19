/**
 * HeroStage — the single persistent 3D presentation. One hero object lives on
 * the shared GraphicsEngine stage across browse and detail; switching devices
 * swaps the object in place and detail only reframes the camera. Model
 * overrides (GLB/GLTF) load through the engine's ModelAssetLoader with the
 * procedural hero as immediate fallback. The stage also derives the ambient
 * atmosphere colour from the selected device's live state.
 */

import type { GraphicsEngine } from '@home-configurator/graphics';
import { Group } from 'three';

import type { DeviceView } from './experience-model.js';
import { createHero, hsbToColor, type HeroHandle } from './hero-models.js';
import type { LivingObjectRegistry, LivingObjectBehaviour } from './living-object.js';
import { applyOverrideTransform, type HeroModelRegistry } from './model-registry.js';
import { MOTION, SpringValue } from './motion-system.js';

export type StageFraming = 'browse' | 'detail';

export interface StageSwipeHandlers {
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onOpen: () => void;
}

export interface HeroStageOptions {
  readonly engine: GraphicsEngine;
  readonly surface: HTMLElement;
  readonly living: LivingObjectRegistry;
  readonly registry: HeroModelRegistry;
  readonly reducedMotion: () => boolean;
  readonly onAmbient: (color: string, strength: number) => void;
}

/** Physical travel choreography for hero swaps (transform, never replace). */
const DEPART_MS = 300;
const ARRIVE_MS = 640;
const TRAVEL_X = 1.7;

const FRAMING: Record<StageFraming, { padding: number; durationMs: number }> = {
  browse: { padding: 2.35, durationMs: 950 },
  detail: { padding: 1.95, durationMs: 800 },
};

/** Ambient atmosphere derived from the selected device. Pure and testable. */
export const deriveAmbient = (view: DeviceView | null): { color: string; strength: number } => {
  if (!view) return { color: 'rgb(120, 104, 88)', strength: 0.16 };
  const s = view.state;
  switch (view.category) {
    case 'light': {
      if (!s.on) return { color: 'rgb(96, 92, 88)', strength: 0.1 };
      const c = hsbToColor(s.hue, s.saturation, s.brightness);
      return {
        color: `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`,
        strength: 0.14 + s.brightness * 0.2,
      };
    }
    case 'climate': {
      const delta = s.targetTemp - s.currentTemp;
      if (delta > 0.3) return { color: 'rgb(214, 150, 96)', strength: 0.22 };
      if (delta < -0.3) return { color: 'rgb(110, 150, 190)', strength: 0.22 };
      return { color: 'rgb(150, 140, 128)', strength: 0.15 };
    }
    case 'cover': {
      const daylight = Math.min(1, Math.max(0, s.position / 100));
      return { color: 'rgb(226, 206, 168)', strength: 0.08 + daylight * 0.18 };
    }
    case 'media':
      return s.playing
        ? { color: 'rgb(120, 140, 200)', strength: 0.24 }
        : { color: 'rgb(104, 108, 124)', strength: 0.12 };
    case 'security':
      return s.locked || s.privacy
        ? { color: 'rgb(110, 130, 118)', strength: 0.13 }
        : { color: 'rgb(200, 140, 96)', strength: 0.2 };
    case 'cleaning':
      return s.cleaning
        ? { color: 'rgb(130, 160, 170)', strength: 0.2 }
        : { color: 'rgb(112, 112, 108)', strength: 0.12 };
    default:
      return { color: 'rgb(128, 118, 104)', strength: 0.14 };
  }
};

export class HeroStage {
  readonly #options: HeroStageOptions;
  #view: DeviceView | null = null;
  #hero: HeroHandle | null = null;
  #wrap: Group | null = null;
  #behaviour: LivingObjectBehaviour | null = null;
  #framing: StageFraming = 'browse';
  #loadToken = 0;
  #unbindSwipe: (() => void) | null = null;
  #unbindExamine: (() => void) | null = null;
  #interactive = true;
  /** Outgoing hero during a travel swap — physically departs, then disposes. */
  #outgoing: { readonly hero: HeroHandle; elapsedMs: number; readonly direction: number } | null =
    null;
  /** Incoming arrival choreography for the mounted hero. */
  #arrival: { elapsedMs: number; readonly direction: number } | null = null;
  readonly #examineX = new SpringValue(0, MOTION.gentleSpring);
  readonly #examineY = new SpringValue(0, MOTION.gentleSpring);

  public constructor(options: HeroStageOptions) {
    this.#options = options;
  }

  public get hero(): HeroHandle | null {
    return this.#hero;
  }

  public get deviceId(): string | null {
    return this.#view?.id ?? null;
  }

  /**
   * Mount or swap the hero object for a device in place on the shared stage.
   * The swap is a physical travel, never a hard replace: the outgoing object
   * departs along the direction of travel while the incoming one arrives from
   * the opposite side and settles under the same camera.
   */
  public setDevice(view: DeviceView, direction: -1 | 0 | 1 = 0): void {
    if (this.#view?.id === view.id) {
      this.update(view);
      return;
    }
    this.#beginDeparture(direction);
    this.#view = view;
    const hero = createHero(view.category, view.capabilities);
    hero.apply(view.state);
    this.#hero = hero;
    const override = this.#options.registry.get(view.id);
    applyOverrideTransform(hero.object, override);
    const wrap = new Group();
    wrap.add(hero.object);
    this.#wrap = wrap;
    this.#options.engine.resources.trackObject(wrap);
    this.#options.engine.graph.add({ id: 'hero.stage', object: wrap });
    this.#behaviour = this.#options.living.create(view.category, {
      object: hero.object,
      reducedMotion: this.#options.reducedMotion,
      state: () => ({ ...(this.#view?.state ?? view.state) }),
    });
    this.#loadOverrideModel(view);
    // Frame while the wrap is at identity so the camera targets the settled pose…
    this.frame(this.#framing);
    // …then start the arrival choreography from its offset.
    if (this.#options.reducedMotion()) {
      this.#arrival = null;
    } else {
      this.#arrival = { elapsedMs: 0, direction };
      this.#applyArrival(0);
    }
    this.#emitAmbient();
  }

  /** Rebuild the hero for the current device (e.g. after an override change). */
  public remount(view: DeviceView): void {
    this.#unmount();
    this.setDevice(view);
  }

  /** Refresh live state on the mounted hero without remounting. */
  public update(view: DeviceView): void {
    this.#view = view;
    this.#hero?.apply(view.state);
    this.#emitAmbient();
  }

  /** Deliberate camera choreography between browse and detail framing. */
  public frame(mode: StageFraming, immediate = false): void {
    this.#framing = mode;
    if (!this.#hero) return;
    const preset = FRAMING[mode];
    this.#options.engine.cameraRig.frameObject(this.#hero.object, {
      padding: preset.padding,
      durationMs: immediate ? 0 : preset.durationMs,
      reducedMotion: this.#options.reducedMotion(),
    });
  }

  public pulse(strength = 0.6): void {
    this.#behaviour?.pulse?.(strength);
  }

  public tick(deltaMs: number): void {
    this.#tickOutgoing(deltaMs);
    if (!this.#view || !this.#hero) return;
    const reduced = this.#options.reducedMotion();
    this.#hero.tick(reduced ? 0 : deltaMs, this.#view.state);
    this.#behaviour?.tick(reduced ? 0 : deltaMs);
    this.#tickArrival(deltaMs);
    this.#tickExamination(deltaMs);
  }

  /** Snap any in-flight arrival to its settled pose (used before re-framing). */
  public settle(): void {
    this.#arrival = null;
    this.#wrap?.position.set(0, 0, 0);
    this.#wrap?.scale.set(1, 1, 1);
  }

  #beginDeparture(direction: number): void {
    this.#disposeOutgoing();
    if (!this.#hero || !this.#wrap) {
      this.#unmount();
      return;
    }
    const hero = this.#hero;
    const wrap = this.#wrap;
    this.#behaviour?.dispose();
    this.#behaviour = null;
    this.#loadToken += 1;
    this.#hero = null;
    this.#wrap = null;
    this.#view = null;
    this.#options.engine.graph.remove('hero.stage');
    if (this.#options.reducedMotion()) {
      this.#options.engine.resources.untrackObject(wrap);
      hero.dispose();
      return;
    }
    this.#options.engine.graph.add({ id: 'hero.stage.outgoing', object: wrap });
    this.#outgoing = { hero, elapsedMs: 0, direction };
  }

  #disposeOutgoing(): void {
    if (!this.#outgoing) return;
    this.#options.engine.graph.remove('hero.stage.outgoing');
    this.#options.engine.resources.untrackObject(
      this.#outgoing.hero.object.parent ?? this.#outgoing.hero.object,
    );
    this.#outgoing.hero.dispose();
    this.#outgoing = null;
  }

  #tickOutgoing(deltaMs: number): void {
    const outgoing = this.#outgoing;
    if (!outgoing) return;
    outgoing.elapsedMs += deltaMs;
    const t = Math.min(1, outgoing.elapsedMs / DEPART_MS);
    const eased = t * t * t;
    const wrap = outgoing.hero.object.parent;
    if (wrap) {
      if (outgoing.direction === 0) {
        wrap.position.set(0, -0.55 * eased, 0);
        const s = 1 - 0.3 * eased;
        wrap.scale.set(s, s, s);
      } else {
        wrap.position.set(-outgoing.direction * TRAVEL_X * eased, -0.08 * eased, 0);
        const s = 1 - 0.16 * eased;
        wrap.scale.set(s, s, s);
      }
    }
    if (t >= 1) this.#disposeOutgoing();
  }

  #applyArrival(progress: number): void {
    const arrival = this.#arrival;
    const wrap = this.#wrap;
    if (!arrival || !wrap) return;
    const remaining = 1 - progress;
    if (arrival.direction === 0) {
      wrap.position.set(0, -0.4 * remaining, 0);
      const s = 1 - 0.22 * remaining;
      wrap.scale.set(s, s, s);
    } else {
      wrap.position.set(arrival.direction * TRAVEL_X * remaining, 0.04 * remaining, 0);
      const s = 1 - 0.1 * remaining;
      wrap.scale.set(s, s, s);
    }
  }

  #tickArrival(deltaMs: number): void {
    const arrival = this.#arrival;
    if (!arrival) return;
    arrival.elapsedMs += deltaMs;
    const t = Math.min(1, arrival.elapsedMs / ARRIVE_MS);
    const eased = 1 - Math.pow(1 - t, 4);
    this.#applyArrival(eased);
    if (t >= 1) {
      this.settle();
    }
  }

  #tickExamination(deltaMs: number): void {
    const wrap = this.#wrap;
    if (!wrap) return;
    if (this.#options.reducedMotion()) {
      wrap.rotation.set(0, 0, 0);
      return;
    }
    this.#examineX.tick(deltaMs);
    this.#examineY.tick(deltaMs);
    wrap.rotation.set(this.#examineX.value, this.#examineY.value, 0);
  }

  /** Horizontal swipe switches devices; a settled tap opens detail. */
  public bindSwipe(handlers: StageSwipeHandlers): void {
    this.#unbindSwipe?.();
    const surface = this.#options.surface;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let moved = false;
    const down = (event: PointerEvent): void => {
      if (!this.#interactive) return;
      tracking = true;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
    };
    const move = (event: PointerEvent): void => {
      if (!tracking) return;
      if (Math.abs(event.clientX - startX) > 10 || Math.abs(event.clientY - startY) > 10) {
        moved = true;
      }
    };
    const up = (event: PointerEvent): void => {
      if (!tracking) return;
      tracking = false;
      if (!this.#interactive) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        if (dx < 0) handlers.onNext();
        else handlers.onPrev();
        return;
      }
      if (!moved) handlers.onOpen();
    };
    const cancel = (): void => {
      tracking = false;
    };
    surface.addEventListener('pointerdown', down);
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerup', up);
    surface.addEventListener('pointercancel', cancel);
    this.#unbindSwipe = () => {
      surface.removeEventListener('pointerdown', down);
      surface.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerup', up);
      surface.removeEventListener('pointercancel', cancel);
    };
    this.#bindExamination(surface);
  }

  /**
   * Subtle pointer examination: the hero leans gently toward the pointer while
   * browsing on hover-capable devices. Interruptible spring follow — never a
   * tween — so redirected pointer motion redirects the object seamlessly.
   */
  #bindExamination(surface: HTMLElement): void {
    this.#unbindExamine?.();
    const move = (event: PointerEvent): void => {
      if (!this.#interactive || event.pointerType !== 'mouse') return;
      const rect = surface.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      this.#examineY.setTarget(nx * 0.13);
      this.#examineX.setTarget(-ny * 0.07);
    };
    const leave = (): void => {
      this.#examineX.setTarget(0);
      this.#examineY.setTarget(0);
    };
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerleave', leave);
    this.#unbindExamine = () => {
      surface.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerleave', leave);
    };
  }

  /** Browse gestures are suspended while detail owns direct manipulation. */
  public setInteractive(interactive: boolean): void {
    this.#interactive = interactive;
    if (!interactive) {
      this.#examineX.setTarget(0);
      this.#examineY.setTarget(0);
    }
  }

  public dispose(): void {
    this.#unbindSwipe?.();
    this.#unbindSwipe = null;
    this.#unbindExamine?.();
    this.#unbindExamine = null;
    this.#disposeOutgoing();
    this.#unmount();
  }

  #emitAmbient(): void {
    const ambient = deriveAmbient(this.#view);
    this.#options.onAmbient(ambient.color, ambient.strength);
  }

  #loadOverrideModel(view: DeviceView): void {
    const resolved = this.#options.registry.resolve(view.id, view.manufacturer, view.model);
    if (resolved.kind === 'fallback' || !resolved.override.url) return;
    const token = (this.#loadToken += 1);
    void this.#options.engine.assets
      .load(`hero-model.${view.id}`, resolved.override.url)
      .then((asset) => {
        if (token !== this.#loadToken || this.#view?.id !== view.id || !this.#hero) return;
        const mount = new Group();
        mount.add(asset.scene);
        const object = this.#hero.object;
        object.clear();
        object.add(mount);
        applyOverrideTransform(object, resolved.override);
        this.settle();
        this.frame(this.#framing, true);
      })
      .catch(() => {
        /* keep the procedural fallback on load failure */
      });
  }

  #unmount(): void {
    this.#loadToken += 1;
    this.#behaviour?.dispose();
    this.#behaviour = null;
    if (this.#hero) {
      this.#options.engine.graph.remove('hero.stage');
      this.#options.engine.resources.untrackObject(this.#wrap ?? this.#hero.object);
      this.#hero.dispose();
    }
    this.#hero = null;
    this.#wrap = null;
    this.#view = null;
    this.#arrival = null;
  }
}
