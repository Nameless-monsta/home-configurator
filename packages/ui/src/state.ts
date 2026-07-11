import type { ConfirmedRuntimeSnapshot } from '@home-configurator/home-assistant';

import type { NavigationModel, UiAction, UiSnapshot, UiState } from './types.js';

export const initialUiState: UiState = {
  navigationOpen: false,
  navigationMode: 'rooms',
  overlay: null,
  selection: {},
};

export const reduceUiState = (state: UiState, action: UiAction): UiState => {
  switch (action.type) {
    case 'toggle-navigation':
      return {
        ...state,
        navigationOpen: !state.navigationOpen,
        overlay: state.navigationOpen ? null : 'navigation',
      };
    case 'close-overlays':
      return { ...state, navigationOpen: false, overlay: null };
    case 'set-navigation-mode':
      return { ...state, navigationMode: action.mode, navigationOpen: true, overlay: 'navigation' };
    case 'select-room':
      return {
        ...state,
        navigationOpen: false,
        overlay: null,
        selection: { roomId: action.roomId },
      };
    case 'select-device':
      return {
        ...state,
        navigationOpen: false,
        overlay: 'configurator',
        selection: { roomId: action.roomId, deviceId: action.deviceId },
      };
    case 'open-diagnostics':
      return { ...state, navigationOpen: false, overlay: 'diagnostics' };
  }
};

export const createUiSnapshot = (
  state: UiState,
  home: ConfirmedRuntimeSnapshot,
): UiSnapshot => ({
  state,
  home,
  selectedRoom: state.selection.roomId
    ? home.rooms.find((room) => room.id === state.selection.roomId)
    : undefined,
  selectedDevice: state.selection.deviceId
    ? home.devices.find((device) => device.id === state.selection.deviceId)
    : undefined,
});

export const buildNavigationModel = (
  home: ConfirmedRuntimeSnapshot,
  state: UiState,
): NavigationModel => ({
  rooms: home.rooms.map((room) => ({
    id: room.id,
    label: room.name,
    meta: `${room.deviceIds.length} ${room.deviceIds.length === 1 ? 'device' : 'devices'}`,
    selected: state.selection.roomId === room.id,
  })),
  devices: home.devices.map((device) => ({
    id: device.id,
    label: device.name,
    meta: device.capabilities.join(' · ') || 'No controls',
    selected: state.selection.deviceId === device.id,
  })),
});
