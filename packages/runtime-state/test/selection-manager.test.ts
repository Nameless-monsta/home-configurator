import { describe, expect, it } from 'vitest';

import { SelectionManager } from '../src/index.js';

describe('SelectionManager', () => {
  it('keeps room, device, hover and focus state synchronized', () => {
    const selection = new SelectionManager();
    const versions: number[] = [];
    selection.subscribe((snapshot) => versions.push(snapshot.version));

    expect(selection.selectRoom('living')).toBe(true);
    expect(selection.selectDevice('light-a', 'living')).toBe(true);
    expect(selection.hoverDevice('light-b')).toBe(true);
    expect(selection.focusDevice('light-a')).toBe(true);

    expect(selection.snapshot()).toEqual({
      version: 4,
      selectedRoomId: 'living',
      selectedDeviceId: 'light-a',
      hoveredDeviceId: 'light-b',
      focusedDeviceId: 'light-a',
    });
    expect(versions).toEqual([1, 2, 3, 4]);
  });

  it('avoids duplicate emissions and clears selection', () => {
    const selection = new SelectionManager();
    selection.selectDevice('light-a', 'living');

    expect(selection.selectDevice('light-a', 'living')).toBe(false);
    expect(selection.clear()).toBe(true);
    expect(selection.clear()).toBe(false);
    expect(selection.snapshot()).toMatchObject({
      selectedRoomId: null,
      selectedDeviceId: null,
      hoveredDeviceId: null,
      focusedDeviceId: null,
    });
  });

  it('clears device selection when the room changes', () => {
    const selection = new SelectionManager();
    selection.selectDevice('light-a', 'living');
    selection.selectRoom('bedroom');

    expect(selection.snapshot()).toMatchObject({
      selectedRoomId: 'bedroom',
      selectedDeviceId: null,
    });
  });
});
