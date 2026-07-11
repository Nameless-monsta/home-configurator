import type { UiLayoutMode } from './types.js';

export const classifyLayout = (width: number): UiLayoutMode => {
  if (width < 680) return 'compact';
  if (width < 1180) return 'regular';
  return 'wide';
};
