import { SubscriptionSet, type RuntimeUnsubscribe } from './subscriptions.js';
import type { SelectionSnapshot } from './types.js';

export class SelectionManager {
  readonly #listeners = new SubscriptionSet<SelectionSnapshot>();
  #version = 0;
  #selectedRoomId: string | null = null;
  #selectedDeviceId: string | null = null;
  #hoveredDeviceId: string | null = null;
  #focusedDeviceId: string | null = null;

  public snapshot(): SelectionSnapshot {
    return {
      version: this.#version,
      selectedRoomId: this.#selectedRoomId,
      selectedDeviceId: this.#selectedDeviceId,
      hoveredDeviceId: this.#hoveredDeviceId,
      focusedDeviceId: this.#focusedDeviceId,
    };
  }

  public subscribe(listener: (snapshot: SelectionSnapshot) => void): RuntimeUnsubscribe {
    return this.#listeners.subscribe(listener);
  }

  public selectRoom(roomId: string | null): boolean {
    if (roomId === this.#selectedRoomId) return false;
    this.#selectedRoomId = roomId;
    this.#selectedDeviceId = null;
    this.#publish();
    return true;
  }

  public selectDevice(deviceId: string | null, roomId?: string | null): boolean {
    const nextRoomId = roomId === undefined ? this.#selectedRoomId : roomId;
    if (deviceId === this.#selectedDeviceId && nextRoomId === this.#selectedRoomId) return false;
    this.#selectedDeviceId = deviceId;
    this.#selectedRoomId = nextRoomId;
    this.#publish();
    return true;
  }

  public hoverDevice(deviceId: string | null): boolean {
    if (deviceId === this.#hoveredDeviceId) return false;
    this.#hoveredDeviceId = deviceId;
    this.#publish();
    return true;
  }

  public focusDevice(deviceId: string | null): boolean {
    if (deviceId === this.#focusedDeviceId) return false;
    this.#focusedDeviceId = deviceId;
    this.#publish();
    return true;
  }

  public clear(): boolean {
    if (
      this.#selectedRoomId === null &&
      this.#selectedDeviceId === null &&
      this.#hoveredDeviceId === null &&
      this.#focusedDeviceId === null
    ) {
      return false;
    }
    this.#selectedRoomId = null;
    this.#selectedDeviceId = null;
    this.#hoveredDeviceId = null;
    this.#focusedDeviceId = null;
    this.#publish();
    return true;
  }

  public dispose(): void {
    this.#listeners.clear();
  }

  #publish(): void {
    this.#version += 1;
    this.#listeners.emit(this.snapshot());
  }
}
