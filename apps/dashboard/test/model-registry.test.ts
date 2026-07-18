import { describe, expect, it } from 'vitest';

import {
  HeroModelRegistry,
  defaultOverride,
  normalizeOverride,
  resolveModel,
  type OverrideStorage,
} from '../src/phase5/model-registry.js';

const memoryStorage = (): OverrideStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
};

describe('model registry', () => {
  it('normalises persisted overrides and clamps ranges', () => {
    expect(normalizeOverride(null)).toEqual(defaultOverride());
    expect(
      normalizeOverride({
        source: 'url',
        url: ' https://x/lamp.glb ',
        scale: 99,
        rotationYDeg: 720,
        offsetY: -9,
      }),
    ).toEqual({
      source: 'url',
      url: 'https://x/lamp.glb',
      scale: 4,
      rotationYDeg: 360,
      offsetY: -1.5,
    });
    expect(normalizeOverride({ source: 'url', url: '' }).source).toBe('procedural');
  });

  it('resolves by user override, then manufacturer alias, then fallback', () => {
    const overrides = {
      lamp: {
        source: 'url' as const,
        url: 'https://x/custom.glb',
        scale: 1,
        rotationYDeg: 0,
        offsetY: 0,
      },
    };
    const aliases = {
      'ikea::trådfri': 'https://x/tradfri.glb',
      'roborock::*': 'https://x/robo.glb',
    };
    expect(resolveModel('lamp', overrides, 'IKEA', 'TRÅDFRI', aliases).kind).toBe('override');
    expect(resolveModel('other', {}, 'IKEA', 'TRÅDFRI', aliases)).toMatchObject({
      kind: 'alias',
      override: { url: 'https://x/tradfri.glb' },
    });
    expect(resolveModel('vac', {}, 'Roborock', 'S8', aliases).override.url).toBe(
      'https://x/robo.glb',
    );
    expect(resolveModel('plain', {}, 'Acme', 'X', aliases).kind).toBe('fallback');
    expect(resolveModel('plain', {}).kind).toBe('fallback');
  });

  it('persists overrides through storage and survives corrupt payloads', () => {
    const storage = memoryStorage();
    const registry = new HeroModelRegistry(storage);
    registry.set('lamp', {
      source: 'url',
      url: 'https://x/a.glb',
      scale: 1.5,
      rotationYDeg: 45,
      offsetY: 0.2,
    });
    expect(new HeroModelRegistry(storage).get('lamp').url).toBe('https://x/a.glb');
    registry.clear('lamp');
    expect(new HeroModelRegistry(storage).has('lamp')).toBe(false);

    storage.setItem('home-configurator.model-overrides.v1', '{not json');
    expect(new HeroModelRegistry(storage).get('lamp')).toEqual(defaultOverride());
  });
});
