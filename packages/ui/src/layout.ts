import { createResponsiveProfile } from './responsive.js';
import type { UiLayoutMode } from './types.js';

export const classifyLayout = (width: number): UiLayoutMode =>
  createResponsiveProfile({ width, height: 900 }).layout;
