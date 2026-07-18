/**
 * Persistent global navigation — Home, Rooms (selector), Alarm, Settings and
 * Search stay fixed across every section including Device Detail. The rooms
 * selector is one item inside the navigation, never a replacement for it.
 */

import type { RoomView } from './experience-model.js';

export type NavSection =
  | { readonly kind: 'home' }
  | { readonly kind: 'room'; readonly roomId: string }
  | { readonly kind: 'alarm' }
  | { readonly kind: 'settings' };

export type NavItemId = 'home' | 'rooms' | 'alarm' | 'settings';

/** Pure: which top-level item is active for a section. */
export const navActiveItem = (section: NavSection): NavItemId => {
  switch (section.kind) {
    case 'home':
      return 'home';
    case 'room':
      return 'rooms';
    case 'alarm':
      return 'alarm';
    case 'settings':
      return 'settings';
  }
};

/** Pure: readable label for the rooms item, reflecting the active room. */
export const roomsItemLabel = (section: NavSection, rooms: readonly RoomView[]): string => {
  if (section.kind !== 'room') return 'Rooms';
  return rooms.find((room) => room.id === section.roomId)?.name ?? 'Rooms';
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export interface NavigationBarOptions {
  readonly root: HTMLElement;
  readonly onNavigate: (section: NavSection) => void;
  readonly onSearch: () => void;
}

export class NavigationBar {
  readonly #root: HTMLElement;
  readonly #onNavigate: (section: NavSection) => void;
  readonly #onSearch: () => void;
  #rooms: readonly RoomView[] = [];
  #section: NavSection = { kind: 'home' };
  #menuOpen = false;

  public constructor(options: NavigationBarOptions) {
    this.#root = options.root;
    this.#onNavigate = options.onNavigate;
    this.#onSearch = options.onSearch;
    this.#root.classList.add('p5-nav');
    this.#root.setAttribute('aria-label', 'Primary');
    this.#root.addEventListener('click', this.#onClick);
    document.addEventListener('pointerdown', this.#onDocumentPointerDown);
    this.#render();
  }

  public get menuOpen(): boolean {
    return this.#menuOpen;
  }

  public setRooms(rooms: readonly RoomView[]): void {
    this.#rooms = rooms;
    this.#render();
  }

  public setSection(section: NavSection): void {
    this.#section = section;
    this.#menuOpen = false;
    this.#render();
  }

  public closeMenu(restoreFocus = false): void {
    if (!this.#menuOpen) return;
    this.#menuOpen = false;
    this.#render();
    if (restoreFocus) this.#root.querySelector<HTMLButtonElement>('[data-p5-nav-rooms]')?.focus();
  }

  public dispose(): void {
    this.#root.removeEventListener('click', this.#onClick);
    document.removeEventListener('pointerdown', this.#onDocumentPointerDown);
    this.#root.innerHTML = '';
    this.#root.classList.remove('p5-nav');
  }

  #render(): void {
    const active = navActiveItem(this.#section);
    const current = (id: NavItemId): string => (active === id ? 'page' : 'false');
    this.#root.innerHTML = `
      <span class="p5-nav-brand" aria-hidden="true"><span class="p5-nav-mark"></span></span>
      <div class="p5-nav-items">
        <button type="button" data-p5-nav-home aria-current="${current('home')}">Home</button>
        <div class="p5-nav-rooms-wrap">
          <button type="button" data-p5-nav-rooms aria-current="${current('rooms')}" aria-expanded="${this.#menuOpen}" aria-haspopup="menu">
            ${escapeHtml(roomsItemLabel(this.#section, this.#rooms))}
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>
          </button>
          <div class="p5-nav-menu" role="menu" ${this.#menuOpen ? '' : 'hidden'}>
            ${this.#rooms
              .map(
                (room) =>
                  `<button type="button" role="menuitem" data-p5-nav-room="${escapeHtml(room.id)}" aria-current="${
                    this.#section.kind === 'room' && this.#section.roomId === room.id
                  }"><span>${escapeHtml(room.name)}</span><small>${room.deviceIds.length}</small></button>`,
              )
              .join('')}
          </div>
        </div>
        <button type="button" data-p5-nav-alarm aria-current="${current('alarm')}">Alarm</button>
        <button type="button" data-p5-nav-settings aria-current="${current('settings')}">Settings</button>
      </div>
      <button class="p5-nav-search" type="button" data-p5-nav-search aria-label="Search devices">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
      </button>
    `;
  }

  readonly #onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-p5-nav-home]')) {
      this.#onNavigate({ kind: 'home' });
      return;
    }
    if (target.closest('[data-p5-nav-rooms]')) {
      this.#menuOpen = !this.#menuOpen;
      this.#render();
      return;
    }
    const room = target.closest<HTMLElement>('[data-p5-nav-room]');
    if (room?.dataset['p5NavRoom']) {
      this.#onNavigate({ kind: 'room', roomId: room.dataset['p5NavRoom'] });
      return;
    }
    if (target.closest('[data-p5-nav-alarm]')) {
      this.#onNavigate({ kind: 'alarm' });
      return;
    }
    if (target.closest('[data-p5-nav-settings]')) {
      this.#onNavigate({ kind: 'settings' });
      return;
    }
    if (target.closest('[data-p5-nav-search]')) this.#onSearch();
  };

  readonly #onDocumentPointerDown = (event: PointerEvent): void => {
    if (!this.#menuOpen) return;
    const target = event.target as Node | null;
    if (target && !this.#root.contains(target)) this.closeMenu();
  };
}
