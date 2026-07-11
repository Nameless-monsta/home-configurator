import { Diagnostics } from '@home-configurator/runtime';
import { describe, expect, it, vi } from 'vitest';

import { InputEngine, NavigationEngine, TransitionDirector } from '../src/index.js';

const pointer = (
  id: number,
  phase: 'down' | 'move' | 'up' | 'cancel',
  x: number,
  y: number,
  timestamp: number,
) => ({ id, type: 'touch' as const, phase, x, y, pressure: 1, buttons: 1, timestamp });

describe('InputEngine', () => {
  it('keeps one-finger orbit separate from two-finger brightness', () => {
    const diagnostics = new Diagnostics();
    const intents: string[] = [];
    const engine = new InputEngine({ diagnostics, now: () => 1000 });
    engine.registerTarget({
      id: 'light',
      layer: 'control',
      gestures: ['orbit', 'two-finger-vertical'],
      onIntent: (intent) => intents.push(intent.type),
    });
    engine.setActiveTarget('light');

    engine.handlePointer(pointer(1, 'down', 10, 10, 0));
    engine.handlePointer(pointer(1, 'move', 30, 10, 10));
    expect(intents).toContain('orbit.update');
    expect(intents).not.toContain('two-finger-vertical.update');

    engine.cancelAll('test reset');
    intents.length = 0;
    engine.handlePointer(pointer(1, 'down', 10, 10, 0));
    engine.handlePointer(pointer(2, 'down', 30, 10, 0));
    engine.handlePointer(pointer(1, 'move', 10, 30, 10));
    engine.handlePointer(pointer(2, 'move', 30, 30, 10));
    expect(intents).toContain('two-finger-vertical.update');
    expect(intents).not.toContain('orbit.update');
  });

  it('cancels safely when pointer count changes', () => {
    const diagnostics = new Diagnostics();
    const engine = new InputEngine({ diagnostics });
    engine.registerTarget({ id: 'device', layer: 'object', gestures: ['orbit'], onIntent: vi.fn() });
    engine.setActiveTarget('device');
    engine.handlePointer(pointer(1, 'down', 0, 0, 0));
    engine.handlePointer(pointer(2, 'down', 10, 0, 0));
    expect(engine.getActiveSessions()).toHaveLength(0);
  });
});

describe('NavigationEngine', () => {
  it('validates hierarchy and supports back navigation', () => {
    const navigation = new NavigationEngine(new Diagnostics());
    expect(navigation.navigate({ level: 'room', roomId: 'living' })).toBe(true);
    expect(navigation.navigate({ level: 'device', roomId: 'living', deviceId: 'lamp' })).toBe(true);
    expect(navigation.location.level).toBe('device');
    expect(navigation.back()).toBe(true);
    expect(navigation.location.level).toBe('room');
    expect(() => navigation.navigate({ level: 'device', deviceId: 'lamp' })).toThrow('requires roomId');
  });
});

describe('TransitionDirector', () => {
  it('finishes deterministic transitions', () => {
    const updates: number[] = [];
    const director = new TransitionDirector(new Diagnostics());
    director.play({ id: 'room-device', durationMs: 100, onUpdate: (progress) => updates.push(progress) });
    director.tick({ timestampMs: 50, deltaMs: 50, frame: 1 });
    director.tick({ timestampMs: 100, deltaMs: 50, frame: 2 });
    expect(director.active).toBe(false);
    expect(updates.at(-1)).toBe(1);
  });
});
