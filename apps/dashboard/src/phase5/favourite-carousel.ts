export interface FavouriteCarouselItem {
  readonly id: string;
  readonly name: string;
  readonly room: string;
  readonly category: string;
  readonly status: string;
}

export interface FavouriteHeroMount {
  dispose(): void;
  setActive(active: boolean): void;
  update?(state: unknown): void;
}

export interface FavouriteHeroCarouselOptions {
  readonly root: HTMLElement;
  readonly items: readonly FavouriteCarouselItem[];
  readonly mountHero: (host: HTMLElement, item: FavouriteCarouselItem) => FavouriteHeroMount;
  readonly onSelect: (item: FavouriteCarouselItem, origin: DOMRect) => void;
  readonly onActiveChange?: (item: FavouriteCarouselItem, index: number) => void;
}

export class FavouriteHeroCarousel {
  readonly #root: HTMLElement;
  #items: readonly FavouriteCarouselItem[];
  readonly #mountHero: FavouriteHeroCarouselOptions['mountHero'];
  readonly #onSelect: FavouriteHeroCarouselOptions['onSelect'];
  readonly #onActiveChange?: FavouriteHeroCarouselOptions['onActiveChange'];
  readonly #mounts = new Map<string, FavouriteHeroMount>();
  readonly #observer: IntersectionObserver;
  #activeIndex = 0;

  public constructor(options: FavouriteHeroCarouselOptions) {
    this.#root = options.root;
    this.#items = options.items;
    this.#mountHero = options.mountHero;
    this.#onSelect = options.onSelect;
    this.#onActiveChange = options.onActiveChange;
    this.#root.classList.add('p5-hero-carousel');
    this.#root.setAttribute('role', 'listbox');
    this.#root.setAttribute('aria-label', 'Favourite devices');
    this.#root.innerHTML = this.#items.map((item, index) => this.#itemMarkup(item, index)).join('');

    this.#observer = new IntersectionObserver(this.#onIntersection, {
      root: this.#root,
      threshold: [0.35, 0.6, 0.78],
    });

    for (const card of this.#root.querySelectorAll<HTMLElement>('[data-p5-hero-item]')) {
      this.#observer.observe(card);
      const host = card.querySelector<HTMLElement>('[data-p5-hero-host]');
      const item = this.#items.find((entry) => entry.id === card.dataset['p5HeroItem']);
      if (!host || !item) continue;
      this.#mounts.set(item.id, this.#mountHero(host, item));
    }

    this.#root.addEventListener('click', this.#onClick);
    this.#root.addEventListener('keydown', this.#onKeydown);
    this.#setActive(0);
  }

  public get activeIndex(): number {
    return this.#activeIndex;
  }

  public focusIndex(index: number, smooth = true): void {
    const clamped = Math.min(this.#items.length - 1, Math.max(0, index));
    const card = this.#root.querySelector<HTMLElement>(`[data-p5-hero-index="${clamped}"]`);
    card?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'instant',
      block: 'nearest',
      inline: 'center',
    });
    this.#setActive(clamped);
  }

  public updateItems(items: readonly FavouriteCarouselItem[]): void {
    if (
      items.length !== this.#items.length ||
      items.some((item, index) => item.id !== this.#items[index]?.id)
    ) {
      throw new Error('Carousel structure changed; rebuild required');
    }
    this.#items = items;
    for (const item of items) {
      const card = this.#root.querySelector<HTMLElement>(`[data-p5-hero-item="${item.id}"]`);
      if (!card) continue;
      const label = card.querySelector<HTMLElement>('.p5-label');
      const name = card.querySelector<HTMLElement>('.p5-hero-copy strong');
      const status = card.querySelector<HTMLElement>('.p5-hero-copy > span:last-child');
      if (label) label.textContent = `${item.room} · ${item.category}`;
      if (name) name.textContent = item.name;
      if (status) status.textContent = item.status;
    }
  }

  public dispose(): void {
    this.#observer.disconnect();
    this.#root.removeEventListener('click', this.#onClick);
    this.#root.removeEventListener('keydown', this.#onKeydown);
    for (const mount of this.#mounts.values()) mount.dispose();
    this.#mounts.clear();
    this.#root.innerHTML = '';
    this.#root.classList.remove('p5-hero-carousel');
  }

  #itemMarkup(item: FavouriteCarouselItem, index: number): string {
    return `<article class="p5-hero-card" role="option" tabindex="${index === 0 ? '0' : '-1'}" aria-selected="${index === 0}" data-p5-hero-item="${item.id}" data-p5-hero-index="${index}">
      <button class="p5-hero-hit" type="button" aria-label="Open ${item.name}" data-p5-hero-open="${item.id}">
        <span class="p5-hero-host" data-p5-hero-host aria-hidden="true"></span>
        <span class="p5-hero-copy">
          <span class="p5-label">${item.room} · ${item.category}</span>
          <strong>${item.name}</strong>
          <span>${item.status}</span>
        </span>
      </button>
    </article>`;
  }

  readonly #onIntersection = (entries: IntersectionObserverEntry[]): void => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const index = Number((visible.target as HTMLElement).dataset['p5HeroIndex']);
    if (Number.isFinite(index)) this.#setActive(index);
  };

  readonly #onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLElement>('[data-p5-hero-open]');
    if (!button) return;
    const item = this.#items.find((entry) => entry.id === button.dataset['p5HeroOpen']);
    const card = button.closest<HTMLElement>('[data-p5-hero-item]');
    if (item && card) this.#onSelect(item, card.getBoundingClientRect());
  };

  readonly #onKeydown = (event: KeyboardEvent): void => {
    if (
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowRight' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    )
      return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? this.#items.length - 1
          : this.#activeIndex + (event.key === 'ArrowRight' ? 1 : -1);
    this.focusIndex(next);
  };

  #setActive(index: number): void {
    if (!this.#items.length) return;
    this.#activeIndex = Math.min(this.#items.length - 1, Math.max(0, index));
    const active = this.#items[this.#activeIndex]!;
    for (const card of this.#root.querySelectorAll<HTMLElement>('[data-p5-hero-index]')) {
      const selected = Number(card.dataset['p5HeroIndex']) === this.#activeIndex;
      card.setAttribute('aria-selected', String(selected));
      card.tabIndex = selected ? 0 : -1;
    }
    for (const [id, mount] of this.#mounts) mount.setActive(id === active.id);
    this.#onActiveChange?.(active, this.#activeIndex);
  }
}
