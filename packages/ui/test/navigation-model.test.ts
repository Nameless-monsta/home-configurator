import { describe, expect, it } from 'vitest';

import { UiNavigationModel } from '../src/navigation-model.js';

const rooms = [
  { id: 'living', name: 'Living Room', deviceIds: ['lamp', 'tv'] },
  { id: 'bedroom', name: 'Bedroom', deviceIds: ['ac'] },
] as const;

const devices = [
  { id: 'lamp', name: 'Lamp', roomId: 'living' },
  { id: 'tv', name: 'TV', roomId: 'living' },
  { id: 'ac', name: 'AC', roomId: 'bedroom' },
] as const;

describe('UiNavigationModel', () => {
  it('selects the first room and first device by default', () => {
    const model = new UiNavigationModel(rooms, devices);
    expect(model.snapshot()).toMatchObject({ roomId: 'living', deviceId: 'lamp' });
  });

  it('moves to the first device when a room is selected', () => {
    const model = new UiNavigationModel(rooms, devices);
    model.selectRoom('bedroom');
    expect(model.snapshot()).toMatchObject({ roomId: 'bedroom', deviceId: 'ac' });
  });

  it('keeps navigation history with back and forward support', () => {
    const model = new UiNavigationModel(rooms, devices);
    model.selectDevice('tv');
    model.selectRoom('bedroom');

    model.back();
    expect(model.snapshot()).toMatchObject({ roomId: 'living', deviceId: 'tv' });

    model.forward();
    expect(model.snapshot()).toMatchObject({ roomId: 'bedroom', deviceId: 'ac' });
  });

  it('falls back safely when the selected room disappears', () => {
    const model = new UiNavigationModel(rooms, devices);
    model.selectRoom('bedroom');
    model.setItems([rooms[0]], [devices[0], devices[1]]);
    expect(model.snapshot()).toMatchObject({ roomId: 'living', deviceId: 'lamp' });
  });
});
