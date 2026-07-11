import { UiMotionController, type UiMotionOptions } from './motion.js';

export interface UiMotionOrchestratorOptions extends UiMotionOptions {
  readonly root: HTMLElement;
}

export class UiMotionOrchestrator {
  readonly #root: HTMLElement;
  readonly #motion: UiMotionController;
  readonly #observer: MutationObserver;
  readonly #known = new WeakSet<Element>();

  public constructor(options: UiMotionOrchestratorOptions) {
    this.#root = options.root;
    this.#motion = new UiMotionController(options);
    this.#root.dataset['uiMotion'] = 'ready';
    this.#root.addEventListener('pointerdown', this.#handlePointerDown, true);
    this.#root.addEventListener('click', this.#handleClick, true);
    this.#observer = new MutationObserver((records) => this.#handleMutations(records));
    this.#observer.observe(this.#root, {
      attributes: true,
      attributeFilter: ['hidden', 'aria-expanded', 'aria-checked', 'data-menu-open'],
      childList: true,
      subtree: true,
    });
    this.#revealNewNodes(this.#root);
  }

  public get controller(): UiMotionController {
    return this.#motion;
  }

  public dispose(): void {
    this.#observer.disconnect();
    this.#root.removeEventListener('pointerdown', this.#handlePointerDown, true);
    this.#root.removeEventListener('click', this.#handleClick, true);
    this.#motion.dispose(this.#root);
    delete this.#root.dataset['uiMotion'];
  }

  readonly #handlePointerDown = (event: Event): void => {
    const target = event.target instanceof Element ? event.target.closest('button, [role="button"]') : null;
    if (target && !target.hasAttribute('disabled')) this.#motion.press(target);
  };

  readonly #handleClick = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    const section = target?.closest('.ui-configurator-section');
    if (section) {
      const body = section.querySelector('.ui-configurator-section-body');
      if (body && !body.hasAttribute('hidden')) this.#motion.reveal(body);
    }
  };

  #handleMutations(records: readonly MutationRecord[]): void {
    for (const record of records) {
      if (record.type === 'childList') {
        for (const node of record.addedNodes) {
          if (node instanceof Element) this.#revealNewNodes(node);
        }
        continue;
      }
      if (!(record.target instanceof Element)) continue;
      const target = record.target;
      if (record.attributeName === 'hidden') {
        if (target.hasAttribute('hidden')) continue;
        if (target.matches('[data-ui-overlay], .ui-navigation-menu')) this.#motion.enterPanel(target);
        else this.#motion.reveal(target);
      }
      if (record.attributeName === 'aria-checked') this.#motion.reveal(target);
      if (record.attributeName === 'data-menu-open' && target.getAttribute('data-menu-open') === 'true') {
        this.#motion.enterPanel(target);
      }
    }
  }

  #revealNewNodes(root: Element): void {
    const candidates = [
      ...(root.matches('.ui-configurator-section, .ui-navigation, .ui-configurator') ? [root] : []),
      ...root.querySelectorAll('.ui-configurator-section, .ui-navigation, .ui-configurator'),
    ];
    for (const element of candidates) {
      if (this.#known.has(element)) continue;
      this.#known.add(element);
      this.#motion.reveal(element);
    }
  }
}
