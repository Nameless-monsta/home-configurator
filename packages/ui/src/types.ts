export type UiOverlay = 'diagnostics' | null;
export type UiLayoutMode = 'compact' | 'regular' | 'wide';
export type UiViewportClass = 'phone' | 'tablet' | 'desktop';
export type UiOrientation = 'portrait' | 'landscape';

export interface UiResponsiveProfile {
  readonly width: number;
  readonly height: number;
  readonly viewport: UiViewportClass;
  readonly orientation: UiOrientation;
  readonly short: boolean;
  readonly coarsePointer: boolean;
  readonly layout: UiLayoutMode;
}

export interface UiFoundationSnapshot {
  readonly overlay: UiOverlay;
  readonly layout: UiLayoutMode;
  readonly responsive: UiResponsiveProfile;
  readonly runtimeStatus: string;
  readonly diagnostics: Readonly<Record<string, number | string>>;
}

export interface UiFoundationOptions {
  readonly root: HTMLElement;
  readonly version: string;
  readonly title?: string;
  readonly subtitle?: string;
}
