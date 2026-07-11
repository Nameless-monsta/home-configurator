import { describe, expect, it } from 'vitest';

import { QualityManager } from '../src/index.js';

describe('QualityManager', () => {
  it('caps device pixel ratio per quality tier', () => {
    const quality = new QualityManager('essential');
    expect(quality.resolvePixelRatio(3)).toBe(1);

    quality.setTier('balanced');
    expect(quality.resolvePixelRatio(3)).toBe(1.5);

    quality.setTier('full');
    expect(quality.resolvePixelRatio(3)).toBe(2);
  });

  it('exposes deterministic feature profiles', () => {
    const quality = new QualityManager('balanced');
    expect(quality.profile.shadows).toBe(true);
    expect(quality.profile.postProcessing).toBe(true);
    expect(quality.profile.shadowMapSize).toBe(1024);
  });
});
