/**
 * Device rail — IYO-style cross-product navigation. A persistent strip of
 * device names with an editorial index counter that lets the person switch the
 * hero object without leaving the shell, both while browsing and inside Device
 * Detail. Mirrors the reference site's cross-product name list: the stage is
 * never destroyed, only the object travels. docs/01-research/IYO_INTERACTION_SPEC.
 */

export interface RailItem {
  readonly id: string;
  readonly name: string;
}

export interface RailEntry extends RailItem {
  readonly active: boolean;
  readonly index: number;
}

/** Pure view model: annotate each item with its index and active flag. */
export const buildRailModel = (
  items: readonly RailItem[],
  activeId: string | null,
): readonly RailEntry[] =>
  items.map((item, index) => ({ ...item, index, active: item.id === activeId }));

/** Editorial two-digit counter, e.g. "02 — 05". Empty when there is nothing. */
export const formatRailIndex = (activeIndex: number, total: number): string => {
  if (total <= 0) return '';
  const clamped = Math.min(total - 1, Math.max(0, activeIndex));
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(clamped + 1)} — ${pad(total)}`;
};

/** Neighbouring device id for keyboard/edge navigation; null at the ends. */
export const railNeighbour = (
  items: readonly RailItem[],
  activeId: string | null,
  direction: -1 | 1,
): string | null => {
  const index = items.findIndex((item) => item.id === activeId);
  if (index === -1) return null;
  return items[index + direction]?.id ?? null;
};

export interface DeviceRailOptions {
  readonly root: HTMLElement;
  readonly onSelect: (id: string) => void;
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export class DeviceRail {
  readonly #root: HTMLElement;
  readonly #onSelect: (id: string) => void;
  #items: readonly RailItem[] = [];
  #activeId: string | null = null;

  public constructor(options: DeviceRailOptions) {
    this.#root = options.root;
    this.#onSelect = options.onSelect;
    this.#root.classList.add('p5-rail');
    this.#root.setAttribute('aria-label', 'Devices');
    this.#root.addEventListener('click', this.#onClick);
    this.#render();
  }

  public get activeId(): string | null {
    return this.#activeId;
  }

  public setItems(items: readonly RailItem[]): void {
    this.#items = items;
    if (this.#activeId && !items.some((item) => item.id === this.#activeId)) {
      this.#activeId = items[0]?.id ?? null;
    }
    if (!this.#activeId) this.#activeId = items[0]?.id ?? null;
    this.#render();
  }

  public setActive(id: string | null): void {
    if (this.#activeId === id) return;
    this.#activeId = id;
    this.#sync();
  }

  public neighbour(direction: -1 | 1): string | null {
    return railNeighbour(this.#items, this.#activeId, direction);
  }

  public dispose(): void {
    this.#root.removeEventListener('click', this.#onClick);
    this.#root.innerHTML = '';
    this.#root.classList.remove('p5-rail');
    this.#root.hidden = true;
  }

  #render(): void {
    const model = buildRailModel(this.#items, this.#activeId);
    this.#root.hidden = model.length === 0;
    if (model.length === 0) {
      this.#root.innerHTML = '';
      return;
    }
    const activeIndex = model.find((entry) => entry.active)?.index ?? 0;
    this.#root.innerHTML = `
      <span class="p5-rail-index" data-p5-rail-index aria-hidden="true">${formatRailIndex(activeIndex, model.length)}</span>
      <div class="p5-rail-names" data-p5-rail-names role="tablist" aria-label="Switch device">
        ${model
          .map(
            (entry) =>
              `<button type="button" role="tab" data-p5-rail-item="${escapeHtml(entry.id)}" aria-selected="${entry.active}" tabindex="${entry.active ? 0 : -1}">${escapeHtml(entry.name)}</button>`,
          )
          .join('')}
      </div>
    `;
    this.#scrollActiveIntoView(false);
  }

  #sync(): void {
    const index = this.#root.querySelector<HTMLElement>('[data-p5-rail-index]');
    const activeIndex = this.#items.findIndex((item) => item.id === this.#activeId);
    if (index) index.textContent = formatRailIndex(Math.max(0, activeIndex), this.#items.length);
    for (const button of this.#root.querySelectorAll<HTMLButtonElement>('[data-p5-rail-item]')) {
      const selected = button.dataset['p5RailItem'] === this.#activeId;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    this.#scrollActiveIntoView(true);
  }

  #scrollActiveIntoView(smooth: boolean): void {
    const active = this.#root.querySelector<HTMLElement>(
      '[data-p5-rail-item][aria-selected="true"]',
    );
    active?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'instant',
      block: 'nearest',
      inline: 'center',
    });
  }

  readonly #onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const id = target?.closest<HTMLElement>('[data-p5-rail-item]')?.dataset['p5RailItem'];
    if (id) this.#onSelect(id);
  };
}
