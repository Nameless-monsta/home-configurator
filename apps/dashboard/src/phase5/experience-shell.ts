/**
 * Phase 5 experience shell. Owns the floating navigation, section router,
 * persistent stage, favourite carousel, room shelves and device detail, all
 * driven by the real Home Assistant snapshot and runtime device store. Commands
 * flow through the injected sink (the existing HA command path). No parallel
 * state store. docs/PHASE-5-IYO-EXPERIENCE.
 */

import type { GraphicsEngine } from '@home-configurator/graphics';

import { AdaptiveControlTray } from './adaptive-controls.js';
import { DeviceDetail } from './device-detail.js';
import type { CommandSink } from './control-map.js';
import {
  CATEGORY_ORDER,
  categoryLabel,
  primaryStatus,
  defaultViewState,
  type DeviceCategory,
  type DeviceView,
  type RoomView,
} from './experience-model.js';
import {
  renderHomeShell,
  renderRoomsShell,
  roomChip,
  shelfHeading,
  type AmbientSummary,
} from './experience-views.js';
import { FavouriteHeroCarousel, type FavouriteCarouselItem } from './favourite-carousel.js';
import { HeroPreview } from './hero-preview.js';
import { createDefaultLivingObjectRegistry } from './living-object.js';
import { SpatialTransitionController } from './motion-system.js';

export type SectionId = 'home' | 'rooms';

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

const NAV = [
  { id: 'home' as const, label: 'Home', icon: '<path d="M3 10.5 12 3l9 7.5M5.5 9v11h13V9"/>' },
  {
    id: 'rooms' as const,
    label: 'Rooms',
    icon: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  },
];

export class ExperienceShell {
  public readonly stage: HTMLElement;
  public readonly canvas: HTMLCanvasElement;

  readonly #root: HTMLElement;
  readonly #data: ExperienceData;
  readonly #sink: CommandSink;
  readonly #reducedMotion: () => boolean;
  readonly #living = createDefaultLivingObjectRegistry();
  readonly #shelfPreviews = new Map<string, HeroPreview>();
  readonly #previewRefs = new Map<string, HeroPreview>();
  readonly #statusRefs = new Map<string, HTMLElement>();
  #transition: SpatialTransitionController | null = null;
  #detail: DeviceDetail | null = null;
  #carousel: FavouriteHeroCarousel | null = null;
  #section: SectionId = 'home';
  #openRoomId: string | null = null;
  #structuralKey = '';
  #refreshRaf = 0;

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
      <nav class="p5-nav" aria-label="Primary">
        <span class="p5-nav-mark" aria-hidden="true"></span>
        <div class="p5-nav-items">
          <span class="p5-nav-pill" data-p5-nav-pill aria-hidden="true"></span>
          ${NAV.map(
            (
              item,
            ) => `<button class="p5-nav-item" data-p5-nav="${item.id}" aria-current="false" aria-label="${item.label}">
              <svg viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg><span>${item.label}</span>
            </button>`,
          ).join('')}
        </div>
      </nav>
      <main class="p5-section" data-p5-section="home" data-active="true"></main>
      <main class="p5-section" data-p5-section="rooms" data-active="false"></main>
      <div class="p5-detail" data-p5-detail>
        <div class="p5-detail-identity" data-p5-identity></div>
        <button class="p5-detail-close" data-p5-close aria-label="Close device">Close</button>
        <div class="p5-detail-readout-wrap" data-p5-readout></div>
        <div class="p5-detail-tray" data-p5-tray></div>
      </div>
      <p class="p5-sr" role="status" aria-live="polite" data-p5-announce></p>
    `;

    this.stage = this.#q('[data-p5-stage]');
    this.canvas = this.#q('[data-p5-canvas]');
    this.#root.addEventListener('click', this.#onClick);
    window.addEventListener('keydown', this.#onKeydown);
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
    this.#setSection('home');
  }

  public refresh(): void {
    if (this.#refreshRaf) return;
    this.#refreshRaf = requestAnimationFrame(() => {
      this.#refreshRaf = 0;
      if (this.#root.dataset['mode'] === 'detail') {
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

  #setSection(section: SectionId): void {
    this.#closeDetail();
    this.#section = section;
    for (const node of this.#root.querySelectorAll<HTMLElement>('[data-p5-section]'))
      node.dataset['active'] = String(node.dataset['p5Section'] === section);
    for (const button of this.#root.querySelectorAll<HTMLElement>('[data-p5-nav]'))
      button.setAttribute('aria-current', String(button.dataset['p5Nav'] === section));
    const index = NAV.findIndex((item) => item.id === section);
    const pill = this.#q('[data-p5-nav-pill]');
    pill.style.width = `calc(${100 / NAV.length}% - 2px)`;
    pill.style.transform = `translateX(${index * 100}%)`;
    this.#render();
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }

  #render(): void {
    this.#disposePreviews();
    this.#carousel?.dispose();
    this.#carousel = null;
    if (this.#section === 'home') this.#renderHome();
    else this.#renderRooms();
    this.#structuralKey = this.#structureKey();
  }

  #renderHome(): void {
    const host = this.#q('[data-p5-section="home"]');
    host.innerHTML = renderHomeShell(this.#data.ambient());
    const favourites = this.#data.favourites();
    const carouselRoot = host.querySelector<HTMLElement>('[data-p5-favourite-carousel]');
    if (carouselRoot && favourites.length) {
      const items: FavouriteCarouselItem[] = favourites.map((view) => ({
        id: view.id,
        name: view.name,
        room: view.roomName,
        category: categoryLabel(view.category),
        status: primaryStatus(view),
      }));
      this.#carousel = new FavouriteHeroCarousel({
        root: carouselRoot,
        items,
        mountHero: (mountHost, item) => this.#createPreview(mountHost, item.id, false),
        onSelect: (item, origin) => this.#openDetail(item.id, origin),
      });
    } else if (carouselRoot)
      carouselRoot.innerHTML = '<p class="p5-empty">No favourite devices yet.</p>';
    const rail = host.querySelector<HTMLElement>('[data-p5-room-rail]');
    if (rail)
      rail.innerHTML = this.#data
        .rooms()
        .map((room) => roomChip(room.id, room.name, room.deviceIds.length))
        .join('');
  }

  #renderRooms(): void {
    const host = this.#q('[data-p5-section="rooms"]');
    host.innerHTML = renderRoomsShell();
    const title = host.querySelector<HTMLElement>('[data-p5-rooms-title]');
    const body = host.querySelector<HTMLElement>('[data-p5-rooms-body]');
    if (!body) return;
    if (!this.#openRoomId) {
      if (title) title.textContent = 'Choose a space.';
      body.innerHTML = `<div class="p5-room-rail">${this.#data
        .rooms()
        .map((room) => roomChip(room.id, room.name, room.deviceIds.length))
        .join('')}</div>`;
      return;
    }
    const room = this.#data.rooms().find((entry) => entry.id === this.#openRoomId);
    if (!room) {
      this.#openRoomId = null;
      this.#renderRooms();
      return;
    }
    if (title) title.textContent = room.name;
    const devices = this.#data.devices().filter((device) => device.roomId === room.id);
    const byCategory = new Map<DeviceCategory, DeviceView[]>();
    for (const device of devices) {
      const list = byCategory.get(device.category) ?? [];
      list.push(device);
      byCategory.set(device.category, list);
    }
    body.innerHTML = `<button class="p5-back" data-p5-rooms-back>← Rooms</button>${CATEGORY_ORDER.filter(
      (category) => byCategory.has(category),
    )
      .map(
        (category) =>
          `${shelfHeading(category)}<div class="p5-shelf" data-p5-shelf="${category}"></div>`,
      )
      .join('')}`;
    for (const category of CATEGORY_ORDER) {
      const list = byCategory.get(category);
      const shelf = body.querySelector<HTMLElement>(`[data-p5-shelf="${category}"]`);
      if (!list || !shelf) continue;
      for (const device of list) {
        const card = document.createElement('button');
        card.className = 'p5-shelf-card';
        card.dataset['p5Open'] = device.id;
        card.setAttribute('aria-label', `Open ${device.name}`);
        card.innerHTML = `<span class="p5-shelf-host" data-p5-hero-host></span><span class="p5-shelf-copy"><strong>${device.name}</strong><span>${primaryStatus(device)}</span></span>`;
        shelf.appendChild(card);
        const mountHost = card.querySelector<HTMLElement>('[data-p5-hero-host]');
        const status = card.querySelector<HTMLElement>('.p5-shelf-copy > span');
        if (status) this.#statusRefs.set(device.id, status);
        if (mountHost) this.#createPreview(mountHost, device.id, true);
      }
    }
  }

  #createPreview(host: HTMLElement, deviceId: string, shellOwned: boolean): HeroPreview {
    const view = this.#data.device(deviceId);
    const preview = new HeroPreview({
      host,
      category: view?.category ?? 'appliance',
      capabilities: view?.capabilities ?? [],
      state: view?.state ?? defaultViewState(),
      reducedMotion: this.#reducedMotion,
    });
    this.#previewRefs.set(deviceId, preview);
    if (shellOwned) this.#shelfPreviews.set(deviceId, preview);
    return preview;
  }

  #disposePreviews(): void {
    for (const preview of this.#shelfPreviews.values()) preview.dispose();
    this.#shelfPreviews.clear();
    this.#previewRefs.clear();
    this.#statusRefs.clear();
  }

  #structureKey(): string {
    if (this.#section === 'home')
      return `home:${this.#data
        .favourites()
        .map((view) => `${view.id}:${view.category}:${view.capabilities.join('.')}`)
        .join(',')}:${this.#data
        .rooms()
        .map((room) => `${room.id}:${room.deviceIds.length}`)
        .join('|')}`;
    if (!this.#openRoomId)
      return `rooms:index:${this.#data
        .rooms()
        .map((room) => `${room.id}:${room.deviceIds.length}`)
        .join('|')}`;
    return `rooms:${this.#openRoomId}:${this.#data
      .devices()
      .filter((view) => view.roomId === this.#openRoomId)
      .map((view) => `${view.id}:${view.category}:${view.capabilities.join('.')}`)
      .join(',')}`;
  }

  #syncBrowse(): void {
    const views =
      this.#section === 'home'
        ? this.#data.favourites()
        : this.#data.devices().filter((view) => view.roomId === this.#openRoomId);
    for (const view of views) {
      this.#previewRefs.get(view.id)?.update(view.state);
      const status = this.#statusRefs.get(view.id);
      if (status) status.textContent = primaryStatus(view);
    }
    if (this.#section === 'home' && this.#carousel)
      this.#carousel.updateItems(
        views.map((view) => ({
          id: view.id,
          name: view.name,
          room: view.roomName,
          category: categoryLabel(view.category),
          status: primaryStatus(view),
        })),
      );
  }

  #openDetail(deviceId: string, origin?: DOMRect): void {
    this.#root.dataset['mode'] = 'detail';
    this.#transition?.enterDetail(origin);
    this.#detail?.show(deviceId);
    this.#announce(`Opened ${this.#data.device(deviceId)?.name ?? 'device'}`);
  }

  #closeDetail(): void {
    if (this.#root.dataset['mode'] !== 'detail') return;
    this.#root.dataset['mode'] = 'browse';
    this.#transition?.leaveDetail();
    this.#detail?.hide();
  }

  readonly #onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const nav = target.closest<HTMLElement>('[data-p5-nav]');
    if (nav) {
      if (nav.dataset['p5Nav'] === 'rooms') this.#openRoomId = null;
      this.#setSection(nav.dataset['p5Nav'] as SectionId);
      return;
    }
    const openRoom = target.closest<HTMLElement>('[data-p5-open-room]');
    if (openRoom?.dataset['p5OpenRoom']) {
      this.#openRoomId = openRoom.dataset['p5OpenRoom'];
      this.#setSection('rooms');
      return;
    }
    if (target.closest('[data-p5-rooms-back]')) {
      this.#openRoomId = null;
      this.#render();
      return;
    }
    const open = target.closest<HTMLElement>('[data-p5-open]');
    if (open?.dataset['p5Open']) {
      this.#openDetail(open.dataset['p5Open'], open.getBoundingClientRect());
      return;
    }
    if (target.closest('[data-p5-close]')) this.#closeDetail();
  };

  readonly #onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.#closeDetail();
  };

  public dispose(): void {
    if (this.#refreshRaf) cancelAnimationFrame(this.#refreshRaf);
    this.#refreshRaf = 0;
    this.#root.removeEventListener('click', this.#onClick);
    window.removeEventListener('keydown', this.#onKeydown);
    this.#disposePreviews();
    this.#carousel?.dispose();
    this.#detail?.hide();
    this.#transition?.dispose();
  }
}

export { AdaptiveControlTray };
