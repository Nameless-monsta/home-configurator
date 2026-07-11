import type { CameraRig, GraphicsEngine } from '@home-configurator/graphics';
import type { HomeConfiguratorRuntime } from '@home-configurator/runtime';

import { AnimationDirector } from './animation-director.js';
import { InputEngine, normalizePointerEvent } from './input-engine.js';
import { NavigationEngine } from './navigation-engine.js';
import { SelectionEngine } from './selection-engine.js';
import { TransitionDirector } from './transition-director.js';
import type {
  InteractionDiagnosticsSnapshot,
  InteractionTarget,
  NavigationLocation,
  SemanticIntent,
} from './types.js';

export interface InteractionEngineOptions {
  readonly runtime: HomeConfiguratorRuntime;
  readonly graphics: GraphicsEngine;
  readonly surface: HTMLElement;
  readonly reducedMotion?: () => boolean;
}

export class InteractionEngine {
  public readonly input: InputEngine;
  public readonly selection: SelectionEngine;
  public readonly navigation: NavigationEngine;
  public readonly transitions: TransitionDirector;
  public readonly animations: AnimationDirector;

  readonly #runtime: HomeConfiguratorRuntime;
  readonly #graphics: GraphicsEngine;
  readonly #surface: HTMLElement;
  readonly #unregisterTasks: Array<() => void> = [];
  readonly #unregisterTargets: Array<() => void> = [];
  #disposed = false;

  public constructor(options: InteractionEngineOptions) {
    this.#runtime = options.runtime;
    this.#graphics = options.graphics;
    this.#surface = options.surface;
    this.input = new InputEngine({ diagnostics: this.#runtime.diagnostics });
    this.selection = new SelectionEngine(
      this.#graphics.cameraRig.camera,
      this.#runtime.diagnostics,
    );
    this.navigation = new NavigationEngine(this.#runtime.diagnostics);
    this.transitions = new TransitionDirector(this.#runtime.diagnostics, options.reducedMotion);
    this.animations = new AnimationDirector(this.#runtime.diagnostics);

    this.#unregisterTasks.push(
      this.#runtime.scheduler.register(this.transitions),
      this.#runtime.scheduler.register(this.animations),
    );
    this.#bindSurface();
    this.#runtime.diagnostics.record('info', 'interaction', 'Interaction engine initialized');
  }

  public registerTarget(target: InteractionTarget): () => void {
    const unregister = this.input.registerTarget(target);
    this.#unregisterTargets.push(unregister);
    return unregister;
  }

  public navigate(
    location: NavigationLocation,
    cameraRig: CameraRig = this.#graphics.cameraRig,
  ): boolean {
    const moved = this.navigation.navigate(location);
    if (!moved) return false;
    if (location.cameraPose) cameraRig.transitionTo(location.cameraPose, { durationMs: 900 });
    return true;
  }

  public focusSelection(durationMs = 900): boolean {
    const object = this.selection.selectedObject;
    if (!object) return false;
    this.#graphics.cameraRig.frameObject(object, { durationMs, padding: 1.35 });
    return true;
  }

  public snapshot(): InteractionDiagnosticsSnapshot {
    const selection = this.selection.snapshot();
    return {
      activePointers:
        this.#runtime.diagnostics.snapshot().gauges['interaction.activePointers'] ?? 0,
      activeSessions: this.input.getActiveSessions().length,
      ...(selection.selectedId ? { selectedId: selection.selectedId } : {}),
      navigationLevel: this.navigation.location.level,
      transitionActive: this.transitions.active,
    };
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#surface.removeEventListener('pointerdown', this.#onPointerDown);
    this.#surface.removeEventListener('pointermove', this.#onPointerMove);
    this.#surface.removeEventListener('pointerup', this.#onPointerUp);
    this.#surface.removeEventListener('pointercancel', this.#onPointerCancel);
    this.#surface.removeEventListener('wheel', this.#onWheel);
    this.#surface.removeEventListener('keydown', this.#onKeyDown);
    this.input.cancelAll('engine disposed');
    this.selection.clear();
    this.navigation.clear();
    this.transitions.cancel('engine disposed');
    this.animations.clear();
    for (const unregister of this.#unregisterTargets.splice(0)) unregister();
    for (const unregister of this.#unregisterTasks.splice(0)) unregister();
    this.#runtime.diagnostics.record('info', 'interaction', 'Interaction engine disposed');
  }

  #bindSurface(): void {
    this.#surface.style.touchAction = 'none';
    if (!this.#surface.hasAttribute('tabindex')) this.#surface.tabIndex = 0;
    this.#surface.addEventListener('pointerdown', this.#onPointerDown);
    this.#surface.addEventListener('pointermove', this.#onPointerMove);
    this.#surface.addEventListener('pointerup', this.#onPointerUp);
    this.#surface.addEventListener('pointercancel', this.#onPointerCancel);
    this.#surface.addEventListener('wheel', this.#onWheel, { passive: false });
    this.#surface.addEventListener('keydown', this.#onKeyDown);
  }

  readonly #onPointerDown = (event: PointerEvent): void => {
    const bounds = this.#surface.getBoundingClientRect();
    const targetId = this.selection.hitTest(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      bounds.width,
      bounds.height,
    );
    if (targetId) {
      this.selection.select(targetId);
      this.input.setActiveTarget(targetId);
    }
    this.#surface.setPointerCapture?.(event.pointerId);
    this.input.handlePointer(normalizePointerEvent(event, 'down', bounds));
  };

  readonly #onPointerMove = (event: PointerEvent): void => {
    const bounds = this.#surface.getBoundingClientRect();
    this.input.handlePointer(normalizePointerEvent(event, 'move', bounds));
  };

  readonly #onPointerUp = (event: PointerEvent): void => {
    const bounds = this.#surface.getBoundingClientRect();
    this.input.handlePointer(normalizePointerEvent(event, 'up', bounds));
    if (this.#surface.hasPointerCapture?.(event.pointerId))
      this.#surface.releasePointerCapture(event.pointerId);
  };

  readonly #onPointerCancel = (event: PointerEvent): void => {
    const bounds = this.#surface.getBoundingClientRect();
    this.input.handlePointer(normalizePointerEvent(event, 'cancel', bounds));
  };

  readonly #onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.input.handleWheel(event.deltaY, this.selection.snapshot().selectedId);
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const action = keyboardAction(event);
    if (!action) return;
    event.preventDefault();
    this.input.handleKeyboard(action, this.selection.snapshot().selectedId);
  };
}

const keyboardAction = (event: KeyboardEvent): string | undefined => {
  const map: Readonly<Record<string, string>> = {
    Enter: 'activate',
    ' ': 'activate',
    Escape: 'cancel',
    ArrowLeft: 'adjust-left',
    ArrowRight: 'adjust-right',
    ArrowUp: 'adjust-up',
    ArrowDown: 'adjust-down',
    Home: 'minimum',
    End: 'maximum',
  };
  return map[event.key];
};

export const semanticOrbitHandler =
  (
    object: { rotation: { x: number; y: number } },
    sensitivity = 0.006,
  ): ((intent: SemanticIntent) => void) =>
  (intent) => {
    if (intent.type !== 'orbit.update') return;
    object.rotation.y += (intent.deltaX ?? 0) * sensitivity;
    object.rotation.x += (intent.deltaY ?? 0) * sensitivity;
  };
