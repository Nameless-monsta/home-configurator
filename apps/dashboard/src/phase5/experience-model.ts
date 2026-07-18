/**
 * Experience model — capability-driven mapping from the real Home Assistant /
 * runtime state onto the IYO experience view models. No parallel state store:
 * this reads the confirmed HA snapshot plus the runtime device store's
 * effective (optimistic) state and derives categories, primary readouts and the
 * adaptive control sets. See docs/PHASE-5-IYO-EXPERIENCE.md.
 */

import type { CanonicalDevice, CapabilityKind } from '@home-configurator/home-assistant';

export type DeviceCategory =
  'light' | 'climate' | 'cover' | 'media' | 'security' | 'cleaning' | 'sensor' | 'appliance';

export interface DeviceViewState {
  readonly on: boolean;
  readonly available: boolean;
  readonly brightness: number;
  readonly hue: number;
  readonly saturation: number;
  readonly colourTempK: number;
  readonly targetTemp: number;
  readonly currentTemp: number;
  readonly humidity: number;
  readonly hvac: string;
  readonly fan: string;
  readonly volume: number;
  readonly playing: boolean;
  readonly source: string;
  readonly position: number;
  readonly locked: boolean;
  readonly cleaning: boolean;
  readonly docked: boolean;
  readonly battery: number;
  readonly privacy: boolean;
  readonly recording: boolean;
  readonly reading: string;
  readonly pending: boolean;
}

export const defaultViewState = (): DeviceViewState => ({
  on: false, available: true, brightness: 0.5, hue: 38, saturation: 40,
  colourTempK: 3200, targetTemp: 22, currentTemp: 22, humidity: 45,
  hvac: 'off', fan: 'auto', volume: 0.3, playing: false, source: '',
  position: 0, locked: true, cleaning: false, docked: true, battery: 100,
  privacy: false, recording: false, reading: '', pending: false,
});

export interface DeviceView {
  readonly id: string;
  readonly name: string;
  readonly roomId: string;
  readonly roomName: string;
  readonly category: DeviceCategory;
  readonly capabilities: readonly CapabilityKind[];
  readonly favourite: boolean;
  readonly available: boolean;
  readonly state: DeviceViewState;
}

export interface RoomView {
  readonly id: string;
  readonly name: string;
  readonly deviceIds: readonly string[];
}

const READABLE_CATEGORY: Record<DeviceCategory, string> = {
  light: 'Lighting',
  climate: 'Climate',
  cover: 'Covers',
  media: 'Media',
  security: 'Security',
  cleaning: 'Cleaning',
  sensor: 'Environment',
  appliance: 'Appliances',
};

export const CATEGORY_ORDER: readonly DeviceCategory[] = [
  'light', 'climate', 'cover', 'media', 'security', 'cleaning', 'appliance', 'sensor',
];

export const categoryLabel = (category: DeviceCategory): string => READABLE_CATEGORY[category];

const has = (capabilities: readonly CapabilityKind[], kind: CapabilityKind): boolean =>
  capabilities.includes(kind);

export const deriveCategory = (device: CanonicalDevice): DeviceCategory => {
  const caps = device.capabilities;
  const domains = device.entityIds.map((entityId) => entityId.split('.')[0] ?? '');
  if (has(caps, 'lock') || domains.includes('lock')) return 'security';
  if (domains.includes('camera')) return 'security';
  if (has(caps, 'vacuumCleaning') || has(caps, 'vacuumReturnHome')) return 'cleaning';
  if (has(caps, 'coverPosition') || domains.includes('cover')) return 'cover';
  if (has(caps, 'targetTemperature') || has(caps, 'hvacMode') || domains.includes('climate')) return 'climate';
  if (has(caps, 'mediaPlayback') || has(caps, 'volume') || domains.includes('media_player')) return 'media';
  if (has(caps, 'brightness') || has(caps, 'color') || domains.includes('light')) return 'light';
  if (domains.some((domain) => domain === 'switch' || domain === 'fan')) return 'appliance';
  if (has(caps, 'sensor') || domains.includes('sensor') || domains.includes('binary_sensor')) return 'sensor';
  return 'appliance';
};

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;
const str = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

export const deriveState = (
  device: CanonicalDevice,
  raw:
    | {
        readonly effectiveState?: Readonly<Record<string, unknown>>;
        readonly available?: boolean;
        readonly pendingCommandIds?: readonly string[];
      }
    | undefined,
): DeviceViewState => {
  const state = raw?.effectiveState ?? {};
  const colour = state['color'];
  const hue = Array.isArray(colour) && typeof colour[0] === 'number' ? colour[0] : 38;
  const saturation = Array.isArray(colour) && typeof colour[1] === 'number' ? colour[1] : 45;
  const power = bool(state['power'], undefined as unknown as boolean);
  const brightness = num(state['brightness'], 0.6);
  const derivedOn = power ?? (brightness > 0 && device.capabilities.includes('brightness'));

  return {
    on: power ?? derivedOn ?? false,
    available: raw?.available ?? device.available,
    brightness,
    hue,
    saturation,
    colourTempK: num(state['colorTemperature'], 3200),
    targetTemp: num(state['targetTemperature'], 22),
    currentTemp: num(state['currentTemperature'], num(state['temperature'], 22)),
    humidity: num(state['humidity'], 45),
    hvac: str(state['hvacMode'], 'off'),
    fan: str(state['fanMode'], 'auto'),
    volume: num(state['volume'], 0.3),
    playing: str(state['mediaPlayback'], '') === 'playing' || bool(state['playing'], false),
    source: str(state['mediaSource'], ''),
    position: num(state['coverPosition'], 0),
    locked: bool(state['lock'], true),
    cleaning: bool(state['vacuumCleaning'], false),
    docked: bool(state['docked'], true),
    battery: num(state['battery'], 100),
    privacy: bool(state['privacy'], false),
    recording: bool(state['recording'], false),
    reading: str(state['sensor'], ''),
    pending: (raw?.pendingCommandIds?.length ?? 0) > 0,
  };
};

export const primaryStatus = (view: DeviceView): string => {
  const s = view.state;
  if (!s.available) return 'Unavailable';
  switch (view.category) {
    case 'light': return s.on ? `${Math.round(s.brightness * 100)}%` : 'Off';
    case 'climate': return s.hvac === 'off' ? 'Off' : `${Math.round(s.targetTemp)}° · ${s.hvac}`;
    case 'cover': return s.position <= 1 ? 'Closed' : `${Math.round(s.position)}% open`;
    case 'media': return s.playing ? 'Playing' : 'Idle';
    case 'security':
      if (view.capabilities.includes('lock')) return s.locked ? 'Locked' : 'Unlocked';
      return s.privacy ? 'Privacy' : s.recording ? 'Recording' : 'Idle';
    case 'cleaning': return s.cleaning ? 'Cleaning' : s.docked ? 'Docked' : 'Paused';
    case 'sensor': return s.reading || `${s.currentTemp.toFixed(1)}°`;
    case 'appliance': return s.on ? 'On' : 'Off';
  }
};
