import type {
  CanonicalDevice,
  ConfirmedRuntimeSnapshot,
} from '@home-configurator/home-assistant';

import { buildNavigationModel, createUiSnapshot, initialUiState, reduceUiState } from './state.js';
import type { UiAction, UiDiagnostics, UiState } from './types.js';

export interface HomeConfiguratorUiOptions {
  readonly root: HTMLElement;
  readonly version: string;
  readonly onRoomSelected?: (roomId: string) => void;
  readonly onDeviceSelected?: (deviceId: string) => void;
  readonly onDeviceAction?: (deviceId: string, capability: string, action: string) => void;
}

const emptyHome = (): ConfirmedRuntimeSnapshot => ({
  status: 'uninitialized',
  rooms: [],
  devices: [],
  states: {},
  observedAt: 0,
  stale: true,
});

const escapeHtml = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const capabilityLabel = (capability: string): string =>
  capability.replaceAll(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());

const primaryAction = (capability: string): string => {
  if (capability === 'power') return 'toggle';
  if (capability === 'vacuumCleaning') return 'start';
  if (capability === 'vacuumReturnHome') return 'return_home';
  if (capability === 'mediaPlayback') return 'play_pause';
  if (capability === 'lock') return 'toggle';
  return 'adjust';
};

export class HomeConfiguratorUi {
  readonly #root: HTMLElement;
  readonly #options: HomeConfiguratorUiOptions;
  #state: UiState = initialUiState;
  #home: ConfirmedRuntimeSnapshot = emptyHome();
  #diagnostics: UiDiagnostics = {
    runtimePhase: 'idle',
    homeAssistantStatus: 'uninitialized',
    frame: 0,
    gestures: 0,
  };

  public readonly stage: HTMLElement;
  public readonly canvas: HTMLCanvasElement;

  public constructor(options: HomeConfiguratorUiOptions) {
    this.#root = options.root;
    this.#options = options;
    this.#root.innerHTML = this.#shellMarkup(options.version);
    const stage = this.#root.querySelector<HTMLElement>('[data-ui-stage]');
    const canvas = this.#root.querySelector<HTMLCanvasElement>('[data-ui-canvas]');
    if (!stage || !canvas) throw new Error('UI Engine failed to create the graphics stage');
    this.stage = stage;
    this.canvas = canvas;
    this.#root.addEventListener('click', this.#onClick);
    this.#root.addEventListener('keydown', this.#onKeyDown);
    this.#render();
  }

  public setHome(snapshot: ConfirmedRuntimeSnapshot): void {
    this.#home = snapshot;
    const selection = this.#state.selection;
    const roomExists = !selection.roomId || snapshot.rooms.some((room) => room.id === selection.roomId);
    const deviceExists =
      !selection.deviceId || snapshot.devices.some((device) => device.id === selection.deviceId);
    if (!roomExists || !deviceExists) {
      this.#state = { ...this.#state, selection: {}, overlay: null };
    }
    this.#render();
  }

  public setDiagnostics(diagnostics: UiDiagnostics): void {
    this.#diagnostics = diagnostics;
    this.#renderDiagnostics();
  }

  public setRuntimeStatus(status: string): void {
    const node = this.#root.querySelector<HTMLElement>('[data-ui-runtime-status]');
    if (node) node.textContent = status;
  }

  public selectDevice(deviceId: string): void {
    const device = this.#home.devices.find((candidate) => candidate.id === deviceId);
    if (!device) return;
    this.#dispatch({ type: 'select-device', deviceId, roomId: device.roomId });
  }

  public dispose(): void {
    this.#root.removeEventListener('click', this.#onClick);
    this.#root.removeEventListener('keydown', this.#onKeyDown);
  }

  #dispatch(action: UiAction): void {
    this.#state = reduceUiState(this.#state, action);
    if (action.type === 'select-room') this.#options.onRoomSelected?.(action.roomId);
    if (action.type === 'select-device') this.#options.onDeviceSelected?.(action.deviceId);
    this.#render();
  }

  readonly #onClick = (event: Event): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ui-action]') : null;
    if (!target) return;
    const action = target.dataset['uiAction'];
    if (action === 'toggle-navigation') this.#dispatch({ type: 'toggle-navigation' });
    else if (action === 'close-overlays') this.#dispatch({ type: 'close-overlays' });
    else if (action === 'show-rooms') this.#dispatch({ type: 'set-navigation-mode', mode: 'rooms' });
    else if (action === 'show-devices') this.#dispatch({ type: 'set-navigation-mode', mode: 'devices' });
    else if (action === 'open-diagnostics') this.#dispatch({ type: 'open-diagnostics' });
    else if (action === 'select-room' && target.dataset['id']) {
      this.#dispatch({ type: 'select-room', roomId: target.dataset['id'] });
    } else if (action === 'select-device' && target.dataset['id']) {
      const device = this.#home.devices.find((candidate) => candidate.id === target.dataset['id']);
      if (device) this.#dispatch({ type: 'select-device', deviceId: device.id, roomId: device.roomId });
    } else if (action === 'device-action') {
      const deviceId = target.dataset['deviceId'];
      const capability = target.dataset['capability'];
      const deviceAction = target.dataset['deviceAction'];
      if (deviceId && capability && deviceAction) {
        this.#options.onDeviceAction?.(deviceId, capability, deviceAction);
      }
    }
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.#dispatch({ type: 'close-overlays' });
  };

  #render(): void {
    const snapshot = createUiSnapshot(this.#state, this.#home);
    this.#renderNavigation();
    this.#renderConfigurator(snapshot.selectedDevice);
    this.#renderContext(snapshot.selectedRoom?.name, snapshot.selectedDevice?.name);
    this.#renderDiagnostics();
    this.#root.dataset['overlay'] = this.#state.overlay ?? 'none';
  }

  #renderNavigation(): void {
    const panel = this.#root.querySelector<HTMLElement>('[data-ui-navigation-panel]');
    const toggle = this.#root.querySelector<HTMLElement>('[data-ui-navigation-toggle]');
    if (!panel || !toggle) return;
    const model = buildNavigationModel(this.#home, this.#state);
    const items = this.#state.navigationMode === 'rooms' ? model.rooms : model.devices;
    const itemAction = this.#state.navigationMode === 'rooms' ? 'select-room' : 'select-device';
    panel.hidden = !this.#state.navigationOpen;
    toggle.setAttribute('aria-expanded', String(this.#state.navigationOpen));
    panel.innerHTML = `
      <div class="ui-navigation-tabs" role="tablist" aria-label="Quick navigation">
        <button type="button" role="tab" aria-selected="${this.#state.navigationMode === 'rooms'}" data-ui-action="show-rooms">Rooms</button>
        <button type="button" role="tab" aria-selected="${this.#state.navigationMode === 'devices'}" data-ui-action="show-devices">Devices</button>
      </div>
      <div class="ui-navigation-list">
        ${items
          .map(
            (item) => `<button type="button" class="ui-navigation-item${item.selected ? ' is-selected' : ''}" data-ui-action="${itemAction}" data-id="${escapeHtml(item.id)}">
              <span>${escapeHtml(item.label)}</span><small>${escapeHtml(item.meta)}</small>
            </button>`,
          )
          .join('') || '<p class="ui-empty">Nothing discovered yet</p>'}
      </div>`;
  }

  #renderConfigurator(device: CanonicalDevice | undefined): void {
    const panel = this.#root.querySelector<HTMLElement>('[data-ui-configurator]');
    if (!panel) return;
    panel.hidden = this.#state.overlay !== 'configurator' || !device;
    if (!device) {
      panel.innerHTML = '';
      return;
    }
    panel.innerHTML = `
      <div class="ui-panel-heading">
        <div><p>Device</p><h2>${escapeHtml(device.name)}</h2></div>
        <button type="button" aria-label="Close device controls" data-ui-action="close-overlays">×</button>
      </div>
      <dl class="ui-device-summary">
        <div><dt>Status</dt><dd>${device.available ? 'Available' : 'Unavailable'}</dd></div>
        <div><dt>Model</dt><dd>${escapeHtml(device.model ?? device.manufacturer ?? 'Generic')}</dd></div>
      </dl>
      <div class="ui-control-rail">
        ${device.capabilities
          .map(
            (capability) => `<button type="button" data-ui-action="device-action" data-device-id="${escapeHtml(device.id)}" data-capability="${escapeHtml(capability)}" data-device-action="${primaryAction(capability)}">
              <span>${escapeHtml(capabilityLabel(capability))}</span><i aria-hidden="true">↗</i>
            </button>`,
          )
          .join('') || '<p class="ui-empty">No controllable capabilities</p>'}
      </div>`;
  }

  #renderContext(roomName?: string, deviceName?: string): void {
    const eyebrow = this.#root.querySelector<HTMLElement>('[data-ui-eyebrow]');
    const title = this.#root.querySelector<HTMLElement>('[data-ui-title]');
    const subtitle = this.#root.querySelector<HTMLElement>('[data-ui-subtitle]');
    if (eyebrow) eyebrow.textContent = deviceName ? roomName ?? 'Home' : 'Living interface';
    if (title) title.textContent = deviceName ?? roomName ?? 'Home Configurator';
    if (subtitle) {
      subtitle.textContent = deviceName
        ? 'Inspect the object and use the configurator rail to control its capabilities.'
        : 'Choose a room or device from the navigation bar to move through your home.';
    }
  }

  #renderDiagnostics(): void {
    const values: Record<string, string> = {
      phase: this.#diagnostics.runtimePhase,
      ha: this.#diagnostics.homeAssistantStatus,
      rooms: String(this.#home.rooms.length),
      devices: String(this.#home.devices.length),
      frame: String(this.#diagnostics.frame),
      gestures: String(this.#diagnostics.gestures),
    };
    for (const [key, value] of Object.entries(values)) {
      const node = this.#root.querySelector<HTMLElement>(`[data-ui-diagnostic="${key}"]`);
      if (node) node.textContent = value;
    }
  }

  #shellMarkup(version: string): string {
    return `
      <section class="ui-shell">
        <header class="ui-header">
          <button type="button" class="ui-brand" data-ui-action="close-overlays">Home Configurator</button>
          <div class="ui-navigation-anchor">
            <button type="button" class="ui-navigation-toggle" data-ui-navigation-toggle data-ui-action="toggle-navigation" aria-haspopup="dialog" aria-expanded="false">
              Navigate <span aria-hidden="true">⌄</span>
            </button>
            <section class="ui-navigation-panel" data-ui-navigation-panel hidden aria-label="Home navigation"></section>
          </div>
          <button type="button" class="ui-status" data-ui-action="open-diagnostics"><span data-ui-runtime-status>Booting</span></button>
        </header>
        <main class="ui-stage" data-ui-stage tabindex="0" aria-label="Interactive three-dimensional home stage">
          <canvas class="ui-canvas" data-ui-canvas aria-hidden="true"></canvas>
          <div class="ui-stage-copy">
            <p data-ui-eyebrow>Living interface</p>
            <h1 data-ui-title>Home Configurator</h1>
            <span data-ui-subtitle>Choose a room or device from the navigation bar to move through your home.</span>
          </div>
          <aside class="ui-configurator" data-ui-configurator hidden aria-live="polite"></aside>
        </main>
        <footer class="ui-footer">
          <span>v${escapeHtml(version)}</span>
          <div class="ui-diagnostics" aria-label="System diagnostics">
            <span>Runtime<strong data-ui-diagnostic="phase">idle</strong></span>
            <span>HA<strong data-ui-diagnostic="ha">uninitialized</strong></span>
            <span>Rooms<strong data-ui-diagnostic="rooms">0</strong></span>
            <span>Devices<strong data-ui-diagnostic="devices">0</strong></span>
            <span>Frame<strong data-ui-diagnostic="frame">0</strong></span>
            <span>Gestures<strong data-ui-diagnostic="gestures">0</strong></span>
          </div>
        </footer>
      </section>`;
  }
}
