import type { SemanticIntent } from '@home-configurator/interaction';

export interface LightGestureState {
  readonly hue: number;
  readonly saturation: number;
  readonly brightness: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const mapColourGesture = (
  intent: Pick<SemanticIntent, 'deltaX' | 'deltaY'>,
  initial: LightGestureState,
): readonly [number, number] => {
  const hue = (initial.hue + (intent.deltaX ?? 0) * 0.65 + 360) % 360;
  const saturation = clamp(initial.saturation - (intent.deltaY ?? 0) * 0.35, 0, 100);
  return [Number(hue.toFixed(2)), Number(saturation.toFixed(2))];
};

export const mapBrightnessGesture = (
  intent: Pick<SemanticIntent, 'deltaY' | 'value'>,
  initialBrightness: number,
): number => {
  const verticalDelta = intent.deltaY ?? intent.value ?? 0;
  return Number(clamp(initialBrightness - verticalDelta * 0.004, 0, 1).toFixed(4));
};
