/** Lightweight standalone hero preview for carousel and shelf cards. */
import { AmbientLight, DirectionalLight, Group, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { FavouriteHeroMount } from './favourite-carousel.js';
import { createHero, type HeroHandle } from './hero-models.js';
import type { DeviceCategory, DeviceViewState } from './experience-model.js';

export interface HeroPreviewOptions {
  readonly host: HTMLElement;
  readonly category: DeviceCategory;
  readonly capabilities: readonly string[];
  readonly state: DeviceViewState;
  readonly reducedMotion: () => boolean;
}

const shared = { count: 0, max: 10 };
let webglSupported: boolean | undefined;
const supportsWebgl = (): boolean => {
  if (webglSupported !== undefined) return webglSupported;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    webglSupported = Boolean(context);
    const lose = context?.getExtension('WEBGL_lose_context');
    lose?.loseContext();
  } catch {
    webglSupported = false;
  }
  return webglSupported;
};

export class HeroPreview implements FavouriteHeroMount {
  readonly #renderer: WebGLRenderer | null;
  readonly #scene = new Scene();
  readonly #camera = new PerspectiveCamera(32, 1, 0.1, 100);
  readonly #hero: HeroHandle;
  readonly #group = new Group();
  readonly #reducedMotion: () => boolean;
  readonly #host: HTMLElement;
  readonly #resizeObserver: ResizeObserver | null;
  #state: DeviceViewState;
  #active = false;
  #disposed = false;
  #raf = 0;
  #last = 0;
  #spin = 0;
  #width = 0;
  #height = 0;

  public constructor(options: HeroPreviewOptions) {
    this.#host = options.host;
    this.#reducedMotion = options.reducedMotion;
    this.#state = options.state;
    this.#hero = createHero(options.category, options.capabilities);
    this.#hero.apply(options.state);
    this.#group.add(this.#hero.object);
    this.#scene.add(this.#group);
    this.#scene.add(new AmbientLight(0xffffff, 0.9));
    const key = new DirectionalLight(0xfff2e0, 1.5);
    key.position.set(2.5, 4, 3);
    this.#scene.add(key);
    this.#camera.position.set(0, 0.4, 5.2);
    this.#camera.lookAt(0, 0, 0);

    if (shared.count >= shared.max || !supportsWebgl()) {
      this.#renderer = null;
      this.#resizeObserver = null;
      this.#host.dataset['fallback'] = 'true';
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      this.#renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
      this.#renderer.setClearColor(0x000000, 0);
      this.#host.appendChild(canvas);
      shared.count += 1;
      this.#resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        this.#resize(entry.contentRect.width, entry.contentRect.height);
      });
      this.#resizeObserver?.observe(this.#host);
      const rect = this.#host.getBoundingClientRect();
      this.#resize(rect.width, rect.height);
      this.#renderFrame();
    } catch {
      this.#renderer = null;
      this.#resizeObserver = null;
      this.#host.dataset['fallback'] = 'true';
    }
  }

  public setActive(active: boolean): void {
    if (this.#disposed) return;
    this.#active = active;
    if (active && !this.#reducedMotion() && this.#renderer) this.#start();
    else this.#stop();
    this.#renderFrame();
  }

  public update(state: DeviceViewState): void {
    if (this.#disposed) return;
    this.#state = state;
    this.#hero.apply(state);
    this.#renderFrame();
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#stop();
    this.#resizeObserver?.disconnect();
    this.#hero.dispose();
    if (this.#renderer) {
      this.#renderer.dispose();
      this.#renderer.forceContextLoss();
      this.#renderer.domElement.remove();
      shared.count = Math.max(0, shared.count - 1);
    }
  }

  #resize(width: number, height: number): void {
    if (!this.#renderer || this.#disposed) return;
    const nextWidth = Math.max(1, Math.round(width));
    const nextHeight = Math.max(1, Math.round(height));
    if (nextWidth === this.#width && nextHeight === this.#height) return;
    this.#width = nextWidth;
    this.#height = nextHeight;
    this.#renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.#renderer.setSize(nextWidth, nextHeight, false);
    this.#camera.aspect = nextWidth / nextHeight;
    this.#camera.updateProjectionMatrix();
    this.#renderFrame();
  }

  #start(): void {
    if (this.#raf || !this.#renderer || this.#disposed) return;
    this.#last = performance.now();
    const loop = (now: number): void => {
      const delta = now - this.#last;
      this.#last = now;
      this.#spin += delta * 0.00016;
      this.#group.rotation.y = this.#spin;
      this.#hero.tick(delta, this.#state);
      this.#renderFrame();
      this.#raf = this.#active && !this.#disposed ? requestAnimationFrame(loop) : 0;
    };
    this.#raf = requestAnimationFrame(loop);
  }

  #stop(): void { if (this.#raf) cancelAnimationFrame(this.#raf); this.#raf = 0; }
  #renderFrame(): void { if (this.#renderer && !this.#disposed) this.#renderer.render(this.#scene, this.#camera); }
}
