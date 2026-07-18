/**
 * Phase 5 spatial experience shell. A single browse context (Home or room)
 * drives one featured-device carousel and a compact inventory. Device detail
 * temporarily owns the only visible WebGL stage.
 */
import type { GraphicsEngine } from '@home-configurator/graphics';

import { AdaptiveControlTray } from './adaptive-controls.js';
import type { CommandSink } from './control-map.js';
import { DeviceDetail } from './device-detail.js';
import {
  categoryLabel,
  defaultViewState,
  primaryStatus,
  type DeviceView,
  type RoomView,
} from './experience-model.js';
import type { AmbientSummary } from './experience-views.js';
import { FavouriteHeroCarousel, type FavouriteCarouselItem } from './favourite-carousel.js';
import { HeroPreview } from './hero-preview.js';
import { createDefaultLivingObjectRegistry } from './living-object.js';
import { SpatialTransitionController } from './motion-system.js';

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

type BrowseContext = { readonly type: 'home' } | { readonly type: 'room'; readonly roomId: string };
type SpatialState = 'browse' | 'menu-open' | 'opening-detail' | 'detail' | 'closing-detail';

const escapeHtml = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export class ExperienceShell {
  public readonly stage: HTMLElement;
  public readonly canvas: HTMLCanvasElement;

  readonly #root: HTMLElement;
  readonly #data: ExperienceData;
  readonly #sink: CommandSink;
  readonly #reducedMotion: () => boolean;
  readonly #living = createDefaultLivingObjectRegistry();
  readonly #previewRefs = new Map<string, HeroPreview>();
  readonly #statusRefs = new Map<string, HTMLElement>();
  #transition: SpatialTransitionController | null = null;
  #detail: DeviceDetail | null = null;
  #carousel: FavouriteHeroCarousel | null = null;
  #context: BrowseContext = { type: 'home' };
  #state: SpatialState = 'browse';
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
    this.#root.innerHTML = `
      <div class="p5-stage" data-p5-stage><canvas data-p5-canvas aria-label="Device stage"></canvas></div>
      <header class="p5-topbar">
        <button class="p5-context-button" type="button" data-p5-context aria-expanded="false" aria-controls="p5-context-menu">
          <span class="p5-nav-mark" aria-hidden="true"></span>
          <span data-p5-context-label>Home</span>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>
        </button>
        <div class="p5-context-menu" id="p5-context-menu" data-p5-context-menu hidden></div>
        <button class="p5-top-action" type="button" aria-label="Search devices" data-p5-search>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
        </button>
      </header>
      <main class="p5-browse" data-p5-browse></main>
      <div class="p5-detail" data-p5-detail>
        <div class="p5-detail-identity" data-p5-identity></div>
        <button class="p5-detail-close" type="button" data-p5-close aria-label="Return to devices">Back</button>
        <div class="p5-detail-readout-wrap" data-p5-readout></div>
        <div class="p5-detail-tray" data-p5-tray></div>
      </div>
      <p class="p5-sr" role="status" aria-live="polite" data-p5-announce></p>
    `;

    this.stage = this.#q('[data-p5-stage]');
    this.canvas = this.#q('[data-p5-canvas]');
    this.#root.addEventListener('click', this.#onClick);
    window.addEventListener('keydown', this.#onKeydown);
    document.addEventListener('pointerdown', this.#onDocumentPointerDown);
  }

  public attach(engine: GraphicsEngine): void {
    this.#transition = new SpatialTransitionController({
      root: this.#root,
      reducedMotion: this.#reducedMotion,
    });
    this.#detail = new DeviceDetail({
      engine,
      surface: this.stage,
      identityEl: this.#q('[data-p5-identity]'),
      readoutEl: this.#q('[data-p5-readout]'),
      trayEl: this.#q('[data-p5-tray]'),
      living: this.#living,
      sink: this.#sink,
      reducedMotion: this.#reducedMotion,
      resolve: (id) => this.#data.device(id),
      onError: (message) => this.#announce(message),
    });
    this.#render();
  }

  public refresh(): void {
    if (this.#refreshRaf) return;
    this.#refreshRaf = requestAnimationFrame(() => {
      this.#refreshRaf = 0;
      if (this.#state === 'detail' || this.#state === 'opening-detail') {
        this.#detail?.sync();
        return;
      }
      const nextKey = this.#structureKey();
      if (nextKey !== this.#structuralKey) this.#render();
      else this.#syncBrowse();
    });
  }

  public tick(deltaMs: number): void {
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

  #contextRoom(): RoomView | undefined {
    return this.#context.type === 'room'
      ? this.#data.rooms().find((room) => room.id === this.#context.roomId)
      : undefined;
  }

  #contextDevices(): readonly DeviceView[] {
    if (this.#context.type === 'home') return this.#data.favourites();
    return this.#data.devices().filter((device) => device.roomId === this.#context.roomId);
  }

  #render(): void {
    this.#disposePreviews();
    this.#carousel?.dispose();
    this.#carousel = null;

    const room = this.#contextRoom();
    if (this.#context.type === 'room' && !room) this.#context = { type: 'home' };
    const label = room?.name ?? 'Home';
    this.#q('[data-p5-context-label]').textContent = label;
    this.#renderContextMenu();

    const ambient = this.#data.ambient();
    const devices = this.#contextDevices();
    const host = this.#q('[data-p5-browse]');
    const summary = [ambient.comfort, ambient.air, ambient.security].filter(Boolean).join(' · ');
    host.innerHTML = `
      <section class="p5-intro" aria-labelledby="p5-context-heading">
        <p class="p5-eyebrow">${escapeHtml(ambient.greeting)}</p>
        <h1 id="p5-context-heading">${escapeHtml(room?.name ?? ambient.statusSentence)}</h1>
        <p class="p5-ambient-line">${escapeHtml(summary)}</p>
      </section>
      <section class="p5-featured" aria-label="Featured devices">
        <div data-p5-favourite-carousel></div>
      </section>
      <section class="p5-inventory" aria-label="All devices in ${escapeHtml(label)}">
        <div class="p5-inventory-head"><p>All devices</p><span>${devices.length}</span></div>
        <div class="p5-device-grid" data-p5-device-grid></div>
      </section>
    `;

    const carouselRoot = host.querySelector<HTMLElement>('[data-p5-favourite-carousel]');
    if (carouselRoot && devices.length) {
      const items = devices.map((view) => this.#carouselItem(view));
      this.#carousel = new FavouriteHeroCarousel({
        root: carouselRoot,
        items,
        mountHero: (mountHost, item) => this.#createPreview(mountHost, item.id),
        onSelect: (item, origin) => this.#openDetail(item.id, origin),
      });
    } else if (carouselRoot) {
      carouselRoot.innerHTML = '<p class="p5-empty">No featured devices in this space.</p>';
    }

    const grid = host.querySelector<HTMLElement>('[data-p5-device-grid]');
    if (grid) {
      grid.innerHTML = devices
        .map(
          (device) => `<button class="p5-device-row" type="button" data-p5-open="${escapeHtml(device.id)}" aria-label="Open ${escapeHtml(device.name)}">
            <span class="p5-device-glyph" data-category="${escapeHtml(device.category)}" aria-hidden="true"></span>
            <span class="p5-device-row-copy"><strong>${escapeHtml(device.name)}</strong><small>${escapeHtml(categoryLabel(device.category))}</small></span>
            <span class="p5-device-status" data-p5-status="${escapeHtml(device.id)}">${escapeHtml(primaryStatus(device))}</span>
            <span class="p5-device-chevron" aria-hidden="true">›</span>
          </button>`,
        )
        .join('');
      for (const status of grid.querySelectorAll<HTMLElement>('[data-p5-status]')) {
        const id = status.dataset['p5Status'];
        if (id) this.#statusRefs.set(id, status);
      }
    }

    this.#structuralKey = this.#structureKey();
  }

  #renderContextMenu(): void {
    const menu = this.#q('[data-p5-context-menu]');
    const homeSelected = this.#context.type === 'home';
    menu.innerHTML = `
      <button type="button" data-p5-select-home aria-current="${homeSelected}">
        <span>Home</span><small>Favourites</small>
      </button>
      <div class="p5-context-divider" role="separator"></div>
      ${this.#data
        .rooms()
        .map(
          (room) => `<button type="button" data-p5-select-room="${escapeHtml(room.id)}" aria-current="${this.#context.type === 'room' && this.#context.roomId === room.id}">
            <span>${escapeHtml(room.name)}</span><small>${room.deviceIds.length}</small>
          </button>`,
        )
        .join('')}
    `;
  }

  #carouselItem(view: DeviceView): FavouriteCarouselItem {
    return {
      id: view.id,
      name: view.name,
      room: view.roomName,
      category: categoryLabel(view.category),
      status: primaryStatus(view),
    };
  }

  #createPreview(host: HTMLElement, deviceId: string): HeroPreview {
    const view = this.#data.device(deviceId);
    const preview = new HeroPreview({
      host,
      category: view?.category ?? 'appliance',
      capabilities: view?.capabilities ?? [],
      state: view?.state ?? defaultViewState(),
      reducedMotion: this.#reducedMotion,
    });
    this.#previewRefs.set(deviceId, preview);
    return preview;
  }

  #disposePreviews(): void {
    this.#previewRefs.clear();
    this.#statusRefs.clear();
  }

  #structureKey(): string {
    return `${this.#context.type}:${this.#context.type === 'room' ? this.#context.roomId : 'home'}:${this.#contextDevices()
      .map((view) => `${view.id}:${view.category}:${view.capabilities.join('.')}`)
      .join(',')}:${this.#data
      .rooms()
      .map((room) => `${room.id}:${room.deviceIds.length}`)
      .join('|')}`;
  }

  #syncBrowse(): void {
    const views = this.#contextDevices();
    for (const view of views) {
      this.#previewRefs.get(view.id)?.update(view.state);
      const status = this.#statusRefs.get(view.id);
      if (status) status.textContent = primaryStatus(view);
    }
    this.#carousel?.updateItems(views.map((view) => this.#carouselItem(view)));
  }

  #setState(state: SpatialState): void {
    this.#state = state;
    this.#root.dataset['spatialState'] = state;
  }

  #openMenu(): void {
    if (this.#state !== 'browse') return;
    const menu = this.#q('[data-p5-context-menu]');
    menu.hidden = false;
    this.#q('[data-p5-context]').setAttribute('aria-expanded', 'true');
    this.#setState('menu-open');
  }

  #closeMenu(restoreFocus = false): void {
    const menu = this.#q('[data-p5-context-menu]');
    menu.hidden = true;
    const button = this.#q<HTMLButtonElement>('[data-p5-context]');
    button.setAttribute('aria-expanded', 'false');
    if (this.#state === 'menu-open') this.#setState('browse');
    if (restoreFocus) button.focus();
  }

  #selectContext(context: BrowseContext): void {
    this.#closeMenu();
    this.#context = context;
    this.#render();
    window.scrollTo({ top: 0, behavior: this.#reducedMotion() ? 'auto' : 'smooth' });
    this.#announce(context.type === 'home' ? 'Showing Home' : `Showing ${this.#contextRoom()?.name ?? 'room'}`);
  }

  #openDetail(deviceId: string, origin?: DOMRect): void {
    if (this.#state !== 'browse') return;
    this.#detailOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.#setState('opening-detail');
    this.#root.dataset['mode'] = 'detail';
    this.#q('[data-p5-browse]').setAttribute('inert', '');
    document.documentElement.classList.add('p5-scroll-lock');
    for (const preview of this.#previewRefs.values()) preview.setActive(false);
    this.#transition?.enterDetail(origin);
    this.#detail?.show(deviceId);
    requestAnimationFrame(() => this.#setState('detail'));
    this.#announce(`Opened ${this.#data.device(deviceId)?.name ?? 'device'}`);
  }

  #closeDetail(): void {
    if (this.#state !== 'detail' && this.#state !== 'opening-detail') return;
    this.#setState('closing-detail');
    this.#transition?.leaveDetail();
    this.#detail?.hide();
    this.#root.dataset['mode'] = 'browse';
    this.#q('[data-p5-browse]').removeAttribute('inert');
    document.documentElement.classList.remove('p5-scroll-lock');
    requestAnimationFrame(() => {
      this.#setState('browse');
      this.#carousel?.focusIndex(this.#carousel.activeIndex, false);
      this.#detailOpener?.focus();
      this.#detailOpener = null;
    });
  }

  readonly #onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-p5-context]')) {
      if (this.#state === 'menu-open') this.#closeMenu(true);
      else this.#openMenu();
      return;
    }
    if (target.closest('[data-p5-select-home]')) {
      this.#selectContext({ type: 'home' });
      return;
    }
    const room = target.closest<HTMLElement>('[data-p5-select-room]');
    if (room?.dataset['p5SelectRoom']) {
      this.#selectContext({ type: 'room', roomId: room.dataset['p5SelectRoom'] });
      return;
    }
    const open = target.closest<HTMLElement>('[data-p5-open]');
    if (open?.dataset['p5Open']) {
      this.#openDetail(open.dataset['p5Open'], open.getBoundingClientRect());
      return;
    }
    if (target.closest('[data-p5-close]')) this.#closeDetail();
  };

  readonly #onDocumentPointerDown = (event: PointerEvent): void => {
    if (this.#state !== 'menu-open') return;
    const target = event.target as Node | null;
    if (target && !this.#q('[data-p5-context-menu]').contains(target) && !this.#q('[data-p5-context]').contains(target)) {
      this.#closeMenu();
    }
  };

  readonly #onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    if (this.#state === 'menu-open') this.#closeMenu(true);
    else this.#closeDetail();
  };

  public dispose(): void {
    if (this.#refreshRaf) cancelAnimationFrame(this.#refreshRaf);
    this.#root.removeEventListener('click', this.#onClick);
    window.removeEventListener('keydown', this.#onKeydown);
    document.removeEventListener('pointerdown', this.#onDocumentPointerDown);
    document.documentElement.classList.remove('p5-scroll-lock');
    this.#carousel?.dispose();
    this.#detail?.hide();
    this.#transition?.dispose();
    this.#previewRefs.clear();
    this.#statusRefs.clear();
  }
}

export { AdaptiveControlTray };
