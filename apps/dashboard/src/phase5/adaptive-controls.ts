export type AdaptiveControlKind = 'toggle' | 'stepper' | 'segmented' | 'action';

export interface AdaptiveControl {
  readonly id: string;
  readonly label: string;
  readonly value?: string;
  readonly kind: AdaptiveControlKind;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly options?: readonly { readonly id: string; readonly label: string; readonly active?: boolean }[];
}

export interface AdaptiveControlTrayOptions {
  readonly root: HTMLElement;
  readonly title: string;
  readonly controls: readonly AdaptiveControl[];
  readonly onAction: (action: string) => void;
  readonly reducedMotion: () => boolean;
}

export class AdaptiveControlTray {
  readonly #root: HTMLElement;
  readonly #onAction: (action: string) => void;
  readonly #reducedMotion: () => boolean;
  #expanded = false;
  #title: string;
  #controls: readonly AdaptiveControl[];

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
    this.render();
  }

  public setExpanded(expanded: boolean): void {
    if (this.#expanded === expanded) return;
    this.#expanded = expanded;
    this.render();
    if (!this.#reducedMotion()) {
      this.#root.animate(
        [
          { transform: expanded ? 'translateY(14px) scale(.985)' : 'translateY(-8px) scale(1.01)', opacity: 0.7 },
          { transform: 'translateY(0) scale(1)', opacity: 1 },
        ],
        { duration: expanded ? 360 : 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
      );
    }
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
    this.#root.dataset['expanded'] = String(this.#expanded);
    const primary = this.#controls[0];
    this.#root.innerHTML = `<button class="p5-control-summary" type="button" data-p5-tray-toggle aria-expanded="${this.#expanded}">
      <span><small>${this.#title}</small><strong>${primary?.value ?? primary?.label ?? ''}</strong></span>
      <span aria-hidden="true">${this.#expanded ? '−' : '+'}</span>
    </button>
    <div class="p5-control-body" ${this.#expanded ? '' : 'inert'}>
      ${this.#controls.map((control) => this.#controlMarkup(control)).join('')}
    </div>`;
  }

  #controlMarkup(control: AdaptiveControl): string {
    if (control.kind === 'segmented') {
      return `<fieldset class="p5-control-group"><legend>${control.label}</legend><div class="p5-segmented">${(control.options ?? [])
        .map((option) => `<button type="button" data-p5-control="${control.id}:${option.id}" aria-pressed="${Boolean(option.active)}">${option.label}</button>`)
        .join('')}</div></fieldset>`;
    }
    return `<button type="button" class="p5-control-row" data-p5-control="${control.id}" aria-pressed="${control.kind === 'toggle' ? String(Boolean(control.active)) : 'false'}" ${control.disabled ? 'disabled' : ''}>
      <span>${control.label}</span><strong>${control.value ?? (control.active ? 'On' : '')}</strong>
    </button>`;
  }

  readonly #onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-p5-tray-toggle]')) {
      this.setExpanded(!this.#expanded);
      return;
    }
    const control = target?.closest<HTMLElement>('[data-p5-control]');
    const action = control?.dataset['p5Control'];
    if (action) this.#onAction(action);
  };
}
