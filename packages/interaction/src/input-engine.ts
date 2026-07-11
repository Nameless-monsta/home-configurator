import type { Diagnostics } from '@home-configurator/runtime';

import type {
  GestureKind,
  GestureSession,
  InteractionTarget,
  NormalizedPointer,
  SemanticIntent,
} from './types.js';

interface PointerRecord {
  readonly startX: number;
  readonly startY: number;
  readonly startedAt: number;
  x: number;
  y: number;
  type: NormalizedPointer['type'];
}

interface MutableSession {
  id: string;
  ownerId: string;
  recognizerId: string;
  kind: GestureKind;
  pointers: number[];
  startedAt: number;
  state: GestureSession['state'];
  targetId?: string;
  distance: number;
  deltaX: number;
  deltaY: number;
  scale: number;
}

export interface InputEngineOptions {
  readonly diagnostics: Diagnostics;
  readonly tapTolerance?: number;
  readonly dragThreshold?: number;
  readonly longPressMs?: number;
  readonly now?: () => number;
}

const layerPriority: Record<InteractionTarget['layer'], number> = {
  ambient: 0,
  room: 1,
  object: 2,
  map: 3,
  control: 4,
  overlay: 5,
  modal: 6,
};

export class InputEngine {
  readonly #diagnostics: Diagnostics;
  readonly #tapTolerance: number;
  readonly #dragThreshold: number;
  readonly #longPressMs: number;
  readonly #now: () => number;
  readonly #pointers = new Map<number, PointerRecord>();
  readonly #targets = new Map<string, InteractionTarget>();
  readonly #sessions = new Map<string, MutableSession>();
  #activeTargetId?: string;
  #mode = 'default';
  #sequence = 0;
  #suspended = false;

  public constructor(options: InputEngineOptions) {
    this.#diagnostics = options.diagnostics;
    this.#tapTolerance = Math.max(1, options.tapTolerance ?? 8);
    this.#dragThreshold = Math.max(1, options.dragThreshold ?? 8);
    this.#longPressMs = Math.max(100, options.longPressMs ?? 550);
    this.#now = options.now ?? (() => performance.now());
  }

  public registerTarget(target: InteractionTarget): () => void {
    if (this.#targets.has(target.id)) throw new Error(`Interaction target already registered: ${target.id}`);
    this.#targets.set(target.id, target);
    return () => {
      this.#targets.delete(target.id);
      if (this.#activeTargetId === target.id) this.cancelAll('owner disposed');
    };
  }

  public setActiveTarget(targetId?: string): void {
    if (targetId !== undefined && !this.#targets.has(targetId)) {
      throw new Error(`Interaction target not found: ${targetId}`);
    }
    this.#activeTargetId = targetId;
  }

  public setInteractionMode(mode: string): void {
    this.#mode = mode;
    this.#diagnostics.record('debug', 'interaction.input', 'Interaction mode changed', { mode });
  }

  public get interactionMode(): string {
    return this.#mode;
  }

  public suspend(reason = 'transition commit'): void {
    this.#suspended = true;
    this.cancelAll(reason);
  }

  public resume(): void {
    this.#suspended = false;
  }

  public handlePointer(pointer: NormalizedPointer): void {
    this.#diagnostics.setGauge('interaction.activePointers', this.#pointers.size);
    if (this.#suspended && pointer.phase === 'down') {
      this.#diagnostics.increment('interaction.rejected');
      return;
    }

    if (pointer.phase === 'down') {
      this.#pointers.set(pointer.id, {
        startX: pointer.x,
        startY: pointer.y,
        startedAt: pointer.timestamp,
        x: pointer.x,
        y: pointer.y,
        type: pointer.type,
      });
      this.#reconcileSession();
    } else if (pointer.phase === 'move') {
      const record = this.#pointers.get(pointer.id);
      if (!record) return;
      record.x = pointer.x;
      record.y = pointer.y;
      this.#updateSession();
    } else {
      this.#finishPointer(pointer.id, pointer.phase === 'cancel');
    }

    this.#diagnostics.setGauge('interaction.activePointers', this.#pointers.size);
  }

  public handleKeyboard(action: string, targetId?: string): void {
    const target = this.#resolveTarget(targetId);
    if (!target || !target.gestures.includes('keyboard-action')) return;
    target.onIntent({ type: action, targetId: target.id, source: 'keyboard' });
    this.#diagnostics.increment('interaction.keyboardActions');
  }

  public handleWheel(deltaY: number, targetId?: string): void {
    const target = this.#resolveTarget(targetId);
    if (!target || !target.gestures.includes('wheel')) return;
    target.onIntent({ type: 'wheel', targetId: target.id, value: deltaY, source: 'wheel' });
  }

  public cancelSession(sessionId: string, reason: string): void {
    const session = this.#sessions.get(sessionId);
    if (!session) return;
    session.state = 'canceled';
    this.#sessions.delete(sessionId);
    this.#diagnostics.increment('interaction.canceled');
    this.#diagnostics.record('debug', 'interaction.input', 'Gesture canceled', {
      sessionId,
      reason,
    });
  }

  public cancelAll(reason: string): void {
    for (const sessionId of [...this.#sessions.keys()]) this.cancelSession(sessionId, reason);
    this.#pointers.clear();
    this.#diagnostics.setGauge('interaction.activePointers', 0);
    this.#diagnostics.setGauge('interaction.activeSessions', 0);
  }

  public getActiveSessions(): readonly GestureSession[] {
    return [...this.#sessions.values()].map((session) => ({ ...session, pointers: [...session.pointers] }));
  }

  #resolveTarget(targetId?: string): InteractionTarget | undefined {
    const explicit = targetId ?? this.#activeTargetId;
    if (explicit) {
      const target = this.#targets.get(explicit);
      return target?.enabled?.() === false ? undefined : target;
    }
    return [...this.#targets.values()]
      .filter((target) => target.enabled?.() !== false)
      .sort((left, right) => layerPriority[right.layer] - layerPriority[left.layer])[0];
  }

  #reconcileSession(): void {
    const target = this.#resolveTarget();
    if (!target) return;
    const pointerCount = this.#pointers.size;
    const kind = this.#chooseKind(target, pointerCount);
    if (!kind) return;

    for (const session of this.#sessions.values()) {
      if (session.pointers.length !== pointerCount) this.cancelSession(session.id, 'pointer-count mismatch');
    }

    const pointers = [...this.#pointers.keys()];
    const session: MutableSession = {
      id: `gesture-${++this.#sequence}`,
      ownerId: target.id,
      recognizerId: `core.${kind}`,
      kind,
      pointers,
      startedAt: this.#now(),
      state: 'candidate',
      targetId: target.id,
      distance: 0,
      deltaX: 0,
      deltaY: 0,
      scale: 1,
    };
    this.#sessions.set(session.id, session);
    this.#diagnostics.setGauge('interaction.activeSessions', this.#sessions.size);
  }

  #chooseKind(target: InteractionTarget, pointerCount: number): GestureKind | undefined {
    if (pointerCount >= 2) {
      if (target.gestures.includes('two-finger-vertical')) return 'two-finger-vertical';
      if (target.gestures.includes('pinch')) return 'pinch';
      return undefined;
    }
    if (target.gestures.includes('orbit')) return 'orbit';
    if (target.gestures.includes('drag')) return 'drag';
    if (target.gestures.includes('tap')) return 'tap';
    return undefined;
  }

  #updateSession(): void {
    const session = [...this.#sessions.values()][0];
    if (!session) return;
    const records = session.pointers
      .map((id) => this.#pointers.get(id))
      .filter((record): record is PointerRecord => record !== undefined);
    if (records.length !== session.pointers.length) {
      this.cancelSession(session.id, 'pointer-count mismatch');
      return;
    }

    if (records.length === 1) {
      const record = records[0];
      if (!record) return;
      session.deltaX = record.x - record.startX;
      session.deltaY = record.y - record.startY;
      session.distance = Math.hypot(session.deltaX, session.deltaY);
      if (session.kind !== 'tap' && session.distance >= this.#dragThreshold) session.state = 'active';
    } else {
      const first = records[0];
      const second = records[1];
      if (!first || !second) return;
      const startDistance = Math.hypot(first.startX - second.startX, first.startY - second.startY);
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      session.scale = startDistance > 0 ? distance / startDistance : 1;
      session.deltaY = ((first.y - first.startY) + (second.y - second.startY)) / 2;
      session.deltaX = ((first.x - first.startX) + (second.x - second.startX)) / 2;
      session.distance = Math.hypot(session.deltaX, session.deltaY);
      if (Math.abs(session.scale - 1) > 0.02 || session.distance >= this.#dragThreshold) {
        session.state = 'active';
      }
    }

    if (session.state !== 'active') return;
    this.#emitIntent(session, false);
  }

  #finishPointer(pointerId: number, canceled: boolean): void {
    const session = [...this.#sessions.values()].find((candidate) => candidate.pointers.includes(pointerId));
    const record = this.#pointers.get(pointerId);
    this.#pointers.delete(pointerId);
    if (!session) return;
    if (canceled) {
      this.cancelSession(session.id, 'pointer cancel');
      return;
    }

    if (session.kind === 'tap' && record) {
      const distance = Math.hypot(record.x - record.startX, record.y - record.startY);
      const elapsed = this.#now() - record.startedAt;
      if (distance <= this.#tapTolerance) {
        session.kind = elapsed >= this.#longPressMs ? 'long-press' : 'tap';
        this.#emitIntent(session, true);
      }
    } else if (session.state === 'active') {
      this.#emitIntent(session, true);
    }
    session.state = 'complete';
    this.#sessions.delete(session.id);
    this.#diagnostics.increment('interaction.completed');
    this.#diagnostics.setGauge('interaction.activeSessions', this.#sessions.size);
  }

  #emitIntent(session: MutableSession, commit: boolean): void {
    const target = this.#targets.get(session.ownerId);
    if (!target) return;
    const type = commit ? `${session.kind}.commit` : `${session.kind}.update`;
    const intent: SemanticIntent = {
      type,
      targetId: target.id,
      deltaX: session.deltaX,
      deltaY: session.deltaY,
      scale: session.scale,
      source: session.kind,
    };
    target.onIntent(intent);
    this.#diagnostics.increment(commit ? 'interaction.commits' : 'interaction.updates');
  }
}

export const normalizePointerEvent = (
  event: PointerEvent,
  phase: NormalizedPointer['phase'],
  bounds: DOMRect,
): NormalizedPointer => ({
  id: event.pointerId,
  type: event.pointerType === 'touch' || event.pointerType === 'pen' ? event.pointerType : 'mouse',
  phase,
  x: event.clientX - bounds.left,
  y: event.clientY - bounds.top,
  pressure: event.pressure,
  buttons: event.buttons,
  timestamp: event.timeStamp,
});
