export interface UiNavigationDevice {
  readonly id: string;
  readonly name: string;
  readonly roomId: string;
  readonly available?: boolean;
  readonly meta?: string;
}

export interface UiNavigationRoom {
  readonly id: string;
  readonly name: string;
  readonly deviceIds: readonly string[];
}

export type UiNavigationMenu = 'rooms' | 'devices' | null;

export interface UiNavigationLocation {
  readonly roomId: string | null;
  readonly deviceId: string | null;
}

export interface UiNavigationSnapshot extends UiNavigationLocation {
  readonly rooms: readonly UiNavigationRoom[];
  readonly devices: readonly UiNavigationDevice[];
  readonly menu: UiNavigationMenu;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
}

export interface UiNavigationOptions {
  readonly root: HTMLElement;
  readonly rooms?: readonly UiNavigationRoom[];
  readonly devices?: readonly UiNavigationDevice[];
  readonly onNavigate?: (location: UiNavigationLocation) => void;
}
