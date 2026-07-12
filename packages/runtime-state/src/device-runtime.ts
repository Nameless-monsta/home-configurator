import { RingBuffer } from './ring-buffer.js';
import { SubscriptionSet, type RuntimeUnsubscribe } from './subscriptions.js';
import type {
  AvailabilityOptions,
  ConfirmationOptions,
  DeviceDescriptor,
  DeviceRuntimeInput,
  DeviceRuntimeMetrics,
  DeviceRuntimeSnapshot,
  DeviceState,
  DeviceTransition,
  DeviceTransitionKind,
  OptimisticUpdateOptions,
  RollbackOptions,
} from './types.js';

const freezeState = (state: DeviceState): DeviceState => Object.freeze({ ...state });

const sameStrings = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const assertIdentifier = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be a non-empty string`);
  return normalized;
};

const normalizeDescriptor = (descriptor: DeviceDescriptor): DeviceDescriptor => {
  const entityIds = [...new Set(descriptor.entityIds.map((id) => assertIdentifier(id, 'Entity ID')))];
  return {
    id: assertIdentifier(descriptor.id, 'Device ID'),
    roomId: assertIdentifier(descriptor.roomId, 'Room ID'),
    entityIds,
    ...(descriptor.name === undefined ? {} : { name: descriptor.name }),
    ...(descriptor.available === undefined ? {} : { available: descriptor.available }),
    ...(descriptor.connected === undefined ? {} : { connected: descriptor.connected }),
  };
};

export class DeviceRuntime {
  readonly #listeners = new SubscriptionSet<DeviceRuntimeSnapshot>();
  readonly #history: RingBuffer<DeviceTransition>;
  readonly #now: () => number;

  #id: string;
  #roomId: string;
  #entityIds: readonly string[];
  #name: string | undefined;
  #available: boolean;
  #connected: boolean;
  #selected = false;
  #confirmedState: DeviceState;
  #optimisticState: DeviceState | null = null;
  #pendingCommandId: string | undefined;
  #pendingIssuedAt: number | undefined;
  #version = 0;
  #lastUpdatedAt: number;
  #transitionSequence = 0;
  #optimisticUpdates = 0;
  #confirmations = 0;
  #rollbacks = 0;
  #availabilityChanges = 0;
  #selectionChanges = 0;
  #latencyTotalMs = 0;
  #latencySamples = 0;
  #lastLatencyMs: number | undefined;

  public constructor(input: DeviceRuntimeInput) {
    const descriptor = normalizeDescriptor(input.descriptor);
    const now = input.now ?? Date.now;
    this.#now = now;
    this.#history = new RingBuffer(input.historyLimit ?? 32);
    this.#id = descriptor.id;
    this.#roomId = descriptor.roomId;
    this.#entityIds = Object.freeze([...descriptor.entityIds]);
    this.#name = descriptor.name;
    this.#available = descriptor.available ?? true;
    this.#connected = descriptor.connected ?? this.#available;
    this.#confirmedState = freezeState(input.confirmedState ?? {});
    this.#lastUpdatedAt = now();
    this.#record('registered', this.#lastUpdatedAt, { roomId: this.#roomId });
  }

  public snapshot(): DeviceRuntimeSnapshot {
    const metrics: DeviceRuntimeMetrics = {
      optimisticUpdates: this.#optimisticUpdates,
      confirmations: this.#confirmations,
      rollbacks: this.#rollbacks,
      availabilityChanges: this.#availabilityChanges,
      selectionChanges: this.#selectionChanges,
      ...(this.#latencySamples === 0
        ? {}
        : { averageLatencyMs: this.#latencyTotalMs / this.#latencySamples }),
      ...(this.#lastLatencyMs === undefined ? {} : { lastLatencyMs: this.#lastLatencyMs }),
    };

    return {
      id: this.#id,
      roomId: this.#roomId,
      entityIds: [...this.#entityIds],
      ...(this.#name === undefined ? {} : { name: this.#name }),
      available: this.#available,
      connected: this.#connected,
      selected: this.#selected,
      confirmedState: this.#confirmedState,
      optimisticState: this.#optimisticState,
      effectiveState: this.#optimisticState ?? this.#confirmedState,
      version: this.#version,
      lastUpdatedAt: this.#lastUpdatedAt,
      ...(this.#pendingCommandId === undefined
        ? {}
        : { pendingCommandId: this.#pendingCommandId }),
      history: this.#history.snapshot(),
      metrics,
    };
  }

  public subscribe(listener: (snapshot: DeviceRuntimeSnapshot) => void): RuntimeUnsubscribe {
    return this.#listeners.subscribe(listener);
  }

  public updateDescriptor(descriptor: DeviceDescriptor, at = this.#now()): boolean {
    const normalized = normalizeDescriptor(descriptor);
    if (normalized.id !== this.#id) throw new Error('A device runtime cannot change its device ID');

    const changed =
      normalized.roomId !== this.#roomId ||
      normalized.name !== this.#name ||
      !sameStrings(normalized.entityIds, this.#entityIds);
    if (!changed) return false;

    const previousRoomId = this.#roomId;
    this.#roomId = normalized.roomId;
    this.#name = normalized.name;
    this.#entityIds = Object.freeze([...normalized.entityIds]);
    this.#publish('metadata', at, { previousRoomId, roomId: this.#roomId });
    return true;
  }

  public applyOptimistic(patch: DeviceState, options: OptimisticUpdateOptions): void {
    const at = options.at ?? this.#now();
    this.#optimisticState = freezeState({ ...(this.#optimisticState ?? this.#confirmedState), ...patch });
    this.#pendingCommandId = assertIdentifier(options.commandId, 'Command ID');
    this.#pendingIssuedAt = options.issuedAt ?? at;
    this.#optimisticUpdates += 1;
    this.#publish('optimistic', at, { commandId: this.#pendingCommandId });
  }

  public confirm(state: DeviceState, options: ConfirmationOptions = {}): void {
    const at = options.at ?? this.#now();
    const commandMatches =
      this.#pendingCommandId === undefined ||
      options.commandId === undefined ||
      options.commandId === this.#pendingCommandId;
    this.#confirmedState = freezeState(state);
    this.#confirmations += 1;

    let latencyMs: number | undefined;
    if (commandMatches && this.#pendingIssuedAt !== undefined) {
      latencyMs = Math.max(0, at - this.#pendingIssuedAt);
      this.#lastLatencyMs = latencyMs;
      this.#latencyTotalMs += latencyMs;
      this.#latencySamples += 1;
    }
    if (commandMatches) this.#clearOptimistic();

    this.#publish('confirmed', at, {
      ...(options.commandId === undefined ? {} : { commandId: options.commandId }),
      ...(latencyMs === undefined ? {} : { latencyMs }),
    });
  }

  public rollback(options: RollbackOptions): boolean {
    if (this.#optimisticState === null) return false;
    const at = options.at ?? this.#now();
    const commandId = this.#pendingCommandId;
    this.#clearOptimistic();
    this.#rollbacks += 1;
    this.#publish('rollback', at, {
      reason: options.reason,
      ...(commandId === undefined ? {} : { commandId }),
    });
    return true;
  }

  public setAvailability(available: boolean, options: AvailabilityOptions = {}): boolean {
    const connected = options.connected ?? available;
    if (available === this.#available && connected === this.#connected) return false;
    const at = options.at ?? this.#now();
    this.#available = available;
    this.#connected = connected;
    this.#availabilityChanges += 1;
    this.#publish('availability', at, { available, connected });
    return true;
  }

  public setSelected(selected: boolean, at = this.#now()): boolean {
    if (selected === this.#selected) return false;
    this.#selected = selected;
    this.#selectionChanges += 1;
    this.#publish('selection', at, { selected });
    return true;
  }

  public dispose(): void {
    this.#listeners.clear();
  }

  #clearOptimistic(): void {
    this.#optimisticState = null;
    this.#pendingCommandId = undefined;
    this.#pendingIssuedAt = undefined;
  }

  #publish(
    kind: DeviceTransitionKind,
    at: number,
    detail: Readonly<Record<string, unknown>>,
  ): void {
    this.#lastUpdatedAt = at;
    this.#version += 1;
    this.#record(kind, at, detail);
    this.#listeners.emit(this.snapshot());
  }

  #record(
    kind: DeviceTransitionKind,
    at: number,
    detail: Readonly<Record<string, unknown>>,
  ): void {
    this.#transitionSequence += 1;
    this.#history.push({ sequence: this.#transitionSequence, kind, at, detail: { ...detail } });
  }
}
