export type AdaptiveControlKind = 'toggle' | 'stepper' | 'segmented' | 'action';
export interface AdaptiveControl {
  readonly id: string;
  readonly label: string;
  readonly value?: string;
  readonly kind: AdaptiveControlKind;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly options?: readonly {
    readonly id: string;
    readonly label: string;
    readonly active?: boolean;
  }[];
}
export interface AdaptiveControlTrayOptions {
  readonly root: HTMLElement;
  readonly title: string;
  readonly controls: readonly AdaptiveControl[];
  readonly onAction: (action: string) => void;
  readonly reducedMotion: () => boolean;
}

const structureKey = (controls: readonly AdaptiveControl[]): string =>
  controls
    .map((c) => `${c.id}:${c.kind}:${(c.options ?? []).map((o) => o.id).join(',')}`)
    .join('|');

export class AdaptiveControlTray {
  readonly #root: HTMLElement;
  readonly #onAction: (action: string) => void;
  readonly #reducedMotion: () => boolean;
  #expanded = false;
  #title: string;
  #controls: readonly AdaptiveControl[];
  #structure = '';
  public constructor(options: AdaptiveControlTrayOptions) {
    this.#root = options.root;
    this.#title = options.title;
    this.#controls = options.controls;
    this.#onAction = options.onAction;
    this.#reducedMotion = options.reducedMotion;
    this.#root.classList.add('p5-control-tray');
    this.#root.addEventListener('click', this.#onClick);
    this.render();
  }
  public setControls(title: string, controls: readonly AdaptiveControl[]): void {
    this.#title = title;
    this.#controls = controls;
    const next = structureKey(controls);
    if (next !== this.#structure) this.render();
    else this.#patch();
  }
  public setExpanded(expanded: boolean): void {
    if (this.#expanded === expanded) return;
    this.#expanded = expanded;
    this.#patchExpanded();
    if (!this.#reducedMotion())
      this.#root.animate(
        [
          {
            transform: expanded ? 'translateY(14px) scale(.985)' : 'translateY(-8px) scale(1.01)',
            opacity: 0.7,
          },
          { transform: 'translateY(0) scale(1)', opacity: 1 },
        ],
        { duration: expanded ? 360 : 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
      );
  }
  public revealTemporarily(durationMs = 2600): void {
    this.setExpanded(true);
    window.setTimeout(() => this.setExpanded(false), durationMs);
  }
  public dispose(): void {
    this.#root.removeEventListener('click', this.#onClick);
    this.#root.innerHTML = '';
    this.#root.classList.remove('p5-control-tray');
  }
  public render(): void {
    this.#structure = structureKey(this.#controls);
    const primary = this.#controls[0];
    this.#root.innerHTML = `<button class="p5-control-summary" type="button" data-p5-tray-toggle aria-expanded="${this.#expanded}"><span><small data-p5-summary-title>${this.#title}</small><strong data-p5-summary-value>${primary?.value ?? primary?.label ?? ''}</strong></span><span data-p5-summary-icon aria-hidden="true">${this.#expanded ? '−' : '+'}</span></button><div class="p5-control-body" ${this.#expanded ? '' : 'inert'}>${this.#controls.map((c) => this.#controlMarkup(c)).join('')}</div>`;
    this.#root.dataset['expanded'] = String(this.#expanded);
  }
  #patch(): void {
    const primary = this.#controls[0];
    const title = this.#root.querySelector<HTMLElement>('[data-p5-summary-title]');
    const value = this.#root.querySelector<HTMLElement>('[data-p5-summary-value]');
    if (title) title.textContent = this.#title;
    if (value) value.textContent = primary?.value ?? primary?.label ?? '';
    for (const c of this.#controls) {
      const el = this.#root.querySelector<HTMLButtonElement>(`[data-p5-control="${c.id}"]`);
      if (el) {
        el.disabled = Boolean(c.disabled);
        el.setAttribute('aria-pressed', c.kind === 'toggle' ? String(Boolean(c.active)) : 'false');
        const strong = el.querySelector('strong');
        if (strong) strong.textContent = c.value ?? (c.active ? 'On' : '');
      }
      for (const o of c.options ?? []) {
        const opt = this.#root.querySelector<HTMLButtonElement>(
          `[data-p5-control="${c.id}:${o.id}"]`,
        );
        opt?.setAttribute('aria-pressed', String(Boolean(o.active)));
      }
    }
    this.#patchExpanded();
  }
  #patchExpanded(): void {
    this.#root.dataset['expanded'] = String(this.#expanded);
    const toggle = this.#root.querySelector<HTMLElement>('[data-p5-tray-toggle]');
    toggle?.setAttribute('aria-expanded', String(this.#expanded));
    const icon = this.#root.querySelector<HTMLElement>('[data-p5-summary-icon]');
    if (icon) icon.textContent = this.#expanded ? '−' : '+';
    const body = this.#root.querySelector<HTMLElement>('.p5-control-body');
    if (body) {
      if (this.#expanded) body.removeAttribute('inert');
      else body.setAttribute('inert', '');
    }
  }
  #controlMarkup(c: AdaptiveControl): string {
    if (c.kind === 'segmented')
      return `<fieldset class="p5-control-group"><legend>${c.label}</legend><div class="p5-segmented">${(c.options ?? []).map((o) => `<button type="button" data-p5-control="${c.id}:${o.id}" aria-pressed="${Boolean(o.active)}">${o.label}</button>`).join('')}</div></fieldset>`;
    return `<button type="button" class="p5-control-row" data-p5-control="${c.id}" aria-pressed="${c.kind === 'toggle' ? String(Boolean(c.active)) : 'false'}" ${c.disabled ? 'disabled' : ''}><span>${c.label}</span><strong>${c.value ?? (c.active ? 'On' : '')}</strong></button>`;
  }
  readonly #onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-p5-tray-toggle]')) {
      this.setExpanded(!this.#expanded);
      return;
    }
    const action = target?.closest<HTMLElement>('[data-p5-control]')?.dataset['p5Control'];
    if (action) this.#onAction(action);
  };
}
