import type { GraphicsEngine } from '@home-configurator/graphics';

import { dispatchAction, type CommandSink } from './control-map.js';
import { DeviceDetail } from './device-detail.js';
import {
  DeviceModelRegistry,
  type DeviceModelConfig,
  type DeviceModelSource,
} from './device-model-registry.js';
import {
  CATEGORY_ORDER,
  categoryLabel,
  primaryStatus,
  type DeviceView,
  type RoomView,
} from './experience-model.js';
import type { AmbientSummary } from './experience-views.js';
import { FavouriteHeroCarousel, type FavouriteCarouselItem } from './favourite-carousel.js';
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

type SectionId = 'home' | 'rooms' | 'settings' | 'alarm';
type ScenePreset = 'settle' | 'away' | 'bright' | 'night';

const NAV: readonly { readonly id: SectionId; readonly label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'settings', label: 'Settings' },
  { id: 'alarm', label: 'Alarm' },
];

export class ExperienceShell {
  public readonly stage: HTMLElement;
  public readonly canvas: HTMLCanvasElement;

  readonly #root: HTMLElement;
  readonly #data: ExperienceData;
  readonly #sink: CommandSink;
  readonly #reducedMotion: () => boolean;
  readonly #living = createDefaultLivingObjectRegistry();
  readonly #models = new DeviceModelRegistry();
  #detail: DeviceDetail | null = null;
  #transition: SpatialTransitionController | null = null;
  #carousel: FavouriteHeroCarousel | null = null;
  #section: SectionId = 'home';
  #activeRoomId: string | null = null;
  #featuredDeviceId: string | null = null;
  #detailDeviceId: string | null = null;
  #detailOpener: HTMLElement | null = null;
  #structuralKey = '';
  #refreshRaf = 0;

  public constructor(options: ExperienceShellOptions) {
    this.#root = options.root;
    this.#data = options.data;
    this.#sink = options.sink;
    this.#reducedMotion = options.reducedMotion;
    this.#root.className = 'p5';
    this.#root.dataset['mode'] = 'browse';
    this.#root.dataset['section'] = 'home';
    this.#root.innerHTML = `
      <div class="p5-atmosphere" aria-hidden="true"><span></span><span></span></div>
      <div class="p5-stage" data-p5-stage><canvas data-p5-canvas aria-label="Interactive device model"></canvas></div>
      <header class="p5-global-nav">
        <button class="p5-brand" type="button" data-p5-nav="home" aria-label="Home"><span></span><strong>Home</strong></button>
        <nav class="p5-nav-links" aria-label="Primary navigation">
          ${NAV.map((item) => `<button type="button" data-p5-nav="${item.id}" aria-current="${item.id === 'home' ? 'page' : 'false'}">${item.label}</button>`).join('')}
        </nav>
        <div class="p5-nav-actions">
          <button class="p5-room-button" type="button" data-p5-room-menu aria-expanded="false"><span data-p5-room-label>All rooms</span><span aria-hidden="true">⌄</span></button>
          <button class="p5-icon-button" type="button" data-p5-search aria-label="Search devices">⌕</button>
          <button class="p5-profile" type="button" aria-label="Account profile">MA</button>
        </div>
        <div class="p5-room-menu" data-p5-room-menu-panel hidden></div>
      </header>
      <main class="p5-surface" data-p5-surface></main>
      <section class="p5-detail" data-p5-detail aria-hidden="true">
        <button class="p5-detail-back" type="button" data-p5-close-detail>Back</button>
        <div class="p5-detail-switcher" aria-label="Switch device">
          <button type="button" data-p5-detail-prev aria-label="Previous device">←</button>
          <button type="button" data-p5-detail-next aria-label="Next device">→</button>
        </div>
        <div class="p5-detail-identity" data-p5-identity></div>
        <div class="p5-detail-readout-wrap" data-p5-readout></div>
        <div class="p5-detail-tray" data-p5-tray></div>
        <aside class="p5-detail-context" data-p5-detail-context></aside>
      </section>
      <div class="p5-search" data-p5-search-panel hidden role="dialog" aria-modal="true" aria-labelledby="p5-search-title">
        <div class="p5-search-card">
          <div><h2 id="p5-search-title">Search your home</h2><button type="button" data-p5-search-close aria-label="Close search">×</button></div>
          <input type="search" data-p5-search-input placeholder="Light, room, thermostat…" autocomplete="off" />
          <div data-p5-search-results></div>
        </div>
      </div>
      <p class="p5-sr" role="status" aria-live="polite" data-p5-announce></p>`;

    this.stage = this.#query('[data-p5-stage]');
    this.canvas = this.#query('[data-p5-canvas]');
    this.#root.addEventListener('click', this.#onClick);
    this.#root.addEventListener('input', this.#onInput);
    this.#root.addEventListener('change', this.#onChange);
    window.addEventListener('keydown', this.#onKeydown);
    window.addEventListener('scroll', this.#onScroll, { passive: true });
    document.addEventListener('pointerdown', this.#onDocumentPointerDown);
  }

  public attach(engine: GraphicsEngine): void {
    this.#transition = new SpatialTransitionController({ root: this.#root, reducedMotion: this.#reducedMotion });
    this.#detail = new DeviceDetail({
      engine,
      surface: this.stage,
      identityEl: this.#query('[data-p5-identity]'),
      readoutEl: this.#query('[data-p5-readout]'),
      trayEl: this.#query('[data-p5-tray]'),
      living: this.#living,
      models: this.#models,
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
      const key = this.#structureKey();
      if (key !== this.#structuralKey) this.#render();
      else this.#sync();
    });
  }

  public tick(deltaMs: number): void {
    this.#detail?.tick(deltaMs);
  }

  public dispose(): void {
    this.#carousel?.dispose();
    this.#detail?.hide();
    this.#root.removeEventListener('click', this.#onClick);
    this.#root.removeEventListener('input', this.#onInput);
    this.#root.removeEventListener('change', this.#onChange);
    window.removeEventListener('keydown', this.#onKeydown);
    window.removeEventListener('scroll', this.#onScroll);
    document.removeEventListener('pointerdown', this.#onDocumentPointerDown);
    this.#root.innerHTML = '';
  }

  #query<T extends HTMLElement = HTMLElement>(selector: string): T {
    const node = this.#root.querySelector<T>(selector);
    if (!node) throw new Error(`Missing shell node: ${selector}`);
    return node;
  }

  #render(): void {
    this.#carousel?.dispose();
    this.#carousel = null;
    this.#root.dataset['section'] = this.#section;
    this.#root.dataset['mode'] = this.#detailDeviceId ? 'detail' : 'browse';
    for (const button of this.#root.querySelectorAll<HTMLElement>('[data-p5-nav]'))
      button.setAttribute('aria-current', button.dataset['p5Nav'] === this.#section ? 'page' : 'false');
    this.#renderRoomMenu();

    if (this.#detailDeviceId) this.#renderDetail();
    else {
      const surface = this.#query('[data-p5-surface]');
      surface.removeAttribute('inert');
      surface.hidden = false;
      this.#query('[data-p5-detail]').setAttribute('aria-hidden', 'true');
      switch (this.#section) {
        case 'home': this.#renderHome(); break;
        case 'rooms': this.#renderRooms(); break;
        case 'settings': this.#renderSettings(); break;
        case 'alarm': this.#renderAlarm(); break;
      }
      this.#transition?.sectionChange();
    }
    this.#structuralKey = this.#structureKey();
  }

  #renderHome(): void {
    const devices = this.#homeDevices();
    this.#ensureFeatured(devices);
    const featured = this.#featuredFrom(devices);
    const ambient = this.#data.ambient();
    const rooms = this.#data.rooms();
    const lights = this.#data.devices().filter((view) => view.category === 'light');
    const climates = this.#data.devices().filter((view) => view.category === 'climate');
    const security = this.#data.devices().filter((view) => view.category === 'security');
    this.#query('[data-p5-surface]').innerHTML = `
      <section class="p5-hero" aria-labelledby="p5-hero-title">
        <div class="p5-hero-copy-panel">
          <p class="p5-eyebrow">${escapeHtml(ambient.greeting)} · ${escapeHtml(featured?.roomName ?? 'Home')}</p>
          <h1 id="p5-hero-title" data-p5-featured-name>${escapeHtml(featured?.name ?? 'Your home')}</h1>
          <p class="p5-hero-status" data-p5-featured-status>${escapeHtml(featured ? primaryStatus(featured) : ambient.statusSentence)}</p>
          <button class="p5-primary-action" type="button" data-p5-open="${escapeHtml(featured?.id ?? '')}" ${featured ? '' : 'disabled'}>${primaryActionLabel(featured)}</button>
        </div>
        <div class="p5-hero-index"><span data-p5-featured-index>01</span><i></i><span>${String(Math.max(1, devices.length)).padStart(2, '0')}</span></div>
        <div class="p5-scroll-cue"><span>Explore home</span><i></i></div>
      </section>
      <section class="p5-device-rail" aria-label="Featured devices"><div data-p5-carousel></div></section>
      <section class="p5-lower-content" aria-label="Home overview">
        <header class="p5-section-heading"><div><p class="p5-eyebrow">Live home</p><h2>Everything, in context.</h2></div><p>${escapeHtml(ambient.statusSentence)}</p></header>
        <div class="p5-summary-grid">
          ${summaryCard('Climate', ambient.comfort, `${climates.length} zones`, climates[0]?.id)}
          ${summaryCard('Lighting', `${lights.filter((view) => view.state.on).length} on`, `${lights.length} devices`, lights[0]?.id)}
          ${summaryCard('Security', ambient.security, `${security.length} devices`, security[0]?.id)}
          ${summaryCard('Air', ambient.air, 'Healthy range')}
        </div>
        <section class="p5-content-block"><div class="p5-block-title"><h3>Scenes</h3><span>Whole-home actions</span></div><div class="p5-scene-grid">${sceneCards()}</div></section>
        <section class="p5-content-block"><div class="p5-block-title"><h3>Rooms</h3><button type="button" data-p5-nav="rooms">View all</button></div><div class="p5-room-grid">${rooms.map((room) => roomCard(room, this.#data.devices())).join('')}</div></section>
        <section class="p5-content-block"><div class="p5-block-title"><h3>Recent state</h3><span>Live from Home Assistant</span></div><div class="p5-state-list">${this.#data.devices().slice(0, 8).map(deviceRow).join('')}</div></section>
      </section>`;
    this.#mountCarousel(devices);
    if (featured) this.#presentBrowse(featured, 0);
  }

  #renderRooms(): void {
    const rooms = this.#data.rooms();
    if (!this.#activeRoomId || !rooms.some((room) => room.id === this.#activeRoomId))
      this.#activeRoomId = rooms[0]?.id ?? null;
    const room = rooms.find((candidate) => candidate.id === this.#activeRoomId);
    const devices = room ? this.#data.devices().filter((view) => view.roomId === room.id) : [];
    this.#ensureFeatured(devices);
    const featured = this.#featuredFrom(devices);
    const environment = roomEnvironment(devices);
    const groups = CATEGORY_ORDER.map((category) => ({ category, devices: devices.filter((view) => view.category === category) })).filter((group) => group.devices.length);
    this.#query('[data-p5-room-label]').textContent = room?.name ?? 'Rooms';
    this.#query('[data-p5-surface]').innerHTML = `
      <section class="p5-room-hero">
        <div class="p5-room-copy"><p class="p5-eyebrow">Room</p><h1>${escapeHtml(room?.name ?? 'Rooms')}</h1><p>${devices.length} connected devices · ${environment.presence}</p></div>
        <div class="p5-room-environment">
          ${metric('Temperature', environment.temperature)}${metric('Humidity', environment.humidity)}${metric('Air quality', environment.air)}${metric('Presence', environment.presence)}
        </div>
        <div class="p5-room-featured"><p>${escapeHtml(featured ? categoryLabel(featured.category) : 'No devices')}</p><h2>${escapeHtml(featured?.name ?? 'Add a device')}</h2><strong>${escapeHtml(featured ? primaryStatus(featured) : '')}</strong><button type="button" data-p5-open="${escapeHtml(featured?.id ?? '')}" ${featured ? '' : 'disabled'}>Open controls</button></div>
      </section>
      <section class="p5-room-content">
        <div class="p5-room-tabs" role="tablist">${rooms.map((candidate) => `<button type="button" role="tab" data-p5-room="${escapeHtml(candidate.id)}" aria-selected="${candidate.id === room?.id}">${escapeHtml(candidate.name)}</button>`).join('')}</div>
        <div class="p5-room-scenes"><div class="p5-block-title"><h3>Quick scenes</h3><span>${escapeHtml(room?.name ?? '')}</span></div><div class="p5-scene-grid">${sceneCards()}</div></div>
        ${groups.map((group) => `<section class="p5-device-section"><div class="p5-block-title"><h3>${categoryLabel(group.category)}</h3><span>${group.devices.length}</span></div><div class="p5-device-card-grid">${group.devices.map(deviceCard).join('')}</div></section>`).join('')}
      </section>`;
    if (featured) this.#presentBrowse(featured, devices.indexOf(featured));
  }

  #renderSettings(): void {
    const devices = this.#data.devices();
    const selected = this.#data.device(this.#featuredDeviceId ?? '') ?? devices[0];
    if (selected) this.#featuredDeviceId = selected.id;
    const config = selected ? this.#models.config(selected.id) : this.#models.defaultConfig();
    const library = selected ? this.#models.library(selected.category) : [];
    this.#query('[data-p5-surface]').innerHTML = `
      <section class="p5-page-head"><p class="p5-eyebrow">Configuration</p><h1>Device models</h1><p>Match every Home Assistant device to a recognisable GLB or GLTF model while preserving the existing command path.</p></section>
      <section class="p5-model-configurator">
        <aside class="p5-model-device-list">${devices.map((view) => `<button type="button" data-p5-model-device="${escapeHtml(view.id)}" aria-current="${view.id === selected?.id}"><span class="p5-device-glyph" data-category="${view.category}"></span><span><strong>${escapeHtml(view.name)}</strong><small>${escapeHtml(view.roomName)}</small></span></button>`).join('')}</aside>
        <form class="p5-model-form" data-p5-model-form>
          <div class="p5-form-head"><div><p>${escapeHtml(selected?.roomName ?? '')}</p><h2>${escapeHtml(selected?.name ?? 'Select a device')}</h2><span>${escapeHtml([selected?.manufacturer, selected?.model].filter(Boolean).join(' · ') || 'Manufacturer mapping available')}</span></div><span class="p5-model-badge">${escapeHtml(this.#models.resolve(selected ?? emptyDevice()).label)}</span></div>
          <label>Model source<select name="source">${modelSourceOptions(config.source)}</select></label>
          <label>Library model<select name="libraryId"><option value="">Automatic match</option>${library.map((entry) => `<option value="${entry.id}" ${entry.id === config.libraryId ? 'selected' : ''}>${escapeHtml(entry.label)}</option>`).join('')}</select></label>
          <label class="p5-form-wide">GLB / GLTF URL<input name="url" type="url" value="${escapeHtml(config.url ?? '')}" placeholder="https://…/device.glb" /></label>
          <label class="p5-upload p5-form-wide">Upload GLB / GLTF<input name="upload" type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" /></label>
          ${rangeField('Scale', 'scale', config.transform.scale, 0.1, 4, 0.05)}
          ${rangeField('Rotation Y', 'rotationY', config.transform.rotation[1], -3.14, 3.14, 0.05)}
          ${rangeField('Vertical position', 'offsetY', config.transform.offset[1], -2, 2, 0.05)}
          ${rangeField('Roughness', 'roughness', config.transform.roughness, 0, 1, 0.05)}
          ${rangeField('Metalness', 'metalness', config.transform.metalness, 0, 1, 0.05)}
          <label>Tint<input name="tint" type="color" value="${escapeHtml(config.transform.tint)}" /></label>
          <div class="p5-model-actions p5-form-wide"><button type="button" data-p5-model-preview>Preview</button><button type="button" data-p5-model-reset>Reset</button><button class="p5-primary-action" type="button" data-p5-model-save>Save model</button></div>
        </form>
      </section>`;
    if (selected) this.#presentBrowse(selected, 0);
  }

  #renderAlarm(): void {
    const security = this.#data.devices().filter((view) => view.category === 'security');
    const locks = security.filter((view) => view.capabilities.includes('lock'));
    const secured = locks.filter((view) => view.state.locked).length;
    const featured = security[0] ?? this.#data.devices()[0];
    this.#query('[data-p5-surface]').innerHTML = `
      <section class="p5-page-head p5-alarm-head"><p class="p5-eyebrow">Security</p><h1>${secured === locks.length ? 'Home is secure.' : `${locks.length - secured} entry needs attention.`}</h1><p>Alarm, cameras, locks, and openings remain connected to the existing Home Assistant entities.</p><div class="p5-alarm-actions"><button type="button" data-p5-scene="away">Arm away</button><button type="button" data-p5-scene="settle">Disarm</button></div></section>
      <section class="p5-alarm-grid">${security.length ? security.map(deviceCard).join('') : '<p class="p5-empty">No security devices are currently exposed.</p>'}</section>`;
    if (featured) this.#presentBrowse(featured, 0);
  }

  #renderDetail(): void {
    const view = this.#data.device(this.#detailDeviceId ?? '');
    if (!view) return this.#closeDetail();
    this.#query('[data-p5-surface]').setAttribute('inert', '');
    this.#query('[data-p5-detail]').setAttribute('aria-hidden', 'false');
    this.#renderDetailContext(view);
    void this.#detail?.present(view.id, 'detail');
    this.#applyAtmosphere(view);
  }

  #renderDetailContext(view: DeviceView): void {
    const context = this.#query('[data-p5-detail-context]');
    const model = this.#models.resolve(view);
    context.innerHTML = `
      <section><p class="p5-eyebrow">Live state</p><dl><div><dt>Room</dt><dd>${escapeHtml(view.roomName)}</dd></div><div><dt>Status</dt><dd>${escapeHtml(primaryStatus(view))}</dd></div><div><dt>Availability</dt><dd>${view.available ? 'Online' : 'Unavailable'}</dd></div></dl></section>
      <section><p class="p5-eyebrow">Visual model</p><strong>${escapeHtml(model.label)}</strong><small>${escapeHtml([view.manufacturer, view.model].filter(Boolean).join(' · ') || 'Automatic category mapping')}</small><button type="button" data-p5-configure="${escapeHtml(view.id)}">Configure model</button></section>
      <section><p class="p5-eyebrow">Context</p><p>Controls, scenes, and automations affecting this device stay within the shared Home Assistant state model.</p></section>`;
  }

  #mountCarousel(devices: readonly DeviceView[]): void {
    const host = this.#root.querySelector<HTMLElement>('[data-p5-carousel]');
    if (!host || !devices.length) return;
    const items = devices.map((view) => this.#carouselItem(view));
    this.#carousel = new FavouriteHeroCarousel({
      root: host,
      items,
      onSelect: (item, origin) => this.#openDetail(item.id, origin),
      onActiveChange: (item, index) => {
        const previous = this.#featuredDeviceId;
        this.#featuredDeviceId = item.id;
        const view = this.#data.device(item.id);
        if (view) {
          this.#syncHero(view, index);
          if (previous && previous !== item.id) this.#transition?.switchDevice(index > devices.findIndex((candidate) => candidate.id === previous) ? 1 : -1);
          void this.#detail?.present(item.id, 'browse');
        }
      },
    });
  }

  #carouselItem(view: DeviceView): FavouriteCarouselItem {
    return { id: view.id, name: view.name, room: view.roomName, category: categoryLabel(view.category), categoryKey: view.category, status: primaryStatus(view) };
  }

  #presentBrowse(view: DeviceView, index: number): void {
    this.#featuredDeviceId = view.id;
    this.#syncHero(view, index);
    this.#applyAtmosphere(view);
    void this.#detail?.present(view.id, 'browse');
  }

  #syncHero(view: DeviceView, index = 0): void {
    const name = this.#root.querySelector<HTMLElement>('[data-p5-featured-name]');
    const status = this.#root.querySelector<HTMLElement>('[data-p5-featured-status]');
    const counter = this.#root.querySelector<HTMLElement>('[data-p5-featured-index]');
    if (name) name.textContent = view.name;
    if (status) status.textContent = primaryStatus(view);
    if (counter) counter.textContent = String(index + 1).padStart(2, '0');
  }

  #sync(): void {
    this.#detail?.sync();
    if (this.#detailDeviceId) {
      const view = this.#data.device(this.#detailDeviceId);
      if (view) this.#renderDetailContext(view);
      return;
    }
    const devices = this.#contextDevices();
    const featured = this.#featuredFrom(devices);
    if (featured) this.#syncHero(featured, Math.max(0, devices.indexOf(featured)));
    this.#carousel?.updateItems(devices.map((view) => this.#carouselItem(view)));
    for (const node of this.#root.querySelectorAll<HTMLElement>('[data-p5-device-status]')) {
      const view = this.#data.device(node.dataset['p5DeviceStatus'] ?? '');
      if (view) node.textContent = primaryStatus(view);
    }
  }

  #setSection(section: SectionId): void {
    if (this.#detailDeviceId) this.#detailDeviceId = null;
    this.#section = section;
    this.#root.dataset['mode'] = 'browse';
    this.#detail?.setMode('browse');
    window.scrollTo({ top: 0, behavior: this.#reducedMotion() ? 'auto' : 'smooth' });
    this.#render();
  }

  #openDetail(deviceId: string, origin?: DOMRect): void {
    const view = this.#data.device(deviceId);
    if (!view) return;
    this.#detailOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.#detailDeviceId = deviceId;
    this.#root.dataset['mode'] = 'detail';
    this.#query('[data-p5-detail]').setAttribute('aria-hidden', 'false');
    this.#transition?.enterDetail(origin);
    this.#renderDetail();
    window.setTimeout(() => this.#query<HTMLButtonElement>('[data-p5-close-detail]').focus(), this.#reducedMotion() ? 0 : 240);
  }

  #closeDetail(): void {
    if (!this.#detailDeviceId) return;
    this.#detailDeviceId = null;
    this.#root.dataset['mode'] = 'browse';
    this.#transition?.leaveDetail();
    this.#detail?.setMode('browse');
    this.#query('[data-p5-detail]').setAttribute('aria-hidden', 'true');
    this.#query('[data-p5-surface]').removeAttribute('inert');
    this.#render();
    this.#detailOpener?.focus();
  }

  #switchDetail(direction: number): void {
    const devices = this.#contextDevices();
    const index = devices.findIndex((view) => view.id === this.#detailDeviceId);
    if (index < 0 || !devices.length) return;
    const next = devices[(index + direction + devices.length) % devices.length];
    if (!next) return;
    this.#detailDeviceId = next.id;
    this.#transition?.switchDevice(direction);
    this.#renderDetail();
    this.#announce(`${next.name}, ${primaryStatus(next)}`);
  }

  #renderRoomMenu(): void {
    const panel = this.#query('[data-p5-room-menu-panel]');
    panel.innerHTML = `<button type="button" data-p5-all-rooms>All rooms</button>${this.#data.rooms().map((room) => `<button type="button" data-p5-room="${escapeHtml(room.id)}"><span>${escapeHtml(room.name)}</span><small>${room.deviceIds.length}</small></button>`).join('')}`;
  }

  #toggleRoomMenu(open?: boolean): void {
    const panel = this.#query('[data-p5-room-menu-panel]');
    const button = this.#query('[data-p5-room-menu]');
    const next = open ?? panel.hidden;
    panel.hidden = !next;
    button.setAttribute('aria-expanded', String(next));
  }

  #openSearch(): void {
    const panel = this.#query('[data-p5-search-panel]');
    panel.hidden = false;
    this.#renderSearch('');
    window.setTimeout(() => this.#query<HTMLInputElement>('[data-p5-search-input]').focus(), 0);
  }

  #closeSearch(): void {
    this.#query('[data-p5-search-panel]').hidden = true;
  }

  #renderSearch(query: string): void {
    const term = query.trim().toLowerCase();
    const results = this.#data.devices().filter((view) => !term || `${view.name} ${view.roomName} ${view.manufacturer ?? ''} ${view.model ?? ''}`.toLowerCase().includes(term));
    this.#query('[data-p5-search-results]').innerHTML = results.length ? results.slice(0, 12).map(deviceRow).join('') : '<p class="p5-empty">No matching devices.</p>';
  }

  async #previewModel(): Promise<void> {
    const view = this.#data.device(this.#featuredDeviceId ?? '');
    if (!view) return;
    this.#models.setPreview(view.id, this.#readModelConfig(view.id));
    await this.#detail?.reload();
    this.#announce(`Previewing model for ${view.name}`);
  }

  async #saveModel(): Promise<void> {
    const view = this.#data.device(this.#featuredDeviceId ?? '');
    if (!view) return;
    this.#models.save(view.id, this.#readModelConfig(view.id));
    await this.#detail?.reload();
    this.#announce(`Saved model for ${view.name}`);
    this.#renderSettings();
  }

  async #resetModel(): Promise<void> {
    const view = this.#data.device(this.#featuredDeviceId ?? '');
    if (!view) return;
    this.#models.reset(view.id);
    await this.#detail?.reload();
    this.#announce(`Reset model for ${view.name}`);
    this.#renderSettings();
  }

  #readModelConfig(deviceId: string): DeviceModelConfig {
    const form = this.#query<HTMLFormElement>('[data-p5-model-form]');
    const data = new FormData(form);
    const current = this.#models.config(deviceId);
    const source = modelSource(formString(data, 'source', 'automatic'));
    const libraryId = formString(data, 'libraryId', '');
    const url = formString(data, 'url', '');
    return {
      source,
      ...(libraryId ? { libraryId } : {}),
      ...(url ? { url } : {}),
      ...(current.uploadId ? { uploadId: current.uploadId } : {}),
      transform: {
        scale: numberValue(data, 'scale', 1),
        rotation: [current.transform.rotation[0], numberValue(data, 'rotationY', 0), current.transform.rotation[2]],
        offset: [current.transform.offset[0], numberValue(data, 'offsetY', 0), current.transform.offset[2]],
        roughness: numberValue(data, 'roughness', 0.42),
        metalness: numberValue(data, 'metalness', 0.12),
        tint: formString(data, 'tint', '#ffffff'),
      },
    };
  }

  async #handleUpload(input: HTMLInputElement): Promise<void> {
    const view = this.#data.device(this.#featuredDeviceId ?? '');
    const file = input.files?.[0];
    if (!view || !file) return;
    const uploadId = await this.#models.saveUpload(view.id, file);
    const config = this.#readModelConfig(view.id);
    this.#models.setPreview(view.id, { ...config, source: 'upload', uploadId });
    await this.#detail?.reload();
    const source = this.#query<HTMLSelectElement>('[name="source"]');
    source.value = 'upload';
    this.#announce(`Loaded ${file.name}`);
  }

  #runScene(scene: ScenePreset): void {
    const devices = this.#section === 'rooms' && this.#activeRoomId
      ? this.#data.devices().filter((view) => view.roomId === this.#activeRoomId)
      : this.#data.devices();
    const tasks: Promise<unknown>[] = [];
    const send = (view: DeviceView, action: string): void => {
      const result = dispatchAction(this.#sink, view, action);
      if (result) tasks.push(result);
    };
    for (const view of devices) {
      if (scene === 'away') {
        if (view.category === 'light' && view.state.on) send(view, 'power');
        if (view.category === 'cover') send(view, 'cover.close');
        if (view.category === 'security' && view.capabilities.includes('lock') && !view.state.locked) send(view, 'lock.toggle');
      } else if (scene === 'bright' && view.category === 'light') {
        if (!view.state.on) send(view, 'power');
        send(view, 'brightness:0.9');
      } else if (scene === 'night') {
        if (view.category === 'light' && view.state.on) send(view, 'brightness:0.18');
        if (view.category === 'cover') send(view, 'cover.close');
      } else if (scene === 'settle' && view.category === 'light' && !view.state.on) send(view, 'power');
    }
    this.#announce(`${sceneLabel(scene)} scene started`);
    void Promise.allSettled(tasks).then(() => window.setTimeout(() => this.refresh(), 80));
  }

  #homeDevices(): readonly DeviceView[] {
    const favourites = this.#data.favourites();
    return favourites.length ? favourites : this.#data.devices().slice(0, 8);
  }

  #contextDevices(): readonly DeviceView[] {
    if (this.#section === 'rooms' && this.#activeRoomId)
      return this.#data.devices().filter((view) => view.roomId === this.#activeRoomId);
    if (this.#section === 'home') return this.#homeDevices();
    return this.#data.devices();
  }

  #ensureFeatured(devices: readonly DeviceView[]): void {
    if (!this.#featuredDeviceId || !devices.some((view) => view.id === this.#featuredDeviceId))
      this.#featuredDeviceId = devices[0]?.id ?? null;
  }

  #featuredFrom(devices: readonly DeviceView[]): DeviceView | undefined {
    return devices.find((view) => view.id === this.#featuredDeviceId) ?? devices[0];
  }

  #applyAtmosphere(view: DeviceView): void {
    const values = atmosphere(view);
    this.#root.style.setProperty('--p5-hue', String(values.hue));
    this.#root.style.setProperty('--p5-intensity', String(values.intensity));
    this.#root.style.setProperty('--p5-daylight', String(values.daylight));
  }

  #structureKey(): string {
    return `${this.#section}|${this.#activeRoomId ?? ''}|${this.#detailDeviceId ?? ''}|${this.#data.rooms().map((room) => `${room.id}:${room.deviceIds.join(',')}`).join('|')}|${this.#data.devices().map((view) => `${view.id}:${view.category}`).join('|')}`;
  }

  #announce(message: string): void {
    this.#query('[data-p5-announce]').textContent = message;
  }

  readonly #onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const nav = target?.closest<HTMLElement>('[data-p5-nav]')?.dataset['p5Nav'] as SectionId | undefined;
    if (nav) return this.#setSection(nav);
    if (target?.closest('[data-p5-room-menu]')) return this.#toggleRoomMenu();
    if (target?.closest('[data-p5-search]')) return this.#openSearch();
    if (target?.closest('[data-p5-search-close]')) return this.#closeSearch();
    if (target?.closest('[data-p5-close-detail]')) return this.#closeDetail();
    if (target?.closest('[data-p5-detail-prev]')) return this.#switchDetail(-1);
    if (target?.closest('[data-p5-detail-next]')) return this.#switchDetail(1);
    const room = target?.closest<HTMLElement>('[data-p5-room]')?.dataset['p5Room'];
    if (room) {
      this.#activeRoomId = room;
      this.#section = 'rooms';
      this.#featuredDeviceId = null;
      this.#toggleRoomMenu(false);
      return this.#render();
    }
    if (target?.closest('[data-p5-all-rooms]')) {
      this.#activeRoomId = this.#data.rooms()[0]?.id ?? null;
      this.#section = 'rooms';
      this.#toggleRoomMenu(false);
      return this.#render();
    }
    const searchResult = target?.closest<HTMLElement>('[data-p5-device]')?.dataset['p5Device'];
    if (searchResult) {
      this.#closeSearch();
      return this.#openDetail(searchResult);
    }
    const open = target?.closest<HTMLElement>('[data-p5-open]');
    if (open?.dataset['p5Open']) return this.#openDetail(open.dataset['p5Open'], open.getBoundingClientRect());
    const scene = target?.closest<HTMLElement>('[data-p5-scene]')?.dataset['p5Scene'] as ScenePreset | undefined;
    if (scene) return this.#runScene(scene);
    const modelDevice = target?.closest<HTMLElement>('[data-p5-model-device]')?.dataset['p5ModelDevice'];
    if (modelDevice) { this.#featuredDeviceId = modelDevice; return this.#renderSettings(); }
    if (target?.closest('[data-p5-model-preview]')) { void this.#previewModel(); return; }
    if (target?.closest('[data-p5-model-save]')) { void this.#saveModel(); return; }
    if (target?.closest('[data-p5-model-reset]')) { void this.#resetModel(); return; }
    const configure = target?.closest<HTMLElement>('[data-p5-configure]')?.dataset['p5Configure'];
    if (configure) { this.#featuredDeviceId = configure; this.#detailDeviceId = null; this.#section = 'settings'; return this.#render(); }
  };

  readonly #onInput = (event: Event): void => {
    const input = event.target as HTMLInputElement | null;
    if (input?.matches('[data-p5-search-input]')) this.#renderSearch(input.value);
  };

  readonly #onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement | null;
    if (input?.matches('[name="upload"]')) void this.#handleUpload(input);
  };

  readonly #onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      if (!this.#query('[data-p5-search-panel]').hidden) this.#closeSearch();
      else if (this.#detailDeviceId) this.#closeDetail();
      else this.#toggleRoomMenu(false);
    } else if (event.key === '/' && !isEditable(event.target)) {
      event.preventDefault();
      this.#openSearch();
    } else if (this.#detailDeviceId && event.key === 'ArrowLeft') this.#switchDetail(-1);
    else if (this.#detailDeviceId && event.key === 'ArrowRight') this.#switchDetail(1);
  };

  readonly #onScroll = (): void => {
    const hero = this.#root.querySelector<HTMLElement>('.p5-hero, .p5-room-hero');
    if (!hero) return;
    this.#transition?.setScrollProgress(Math.min(1, window.scrollY / Math.max(1, hero.offsetHeight * 0.75)));
  };

  readonly #onDocumentPointerDown = (event: PointerEvent): void => {
    const target = event.target as Node | null;
    const panel = this.#query('[data-p5-room-menu-panel]');
    if (!panel.hidden && target && !panel.contains(target) && !this.#query('[data-p5-room-menu]').contains(target)) this.#toggleRoomMenu(false);
  };
}

const summaryCard = (title: string, value: string, note: string, deviceId?: string): string =>
  `<${deviceId ? 'button' : 'article'} class="p5-summary-card" ${deviceId ? `type="button" data-p5-open="${escapeHtml(deviceId)}"` : ''}><span>${escapeHtml(title)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></${deviceId ? 'button' : 'article'}>`;
const sceneCards = (): string => (['settle', 'bright', 'night', 'away'] as ScenePreset[]).map((scene) => `<button type="button" class="p5-scene-card" data-p5-scene="${scene}"><span>${sceneIcon(scene)}</span><strong>${sceneLabel(scene)}</strong><small>${sceneDescription(scene)}</small></button>`).join('');
const sceneLabel = (scene: ScenePreset): string => ({ settle: 'Settle in', away: 'Away', bright: 'Bright', night: 'Night' })[scene];
const sceneDescription = (scene: ScenePreset): string => ({ settle: 'Welcome lighting', away: 'Secure and power down', bright: 'Lift every light', night: 'Quiet the house' })[scene];
const sceneIcon = (scene: ScenePreset): string => ({ settle: '◒', away: '⌂', bright: '☼', night: '◐' })[scene];
const primaryActionLabel = (view?: DeviceView): string => !view ? 'No device' : view.category === 'cleaning' ? (view.state.cleaning ? 'Cleaning now' : 'Open vacuum') : view.category === 'climate' ? 'Adjust climate' : view.category === 'security' ? 'View security' : 'Open controls';
const metric = (label: string, value: string): string => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
const roomCard = (room: RoomView, all: readonly DeviceView[]): string => {
  const devices = all.filter((view) => view.roomId === room.id);
  return `<button type="button" class="p5-room-card" data-p5-room="${escapeHtml(room.id)}"><span>${String(devices.length).padStart(2, '0')}</span><strong>${escapeHtml(room.name)}</strong><small>${escapeHtml(devices.filter((view) => view.state.on || view.state.cleaning || view.state.playing).length ? 'Active now' : 'Settled')}</small></button>`;
};
const deviceRow = (view: DeviceView): string => `<button type="button" class="p5-device-row" data-p5-device="${escapeHtml(view.id)}" data-p5-open="${escapeHtml(view.id)}"><span class="p5-device-glyph" data-category="${view.category}"></span><span><strong>${escapeHtml(view.name)}</strong><small>${escapeHtml(view.roomName)} · ${escapeHtml(categoryLabel(view.category))}</small></span><em data-p5-device-status="${escapeHtml(view.id)}">${escapeHtml(primaryStatus(view))}</em></button>`;
const deviceCard = (view: DeviceView): string => `<button type="button" class="p5-device-card" data-p5-open="${escapeHtml(view.id)}"><span class="p5-device-glyph" data-category="${view.category}"></span><span><small>${escapeHtml(categoryLabel(view.category))}</small><strong>${escapeHtml(view.name)}</strong></span><em data-p5-device-status="${escapeHtml(view.id)}">${escapeHtml(primaryStatus(view))}</em></button>`;
const rangeField = (label: string, name: string, value: number, min: number, max: number, step: number): string => `<label>${escapeHtml(label)}<input name="${name}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" /></label>`;
const modelSourceOptions = (selected: DeviceModelSource): string => ([['automatic', 'Automatic match'], ['library', 'Model library'], ['url', 'GLB / GLTF URL'], ['upload', 'Uploaded model'], ['procedural', 'Procedural fallback']] as const).map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
const formString = (data: FormData, key: string, fallback: string): string => { const value = data.get(key); return typeof value === 'string' ? value : fallback; };
const modelSource = (value: string): DeviceModelSource => { switch (value) { case 'automatic': case 'library': case 'url': case 'upload': case 'procedural': return value; default: return 'automatic'; } };
const numberValue = (data: FormData, key: string, fallback: number): number => { const value = Number(data.get(key)); return Number.isFinite(value) ? value : fallback; };
const isEditable = (target: EventTarget | null): boolean => target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
const escapeHtml = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const roomEnvironment = (devices: readonly DeviceView[]): { temperature: string; humidity: string; air: string; presence: string } => {
  const climate = devices.find((view) => view.category === 'climate');
  const sensor = devices.find((view) => view.category === 'sensor');
  const presence = devices.find((view) => view.entityIds.some((id) => id.includes('presence') || id.includes('occupancy')));
  return {
    temperature: `${(climate?.state.currentTemp ?? sensor?.state.currentTemp ?? 22).toFixed(1)}°`,
    humidity: `${Math.round(sensor?.state.humidity ?? climate?.state.humidity ?? 45)}%`,
    air: devices.some((view) => view.entityIds.some((id) => id.includes('air_quality'))) ? 'Live' : 'Good',
    presence: presence?.state.on ? 'Occupied' : 'Clear',
  };
};

const atmosphere = (view: DeviceView): { hue: number; intensity: number; daylight: number } => {
  switch (view.category) {
    case 'light': return { hue: view.state.hue, intensity: view.state.on ? 0.55 + view.state.brightness * 0.45 : 0.2, daylight: 0.45 };
    case 'climate': return { hue: view.state.targetTemp < 22 ? 205 : 24, intensity: 0.52, daylight: 0.4 };
    case 'cover': return { hue: 38, intensity: 0.45, daylight: Math.max(0.2, view.state.position / 100) };
    case 'media': return { hue: 258, intensity: view.state.playing ? 0.68 : 0.36, daylight: 0.24 };
    case 'cleaning': return { hue: 178, intensity: 0.46, daylight: 0.36 };
    case 'security': return { hue: view.state.locked ? 152 : 8, intensity: 0.42, daylight: 0.3 };
    default: return { hue: 36, intensity: 0.38, daylight: 0.42 };
  }
};

const emptyDevice = (): DeviceView => ({
  id: '', name: '', roomId: '', roomName: '', entityIds: [], category: 'appliance', capabilities: [], favourite: false, available: false,
  state: { on: false, available: false, brightness: 0, hue: 0, saturation: 0, colourTempK: 3200, targetTemp: 22, currentTemp: 22, humidity: 45, hvac: 'off', fan: 'auto', volume: 0, playing: false, source: '', position: 0, locked: true, cleaning: false, docked: true, battery: 0, privacy: false, recording: false, reading: '', pending: false },
});
