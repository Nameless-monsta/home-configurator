import { describe, expect, it } from 'vitest';

import {
  DevicePanelRegistry,
  type DevicePanelProvider,
  type DevicePanelSource,
} from '../src/device-panels.js';

const source = (overrides: Partial<DevicePanelSource> = {}): DevicePanelSource => ({
  id: 'device.demo',
  name: 'Demo Device',
  available: true,
  capabilities: [],
  values: {},
  ...overrides,
});

describe('DevicePanelRegistry', () => {
  it('builds a lighting panel from light capabilities', () => {
    const document = new DevicePanelRegistry().buildDocument(
      source({
        capabilities: ['power', 'brightness', 'colorTemperature', 'color'],
        values: { power: true, brightness: 64, colorTemperature: 3200, color: '#ffaa55' },
      }),
    );

    expect(document.sections.map((section) => section.id)).toContain('lighting');
    expect(document.sections[0]?.fields.map((field) => field.kind)).toEqual([
      'toggle',
      'slider',
      'slider',
      'color',
    ]);
  });

  it('builds climate controls and environment status', () => {
    const document = new DevicePanelRegistry().buildDocument(
      source({
        capabilities: ['power', 'targetTemperature', 'hvacMode', 'fanMode'],
        values: {
          power: true,
          targetTemperature: 22,
          hvacMode: 'cool',
          fanMode: 'auto',
          currentTemperature: 23.5,
          humidity: 48,
        },
      }),
    );

    expect(document.sections.map((section) => section.id)).toEqual(['climate', 'climate-status']);
    expect(document.sections[0]?.fields.some((field) => field.kind === 'segmented')).toBe(true);
  });

  it('builds cover actions and position control', () => {
    const document = new DevicePanelRegistry().buildDocument(
      source({ capabilities: ['coverPosition'], values: { coverPosition: 72 } }),
    );

    expect(document.sections[0]?.actions?.map((action) => action.id)).toEqual([
      'cover.open',
      'cover.stop',
      'cover.close',
    ]);
  });

  it('builds media playback actions and source controls', () => {
    const document = new DevicePanelRegistry().buildDocument(
      source({
        capabilities: ['volume', 'mediaPlayback', 'mediaSource'],
        values: { volume: 34, mediaSource: 'tv', nowPlaying: 'Demo' },
      }),
    );

    expect(document.sections[0]?.fields.map((field) => field.id)).toEqual([
      'volume',
      'mediaSource',
      'nowPlaying',
    ]);
    expect(document.sections[0]?.actions).toHaveLength(3);
  });

  it('renders sensor values as read-only status fields', () => {
    const document = new DevicePanelRegistry().buildDocument(
      source({ capabilities: ['sensor'], values: { temperature: '24 °C', humidity: '52 %' } }),
    );

    expect(document.sections[0]?.fields).toEqual([
      expect.objectContaining({ id: 'temperature', kind: 'status', readOnly: true }),
      expect.objectContaining({ id: 'humidity', kind: 'status', readOnly: true }),
    ]);
  });

  it('falls back for unknown capability sets', () => {
    const document = new DevicePanelRegistry().buildDocument(
      source({ capabilities: ['power'], values: { power: true } }),
    );

    expect(document.sections[0]?.id).toBe('overview');
  });

  it('prepends identity metadata when provided', () => {
    const document = new DevicePanelRegistry().buildDocument(
      source({ capabilities: ['sensor'], metadata: { manufacturer: 'Demo', entities: 2 } }),
    );

    expect(document.sections[0]).toEqual(
      expect.objectContaining({ id: 'identity', collapsed: true }),
    );
  });

  it('allows a provider to be replaced by id', () => {
    const registry = new DevicePanelRegistry();
    const replacement: DevicePanelProvider = {
      id: 'light',
      priority: 200,
      supports: () => true,
      build: () => [{ id: 'custom-light', title: 'Custom', fields: [] }],
    };
    registry.register(replacement);

    expect(registry.buildDocument(source({ capabilities: ['brightness'] })).sections[0]?.id).toBe(
      'custom-light',
    );
  });
});
