/**
 * Device Detail — object-first control page. Mounts the category hero on the
 * shared GraphicsEngine stage, frames the camera, registers the living-object
 * behaviour, wires the primary direct manipulation (sphere / ring / drag / hold)
 * and an adaptive control tray. All writes go through the shared command sink.
 * docs/PHASE-5-IYO-EXPERIENCE §5.3–5.5.
 */

import type { GraphicsEngine } from '@home-configurator/graphics';

import { AdaptiveControlTray } from './adaptive-controls.js';
import { ColourSphere } from './colour-sphere.js';
import {
  buildControls,
  dispatchAction,
  isSensitiveAction,
  primaryControlTitle,
  type CommandSink,
} from './control-map.js';
import { categoryLabel, type DeviceView } from './experience-model.js';
import { createHero, type HeroHandle } from './hero-models.js';
import type { LivingObjectRegistry } from './living-object.js';
import { type LivingObjectBehaviour } from './living-object.js';
import { ThermostatRing } from './thermostat-ring.js';

export interface DeviceDetailOptions {
  readonly engine: GraphicsEngine;
  readonly surface: HTMLElement;
  readonly identityEl: HTMLElement;
  readonly readoutEl: HTMLElement;
  readonly trayEl: HTMLElement;
  readonly living: LivingObjectRegistry;
  readonly sink: CommandSink;
  reducedMotion: () => boolean;
  resolve: (deviceId: string) => DeviceView | undefined;
  onError: (message: string) => void;
}

export class DeviceDetail {
  readonly #options: DeviceDetailOptions;
  #view: DeviceView | null = null;
  #hero: HeroHandle | null = null;
  #behaviour: LivingObjectBehaviour | null = null;
  #sphere: ColourSphere | null = null;
  #ring: ThermostatRing | null = null;
  #tray: AdaptiveControlTray | null = null;
  #detachers: Array<() => void> = [];
  #confirm: string | null = null;

  public constructor(options: DeviceDetailOptions) {
    this.#options = options;
  }

  public get open(): boolean {
    return this.#view !== null;
  }
  public get deviceId(): string | null {
    return this.#view?.id ?? null;
  }

  public show(deviceId: string): void {
    this.hide();
    const view = this.#options.resolve(deviceId);
    if (!view) return;
    this.#view = view;
    const { engine, surface } = this.#options;

    const hero = createHero(view.category, view.capabilities);
    hero.apply(view.state);
    this.#hero = hero;
    engine.resources.trackObject(hero.object);
    engine.graph.add({ id: `hero.${view.id}`, object: hero.object });

    this.#behaviour = this.#options.living.create(view.category, {
      object: hero.object,
      reducedMotion: this.#options.reducedMotion,
      state: () => ({ ...(this.#view?.state ?? view.state) }),
    });

    this.#wireDirect(view, hero, surface);
    engine.cameraRig.frameObject(hero.object, {
      padding: this.#sphere ? 2.1 : 1.7,
      reducedMotion: this.#options.reducedMotion(),
    });

    this.#renderIdentity(view);
    this.#tray = new AdaptiveControlTray({
      root: this.#options.trayEl,
      title: primaryControlTitle(view),
      controls: buildControls(view),
      reducedMotion: this.#options.reducedMotion,
      onAction: (action) => this.#onTrayAction(action),
    });
    this.#renderReadout(view);
  }

  public hide(): void {
    for (const detach of this.#detachers) detach();
    this.#detachers = [];
    this.#sphere?.dispose();
    this.#sphere = null;
    this.#ring?.dispose();
    this.#ring = null;
    this.#behaviour?.dispose();
    this.#behaviour = null;
    this.#tray?.dispose();
    this.#tray = null;
    if (this.#view && this.#hero) {
      this.#options.engine.graph.remove(`hero.${this.#view.id}`);
      this.#options.engine.resources.untrackObject(this.#hero.object);
    }
    this.#hero?.dispose();
    this.#hero = null;
    this.#confirm = null;
    this.#view = null;
    this.#options.identityEl.innerHTML = '';
    this.#options.readoutEl.innerHTML = '';
  }

  public sync(): void {
    if (!this.#view) return;
    const view = this.#options.resolve(this.#view.id);
    if (!view) {
      this.hide();
      return;
    }
    this.#view = view;
    this.#hero?.apply(view.state);
    if (this.#sphere) {
      this.#sphere.setLuminosity(view.state.brightness);
      this.#sphere.setSelection(view.state.hue, view.state.saturation);
    }
    this.#ring?.setValue(view.state.targetTemp);
    this.#tray?.setControls(primaryControlTitle(view), buildControls(view));
    this.#renderReadout(view);
  }

  public tick(deltaMs: number): void {
    if (!this.#view || !this.#hero) return;
    const reduced = this.#options.reducedMotion();
    this.#hero.tick(reduced ? 0 : deltaMs, this.#view.state);
    this.#behaviour?.tick(reduced ? 0 : deltaMs);
    if (this.#sphere && !reduced) this.#sphere.tick(deltaMs);
  }

  #wireDirect(view: DeviceView, hero: HeroHandle, surface: HTMLElement): void {
    const engine = this.#options.engine;
    if (view.category === 'light' && view.capabilities.includes('color')) {
      const sphere = new ColourSphere({
        radius: 0.72,
        onSelect: ({ hue, saturation }, final) => {
          this.#send(`color:${Math.round(hue)},${Math.round(saturation)}`, final);
        },
      });
      sphere.object.position.set(1.95, 0.15, 0.2);
      hero.object.add(sphere.object);
      sphere.setLuminosity(view.state.brightness);
      sphere.setSelection(view.state.hue, view.state.saturation);
      this.#detachers.push(sphere.bind(surface, engine.cameraRig.camera));
      this.#sphere = sphere;
      this.#detachers.push(
        this.#verticalDrag(
          (delta) => {
            const next = Math.min(
              1,
              Math.max(0, (this.#view?.state.brightness ?? 0) - delta * 0.004),
            );
            this.#send(`brightness:${next.toFixed(3)}`, false);
          },
          () => this.#send(`brightness:${(this.#view?.state.brightness ?? 0).toFixed(3)}`, true),
          () => !sphere.dragging,
        ),
      );
    } else if (view.category === 'light' && view.capabilities.includes('brightness')) {
      this.#detachers.push(
        this.#verticalDrag(
          (delta) => {
            const next = Math.min(
              1,
              Math.max(0, (this.#view?.state.brightness ?? 0) - delta * 0.004),
            );
            this.#send(`brightness:${next.toFixed(3)}`, false);
          },
          () => this.#send(`brightness:${(this.#view?.state.brightness ?? 0).toFixed(3)}`, true),
        ),
      );
    } else if (view.category === 'climate' && view.capabilities.includes('targetTemperature')) {
      const ring = new ThermostatRing({
        hero: hero.object,
        onChange: (target, final) => this.#send(`target:${target}`, final),
      });
      ring.setValue(view.state.targetTemp);
      this.#detachers.push(ring.bind(surface, engine.cameraRig.camera));
      this.#ring = ring;
    } else if (view.category === 'cover') {
      this.#detachers.push(
        this.#verticalDrag(
          (delta) => {
            const next = Math.min(
              100,
              Math.max(0, (this.#view?.state.position ?? 0) - delta * 0.4),
            );
            this.#send(`position:${Math.round(next)}`, false);
          },
          () => this.#send(`position:${Math.round(this.#view?.state.position ?? 0)}`, true),
        ),
      );
    } else if (view.category === 'media' && view.capabilities.includes('volume')) {
      this.#detachers.push(
        this.#verticalDrag(
          (delta) => {
            const next = Math.min(1, Math.max(0, (this.#view?.state.volume ?? 0) - delta * 0.004));
            this.#send(`volume:${next.toFixed(3)}`, false);
          },
          () => this.#send(`volume:${(this.#view?.state.volume ?? 0).toFixed(3)}`, true),
        ),
      );
    } else if (view.category === 'security' && view.capabilities.includes('lock')) {
      this.#detachers.push(this.#hold(650, () => this.#send('lock.toggle', true)));
    }
  }

  #onTrayAction(action: string): void {
    if (action === 'noop') return;
    if (isSensitiveAction(action) && this.#confirm !== action) {
      this.#confirm = action;
      this.#tray?.render();
      this.#renderConfirm(action);
      return;
    }
    this.#confirm = null;
    this.#send(action, true);
  }

  #send(action: string, final: boolean): void {
    if (!this.#view) return;
    const promise = dispatchAction(this.#options.sink, this.#view, action);
    this.#behaviour?.pulse?.(0.6);
    if (!promise) return;
    void promise
      .then((receipt) => {
        if (receipt.state === 'failed' || receipt.state === 'timed-out') {
          this.#options.onError(receipt.error?.userMessage ?? 'Command failed');
        }
      })
      .catch((error: unknown) => {
        this.#options.onError(error instanceof Error ? error.message : 'Command failed');
      });
    if (final) window.setTimeout(() => this.sync(), 60);
  }

  #verticalDrag(
    onDelta: (delta: number) => void,
    onEnd: () => void,
    canStart: () => boolean = () => true,
  ): () => void {
    const surface = this.#options.surface;
    let active = false;
    let lastY = 0;
    const down = (event: PointerEvent): void => {
      if (!canStart()) return;
      active = true;
      lastY = event.clientY;
      surface.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent): void => {
      if (!active) return;
      onDelta(event.clientY - lastY);
      lastY = event.clientY;
    };
    const up = (event: PointerEvent): void => {
      if (active) onEnd();
      active = false;
      if (surface.hasPointerCapture(event.pointerId))
        surface.releasePointerCapture(event.pointerId);
    };
    surface.addEventListener('pointerdown', down);
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerup', up);
    surface.addEventListener('pointercancel', up);
    surface.addEventListener('lostpointercapture', up);
    return () => {
      surface.removeEventListener('pointerdown', down);
      surface.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerup', up);
      surface.removeEventListener('pointercancel', up);
      surface.removeEventListener('lostpointercapture', up);
    };
  }

  #hold(durationMs: number, onHold: () => void): () => void {
    const surface = this.#options.surface;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const down = (): void => {
      timer = setTimeout(onHold, durationMs);
    };
    const cancel = (): void => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    surface.addEventListener('pointerdown', down);
    surface.addEventListener('pointerup', cancel);
    surface.addEventListener('pointercancel', cancel);
    return () => {
      cancel();
      surface.removeEventListener('pointerdown', down);
      surface.removeEventListener('pointerup', cancel);
      surface.removeEventListener('pointercancel', cancel);
    };
  }

  #renderIdentity(view: DeviceView): void {
    this.#options.identityEl.innerHTML = `
      <p class="p5-label">${view.roomName} · ${categoryLabel(view.category)}</p>
      <h2 class="p5-detail-name">${view.name}</h2>
    `;
  }

  #renderReadout(view: DeviceView): void {
    const s = view.state;
    let primary = '';
    let unit = '';
    switch (view.category) {
      case 'light':
        primary = s.on ? String(Math.round(s.brightness * 100)) : 'Off';
        unit = s.on ? '% brightness' : '';
        break;
      case 'climate':
        primary = s.targetTemp.toFixed(1);
        unit = `° target · now ${s.currentTemp.toFixed(1)}°`;
        break;
      case 'cover':
        primary = String(Math.round(s.position));
        unit = '% open';
        break;
      case 'media':
        primary = s.playing ? 'Playing' : 'Paused';
        unit = `${Math.round(s.volume * 100)}% volume`;
        break;
      case 'security':
        primary = view.capabilities.includes('lock')
          ? s.locked
            ? 'Locked'
            : 'Unlocked'
          : s.privacy
            ? 'Privacy'
            : 'Live';
        break;
      case 'cleaning':
        primary = s.cleaning ? 'Cleaning' : s.docked ? 'Docked' : 'Paused';
        unit = `${Math.round(s.battery)}% battery`;
        break;
      case 'sensor':
        primary = s.reading || s.currentTemp.toFixed(1);
        break;
      case 'appliance':
        primary = s.on ? 'On' : 'Off';
        break;
    }
    const unavailable = !s.available ? '<span class="p5-readout-flag">Unavailable</span>' : '';
    const pending = s.pending
      ? '<span class="p5-readout-flag" data-pending="true">Updating</span>'
      : '';
    this.#options.readoutEl.innerHTML = `
      <div class="p5-readout" role="status" aria-live="polite">
        <strong>${primary}</strong><span>${unit}</span>${pending}${unavailable}
      </div>`;
  }

  #renderConfirm(action: string): void {
    const label = action === 'lock.toggle' ? 'Confirm lock change' : 'Confirm';
    const flag = document.createElement('div');
    flag.className = 'p5-confirm';
    flag.textContent = `${label} — tap again`;
    this.#options.readoutEl.appendChild(flag);
  }
}
