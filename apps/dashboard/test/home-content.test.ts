import { describe, expect, it } from 'vitest';

import { defaultViewState, type DeviceView } from '../src/phase5/experience-model.js';
import { buildSummaryTiles, deriveSummary } from '../src/phase5/home-content.js';

const view = (partial: Partial<DeviceView> & Pick<DeviceView, 'id' | 'category'>): DeviceView => ({
  name: partial.id,
  roomId: 'r1',
  roomName: 'Living Room',
  capabilities: [],
  favourite: false,
  available: true,
  state: defaultViewState(),
  ...partial,
});

const state = (partial: Partial<DeviceView['state']>): DeviceView['state'] => ({
  ...defaultViewState(),
  ...partial,
});

describe('home content summaries', () => {
  const views: DeviceView[] = [
    view({ id: 'l1', category: 'light', state: state({ on: true, brightness: 0.7 }) }),
    view({ id: 'l2', category: 'light', state: state({ on: false }) }),
    view({
      id: 'c1',
      category: 'climate',
      state: state({ currentTemp: 22, humidity: 40 }),
    }),
    view({
      id: 's1',
      category: 'sensor',
      state: state({ currentTemp: 24, humidity: 60 }),
    }),
    view({
      id: 'lock1',
      category: 'security',
      capabilities: ['lock'],
      state: state({ locked: true }),
    }),
    view({ id: 'cov1', category: 'cover', state: state({ position: 72 }) }),
    view({ id: 'tv1', category: 'media', state: state({ playing: true }) }),
    view({
      id: 'off1',
      category: 'appliance',
      name: 'Heater',
      state: state({ available: false }),
    }),
  ];

  it('derives live counts, averages and offline devices', () => {
    const summary = deriveSummary(views);
    expect(summary.lightsOn).toBe(1);
    expect(summary.lightsTotal).toBe(2);
    expect(summary.averageTemp).toBeCloseTo(23);
    expect(summary.humidity).toBeCloseTo(50);
    expect(summary.locked).toBe(1);
    expect(summary.locksTotal).toBe(1);
    expect(summary.coversOpen).toBe(1);
    expect(summary.mediaPlaying).toBe(1);
    expect(summary.offline).toEqual(['Heater']);
  });

  it('builds jumpable summary tiles only for present categories', () => {
    const tiles = buildSummaryTiles(views, deriveSummary(views));
    const ids = tiles.map((tile) => tile.id);
    expect(ids).toEqual(['lights', 'climate', 'security', 'covers', 'media']);
    expect(tiles.find((tile) => tile.id === 'lights')).toMatchObject({
      value: '1 on',
      jumpDeviceId: 'l1',
    });
    expect(tiles.find((tile) => tile.id === 'security')?.value).toBe('Secured');
  });

  it('omits everything for an empty home', () => {
    expect(buildSummaryTiles([], deriveSummary([]))).toEqual([]);
    expect(deriveSummary([]).averageTemp).toBeNull();
  });
});
