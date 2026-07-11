export type UiOverlay = 'diagnostics' | null;
export type UiLayoutMode = 'compact' | 'regular' | 'wide';

export interface UiFoundationSnapshot {
  readonly overlay: UiOverlay;
  readonly layout: UiLayoutMode;
  readonly runtimeStatus: string;
  readonly diagnostics: Readonly<Record<string, number | string>>;
}

export interface UiFoundationOptions {
  readonly root: HTMLElement;
  readonly version: string;
  readonly title?: string;
  readonly subtitle?: string;
}
