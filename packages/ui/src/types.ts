import type {
  CanonicalDevice,
  CanonicalRoom,
  ConfirmedRuntimeSnapshot,
} from '@home-configurator/home-assistant';

export type NavigationMode = 'rooms' | 'devices';
export type OverlayKind = 'navigation' | 'configurator' | 'diagnostics' | null;

export interface UiSelection {
  readonly roomId?: string;
  readonly deviceId?: string;
}

export interface UiState {
  readonly navigationOpen: boolean;
  readonly navigationMode: NavigationMode;
  readonly overlay: OverlayKind;
  readonly selection: UiSelection;
}

export type UiAction =
  | { readonly type: 'toggle-navigation' }
  | { readonly type: 'close-overlays' }
  | { readonly type: 'set-navigation-mode'; readonly mode: NavigationMode }
  | { readonly type: 'select-room'; readonly roomId: string }
  | { readonly type: 'select-device'; readonly deviceId: string; readonly roomId?: string }
  | { readonly type: 'open-diagnostics' };

export interface NavigationItem {
  readonly id: string;
  readonly label: string;
  readonly meta: string;
  readonly selected: boolean;
}

export interface NavigationModel {
  readonly rooms: readonly NavigationItem[];
  readonly devices: readonly NavigationItem[];
}

export interface UiSnapshot {
  readonly state: UiState;
  readonly home: ConfirmedRuntimeSnapshot;
  readonly selectedRoom?: CanonicalRoom;
  readonly selectedDevice?: CanonicalDevice;
}

export interface UiDiagnostics {
  readonly runtimePhase: string;
  readonly homeAssistantStatus: string;
  readonly frame: number;
  readonly gestures: number;
  readonly drawCalls?: number;
}
