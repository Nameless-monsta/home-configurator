import { describe, expect, it } from 'vitest';

import { formatRoute, parseRoute, routesEqual } from '../src/phase5/experience-router.js';

describe('experience router', () => {
  it('parses the canonical routes', () => {
    expect(parseRoute('')).toEqual({ kind: 'home' });
    expect(parseRoute('#/')).toEqual({ kind: 'home' });
    expect(parseRoute('#/home')).toEqual({ kind: 'home' });
    expect(parseRoute('#/alarm')).toEqual({ kind: 'alarm' });
    expect(parseRoute('#/settings')).toEqual({ kind: 'settings' });
    expect(parseRoute('#/room/living-room')).toEqual({ kind: 'room', roomId: 'living-room' });
    expect(parseRoute('#/device/ikea-lamp')).toEqual({ kind: 'device', deviceId: 'ikea-lamp' });
  });

  it('round-trips format → parse for every route kind', () => {
    const routes = [
      { kind: 'home' },
      { kind: 'alarm' },
      { kind: 'settings' },
      { kind: 'room', roomId: 'kitchen' },
      { kind: 'device', deviceId: 'robot vac/1' },
    ] as const;
    for (const route of routes) {
      expect(parseRoute(formatRoute(route))).toEqual(route);
    }
  });

  it('treats unknown and malformed hashes as home', () => {
    expect(parseRoute('#/nonsense')).toEqual({ kind: 'home' });
    expect(parseRoute('#/room/')).toEqual({ kind: 'home' });
    expect(parseRoute('#/device')).toEqual({ kind: 'home' });
  });

  it('compares routes structurally', () => {
    expect(routesEqual({ kind: 'room', roomId: 'a' }, { kind: 'room', roomId: 'a' })).toBe(true);
    expect(routesEqual({ kind: 'room', roomId: 'a' }, { kind: 'room', roomId: 'b' })).toBe(false);
    expect(routesEqual({ kind: 'home' }, { kind: 'alarm' })).toBe(false);
  });
});
