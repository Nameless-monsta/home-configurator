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
import type { DeviceModelRegistry } from './device-model-registry.js';
import { categoryLabel, type DeviceView } from './experience-model.js';
import type { HeroHandle } from './hero-models.js';
import type { LivingObjectBehaviour, LivingObjectRegistry } from './living-object.js';
import { ThermostatRing } from './thermostat-ring.js';

export type DevicePresentationMode = 'browse' | 'detail';

export interface DeviceDetailOptions {
  readonly engine: GraphicsEngine;
  readonly surface: HTMLElement;
  readonly identityEl: HTMLElement;
  readonly readoutEl: HTMLElement;
  readonly trayEl: HTMLElement;
  readonly living: LivingObjectRegistry;
  readonly models: DeviceModelRegistry;
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
  #mode: DevicePresentationMode = 'browse';
  #loadToken = 0;
  #modelRevision = -1;

  public constructor(options: DeviceDetailOptions) {
    this.#options = options;
  }

  public get open(): boolean {
    return this.#view !== null;
  }

  public get deviceId(): string | null {
    return this.#view?.id ?? null;
  }

  public get view(): DeviceView | null {
    return this.#view;
  }

  public async present(deviceId: string, mode: DevicePresentationMode): Promise<void> {
    const view = this.#options.resolve(deviceId);
    if (!view) return;
    const sameObject = this.#view?.id === deviceId && this.#modelRevision === this.#options.models.revision;
    this.#mode = mode;
    if (sameObject && this.#hero) {
      this.#view = view;
      this.#hero.apply(view.state);
      this.#setControlOwnership();
      this.#frame();
      this.#render();
      return;
    }

    const token = ++this.#loadToken;
    this.#clearPresentation();
    this.#view = view;
    this.#mode = mode;
    this.#modelRevision = this.#options.models.revision;
    const hero = await this.#options.models.createHero(view);
    if (token !== this.#loadToken || this.#view?.id !== deviceId) {
      hero.dispose();
      return;
    }

    this.#hero = hero;
    hero.apply(view.state);
    this.#options.engine.resources.trackObject(hero.object);
    this.#options.engine.graph.add({ id: 'hero.active', object: hero.object });
    this.#behaviour = this.#options.living.create(view.category, {
      object: hero.object,
      reducedMotion: this.#options.reducedMotion,
      state: () => ({ ...(this.#view?.state ?? view.state) }),
    });
    this.#setControlOwnership();
    this.#frame();
    this.#render();
  }

  public async reload(): Promise<void> {
    const id = this.#view?.id;
    if (!id) return;
    this.#modelRevision = -1;
    await this.present(id, this.#mode);
  }

  public setMode(mode: DevicePresentationMode): void {
    if (this.#mode === mode) {
      this.#frame();
      return;
    }
    this.#mode = mode;
    this.#setControlOwnership();
    this.#frame();
    this.#render();
  }

  public hide(): void {
    this.#loadToken += 1;
    this.#clearPresentation();
    this.#view = null;
    this.#options.identityEl.innerHTML = '';
    this.#options.readoutEl.innerHTML = '';
  }

  public sync(): void {
    if (!this.#view) return;
    const view = this.#options.resolve(this.#view.id);
    if (!view) return this.hide();
    this.#view = view;
    this.#hero?.apply(view.state);
    if (this.#sphere) {
      this.#sphere.setLuminosity(view.state.brightness);
      this.#sphere.setSelection(view.state.hue, view.state.saturation);
    }
    this.#ring?.setValue(view.state.targetTemp);
    this.#tray?.setControls(primaryControlTitle(view), buildControls(view));
    this.#render();
  }

  public tick(deltaMs: number): void {
    if (!this.#view || !this.#hero) return;
    const reduced = this.#options.reducedMotion();
    this.#hero.tick(reduced ? 0 : deltaMs, this.#view.state);
    this.#behaviour?.tick(reduced ? 0 : deltaMs);
    if (this.#sphere && !reduced) this.#sphere.tick(deltaMs);
  }

  #clearPresentation(): void {
    this.#detachControls();
    this.#behaviour?.dispose();
    this.#behaviour = null;
    if (this.#hero) {
      this.#options.engine.graph.remove('hero.active');
      this.#options.engine.resources.untrackObject(this.#hero.object);
      this.#hero.dispose();
    }
    this.#hero = null;
    this.#confirm = null;
  }

  #setControlOwnership(): void {
    this.#detachControls();
    if (this.#mode !== 'detail' || !this.#view || !this.#hero) return;
    this.#wireDirect(this.#view, this.#hero, this.#options.surface);
    this.#tray = new AdaptiveControlTray({
      root: this.#options.trayEl,
      title: primaryControlTitle(this.#view),
      controls: buildControls(this.#view),
      reducedMotion: this.#options.reducedMotion,
      onAction: (action) => this.#onTrayAction(action),
    });
  }

  #detachControls(): void {
    for (const detach of this.#detachers) detach();
    this.#detachers = [];
    this.#sphere?.dispose();
    this.#sphere = null;
    this.#ring?.dispose();
    this.#ring = null;
    this.#tray?.dispose();
    this.#tray = null;
  }

  #frame(): void {
    if (!this.#hero) return;
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    const padding = this.#mode === 'detail' ? (mobile ? 1.72 : 1.55) : mobile ? 1.6 : 1.35;
    const pose = this.#options.engine.cameraRig.computeFramingPose(this.#hero.object, { padding });
    const shift = mobile ? 0 : this.#mode === 'browse' ? -0.78 : 0.72;
    this.#options.engine.cameraRig.transitionTo(
      {
        position: [pose.position[0] + shift, pose.position[1], pose.position[2]],
        target: [pose.target[0] + shift, pose.target[1], pose.target[2]],
        fov: this.#mode === 'detail' ? 32 : 34,
      },
      { durationMs: this.#mode === 'detail' ? 720 : 560, reducedMotion: this.#options.reducedMotion() },
    );
  }

  #wireDirect(view: DeviceView, hero: HeroHandle, surface: HTMLElement): void {
    const engine = this.#options.engine;
    if (view.category === 'light' && view.capabilities.includes('color')) {
      const sphere = new ColourSphere({
        radius: 0.72,
        onSelect: ({ hue, saturation }, final) =>
          this.#send(`color:${Math.round(hue)},${Math.round(saturation)}`, final),
      });
      sphere.object.position.set(1.95, 0.15, 0.2);
      hero.object.add(sphere.object);
      sphere.setLuminosity(view.state.brightness);
      sphere.setSelection(view.state.hue, view.state.saturation);
      this.#detachers.push(sphere.bind(surface, engine.cameraRig.camera));
      this.#sphere = sphere;
      this.#detachers.push(
        this.#verticalDrag(
          (delta) => this.#sendBrightness(delta),
          () => this.#send(`brightness:${(this.#view?.state.brightness ?? 0).toFixed(3)}`, true),
          () => !sphere.dragging,
        ),
      );
    } else if (view.category === 'light' && view.capabilities.includes('brightness')) {
      this.#detachers.push(
        this.#verticalDrag(
          (delta) => this.#sendBrightness(delta),
          () => this.#send(`brightness:${(this.#view?.state.brightness ?? 0).toFixed(3)}`, true),
        ),
      );
    } else if (view.category === 'climate' && view.capabilities.includes('targetTemperature')) {
      const ring = new ThermostatRing({ hero: hero.object, onChange: (target, final) => this.#send(`target:${target}`, final) });
      ring.setValue(view.state.targetTemp);
      this.#detachers.push(ring.bind(surface, engine.cameraRig.camera));
      this.#ring = ring;
    } else if (view.category === 'cover') {
      this.#detachers.push(
        this.#verticalDrag(
          (delta) => {
            const next = Math.min(100, Math.max(0, (this.#view?.state.position ?? 0) - delta * 0.4));
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

  #sendBrightness(delta: number): void {
    const next = Math.min(1, Math.max(0, (this.#view?.state.brightness ?? 0) - delta * 0.004));
    this.#send(`brightness:${next.toFixed(3)}`, false);
  }

  #onTrayAction(action: string): void {
    if (action === 'noop') return;
    if (isSensitiveAction(action) && this.#confirm !== action) {
      this.#confirm = action;
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
        if (receipt.state === 'failed' || receipt.state === 'timed-out')
          this.#options.onError(receipt.error?.userMessage ?? 'Command failed');
      })
      .catch((error: unknown) =>
        this.#options.onError(error instanceof Error ? error.message : 'Command failed'),
      );
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
      if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
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

  #render(): void {
    if (!this.#view) return;
    const view = this.#view;
    const model = [view.manufacturer, view.model].filter(Boolean).join(' · ');
    this.#options.identityEl.innerHTML = `
      <p class="p5-label">${escapeHtml(view.roomName)} · ${escapeHtml(categoryLabel(view.category))}</p>
      <h2 class="p5-detail-name">${escapeHtml(view.name)}</h2>
      ${model ? `<p class="p5-device-model">${escapeHtml(model)}</p>` : ''}`;
    this.#renderReadout(view);
  }

  #renderReadout(view: DeviceView): void {
    const s = view.state;
    const [primary, unit] = readout(view);
    const unavailable = !s.available ? '<span class="p5-readout-flag">Unavailable</span>' : '';
    const pending = s.pending ? '<span class="p5-readout-flag" data-pending="true">Updating</span>' : '';
    this.#options.readoutEl.innerHTML = `<div class="p5-readout" role="status" aria-live="polite"><strong>${escapeHtml(primary)}</strong><span>${escapeHtml(unit)}</span>${pending}${unavailable}</div>`;
  }

  #renderConfirm(action: string): void {
    const flag = document.createElement('div');
    flag.className = 'p5-confirm';
    flag.textContent = `${action === 'lock.toggle' ? 'Confirm lock change' : 'Confirm'} — tap again`;
    this.#options.readoutEl.appendChild(flag);
  }
}

const readout = (view: DeviceView): [string, string] => {
  const s = view.state;
  switch (view.category) {
    case 'light': return [s.on ? String(Math.round(s.brightness * 100)) : 'Off', s.on ? '% brightness' : ''];
    case 'climate': return [s.targetTemp.toFixed(1), `° target · now ${s.currentTemp.toFixed(1)}°`];
    case 'cover': return [String(Math.round(s.position)), '% open'];
    case 'media': return [s.playing ? 'Playing' : 'Paused', `${Math.round(s.volume * 100)}% volume`];
    case 'security': return [view.capabilities.includes('lock') ? (s.locked ? 'Locked' : 'Unlocked') : s.privacy ? 'Privacy' : 'Live', ''];
    case 'cleaning': return [s.cleaning ? 'Cleaning' : s.docked ? 'Docked' : 'Paused', `${Math.round(s.battery)}% battery`];
    case 'sensor': return [s.reading || s.currentTemp.toFixed(1), ''];
    case 'appliance': return [s.on ? 'On' : 'Off', ''];
  }
};

const escapeHtml = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
