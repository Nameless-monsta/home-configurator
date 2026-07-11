import type { CameraPose } from '@home-configurator/graphics';

export type PointerKind = 'mouse' | 'touch' | 'pen';
export type PointerPhase = 'down' | 'move' | 'up' | 'cancel';
export type GestureKind =
  | 'tap'
  | 'double-tap'
  | 'long-press'
  | 'drag'
  | 'orbit'
  | 'pinch'
  | 'two-finger-vertical'
  | 'wheel'
  | 'keyboard-action';

export type GestureState =
  'candidate' | 'claimed' | 'active' | 'committing' | 'complete' | 'canceled';

export type InputLayer = 'ambient' | 'room' | 'object' | 'map' | 'control' | 'overlay' | 'modal';

export interface NormalizedPointer {
  readonly id: number;
  readonly type: PointerKind;
  readonly phase: PointerPhase;
  readonly x: number;
  readonly y: number;
  readonly pressure: number;
  readonly buttons: number;
  readonly timestamp: number;
}

export interface GestureSession {
  readonly id: string;
  readonly ownerId: string;
  readonly recognizerId: string;
  readonly kind: GestureKind;
  readonly pointers: readonly number[];
  readonly startedAt: number;
  readonly state: GestureState;
  readonly targetId?: string;
  readonly distance: number;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly scale: number;
}

export interface SemanticIntent {
  readonly type: string;
  readonly targetId?: string;
  readonly value?: number;
  readonly deltaX?: number;
  readonly deltaY?: number;
  readonly scale?: number;
  readonly source: GestureKind | 'keyboard';
}

export interface InteractionTarget {
  readonly id: string;
  readonly layer: InputLayer;
  readonly gestures: readonly GestureKind[];
  readonly enabled?: () => boolean;
  readonly onIntent: (intent: SemanticIntent) => void;
}

export interface SelectionSnapshot {
  readonly selectedId?: string;
  readonly hoveredId?: string;
}

export type NavigationLevel = 'home' | 'room' | 'device' | 'control';

export interface NavigationLocation {
  readonly level: NavigationLevel;
  readonly roomId?: string;
  readonly deviceId?: string;
  readonly controlId?: string;
  readonly cameraPose?: CameraPose;
}

export interface TransitionDefinition {
  readonly id: string;
  readonly durationMs: number;
  readonly reducedMotionDurationMs?: number;
  readonly onUpdate: (progress: number) => void;
  readonly onComplete?: () => void;
  readonly onCancel?: () => void;
}

export interface AnimationDefinition {
  readonly id: string;
  readonly durationMs: number;
  readonly loop?: boolean;
  readonly onUpdate: (progress: number, deltaMs: number) => void;
  readonly onComplete?: () => void;
}

export interface InteractionDiagnosticsSnapshot {
  readonly activePointers: number;
  readonly activeSessions: number;
  readonly selectedId?: string;
  readonly navigationLevel: NavigationLevel;
  readonly transitionActive: boolean;
}
