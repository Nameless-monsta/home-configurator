import type { UiLayoutMode, UiOrientation, UiResponsiveProfile, UiViewportClass } from './types.js';

export interface UiViewportInput {
  readonly width: number;
  readonly height: number;
  readonly coarsePointer?: boolean;
}

const classifyViewport = (width: number): UiViewportClass => {
  if (width < 680) return 'phone';
  if (width < 1180) return 'tablet';
  return 'desktop';
};

const classifyOrientation = (width: number, height: number): UiOrientation =>
  width > height ? 'landscape' : 'portrait';

const classifyLayoutFromViewport = (
  viewport: UiViewportClass,
  orientation: UiOrientation,
  short: boolean,
): UiLayoutMode => {
  if (viewport === 'phone') return 'compact';
  if (viewport === 'tablet' && (orientation === 'portrait' || short)) return 'compact';
  if (viewport === 'desktop') return 'wide';
  return 'regular';
};

export const createResponsiveProfile = (input: UiViewportInput): UiResponsiveProfile => {
  const width = Math.max(0, input.width);
  const height = Math.max(0, input.height);
  const viewport = classifyViewport(width);
  const orientation = classifyOrientation(width, height);
  const short = height < 620;
  return {
    width,
    height,
    viewport,
    orientation,
    short,
    coarsePointer: input.coarsePointer ?? false,
    layout: classifyLayoutFromViewport(viewport, orientation, short),
  };
};
