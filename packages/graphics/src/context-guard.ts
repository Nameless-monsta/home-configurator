import type { Diagnostics } from '@home-configurator/runtime';

export interface WebGLContextGuardOptions {
  readonly canvas: HTMLCanvasElement;
  readonly diagnostics: Diagnostics;
  readonly onRestored?: () => void;
}

export class WebGLContextGuard {
  readonly #canvas: HTMLCanvasElement;
  readonly #diagnostics: Diagnostics;
  readonly #onRestored?: () => void;
  #lost = false;
  #disposed = false;

  public constructor(options: WebGLContextGuardOptions) {
    this.#canvas = options.canvas;
    this.#diagnostics = options.diagnostics;
    this.#onRestored = options.onRestored;
    this.#canvas.addEventListener('webglcontextlost', this.#handleLost);
    this.#canvas.addEventListener('webglcontextrestored', this.#handleRestored);
  }

  public get lost(): boolean {
    return this.#lost;
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#canvas.removeEventListener('webglcontextlost', this.#handleLost);
    this.#canvas.removeEventListener('webglcontextrestored', this.#handleRestored);
  }

  readonly #handleLost = (event: Event): void => {
    event.preventDefault();
    this.#lost = true;
    this.#diagnostics.increment('graphics.contextLosses');
    this.#diagnostics.record('error', 'graphics.context', 'WebGL context lost');
  };

  readonly #handleRestored = (): void => {
    this.#lost = false;
    this.#diagnostics.record('info', 'graphics.context', 'WebGL context restored');
    this.#onRestored?.();
  };
}
