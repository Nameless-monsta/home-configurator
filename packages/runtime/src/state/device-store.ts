import { DeviceRegistry } from './device-registry.js';
import { DeviceRuntime } from './device-runtime.js';
import { SubscriptionSet, type RuntimeUnsubscribe } from './subscriptions.js';
import type {
  AvailabilityOptions,
  ConfirmationOptions,
  DeviceRuntimeInput,
  DeviceRuntimeSnapshot,
  DeviceState,
  DeviceStorePatch,
  DeviceStoreRoomSnapshot,
  DeviceStoreSnapshot,
  OptimisticUpdateOptions,
  RollbackOptions,
} from './types.js';

export class DeviceStore {
  readonly #registry = new DeviceRegistry();
  readonly #devices = new Map<string, DeviceRuntime>();
  readonly #runtimeUnsubscribes = new Map<string, RuntimeUnsubscribe>();
  readonly #listeners = new SubscriptionSet<DeviceStorePatch>();
  readonly #roomListeners = new Map<string, SubscriptionSet<DeviceStoreRoomSnapshot>>();
  #version = 0;

  public upsert(input: DeviceRuntimeInput): DeviceRuntime {
    const existing = this.#devices.get(input.descriptor.id);
    if (existing === undefined) return this.#register(input);

    const previousRoomId = existing.snapshot().roomId;
    this.#registry.upsert(input.descriptor);
    const metadataChanged = existing.updateDescriptor(input.descriptor);
    if (input.confirmedState !== undefined) existing.confirm(input.confirmedState);
    if (input.descriptor.available !== undefined || input.descriptor.connected !== undefined) {
      existing.setAvailability(input.descriptor.available ?? true, {
        connected: input.descriptor.connected ?? input.descriptor.available ?? true,
      });
    }
    if (metadataChanged && previousRoomId !== input.descriptor.roomId)
      this.#emitRoom(previousRoomId);
    return existing;
  }

  public remove(deviceId: string): boolean {
    const runtime = this.#devices.get(deviceId);
    const descriptor = this.#registry.remove(deviceId);
    if (runtime === undefined || descriptor === null) return false;

    this.#runtimeUnsubscribes.get(deviceId)?.();
    this.#runtimeUnsubscribes.delete(deviceId);
    this.#devices.delete(deviceId);
    runtime.dispose();
    this.#version += 1;
    this.#listeners.emit({
      kind: 'removed',
      deviceId,
      roomIds: [descriptor.roomId],
      version: this.#version,
    });
    this.#emitRoom(descriptor.roomId);
    return true;
  }

  public get(deviceId: string): DeviceRuntime | null {
    return this.#devices.get(deviceId) ?? null;
  }

  public getByEntity(entityId: string): DeviceRuntime | null {
    const deviceId = this.#registry.deviceIdForEntity(entityId);
    return deviceId === null ? null : (this.#devices.get(deviceId) ?? null);
  }

  public devicesForRoom(roomId: string): readonly DeviceRuntime[] {
    return this.#registry
      .deviceIdsForRoom(roomId)
      .map((deviceId) => this.#devices.get(deviceId))
      .filter((device): device is DeviceRuntime => device !== undefined);
  }

  public snapshot(): DeviceStoreSnapshot {
    return {
      version: this.#version,
      devices: [...this.#devices.values()]
        .map((device) => device.snapshot())
        .sort((left, right) => left.id.localeCompare(right.id)),
      rooms: this.#registry.rooms(),
    };
  }

  public roomSnapshot(roomId: string): DeviceStoreRoomSnapshot {
    return {
      roomId,
      version: this.#version,
      devices: this.devicesForRoom(roomId).map((device) => device.snapshot()),
    };
  }

  public subscribe(listener: (patch: DeviceStorePatch) => void): RuntimeUnsubscribe {
    return this.#listeners.subscribe(listener);
  }

  public subscribeDevice(
    deviceId: string,
    listener: (snapshot: DeviceRuntimeSnapshot) => void,
  ): RuntimeUnsubscribe {
    const device = this.#devices.get(deviceId);
    if (device === undefined) throw new Error(`Unknown device: ${deviceId}`);
    return device.subscribe(listener);
  }

  public subscribeRoom(
    roomId: string,
    listener: (snapshot: DeviceStoreRoomSnapshot) => void,
  ): RuntimeUnsubscribe {
    const listeners =
      this.#roomListeners.get(roomId) ?? new SubscriptionSet<DeviceStoreRoomSnapshot>();
    this.#roomListeners.set(roomId, listeners);
    const unsubscribe = listeners.subscribe(listener);
    return () => {
      unsubscribe();
      if (listeners.size === 0) this.#roomListeners.delete(roomId);
    };
  }

  public applyOptimistic(
    deviceId: string,
    patch: DeviceState,
    options: OptimisticUpdateOptions,
  ): void {
    this.#require(deviceId).applyOptimistic(patch, options);
  }

  public confirm(deviceId: string, state: DeviceState, options: ConfirmationOptions = {}): void {
    this.#require(deviceId).confirm(state, options);
  }

  public rollback(deviceId: string, options: RollbackOptions): boolean {
    return this.#require(deviceId).rollback(options);
  }

  public setAvailability(
    deviceId: string,
    available: boolean,
    options: AvailabilityOptions = {},
  ): boolean {
    return this.#require(deviceId).setAvailability(available, options);
  }

  public setSelected(deviceId: string, selected: boolean): boolean {
    return this.#require(deviceId).setSelected(selected);
  }

  public dispose(): void {
    for (const unsubscribe of this.#runtimeUnsubscribes.values()) unsubscribe();
    for (const runtime of this.#devices.values()) runtime.dispose();
    this.#runtimeUnsubscribes.clear();
    this.#devices.clear();
    this.#listeners.clear();
    for (const listeners of this.#roomListeners.values()) listeners.clear();
    this.#roomListeners.clear();
  }

  #register(input: DeviceRuntimeInput): DeviceRuntime {
    this.#registry.upsert(input.descriptor);
    const runtime = new DeviceRuntime(input);
    this.#devices.set(input.descriptor.id, runtime);
    this.#runtimeUnsubscribes.set(
      input.descriptor.id,
      runtime.subscribe((snapshot) => this.#handleRuntimeUpdate(snapshot)),
    );
    this.#version += 1;
    const snapshot = runtime.snapshot();
    this.#listeners.emit({
      kind: 'registered',
      deviceId: snapshot.id,
      roomIds: [snapshot.roomId],
      version: this.#version,
      snapshot,
    });
    this.#emitRoom(snapshot.roomId);
    return runtime;
  }

  #handleRuntimeUpdate(snapshot: DeviceRuntimeSnapshot): void {
    this.#version += 1;
    this.#listeners.emit({
      kind: 'updated',
      deviceId: snapshot.id,
      roomIds: [snapshot.roomId],
      version: this.#version,
      snapshot,
    });
    this.#emitRoom(snapshot.roomId);
  }

  #emitRoom(roomId: string): void {
    this.#roomListeners.get(roomId)?.emit(this.roomSnapshot(roomId));
  }

  #require(deviceId: string): DeviceRuntime {
    const device = this.#devices.get(deviceId);
    if (device === undefined) throw new Error(`Unknown device: ${deviceId}`);
    return device;
  }
}
