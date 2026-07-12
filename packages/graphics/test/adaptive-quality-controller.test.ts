import { describe, expect, it } from 'vitest';

import { AdaptiveQualityController } from '../src/index.js';

describe('AdaptiveQualityController', () => {
  it('downgrades after a sustained average frame-time overrun', () => {
    const controller = new AdaptiveQualityController({
      initialTier: 'full',
      downgradeWindowMs: 100,
      slowFrameWindowMs: 300,
      upgradeWindowMs: 500,
    });

    let decision = null;
    for (let index = 0; index < 6; index += 1) {
      decision ??= controller.observe(20);
    }

    expect(decision).toMatchObject({
      previousTier: 'full',
      tier: 'balanced',
      reason: 'average-frame-time',
    });
  });

  it('downgrades when more than ten percent of frames are severely slow', () => {
    const controller = new AdaptiveQualityController({
      initialTier: 'balanced',
      downgradeWindowMs: 1000,
      slowFrameWindowMs: 100,
      upgradeWindowMs: 1000,
    });

    const samples = [10, 10, 10, 10, 40, 10, 10, 10];
    let decision = null;
    for (const sample of samples) {
      decision ??= controller.observe(sample);
    }

    expect(decision).toMatchObject({
      previousTier: 'balanced',
      tier: 'essential',
      reason: 'slow-frame-ratio',
    });
  });

  it('requires a longer stable window before upgrading', () => {
    const controller = new AdaptiveQualityController({
      initialTier: 'essential',
      downgradeWindowMs: 100,
      slowFrameWindowMs: 100,
      upgradeWindowMs: 200,
    });

    expect(controller.observe(10)).toBeNull();

    let decision = null;
    for (let index = 0; index < 20; index += 1) {
      decision ??= controller.observe(10);
    }

    expect(decision).toMatchObject({
      previousTier: 'essential',
      tier: 'balanced',
      reason: 'stable-frame-time',
    });
  });

  it('resets its sampling window when a tier is set explicitly', () => {
    const controller = new AdaptiveQualityController({
      initialTier: 'full',
      downgradeWindowMs: 100,
    });

    controller.observe(25);
    controller.setTier('essential');

    expect(controller.tier).toBe('essential');
    expect(controller.observe(10)).toBeNull();
  });
});
