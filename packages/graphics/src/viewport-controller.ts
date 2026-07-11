import type { Diagnostics } from '@home-configurator/runtime';

import type { GraphicsViewport } from './types.js';

export type ViewportListener = (viewport: GraphicsViewport) => void;

export class GraphicsViewportController {
  readonly #element: HTMLElement;
  readonly #listener: ViewportListener;
  readonly #diagnostics: Diagnostics;
  #observer: ResizeObserver | undefined;
  #started = false;

  public constructor(element: HTMLElement, listener: ViewportListener, diagnostics: Diagnostics) {
    this.#element = element;
    this.#listener = listener;
    this.#diagnostics = diagnostics;
  }

  public start(): void {
    if (this.#started) return;
    this.#started = true;
    if (typeof ResizeObserver !== 'undefined') {
      this.#observer = new ResizeObserver(() => this.#emit());
      this.#observer.observe(this.#element);
    }
    globalThis.addEventListener?.('resize', this.#emit);
    globalThis.visualViewport?.addEventListener('resize', this.#emit);
    this.#emit();
  }

  public stop(): void {
    if (!this.#started) return;
    this.#started = false;
    this.#observer?.disconnect();
    this.#observer = undefined;
    globalThis.removeEventListener?.('resize', this.#emit);
    globalThis.visualViewport?.removeEventListener('resize', this.#emit);
  }

  readonly #emit = (): void => {
    if (!this.#started) return;
    const rect = this.#element.getBoundingClientRect();
    const viewport: GraphicsViewport = {
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
      devicePixelRatio: Math.max(0.75, globalThis.devicePixelRatio || 1),
    };
    this.#listener(viewport);
    this.#diagnostics.setGauge('graphics.viewportWidth', viewport.width);
    this.#diagnostics.setGauge('graphics.viewportHeight', viewport.height);
  };
}
