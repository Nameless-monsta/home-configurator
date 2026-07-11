import { describe, expect, it } from 'vitest';

import { createResponsiveProfile } from '../src/responsive.js';

describe('createResponsiveProfile', () => {
  it('classifies portrait phones as compact', () => {
    expect(createResponsiveProfile({ width: 390, height: 844 })).toMatchObject({
      viewport: 'phone',
      orientation: 'portrait',
      layout: 'compact',
      short: false,
    });
  });

  it('keeps short landscape phones compact', () => {
    expect(createResponsiveProfile({ width: 844, height: 390, coarsePointer: true })).toMatchObject(
      {
        viewport: 'tablet',
        orientation: 'landscape',
        layout: 'compact',
        short: true,
        coarsePointer: true,
      },
    );
  });

  it('uses compact layout for portrait tablets', () => {
    expect(createResponsiveProfile({ width: 820, height: 1180 })).toMatchObject({
      viewport: 'tablet',
      orientation: 'portrait',
      layout: 'compact',
    });
  });

  it('uses regular layout for landscape tablets with enough height', () => {
    expect(createResponsiveProfile({ width: 1024, height: 768 })).toMatchObject({
      viewport: 'tablet',
      orientation: 'landscape',
      layout: 'regular',
    });
  });

  it('uses wide layout for desktop viewports', () => {
    expect(createResponsiveProfile({ width: 1440, height: 900 })).toMatchObject({
      viewport: 'desktop',
      orientation: 'landscape',
      layout: 'wide',
    });
  });

  it('normalises negative dimensions', () => {
    expect(createResponsiveProfile({ width: -1, height: -1 })).toMatchObject({
      width: 0,
      height: 0,
      viewport: 'phone',
      layout: 'compact',
    });
  });
});
