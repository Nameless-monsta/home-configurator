import type {
  CanonicalDevice,
  ConfirmedRuntimeSnapshot,
  HAState,
} from '@home-configurator/home-assistant';
import type {
  DevicePanelCapability,
  DevicePanelSource,
} from '@home-configurator/ui';

const numberAttribute = (state: HAState | undefined, key: string): number | undefined => {
  const value = state?.attributes[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const stringAttribute = (state: HAState | undefined, key: string): string | undefined => {
  const value = state?.attributes[key];
  return typeof value === 'string' ? value : undefined;
};

const firstState = (
  snapshot: ConfirmedRuntimeSnapshot,
  device: CanonicalDevice,
  domain?: string,
): HAState | undefined =>
  device.entityIds
    .filter((entityId) => (domain ? entityId.startsWith(`${domain}.`) : true))
    .map((entityId) => snapshot.states[entityId])
    .find((state): state is HAState => state !== undefined);

const percentage = (value: number | undefined, scale = 1): number | undefined =>
  value === undefined ? undefined : Math.round(value * scale);

export const toDevicePanelSource = (
  snapshot: ConfirmedRuntimeSnapshot,
  device: CanonicalDevice,
): DevicePanelSource => {
  const light = firstState(snapshot, device, 'light');
  const climate = firstState(snapshot, device, 'climate');
  const media = firstState(snapshot, device, 'media_player');
  const cover = firstState(snapshot, device, 'cover');
  const sensorStates = device.entityIds
    .filter((entityId) => entityId.startsWith('sensor.') || entityId.startsWith('binary_sensor.'))
    .map((entityId) => snapshot.states[entityId])
    .filter((state): state is HAState => state !== undefined);

  const values: Record<string, unknown> = { ...device.optimistic };
  const capabilities = [...device.capabilities] as DevicePanelCapability[];

  if (light) {
    values['power'] = light.state === 'on';
    values['brightness'] = percentage(numberAttribute(light, 'brightness'), 100 / 255);
    values['colorTemperature'] = numberAttribute(light, 'color_temp_kelvin');
    const rgb = light.attributes['rgb_color'];
    if (Array.isArray(rgb) && rgb.length >= 3 && rgb.every((item) => typeof item === 'number')) {
      values['color'] = `#${rgb
        .slice(0, 3)
        .map((item) => Math.max(0, Math.min(255, Math.round(item))).toString(16).padStart(2, '0'))
        .join('')}`;
    }
  }

  if (climate) {
    values['power'] = climate.state !== 'off';
    values['hvacMode'] = climate.state;
    values['targetTemperature'] = numberAttribute(climate, 'temperature');
    values['fanMode'] = stringAttribute(climate, 'fan_mode');
    values['currentTemperature'] = numberAttribute(climate, 'current_temperature');
    values['humidity'] = numberAttribute(climate, 'current_humidity');
  }

  if (media) {
    values['volume'] = percentage(numberAttribute(media, 'volume_level'), 100);
    values['mediaSource'] = stringAttribute(media, 'source');
    values['nowPlaying'] =
      stringAttribute(media, 'media_title') ?? stringAttribute(media, 'app_name') ?? media.state;
  }

  if (cover) {
    values['coverPosition'] = numberAttribute(cover, 'current_position');
  }

  for (const state of sensorStates) {
    const label = stringAttribute(state, 'friendly_name') ?? state.entity_id.split('.')[1] ?? state.entity_id;
    const unit = stringAttribute(state, 'unit_of_measurement');
    values[label.toLowerCase().replaceAll(' ', '_')] = unit ? `${state.state} ${unit}` : state.state;
  }

  return {
    id: device.id,
    name: device.name,
    subtitle: [device.manufacturer, device.model].filter(Boolean).join(' ') || 'Home Assistant device',
    available: device.available,
    capabilities,
    values,
    metadata: {
      manufacturer: device.manufacturer ?? 'Unknown',
      model: device.model ?? 'Unknown',
      entities: device.entityIds.length,
    },
  };
};
