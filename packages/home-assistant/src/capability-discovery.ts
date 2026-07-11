import type {
  CanonicalDevice,
  CanonicalRoom,
  CapabilityKind,
  EntityBinding,
  HAAreaRegistryEntry,
  HADeviceRegistryEntry,
  HAEntityRegistryEntry,
  HARegistrySnapshot,
  HAState,
} from './types.js';

const UNASSIGNED_ROOM_ID = 'ha-area:unassigned';

const domainOf = (entityId: string): string => entityId.split('.', 1)[0] ?? 'unknown';

const stringArray = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const supportsAnyColor = (state: HAState): boolean => {
  const modes = stringArray(state.attributes['supported_color_modes']);
  return modes.some((mode) => ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'].includes(mode));
};

const capabilitiesFor = (
  entity: HAEntityRegistryEntry,
  state: HAState | undefined,
): readonly CapabilityKind[] => {
  const domain = domainOf(entity.entity_id);
  const capabilities = new Set<CapabilityKind>();

  if (domain === 'light') {
    capabilities.add('power');
    if (
      state?.attributes['brightness'] !== undefined ||
      stringArray(state?.attributes['supported_color_modes']).length > 0
    ) {
      capabilities.add('brightness');
    }
    if (state && supportsAnyColor(state)) capabilities.add('color');
    const modes = stringArray(state?.attributes['supported_color_modes']);
    if (modes.includes('color_temp')) capabilities.add('colorTemperature');
  } else if (domain === 'switch' || domain === 'input_boolean' || domain === 'fan') {
    capabilities.add('power');
  } else if (domain === 'climate') {
    capabilities.add('power');
    capabilities.add('targetTemperature');
    capabilities.add('hvacMode');
    if (stringArray(state?.attributes['fan_modes']).length > 0) capabilities.add('fanMode');
  } else if (domain === 'media_player') {
    capabilities.add('power');
    capabilities.add('volume');
    capabilities.add('mediaPlayback');
    if (stringArray(state?.attributes['source_list']).length > 0) capabilities.add('mediaSource');
  } else if (domain === 'vacuum') {
    capabilities.add('vacuumCleaning');
    capabilities.add('vacuumReturnHome');
    capabilities.add('vacuumLocate');
  } else if (domain === 'cover') {
    capabilities.add('coverPosition');
  } else if (domain === 'lock') {
    capabilities.add('lock');
  } else if (['sensor', 'binary_sensor'].includes(domain)) {
    capabilities.add('sensor');
  }

  return [...capabilities];
};

const entityName = (entity: HAEntityRegistryEntry, state: HAState | undefined): string => {
  const friendlyName = state?.attributes['friendly_name'];
  if (typeof friendlyName === 'string' && friendlyName.trim()) return friendlyName;
  return entity.name ?? entity.original_name ?? entity.entity_id;
};

const deviceName = (
  device: HADeviceRegistryEntry | undefined,
  entity: HAEntityRegistryEntry,
  state: HAState | undefined,
): string => device?.name_by_user ?? device?.name ?? entityName(entity, state);

const roomIdFor = (
  entity: HAEntityRegistryEntry,
  device: HADeviceRegistryEntry | undefined,
  areasById: ReadonlyMap<string, HAAreaRegistryEntry>,
): string => {
  const areaId = entity.area_id ?? device?.area_id;
  return areaId && areasById.has(areaId) ? `ha-area:${areaId}` : UNASSIGNED_ROOM_ID;
};

export interface DiscoveryResult {
  readonly rooms: readonly CanonicalRoom[];
  readonly devices: readonly CanonicalDevice[];
}

export const discoverCanonicalHome = (
  registry: HARegistrySnapshot,
  optimisticByDevice: ReadonlyMap<
    string,
    Readonly<Partial<Record<CapabilityKind, unknown>>>
  > = new Map(),
): DiscoveryResult => {
  const statesById = new Map(registry.states.map((state) => [state.entity_id, state] as const));
  const areasById = new Map(registry.areas.map((area) => [area.area_id, area] as const));
  const devicesById = new Map(registry.devices.map((device) => [device.id, device] as const));
  const entities = registry.entities.filter(
    (entity) => entity.disabled_by == null && entity.hidden_by == null,
  );

  const grouped = new Map<string, HAEntityRegistryEntry[]>();
  for (const entity of entities) {
    const groupId = entity.device_id
      ? `ha-device:${entity.device_id}`
      : `ha-entity:${entity.entity_id}`;
    const current = grouped.get(groupId) ?? [];
    current.push(entity);
    grouped.set(groupId, current);
  }

  const canonicalDevices: CanonicalDevice[] = [];
  for (const [id, groupedEntities] of grouped) {
    const primary = groupedEntities[0];
    if (!primary) continue;
    const device = primary.device_id ? devicesById.get(primary.device_id) : undefined;
    const roomId = roomIdFor(primary, device, areasById);
    const bindings: EntityBinding[] = groupedEntities.map((entity) => {
      const state = statesById.get(entity.entity_id);
      return {
        entityId: entity.entity_id,
        domain: domainOf(entity.entity_id),
        capabilities: capabilitiesFor(entity, state),
        available: state !== undefined && !['unavailable', 'unknown'].includes(state.state),
        stale: false,
      };
    });
    const capabilities = [...new Set(bindings.flatMap((binding) => binding.capabilities))];
    canonicalDevices.push({
      id,
      name: deviceName(device, primary, statesById.get(primary.entity_id)),
      roomId,
      ...(device?.manufacturer ? { manufacturer: device.manufacturer } : {}),
      ...(device?.model ? { model: device.model } : {}),
      entityIds: groupedEntities.map((entity) => entity.entity_id),
      bindings,
      capabilities,
      available: bindings.some((binding) => binding.available),
      optimistic: optimisticByDevice.get(id) ?? {},
    });
  }

  const deviceIdsByRoom = new Map<string, string[]>();
  for (const device of canonicalDevices) {
    const current = deviceIdsByRoom.get(device.roomId) ?? [];
    current.push(device.id);
    deviceIdsByRoom.set(device.roomId, current);
  }

  const rooms: CanonicalRoom[] = registry.areas.map((area) => ({
    id: `ha-area:${area.area_id}`,
    name: area.name,
    ...(area.floor_id ? { floorId: `ha-floor:${area.floor_id}` } : {}),
    aliases: area.aliases ?? [],
    deviceIds: deviceIdsByRoom.get(`ha-area:${area.area_id}`) ?? [],
  }));

  const unassigned = deviceIdsByRoom.get(UNASSIGNED_ROOM_ID) ?? [];
  if (unassigned.length > 0) {
    rooms.push({
      id: UNASSIGNED_ROOM_ID,
      name: 'Unassigned',
      aliases: [],
      deviceIds: unassigned,
    });
  }

  rooms.sort((left, right) => left.name.localeCompare(right.name));
  canonicalDevices.sort((left, right) => left.name.localeCompare(right.name));
  return { rooms, devices: canonicalDevices };
};

export const affectedDeviceIdsForEntity = (
  devices: readonly CanonicalDevice[],
  entityId: string,
): readonly string[] =>
  devices.filter((device) => device.entityIds.includes(entityId)).map((device) => device.id);
