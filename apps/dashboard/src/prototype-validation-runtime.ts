import { validatePrototype, type PrototypeValidationResult } from './prototype-validation.js';

const ROOT_SELECTOR = '#app';
const STAGE_SELECTOR = '[data-ui-stage], .hc-stage, canvas';
const DIAGNOSTICS_SELECTOR = '[data-ui-diagnostics], [role="dialog"][aria-label*="iagnostic"]';
const FALLBACK_SELECTOR = 'canvas';

const media = {
  coarsePointer: window.matchMedia('(pointer: coarse)'),
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
};

let keyboardNavigationUsed = false;
let latestResult: PrototypeValidationResult | null = null;

const findStage = (root: HTMLElement): HTMLElement | null => {
  const candidate = root.querySelector<HTMLElement>(STAGE_SELECTOR);
  return candidate ?? null;
};

const ensureStageSemantics = (root: HTMLElement): boolean => {
  const stage = findStage(root);
  if (!stage) return false;

  if (!stage.hasAttribute('tabindex')) stage.tabIndex = 0;
  if (!stage.hasAttribute('role')) stage.setAttribute('role', 'application');
  if (!stage.hasAttribute('aria-label')) {
    stage.setAttribute(
      'aria-label',
      'Interactive Home Configurator stage. Select a device, drag to change colour, and use arrow keys or the mouse wheel to change brightness.',
    );
  }
  stage.dataset.prototypeKeyboard = 'enabled';
  return stage.getAttribute('aria-label')?.trim().length !== 0;
};

const diagnosticsAvailable = (root: HTMLElement): boolean =>
  root.querySelector(DIAGNOSTICS_SELECTOR) !== null || root.textContent?.includes('Diagnostics') === true;

const fallbackModelAvailable = (root: HTMLElement): boolean =>
  root.querySelector(FALLBACK_SELECTOR) !== null;

const publish = (root: HTMLElement): void => {
  const accessibleName = ensureStageSemantics(root);
  latestResult = validatePrototype({
    width: window.innerWidth,
    height: window.innerHeight,
    coarsePointer: media.coarsePointer.matches,
    reducedMotion: media.reducedMotion.matches,
    keyboardNavigation: accessibleName,
    accessibleName,
    fallbackModelAvailable: fallbackModelAvailable(root),
    diagnosticsAvailable: diagnosticsAvailable(root),
  });

  root.dataset.prototypeViewport = latestResult.viewport;
  root.dataset.prototypeValidation = latestResult.passed ? 'passed' : 'failed';
  root.dataset.prototypeFailures = latestResult.failures.join(',');
  root.dataset.prototypeReducedMotion = String(media.reducedMotion.matches);
  root.dataset.prototypeCoarsePointer = String(media.coarsePointer.matches);
  root.dataset.prototypeKeyboardUsed = String(keyboardNavigationUsed);

  window.dispatchEvent(
    new CustomEvent('home-configurator:prototype-validation', {
      detail: latestResult,
    }),
  );
};

const root = document.querySelector<HTMLElement>(ROOT_SELECTOR);
if (root) {
  const schedulePublish = (): void => {
    window.requestAnimationFrame(() => publish(root));
  };

  const observer = new MutationObserver(schedulePublish);
  observer.observe(root, { childList: true, subtree: true, attributes: true });

  window.addEventListener('resize', schedulePublish, { passive: true });
  window.addEventListener('keydown', () => {
    keyboardNavigationUsed = true;
    schedulePublish();
  });
  media.coarsePointer.addEventListener('change', schedulePublish);
  media.reducedMotion.addEventListener('change', schedulePublish);

  schedulePublish();
}

export const getPrototypeValidationResult = (): PrototypeValidationResult | null => latestResult;
