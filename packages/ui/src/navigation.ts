import { UiNavigationModel } from './navigation-model.js';
import type {
  UiNavigationDevice,
  UiNavigationLocation,
  UiNavigationOptions,
  UiNavigationRoom,
  UiNavigationSnapshot,
} from './navigation-types.js';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export class UiNavigation {
  readonly #root: HTMLElement;
  readonly #host: HTMLElement;
  readonly #model: UiNavigationModel;
  readonly #onNavigate: ((location: UiNavigationLocation) => void) | undefined;
  readonly #unsubscribe: () => void;

  public constructor(options: UiNavigationOptions) {
    this.#root = options.root;
    this.#onNavigate = options.onNavigate;
    this.#host = document.createElement('nav');
    this.#host.className = 'ui-navigation';
    this.#host.setAttribute('aria-label', 'Home navigation');

    const shell = this.#root.querySelector<HTMLElement>('[data-ui-shell]');
    const stage = this.#root.querySelector<HTMLElement>('[data-ui-stage]');
    if (!shell || !stage) throw new Error('UI Foundation shell is required before navigation');
    shell.insertBefore(this.#host, stage);

    this.#model = new UiNavigationModel(options.rooms ?? [], options.devices ?? []);
    this.#host.addEventListener('click', this.#handleClick);
    this.#host.addEventListener('keydown', this.#handleKeydown);
    this.#unsubscribe = this.#model.subscribe((snapshot) => {
      this.#render(snapshot);
      this.#onNavigate?.({ roomId: snapshot.roomId, deviceId: snapshot.deviceId });
    });
  }

  public snapshot(): UiNavigationSnapshot {
    return this.#model.snapshot();
  }

  public setItems(
    rooms: readonly UiNavigationRoom[],
    devices: readonly UiNavigationDevice[],
  ): void {
    this.#model.setItems(rooms, devices);
  }

  public selectRoom(roomId: string): void {
    this.#model.selectRoom(roomId);
  }

  public selectDevice(deviceId: string): void {
    this.#model.selectDevice(deviceId);
  }

  public back(): void {
    this.#model.back();
  }

  public forward(): void {
    this.#model.forward();
  }

  public dispose(): void {
    this.#unsubscribe();
    this.#host.removeEventListener('click', this.#handleClick);
    this.#host.removeEventListener('keydown', this.#handleKeydown);
    this.#host.remove();
  }

  readonly #handleClick = (event: Event): void => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-navigation-action]')
        : null;
    const action = target?.dataset['navigationAction'];
    const id = target?.dataset['navigationId'];

    if (action === 'toggle-rooms') this.#model.toggleMenu('rooms');
    if (action === 'toggle-devices') this.#model.toggleMenu('devices');
    if (action === 'select-room' && id) this.#model.selectRoom(id);
    if (action === 'select-device' && id) this.#model.selectDevice(id);
    if (action === 'back') this.#model.back();
    if (action === 'forward') this.#model.forward();
  };

  readonly #handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.#model.closeMenu();
      return;
    }

    const target = event.target instanceof HTMLElement ? event.target : null;
    const list = target?.closest<HTMLElement>('[role="listbox"]');
    if (!list || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

    const items = [...list.querySelectorAll<HTMLElement>('[role="option"]')];
    if (items.length === 0) return;
    event.preventDefault();
    const current = Math.max(0, items.indexOf(target ?? items[0]!));
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length;
    items[index]?.focus();
  };

  #render(snapshot: UiNavigationSnapshot): void {
    const room = snapshot.rooms.find((item) => item.id === snapshot.roomId);
    const availableDevices = snapshot.devices.filter((device) => device.roomId === snapshot.roomId);
    const device = snapshot.devices.find((item) => item.id === snapshot.deviceId);

    this.#host.innerHTML = `
      <div class="ui-navigation-history" aria-label="Navigation history">
        <button class="ui-nav-icon" type="button" data-navigation-action="back" aria-label="Go back" ${snapshot.canGoBack ? '' : 'disabled'}>←</button>
        <button class="ui-nav-icon" type="button" data-navigation-action="forward" aria-label="Go forward" ${snapshot.canGoForward ? '' : 'disabled'}>→</button>
      </div>
      <div class="ui-navigation-selectors">
        ${this.#selector('rooms', 'Room', room?.name ?? 'No rooms', snapshot.menu === 'rooms', snapshot.rooms, snapshot.roomId)}
        <span class="ui-navigation-separator" aria-hidden="true">/</span>
        ${this.#selector('devices', 'Device', device?.name ?? 'No devices', snapshot.menu === 'devices', availableDevices, snapshot.deviceId)}
      </div>
      <div class="ui-navigation-context" aria-live="polite">
        <span>${escapeHtml(room?.name ?? 'No room')}</span>
        <strong>${escapeHtml(device?.name ?? 'No device')}</strong>
      </div>
    `;
  }

  #selector(
    kind: 'rooms' | 'devices',
    label: string,
    value: string,
    open: boolean,
    items: readonly (UiNavigationRoom | UiNavigationDevice)[],
    selectedId: string | null,
  ): string {
    const singular = kind === 'rooms' ? 'room' : 'device';
    return `
      <div class="ui-nav-selector" data-open="${String(open)}">
        <button class="ui-nav-trigger" type="button" data-navigation-action="toggle-${kind}" aria-haspopup="listbox" aria-expanded="${String(open)}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <i aria-hidden="true">⌄</i>
        </button>
        <div class="ui-nav-menu" ${open ? '' : 'hidden'} role="listbox" aria-label="Select ${singular}">
          ${items
            .map(
              (item) => `
                <button type="button" role="option" aria-selected="${String(item.id === selectedId)}" data-navigation-action="select-${singular}" data-navigation-id="${escapeHtml(item.id)}">
                  <span>${escapeHtml(item.name)}</span>
                  ${'available' in item && item.available === false ? '<small>Offline</small>' : ''}
                </button>`,
            )
            .join('')}
        </div>
      </div>
    `;
  }
}
