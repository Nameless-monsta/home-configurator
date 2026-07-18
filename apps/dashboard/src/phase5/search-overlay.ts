/**
 * Search overlay — quick device lookup across the whole home. Matching is a
 * simple case-insensitive filter over device, room and category names; picking
 * a result hands the device id back to the shell, which travels there inside
 * the persistent stage.
 */

import { categoryLabel, primaryStatus, type DeviceView } from './experience-model.js';

/** Pure: filter devices by a free-text query. */
export const filterDevices = (
  views: readonly DeviceView[],
  query: string,
): readonly DeviceView[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return views;
  return views.filter((view) =>
    `${view.name} ${view.roomName} ${categoryLabel(view.category)}`.toLowerCase().includes(needle),
  );
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export interface SearchOverlayOptions {
  readonly root: HTMLElement;
  readonly devices: () => readonly DeviceView[];
  readonly onPick: (deviceId: string) => void;
  readonly onClose: () => void;
}

export class SearchOverlay {
  readonly #options: SearchOverlayOptions;
  #open = false;

  public constructor(options: SearchOverlayOptions) {
    this.#options = options;
    this.#options.root.classList.add('p5-search');
    this.#options.root.hidden = true;
    this.#options.root.addEventListener('click', this.#onClick);
    this.#options.root.addEventListener('input', this.#onInput);
  }

  public get open(): boolean {
    return this.#open;
  }

  public show(): void {
    this.#open = true;
    this.#options.root.hidden = false;
    this.#options.root.innerHTML = `
      <div class="p5-search-panel" role="dialog" aria-modal="false" aria-label="Search devices">
        <div class="p5-search-bar">
          <input type="search" data-p5-search-input placeholder="Search devices, rooms…" aria-label="Search devices" autocomplete="off" />
          <button type="button" class="p5-settings-close" data-p5-search-close aria-label="Close search">Close</button>
        </div>
        <div class="p5-search-results" data-p5-search-results></div>
      </div>
    `;
    this.#renderResults('');
    this.#options.root.querySelector<HTMLInputElement>('[data-p5-search-input]')?.focus();
  }

  public hide(): void {
    if (!this.#open) return;
    this.#open = false;
    this.#options.root.hidden = true;
    this.#options.root.innerHTML = '';
  }

  public dispose(): void {
    this.#options.root.removeEventListener('click', this.#onClick);
    this.#options.root.removeEventListener('input', this.#onInput);
    this.#options.root.innerHTML = '';
  }

  #renderResults(query: string): void {
    const host = this.#options.root.querySelector<HTMLElement>('[data-p5-search-results]');
    if (!host) return;
    const results = filterDevices(this.#options.devices(), query);
    host.innerHTML = results.length
      ? results
          .map(
            (
              view,
            ) => `<button class="p5-device-row" type="button" data-p5-search-pick="${escapeHtml(view.id)}">
              <span class="p5-device-row-copy"><strong>${escapeHtml(view.name)}</strong><small>${escapeHtml(view.roomName)} · ${escapeHtml(categoryLabel(view.category))}</small></span>
              <span class="p5-device-status">${escapeHtml(primaryStatus(view))}</span>
            </button>`,
          )
          .join('')
      : '<p class="p5-empty">No devices match.</p>';
  }

  readonly #onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-p5-search-close]') || target === this.#options.root) {
      this.#options.onClose();
      return;
    }
    const pick = target.closest<HTMLElement>('[data-p5-search-pick]');
    if (pick?.dataset['p5SearchPick']) this.#options.onPick(pick.dataset['p5SearchPick']);
  };

  readonly #onInput = (event: Event): void => {
    const input = (event.target as HTMLElement | null)?.closest<HTMLInputElement>(
      '[data-p5-search-input]',
    );
    if (input) this.#renderResults(input.value);
  };
}
