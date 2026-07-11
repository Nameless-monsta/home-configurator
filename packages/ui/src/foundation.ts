import { createResponsiveProfile } from './responsive.js';
import type {
  UiFoundationOptions,
  UiFoundationSnapshot,
  UiOverlay,
  UiResponsiveProfile,
} from './types.js';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export class UiFoundation {
  readonly #root: HTMLElement;
  readonly #resizeObserver: ResizeObserver;
  readonly #listeners = new Set<(snapshot: UiFoundationSnapshot) => void>();
  #overlay: UiOverlay = null;
  #responsive: UiResponsiveProfile;
  #runtimeStatus = 'Booting';
  #diagnostics: Readonly<Record<string, number | string>> = {};
  #focusReturn: HTMLElement | null = null;

  public readonly stage: HTMLElement;
  public readonly canvas: HTMLCanvasElement;

  public constructor(options: UiFoundationOptions) {
    this.#root = options.root;
    this.#responsive = this.#createProfile(
      this.#root.clientWidth || window.innerWidth,
      this.#root.clientHeight || window.innerHeight,
    );
    this.#root.innerHTML = this.#markup(options);

    const stage = this.#root.querySelector<HTMLElement>('[data-ui-stage]');
    const canvas = this.#root.querySelector<HTMLCanvasElement>('[data-ui-canvas]');
    if (!stage || !canvas) throw new Error('UI Foundation shell could not be created');
    this.stage = stage;
    this.canvas = canvas;

    this.#root.addEventListener('click', this.#handleClick);
    this.#root.addEventListener('keydown', this.#handleKeydown);
    this.#resizeObserver = new ResizeObserver((entries) => {
      const rectangle = entries[0]?.contentRect;
      this.#setResponsive(
        this.#createProfile(
          rectangle?.width ?? this.#root.clientWidth,
          rectangle?.height ?? this.#root.clientHeight,
        ),
      );
    });
    this.#resizeObserver.observe(this.#root);
    this.#renderState();
  }

  public snapshot(): UiFoundationSnapshot {
    return {
      overlay: this.#overlay,
      layout: this.#responsive.layout,
      responsive: this.#responsive,
      runtimeStatus: this.#runtimeStatus,
      diagnostics: this.#diagnostics,
    };
  }

  public subscribe(listener: (snapshot: UiFoundationSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.snapshot());
    return () => this.#listeners.delete(listener);
  }

  public setRuntimeStatus(status: string): void {
    this.#runtimeStatus = status;
    const node = this.#root.querySelector<HTMLElement>('[data-ui-runtime-status]');
    if (node) node.textContent = status;
    this.#publish();
  }

  public setDiagnostics(values: Readonly<Record<string, number | string>>): void {
    this.#diagnostics = values;
    const container = this.#root.querySelector<HTMLElement>('[data-ui-diagnostics-values]');
    if (container) {
      container.innerHTML = Object.entries(values)
        .map(
          ([label, value]) =>
            `<div class="ui-diagnostic"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`,
        )
        .join('');
    }
    this.#publish();
  }

  public openOverlay(overlay: Exclude<UiOverlay, null>): void {
    if (document.activeElement instanceof HTMLElement) this.#focusReturn = document.activeElement;
    this.#overlay = overlay;
    this.#renderState();
    queueMicrotask(() => {
      this.#root.querySelector<HTMLElement>('[data-ui-action="close-overlay"]')?.focus();
    });
  }

  public closeOverlay(): void {
    this.#overlay = null;
    this.#renderState();
    const focusReturn = this.#focusReturn;
    this.#focusReturn = null;
    queueMicrotask(() => focusReturn?.focus());
  }

  public dispose(): void {
    this.#resizeObserver.disconnect();
    this.#root.removeEventListener('click', this.#handleClick);
    this.#root.removeEventListener('keydown', this.#handleKeydown);
    this.#listeners.clear();
    this.#focusReturn = null;
  }

  #createProfile(width: number, height: number): UiResponsiveProfile {
    return createResponsiveProfile({
      width,
      height,
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    });
  }

  #setResponsive(responsive: UiResponsiveProfile): void {
    const current = this.#responsive;
    if (
      current.width === responsive.width &&
      current.height === responsive.height &&
      current.coarsePointer === responsive.coarsePointer
    ) {
      return;
    }
    this.#responsive = responsive;
    this.#renderState();
  }

  #renderState(): void {
    this.#root.dataset['uiLayout'] = this.#responsive.layout;
    this.#root.dataset['uiViewport'] = this.#responsive.viewport;
    this.#root.dataset['uiOrientation'] = this.#responsive.orientation;
    this.#root.dataset['uiShort'] = String(this.#responsive.short);
    this.#root.dataset['uiPointer'] = this.#responsive.coarsePointer ? 'coarse' : 'fine';
    const overlay = this.#root.querySelector<HTMLElement>('[data-ui-overlay]');
    if (overlay) {
      overlay.hidden = this.#overlay !== 'diagnostics';
      overlay.setAttribute('aria-hidden', String(this.#overlay !== 'diagnostics'));
    }
    this.#publish();
  }

  #publish(): void {
    const snapshot = this.snapshot();
    for (const listener of this.#listeners) listener(snapshot);
  }

  readonly #handleClick = (event: Event): void => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-ui-action]')
        : null;
    const action = target?.dataset['uiAction'];
    if (action === 'open-diagnostics') this.openOverlay('diagnostics');
    if (action === 'close-overlay') this.closeOverlay();
  };

  readonly #handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.#overlay) {
      event.preventDefault();
      this.closeOverlay();
    }
  };

  #markup(options: UiFoundationOptions): string {
    const title = escapeHtml(options.title ?? 'Home Configurator');
    const subtitle = escapeHtml(
      options.subtitle ?? 'A spatial interface for rooms, devices and live home state.',
    );
    return `
      <section class="ui-shell" data-ui-shell>
        <header class="ui-header">
          <div class="ui-brand">
            <span class="ui-brand-mark" aria-hidden="true"></span>
            <span>${title}</span>
          </div>
          <div class="ui-header-meta">
            <span class="ui-runtime-status" data-ui-runtime-status aria-live="polite">${escapeHtml(this.#runtimeStatus)}</span>
            <button class="ui-icon-button" type="button" data-ui-action="open-diagnostics" aria-label="Open diagnostics">···</button>
          </div>
        </header>
        <main class="ui-stage" data-ui-stage tabindex="0" aria-label="Home Configurator visual stage">
          <canvas class="ui-canvas" data-ui-canvas aria-hidden="true"></canvas>
          <div class="ui-stage-copy" aria-hidden="true">
            <p>UI Foundation</p>
            <h1>${title}</h1>
            <span>${subtitle}</span>
          </div>
        </main>
        <footer class="ui-footer">
          <span>v${escapeHtml(options.version)}</span>
          <span>Foundation online</span>
        </footer>
        <section class="ui-overlay" data-ui-overlay hidden aria-hidden="true" aria-labelledby="ui-diagnostics-title" role="dialog" aria-modal="true">
          <div class="ui-overlay-panel">
            <div class="ui-overlay-heading">
              <div>
                <p>System</p>
                <h2 id="ui-diagnostics-title">Diagnostics</h2>
              </div>
              <button class="ui-icon-button" type="button" data-ui-action="close-overlay" aria-label="Close diagnostics">×</button>
            </div>
            <div class="ui-diagnostics-grid" data-ui-diagnostics-values></div>
          </div>
        </section>
      </section>
    `;
  }
}
