/**
 * Settings — model fidelity configuration. Select a device, choose the model
 * source (procedural fallback or a GLB/GLTF URL), tune scale, rotation and
 * vertical anchor, then save. The persistent stage behind the panel previews
 * the selected device live, following the 2.7 model-registry configuration
 * flow. Overrides are presentation-only and never touch device state.
 */

import type { DeviceView } from './experience-model.js';
import {
  defaultOverride,
  normalizeOverride,
  type HeroModelRegistry,
  type ModelOverride,
} from './model-registry.js';

export interface SettingsViewOptions {
  readonly root: HTMLElement;
  readonly registry: HeroModelRegistry;
  readonly devices: () => readonly DeviceView[];
  readonly onPreview: (deviceId: string) => void;
  readonly onApply: (deviceId: string) => void;
  readonly onClose: () => void;
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export class SettingsView {
  readonly #options: SettingsViewOptions;
  #selectedId: string | null = null;
  #open = false;

  public constructor(options: SettingsViewOptions) {
    this.#options = options;
    this.#options.root.classList.add('p5-settings');
    this.#options.root.hidden = true;
    this.#options.root.addEventListener('click', this.#onClick);
    this.#options.root.addEventListener('change', this.#onChange);
    this.#options.root.addEventListener('input', this.#onInput);
  }

  public get open(): boolean {
    return this.#open;
  }

  public show(preferredDeviceId?: string): void {
    this.#open = true;
    const devices = this.#options.devices();
    this.#selectedId =
      preferredDeviceId && devices.some((view) => view.id === preferredDeviceId)
        ? preferredDeviceId
        : (this.#selectedId ?? devices[0]?.id ?? null);
    this.#options.root.hidden = false;
    this.#render();
    if (this.#selectedId) this.#options.onPreview(this.#selectedId);
    this.#options.root.querySelector<HTMLElement>('[data-p5-settings-close]')?.focus();
  }

  public hide(): void {
    if (!this.#open) return;
    this.#open = false;
    this.#options.root.hidden = true;
  }

  public dispose(): void {
    this.#options.root.removeEventListener('click', this.#onClick);
    this.#options.root.removeEventListener('change', this.#onChange);
    this.#options.root.removeEventListener('input', this.#onInput);
    this.#options.root.innerHTML = '';
  }

  #current(): ModelOverride {
    return this.#selectedId ? this.#options.registry.get(this.#selectedId) : defaultOverride();
  }

  #render(): void {
    const devices = this.#options.devices();
    const override = this.#current();
    const selected = devices.find((view) => view.id === this.#selectedId);
    this.#options.root.innerHTML = `
      <div class="p5-settings-panel" role="dialog" aria-modal="false" aria-label="Model settings">
        <header class="p5-settings-head">
          <div>
            <p class="p5-section-label">Settings</p>
            <h2>Device model</h2>
          </div>
          <button type="button" class="p5-settings-close" data-p5-settings-close aria-label="Close settings">Close</button>
        </header>
        <label class="p5-field">
          <span>Device</span>
          <select data-p5-settings-device>
            ${devices
              .map(
                (view) =>
                  `<option value="${escapeHtml(view.id)}" ${view.id === this.#selectedId ? 'selected' : ''}>${escapeHtml(view.name)} — ${escapeHtml(view.roomName)}</option>`,
              )
              .join('')}
          </select>
        </label>
        ${
          selected?.manufacturer || selected?.model
            ? `<p class="p5-settings-meta">${escapeHtml([selected.manufacturer, selected.model].filter(Boolean).join(' · '))}</p>`
            : ''
        }
        <fieldset class="p5-field">
          <legend>Model source</legend>
          <div class="p5-segmented">
            <button type="button" data-p5-settings-source="procedural" aria-pressed="${override.source === 'procedural'}">Built-in</button>
            <button type="button" data-p5-settings-source="url" aria-pressed="${override.source === 'url'}">GLB / GLTF</button>
          </div>
        </fieldset>
        <label class="p5-field" ${override.source === 'url' ? '' : 'hidden'} data-p5-settings-url-field>
          <span>Model URL (.glb / .gltf)</span>
          <input type="url" data-p5-settings-url value="${escapeHtml(override.url)}" placeholder="https://…/lamp.glb" />
        </label>
        <label class="p5-field">
          <span>Scale <output data-p5-settings-out="scale">${override.scale.toFixed(2)}×</output></span>
          <input type="range" min="0.2" max="4" step="0.05" value="${override.scale}" data-p5-settings-range="scale" />
        </label>
        <label class="p5-field">
          <span>Rotation <output data-p5-settings-out="rotationYDeg">${Math.round(override.rotationYDeg)}°</output></span>
          <input type="range" min="-180" max="180" step="1" value="${override.rotationYDeg}" data-p5-settings-range="rotationYDeg" />
        </label>
        <label class="p5-field">
          <span>Height <output data-p5-settings-out="offsetY">${override.offsetY.toFixed(2)}</output></span>
          <input type="range" min="-1" max="1" step="0.02" value="${override.offsetY}" data-p5-settings-range="offsetY" />
        </label>
        <div class="p5-settings-actions">
          <button type="button" class="p5-quick" data-p5-settings-apply>Save &amp; preview</button>
          <button type="button" class="p5-quick" data-p5-settings-reset>Reset</button>
        </div>
        <p class="p5-settings-note">Built-in models remain the fallback when a custom model cannot load.</p>
      </div>
    `;
  }

  #draft(): ModelOverride {
    const root = this.#options.root;
    const source =
      root.querySelector<HTMLButtonElement>('[data-p5-settings-source][aria-pressed="true"]')
        ?.dataset['p5SettingsSource'] === 'url'
        ? 'url'
        : 'procedural';
    const url = root.querySelector<HTMLInputElement>('[data-p5-settings-url]')?.value ?? '';
    const range = (key: string): number =>
      Number(root.querySelector<HTMLInputElement>(`[data-p5-settings-range="${key}"]`)?.value ?? 0);
    return normalizeOverride({
      source,
      url,
      scale: range('scale'),
      rotationYDeg: range('rotationYDeg'),
      offsetY: range('offsetY'),
    });
  }

  #apply(): void {
    if (!this.#selectedId) return;
    this.#options.registry.set(this.#selectedId, this.#draft());
    this.#options.onApply(this.#selectedId);
    this.#render();
  }

  readonly #onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-p5-settings-close]')) {
      this.#options.onClose();
      return;
    }
    const source = target.closest<HTMLElement>('[data-p5-settings-source]');
    if (source?.dataset['p5SettingsSource']) {
      for (const button of this.#options.root.querySelectorAll<HTMLElement>(
        '[data-p5-settings-source]',
      )) {
        button.setAttribute('aria-pressed', String(button === source));
      }
      const urlField = this.#options.root.querySelector<HTMLElement>(
        '[data-p5-settings-url-field]',
      );
      if (urlField) urlField.hidden = source.dataset['p5SettingsSource'] !== 'url';
      return;
    }
    if (target.closest('[data-p5-settings-apply]')) {
      this.#apply();
      return;
    }
    if (target.closest('[data-p5-settings-reset]')) {
      if (this.#selectedId) {
        this.#options.registry.clear(this.#selectedId);
        this.#options.onApply(this.#selectedId);
      }
      this.#render();
    }
  };

  readonly #onChange = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const select = target?.closest<HTMLSelectElement>('[data-p5-settings-device]');
    if (select) {
      this.#selectedId = select.value;
      this.#render();
      this.#options.onPreview(select.value);
    }
  };

  readonly #onInput = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const range = target?.closest<HTMLInputElement>('[data-p5-settings-range]');
    if (!range) return;
    const key = range.dataset['p5SettingsRange'];
    const output = this.#options.root.querySelector<HTMLElement>(
      `[data-p5-settings-out="${key ?? ''}"]`,
    );
    if (!output) return;
    const value = Number(range.value);
    if (key === 'scale') output.textContent = `${value.toFixed(2)}×`;
    else if (key === 'rotationYDeg') output.textContent = `${Math.round(value)}°`;
    else output.textContent = value.toFixed(2);
  };
}
