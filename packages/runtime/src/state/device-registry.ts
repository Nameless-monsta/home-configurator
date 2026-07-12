import type { DeviceDescriptor } from './types.js';

const assertIdentifier = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be a non-empty string`);
  return normalized;
};

const normalizeDescriptor = (descriptor: DeviceDescriptor): DeviceDescriptor => ({
  id: assertIdentifier(descriptor.id, 'Device ID'),
  roomId: assertIdentifier(descriptor.roomId, 'Room ID'),
  entityIds: [...new Set(descriptor.entityIds.map((id) => assertIdentifier(id, 'Entity ID')))],
  ...(descriptor.name === undefined ? {} : { name: descriptor.name }),
  ...(descriptor.available === undefined ? {} : { available: descriptor.available }),
  ...(descriptor.connected === undefined ? {} : { connected: descriptor.connected }),
});

export class DeviceRegistry {
  readonly #descriptors = new Map<string, DeviceDescriptor>();
  readonly #entityToDevice = new Map<string, string>();
  readonly #roomToDevices = new Map<string, Set<string>>();

  public upsert(descriptor: DeviceDescriptor): DeviceDescriptor | null {
    const normalized = normalizeDescriptor(descriptor);
    for (const entityId of normalized.entityIds) {
      const owner = this.#entityToDevice.get(entityId);
      if (owner !== undefined && owner !== normalized.id) {
        throw new Error(`Entity ${entityId} is already registered to device ${owner}`);
      }
    }

    const previous = this.#descriptors.get(normalized.id) ?? null;
    if (previous !== null) this.#removeIndexes(previous);
    this.#descriptors.set(normalized.id, normalized);
    this.#addIndexes(normalized);
    return previous;
  }

  public remove(deviceId: string): DeviceDescriptor | null {
    const descriptor = this.#descriptors.get(deviceId) ?? null;
    if (descriptor === null) return null;
    this.#descriptors.delete(deviceId);
    this.#removeIndexes(descriptor);
    return descriptor;
  }

  public get(deviceId: string): DeviceDescriptor | null {
    return this.#descriptors.get(deviceId) ?? null;
  }

  public deviceIdForEntity(entityId: string): string | null {
    return this.#entityToDevice.get(entityId) ?? null;
  }

  public deviceIdsForRoom(roomId: string): readonly string[] {
    return [...(this.#roomToDevices.get(roomId) ?? [])].sort();
  }

  public descriptors(): readonly DeviceDescriptor[] {
    return [...this.#descriptors.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  public rooms(): Readonly<Record<string, readonly string[]>> {
    return Object.fromEntries(
      [...this.#roomToDevices.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([roomId, deviceIds]) => [roomId, [...deviceIds].sort()]),
    );
  }

  public get size(): number {
    return this.#descriptors.size;
  }

  #addIndexes(descriptor: DeviceDescriptor): void {
    for (const entityId of descriptor.entityIds) this.#entityToDevice.set(entityId, descriptor.id);
    const roomDevices = this.#roomToDevices.get(descriptor.roomId) ?? new Set<string>();
    roomDevices.add(descriptor.id);
    this.#roomToDevices.set(descriptor.roomId, roomDevices);
  }

  #removeIndexes(descriptor: DeviceDescriptor): void {
    for (const entityId of descriptor.entityIds) {
      if (this.#entityToDevice.get(entityId) === descriptor.id)
        this.#entityToDevice.delete(entityId);
    }
    const roomDevices = this.#roomToDevices.get(descriptor.roomId);
    roomDevices?.delete(descriptor.id);
    if (roomDevices?.size === 0) this.#roomToDevices.delete(descriptor.roomId);
  }
}
