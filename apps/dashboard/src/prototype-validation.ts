export type PrototypeViewport = 'phone' | 'tablet-portrait' | 'tablet-landscape' | 'desktop';

export interface PrototypeValidationInput {
  readonly width: number;
  readonly height: number;
  readonly coarsePointer: boolean;
  readonly reducedMotion: boolean;
  readonly keyboardNavigation: boolean;
  readonly accessibleName: boolean;
  readonly fallbackModelAvailable: boolean;
  readonly diagnosticsAvailable: boolean;
}

export interface PrototypeValidationResult {
  readonly viewport: PrototypeViewport;
  readonly passed: boolean;
  readonly failures: readonly string[];
}

export const classifyPrototypeViewport = (width: number, height: number): PrototypeViewport => {
  if (width < 720) return 'phone';
  if (width <= 1180) return height >= width ? 'tablet-portrait' : 'tablet-landscape';
  return 'desktop';
};

export const validatePrototype = (input: PrototypeValidationInput): PrototypeValidationResult => {
  const failures: string[] = [];
  if (input.width <= 0 || input.height <= 0) failures.push('viewport');
  if (!input.keyboardNavigation) failures.push('keyboard-navigation');
  if (!input.accessibleName) failures.push('accessible-name');
  if (!input.fallbackModelAvailable) failures.push('fallback-model');
  if (!input.diagnosticsAvailable) failures.push('diagnostics');

  return {
    viewport: classifyPrototypeViewport(input.width, input.height),
    passed: failures.length === 0,
    failures,
  };
};
