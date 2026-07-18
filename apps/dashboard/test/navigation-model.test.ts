import { describe, expect, it } from 'vitest';

import { navActiveItem, roomsItemLabel } from '../src/phase5/navigation-bar.js';
import { filterDevices } from '../src/phase5/search-overlay.js';
import { defaultViewState, type DeviceView } from '../src/phase5/experience-model.js';

describe('navigation model', () => {
  const rooms = [
    { id: 'living', name: 'Living Room', deviceIds: ['a'] },
    { id: 'bed', name: 'Bedroom', deviceIds: ['b'] },
  ];

  it('maps sections to active nav items', () => {
    expect(navActiveItem({ kind: 'home' })).toBe('home');
    expect(navActiveItem({ kind: 'room', roomId: 'bed' })).toBe('rooms');
    expect(navActiveItem({ kind: 'alarm' })).toBe('alarm');
    expect(navActiveItem({ kind: 'settings' })).toBe('settings');
  });

  it('labels the rooms item with the active room name', () => {
    expect(roomsItemLabel({ kind: 'home' }, rooms)).toBe('Rooms');
    expect(roomsItemLabel({ kind: 'room', roomId: 'bed' }, rooms)).toBe('Bedroom');
    expect(roomsItemLabel({ kind: 'room', roomId: 'gone' }, rooms)).toBe('Rooms');
  });
});

describe('device search filter', () => {
  const device = (id: string, name: string, roomName: string): DeviceView => ({
    id,
    name,
    roomId: roomName,
    roomName,
    category: 'light',
    capabilities: [],
    favourite: false,
    available: true,
    state: defaultViewState(),
  });
  const views = [device('a', 'Floor Lamp', 'Living Room'), device('b', 'Bedside Light', 'Bedroom')];

  it('matches by device name, room and category, case-insensitively', () => {
    expect(filterDevices(views, 'floor').map((v) => v.id)).toEqual(['a']);
    expect(filterDevices(views, 'BEDROOM').map((v) => v.id)).toEqual(['b']);
    expect(filterDevices(views, 'lighting').map((v) => v.id)).toEqual(['a', 'b']);
    expect(filterDevices(views, '  ')).toHaveLength(2);
    expect(filterDevices(views, 'vacuum')).toHaveLength(0);
  });
});
