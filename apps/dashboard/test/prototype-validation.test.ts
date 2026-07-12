import { describe, expect, it } from 'vitest';

import { classifyPrototypeViewport, validatePrototype } from '../src/prototype-validation.js';

describe('prototype validation', () => {
  it('classifies phone, tablet and desktop viewports', () => {
    expect(classifyPrototypeViewport(430, 932)).toBe('phone');
    expect(classifyPrototypeViewport(820, 1180)).toBe('tablet-portrait');
    expect(classifyPrototypeViewport(1180, 820)).toBe('tablet-landscape');
    expect(classifyPrototypeViewport(1440, 900)).toBe('desktop');
  });

  it('passes a complete prototype acceptance profile', () => {
    expect(
      validatePrototype({
        width: 1024,
        height: 1366,
        coarsePointer: true,
        reducedMotion: true,
        keyboardNavigation: true,
        accessibleName: true,
        fallbackModelAvailable: true,
        diagnosticsAvailable: true,
      }),
    ).toEqual({ viewport: 'tablet-portrait', passed: true, failures: [] });
  });

  it('reports missing accessibility and resilience requirements', () => {
    expect(
      validatePrototype({
        width: 1440,
        height: 900,
        coarsePointer: false,
        reducedMotion: false,
        keyboardNavigation: false,
        accessibleName: false,
        fallbackModelAvailable: false,
        diagnosticsAvailable: false,
      }).failures,
    ).toEqual(['keyboard-navigation', 'accessible-name', 'fallback-model', 'diagnostics']);
  });
});
