/**
 * Phase 5 spatial experience shell — one persistent stage, one hero object.
 *
 * The shell coordinates: persistent global navigation (Home / Rooms / Alarm /
 * Settings / Search), the HeroStage (single 3D object, camera choreography,
 * ambient atmosphere), the slide-up content beneath the hero, Device Detail
 * (controls around the same object) and the cross-device rail. Sections and
 * detail all live inside the same environment; nothing is destroyed on
 * navigation. docs/PHASE-5-IYO-EXPERIENCE, docs/01-research/IYO_INTERACTION_SPEC.
 */
import type { GraphicsEngine } from '@home-configurator/graphics';

import { AdaptiveControlTray } from './adaptive-controls.js';
import type { CommandSink } from './control-map.js';
import { dispatchAction } from './control-map.js';
import { DeviceDetail } from './device-detail.js';
import { DeviceRail } from './device-rail.js';
import {
  categoryLabel,
  primaryStatus,
  type DeviceView,
  type RoomView,
} from './experience-model.js';
import type { AmbientSummary } from './experience-views.js';
import { HeroStage } from './hero-stage.js';
import {
  buildSummaryTiles,
  deriveSummary,
  renderAlarmContent,
  renderHomeContent,
  renderRoomContent,
} from './home-content.js';
import { createDefaultLivingObjectRegistry } from './living-object.js';
import { HeroModelRegistry } from './model-registry.js';
import { SpatialTransitionController } from './motion-system.js';
import { NavigationBar, type NavSection } from './navigation-bar.js';
import { SearchOverlay } from './search-overlay.js';
import { SettingsView } from './settings-view.js';

export interface ExperienceData {
  rooms(): readonly RoomView[];
  devices(): readonly DeviceView[];
  device(id: string): DeviceView | undefined;
  favourites(): readonly DeviceView[];
  ambient(): AmbientSummary;
}

export interface ExperienceShellOptions {
  readonly root: HTMLElement;
  readonly sink: CommandSink;
  readonly data: ExperienceData;
  reducedMotion: () => boolean;
}

type SpatialState = 'browse' | 'opening-detail' | 'detail' | 'closing-detail';

const storageOrNull = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export class ExperienceShell {
  public readonly stage: HTMLElement;
  public readonly canvas: HTMLCanvasElement;

  readonly #root: HTMLElement;
  readonly #data: ExperienceData;
  readonly #sink: CommandSink;
  readonly #reducedMotion: () => boolean;
  readonly #living = createDefaultLivingObjectRegistry();
  readonly #registry = new HeroModelRegistry(storageOrNull());
  readonly #statusRefs = new Map<string, HTMLElement>();
  readonly #nav: NavigationBar;
  readonly #rail: DeviceRail;
  readonly #search: SearchOverlay;
  readonly #settings: SettingsView;
  #heroStage: HeroStage | null = null;
  #transition: SpatialTransitionController | null = null;
  #detail: DeviceDetail | null = null;
  #section: NavSection = { kind: 'home' };
  #state: SpatialState = 'browse';
  #activeDeviceId: string | null = null;
  #structuralKey = '';
  #refreshRaf = 0;
  #detailOpener: HTMLElement | null = null;

  public constructor(options: ExperienceShellOptions) {
    this.#root = options.root;
    this.#data = options.data;
    this.#sink = options.sink;
    this.#reducedMotion = options.reducedMotion;
    this.#root.className = 'p5';
    this.#root.dataset['mode'] = 'browse';
    this.#root.dataset['spatialState'] = 'browse';
    this.#root.dataset['section'] = 'home';
    this.#root.innerHTML = `
      <div class="p5-stage" data-p5-stage>
        <div class="p5-atmos" aria-hidden="true"></div>
        <canvas data-p5-canvas aria-label="Device stage"></canvas>
      </div>
      <nav class="p5-nav" data-p5-nav></nav>
      <div class="p5-hero-overlay" data-p5-hero-overlay>
        <p class="p5-hero-eyebrow" data-p5-hero-eyebrow></p>
        <h1 class="p5-hero-name" data-p5-hero-name></h1>
        <p class="p5-hero-status" data-p5-hero-status></p>
        <button class="p5-hero-open" type="button" data-p5-hero-enter>Open device</button>
        <p class="p5-hero-scroll" aria-hidden="true">Scroll for your home</p>
      </div>
      <main class="p5-content" data-p5-content tabindex="-1"></main>
      <div class="p5-detail" data-p5-detail>
        <div class="p5-detail-identity" data-p5-identity></div>
        <button class="p5-detail-close" type="button" data-p5-close aria-label="Return to devices">Back</button>
        <button class="p5-detail-step" type="button" data-p5-detail-prev aria-label="Previous device">‹</button>
        <button class="p5-detail-step" type="button" data-p5-detail-next aria-label="Next device">›</button>
        <div class="p5-detail-readout-wrap" data-p5-readout></div>
        <div class="p5-detail-tray" data-p5-tray></div>
      </div>
      <nav class="p5-rail" data-p5-rail></nav>
      <div class="p5-search" data-p5-search-overlay hidden></div>
      <div class="p5-settings" data-p5-settings hidden></div>
      <p class="p5-sr" role="status" aria-live="polite" data-p5-announce></p>
    `;

    this.stage = this.#q('[data-p5-stage]');
    this.canvas = this.#q('[data-p5-canvas]');

    this.#nav = new NavigationBar({
      root: this.#q('[data-p5-nav]'),
      onNavigate: (section) => this.#navigate(section),
      onSearch: () => this.#openSearch(),
    });
    this.#rail = new DeviceRail({
      root: this.#q('[data-p5-rail]'),
      onSelect: (id) => this.#travelToDevice(id),
    });
    this.#search = new SearchOverlay({
      root: this.#q('[data-p5-search-overlay]'),
      devices: () => this.#data.devices(),
      onPick: (id) => this.#onSearchPick(id),
      onClose: () => this.#closeSearch(),
    });
    this.#settings = new SettingsView({
      root: this.#q('[data-p5-settings]'),
      registry: this.#registry,
      devices: () => this.#data.devices(),
      onPreview: (id) => this.#previewDevice(id),
      onApply: (id) => this.#remountHero(id),
      onClose: () => this.#navigate({ kind: 'home' }),
    });

    this.#root.addEventListener('click', this.#onClick);
    window.addEventListener('keydown', this.#onKeydown);
  }

  public attach(engine: GraphicsEngine): void {
    this.#transition = new SpatialTransitionController({
      root: this.#root,
      reducedMotion: this.#reducedMotion,
    });
    this.#heroStage = new HeroStage({
      engine,
      surface: this.stage,
      living: this.#living,
      registry: this.#registry,
      reducedMotion: this.#reducedMotion,
      onAmbient: (color, strength) => {
        this.#root.style.setProperty('--p5-ambient', color);
        this.#root.style.setProperty('--p5-ambient-strength', String(strength));
      },
    });
    this.#heroStage.bindSwipe({
      onPrev: () => this.#step(-1),
      onNext: () => this.#step(1),
      onOpen: () => {
        if (this.#activeDeviceId) this.#openDetail(this.#activeDeviceId);
      },
    });
    this.#detail = new DeviceDetail({
      engine,
      surface: this.stage,
      identityEl: this.#q('[data-p5-identity]'),
      readoutEl: this.#q('[data-p5-readout]'),
      trayEl: this.#q('[data-p5-tray]'),
      sink: this.#sink,
      reducedMotion: this.#reducedMotion,
      resolve: (id) => this.#data.device(id),
      onError: (message) => this.#announce(message),
      onPulse: (strength) => this.#heroStage?.pulse(strength),
    });
    this.#render();
  }

  public refresh(): void {
    if (this.#refreshRaf) return;
    this.#refreshRaf = requestAnimationFrame(() => {
      this.#refreshRaf = 0;
      const active = this.#activeView();
      if (active) {
        this.#heroStage?.update(active);
        this.#renderHeroOverlay(active);
      }
      if (this.#state === 'detail' || this.#state === 'opening-detail') {
        this.#detail?.sync();
        return;
      }
      const nextKey = this.#structureKey();
      if (nextKey !== this.#structuralKey) this.#render();
      else this.#syncContent();
    });
  }

  public tick(deltaMs: number): void {
    this.#heroStage?.tick(deltaMs);
    this.#detail?.tick(deltaMs);
  }

  #q<T extends HTMLElement = HTMLElement>(selector: string): T {
    const node = this.#root.querySelector<T>(selector);
    if (!node) throw new Error(`Missing shell node: ${selector}`);
    return node;
  }

  #announce(message: string): void {
    this.#q('[data-p5-announce]').textContent = message;
  }

  #sectionRoom(): RoomView | undefined {
    const section = this.#section;
    return section.kind === 'room'
      ? this.#data.rooms().find((room) => room.id === section.roomId)
      : undefined;
  }

  /** Devices browsable in the current section, in rail/switch order. */
  #sectionDevices(): readonly DeviceView[] {
    const section = this.#section;
    switch (section.kind) {
      case 'home':
      case 'settings': {
        const favourites = this.#data.favourites();
        return favourites.length ? favourites : this.#data.devices();
      }
      case 'room':
        return this.#data.devices().filter((device) => device.roomId === section.roomId);
      case 'alarm':
        return this.#data
          .devices()
          .filter(
            (device) => device.category === 'security' || device.capabilities.includes('lock'),
          );
    }
  }

  #activeView(): DeviceView | null {
    return this.#activeDeviceId ? (this.#data.device(this.#activeDeviceId) ?? null) : null;
  }

  #navigate(section: NavSection): void {
    if (this.#state === 'detail' || this.#state === 'opening-detail') this.#closeDetail(true);
    this.#closeSearch();
    if (section.kind !== 'settings') this.#settings.hide();
    this.#section = section;
    this.#root.dataset['section'] = section.kind;
    this.#nav.setSection(section);
    this.#activeDeviceId = null;
    this.#render();
    window.scrollTo({ top: 0, behavior: this.#reducedMotion() ? 'auto' : 'smooth' });
    if (section.kind === 'settings') this.#settings.show(this.#activeDeviceId ?? undefined);
    const label =
      section.kind === 'home'
        ? 'Home'
        : section.kind === 'room'
          ? (this.#sectionRoom()?.name ?? 'Room')
          : section.kind === 'alarm'
            ? 'Alarm'
            : 'Settings';
    this.#announce(`Showing ${label}`);
  }

  #render(): void {
    const devices = this.#sectionDevices();
    if (this.#section.kind === 'room' && !this.#sectionRoom()) {
      this.#section = { kind: 'home' };
      this.#root.dataset['section'] = 'home';
    }
    this.#nav.setRooms(this.#data.rooms());
    this.#nav.setSection(this.#section);
    this.#statusRefs.clear();

    if (!this.#activeDeviceId || !devices.some((view) => view.id === this.#activeDeviceId)) {
      this.#activeDeviceId = devices[0]?.id ?? null;
    }
    const active = this.#activeView();
    if (active && this.#heroStage) {
      this.#heroStage.setDevice(active);
      this.#renderHeroOverlay(active);
    } else {
      this.#renderHeroOverlay(null);
    }
    this.#rail.setItems(devices.map((view) => ({ id: view.id, name: view.name })));
    this.#rail.setActive(this.#activeDeviceId);

    const content = this.#q('[data-p5-content]');
    const room = this.#sectionRoom();
    switch (this.#section.kind) {
      case 'home':
      case 'settings':
        content.innerHTML = renderHomeContent(
          this.#data.favourites(),
          this.#data.devices(),
          this.#data.rooms(),
        );
        break;
      case 'room':
        content.innerHTML = room ? renderRoomContent(room, devices) : '';
        break;
      case 'alarm':
        content.innerHTML = renderAlarmContent(devices);
        break;
    }
    for (const status of content.querySelectorAll<HTMLElement>('[data-p5-status]')) {
      const id = status.dataset['p5Status'];
      if (id) this.#statusRefs.set(id, status);
    }
    this.#structuralKey = this.#structureKey();
  }

  #renderHeroOverlay(view: DeviceView | null): void {
    const eyebrow = this.#q('[data-p5-hero-eyebrow]');
    const name = this.#q('[data-p5-hero-name]');
    const status = this.#q('[data-p5-hero-status]');
    const enter = this.#q<HTMLButtonElement>('[data-p5-hero-enter]');
    if (!view) {
      eyebrow.textContent = '';
      name.textContent =
        this.#section.kind === 'alarm' ? 'No security devices' : 'No devices yet';
      status.textContent = '';
      enter.hidden = true;
      return;
    }
    eyebrow.textContent = `${view.roomName} · ${categoryLabel(view.category)}`;
    name.textContent = view.name;
    status.textContent = primaryStatus(view);
    enter.hidden = false;
    enter.setAttribute('aria-label', `Open ${view.name}`);
  }

  #syncContent(): void {
    const views = this.#data.devices();
    for (const view of views) {
      const status = this.#statusRefs.get(view.id);
      if (status) status.textContent = primaryStatus(view);
      const fav = this.#root.querySelector<HTMLElement>(`[data-p5-fav-status="${view.id}"]`);
      if (fav) fav.textContent = primaryStatus(view);
    }
    const sectionViews = this.#sectionDevices();
    const summary = deriveSummary(
      this.#section.kind === 'home' || this.#section.kind === 'settings' ? views : sectionViews,
    );
    for (const tile of buildSummaryTiles(
      this.#section.kind === 'home' || this.#section.kind === 'settings' ? views : sectionViews,
      summary,
    )) {
      const value = this.#root.querySelector<HTMLElement>(`[data-p5-tile-value="${tile.id}"]`);
      if (value) value.textContent = tile.value;
      const detail = this.#root.querySelector<HTMLElement>(`[data-p5-tile-detail="${tile.id}"]`);
      if (detail) detail.textContent = tile.detail;
    }
  }

  #structureKey(): string {
    return `${this.#section.kind}:${this.#section.kind === 'room' ? this.#section.roomId : '-'}:${this.#sectionDevices()
      .map((view) => `${view.id}:${view.category}`)
      .join(',')}:${this.#data
      .rooms()
      .map((room) => `${room.id}:${room.deviceIds.length}`)
      .join('|')}:${this.#data
      .favourites()
      .map((view) => view.id)
      .join(',')}`;
  }

  #setState(state: SpatialState): void {
    this.#state = state;
    this.#root.dataset['spatialState'] = state;
  }

  /** Travel to a device inside the persistent shell (browse or detail). */
  #travelToDevice(deviceId: string): void {
    if (this.#state === 'detail') {
      this.#switchDetail(deviceId);
      return;
    }
    if (this.#state !== 'browse') return;
    const view = this.#data.device(deviceId);
    if (!view || !this.#heroStage) return;
    this.#activeDeviceId = deviceId;
    this.#heroStage.setDevice(view);
    this.#renderHeroOverlay(view);
    this.#rail.setActive(deviceId);
    this.#transition?.swapDetail();
    this.#announce(`Showing ${view.name}`);
  }

  #step(direction: -1 | 1): void {
    const next = this.#rail.neighbour(direction);
    if (next) this.#travelToDevice(next);
  }

  #previewDevice(deviceId: string): void {
    const view = this.#data.device(deviceId);
    if (!view || !this.#heroStage) return;
    this.#activeDeviceId = deviceId;
    this.#heroStage.setDevice(view);
    this.#renderHeroOverlay(view);
    this.#rail.setActive(deviceId);
  }

  /** Remount after a model override changed, keeping the same framing. */
  #remountHero(deviceId: string): void {
    const view = this.#data.device(deviceId);
    if (!view || !this.#heroStage) return;
    this.#activeDeviceId = deviceId;
    this.#heroStage.remount(view);
    this.#renderHeroOverlay(view);
    this.#rail.setActive(deviceId);
    this.#announce('Model updated');
  }

  #openDetail(deviceId: string, origin?: DOMRect): void {
    if (this.#state !== 'browse') return;
    const view = this.#data.device(deviceId);
    if (!view || !this.#heroStage || !this.#detail) return;
    this.#detailOpener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.#nav.closeMenu();
    this.#closeSearch();
    this.#settings.hide();
    this.#setState('opening-detail');
    this.#root.dataset['mode'] = 'detail';
    this.#q('[data-p5-content]').setAttribute('inert', '');
    document.documentElement.classList.add('p5-scroll-lock');
    this.#activeDeviceId = deviceId;
    this.#heroStage.setDevice(view);
    this.#heroStage.setInteractive(false);
    this.#rail.setActive(deviceId);
    this.#transition?.enterDetail(origin);
    const hero = this.#heroStage.hero;
    if (hero) this.#detail.show(view, hero);
    this.#heroStage.frame('detail');
    requestAnimationFrame(() => this.#setState('detail'));
    this.#announce(`Opened ${view.name}`);
  }

  #switchDetail(deviceId: string): void {
    if (this.#state !== 'detail' || this.#detail?.deviceId === deviceId) return;
    const view = this.#data.device(deviceId);
    if (!view || !this.#heroStage || !this.#detail) return;
    this.#detail.hide();
    this.#activeDeviceId = deviceId;
    this.#heroStage.setDevice(view);
    this.#renderHeroOverlay(view);
    this.#rail.setActive(deviceId);
    this.#transition?.swapDetail();
    const hero = this.#heroStage.hero;
    if (hero) this.#detail.show(view, hero);
    this.#heroStage.frame('detail');
    this.#announce(`Showing ${view.name}`);
  }

  #closeDetail(immediate = false): void {
    if (this.#state !== 'detail' && this.#state !== 'opening-detail') return;
    this.#setState('closing-detail');
    this.#transition?.leaveDetail();
    this.#detail?.hide();
    this.#heroStage?.setInteractive(true);
    this.#heroStage?.frame('browse', immediate);
    this.#root.dataset['mode'] = 'browse';
    this.#q('[data-p5-content]').removeAttribute('inert');
    document.documentElement.classList.remove('p5-scroll-lock');
    const finish = (): void => {
      this.#setState('browse');
      const active = this.#activeView();
      if (active) this.#renderHeroOverlay(active);
      this.#detailOpener?.focus();
      this.#detailOpener = null;
    };
    if (immediate) finish();
    else requestAnimationFrame(finish);
  }

  #openSearch(): void {
    this.#nav.closeMenu();
    this.#search.show();
  }

  #closeSearch(): void {
    this.#search.hide();
  }

  #onSearchPick(deviceId: string): void {
    this.#closeSearch();
    const view = this.#data.device(deviceId);
    if (!view) return;
    if (this.#section.kind !== 'room' || this.#section.roomId !== view.roomId) {
      // Travel to the device's room so the rail and content share its context.
      this.#navigate({ kind: 'room', roomId: view.roomId });
    }
    this.#travelToDevice(deviceId);
    window.scrollTo({ top: 0, behavior: this.#reducedMotion() ? 'auto' : 'smooth' });
  }

  /** Room quick lighting control through the shared command path. */
  #quickLights(on: boolean): void {
    const lights = this.#sectionDevices().filter(
      (view) => view.category === 'light' && view.state.on !== on,
    );
    for (const view of lights) {
      const promise = dispatchAction(this.#sink, view, 'power');
      void promise?.catch(() => this.#announce('Command failed'));
    }
    this.#announce(on ? 'Turning lights on' : 'Turning lights off');
  }

  readonly #onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-p5-hero-enter]')) {
      if (this.#activeDeviceId)
        this.#openDetail(
          this.#activeDeviceId,
          this.#q('[data-p5-hero-overlay]').getBoundingClientRect(),
        );
      return;
    }
    const jump = target.closest<HTMLElement>('[data-p5-jump]');
    if (jump?.dataset['p5Jump']) {
      this.#travelToDevice(jump.dataset['p5Jump']);
      window.scrollTo({ top: 0, behavior: this.#reducedMotion() ? 'auto' : 'smooth' });
      return;
    }
    const room = target.closest<HTMLElement>('[data-p5-nav-room]');
    if (room?.dataset['p5NavRoom'] && !room.closest('[data-p5-nav]')) {
      this.#navigate({ kind: 'room', roomId: room.dataset['p5NavRoom'] });
      return;
    }
    const quick = target.closest<HTMLElement>('[data-p5-quick]');
    if (quick?.dataset['p5Quick'] === 'lights-on') {
      this.#quickLights(true);
      return;
    }
    if (quick?.dataset['p5Quick'] === 'lights-off') {
      this.#quickLights(false);
      return;
    }
    const open = target.closest<HTMLElement>('[data-p5-open]');
    if (open?.dataset['p5Open']) {
      this.#openDetail(open.dataset['p5Open'], open.getBoundingClientRect());
      return;
    }
    if (target.closest('[data-p5-detail-prev]')) {
      this.#step(-1);
      return;
    }
    if (target.closest('[data-p5-detail-next]')) {
      this.#step(1);
      return;
    }
    if (target.closest('[data-p5-close]')) this.#closeDetail();
  };

  readonly #onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      if (this.#search.open) {
        this.#closeSearch();
        return;
      }
      if (this.#settings.open && this.#section.kind === 'settings') {
        this.#navigate({ kind: 'home' });
        return;
      }
      if (this.#nav.menuOpen) {
        this.#nav.closeMenu(true);
        return;
      }
      this.#closeDetail();
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest('.p5-detail, .p5-rail, .p5-search, .p5-settings, input, select, textarea')
    ) {
      return;
    }
    if (this.#state === 'detail' || this.#state === 'browse') {
      event.preventDefault();
      this.#step(event.key === 'ArrowRight' ? 1 : -1);
    }
  };

  public dispose(): void {
    if (this.#refreshRaf) cancelAnimationFrame(this.#refreshRaf);
    this.#root.removeEventListener('click', this.#onClick);
    window.removeEventListener('keydown', this.#onKeydown);
    document.documentElement.classList.remove('p5-scroll-lock');
    this.#nav.dispose();
    this.#rail.dispose();
    this.#search.dispose();
    this.#settings.dispose();
    this.#detail?.hide();
    this.#heroStage?.dispose();
    this.#transition?.dispose();
    this.#statusRefs.clear();
  }
}

export { AdaptiveControlTray };
