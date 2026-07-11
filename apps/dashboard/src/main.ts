import { attachGraphicsRuntime } from '@home-configurator/graphics';
import {
  HomeAssistantEngine,
  MemoryHomeAssistantTransport,
  type ConfirmedRuntimeSnapshot,
  type HAState,
} from '@home-configurator/home-assistant';
import { InteractionEngine, semanticOrbitHandler } from '@home-configurator/interaction';
import { createRuntime } from '@home-configurator/runtime';
import {
  UiConfigurator,
  UiFoundation,
  UiNavigation,
  type ConfiguratorDocument,
  type ConfiguratorValue,
  type UiNavigationLocation,
} from '@home-configurator/ui';

import './styles.css';
import './navigation.css';
import './configurator.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Application root was not found');

const ui = new UiFoundation({
  root,
  version: '0.6.3',
  subtitle: 'Select a device and inspect its generic capability-driven configuration.',
});

let latestHomeSnapshot: ConfirmedRuntimeSnapshot | null = null;

const createDocument = (
  snapshot: ConfirmedRuntimeSnapshot | null,
  location: UiNavigationLocation,
): ConfiguratorDocument | null => {
  const device = snapshot?.devices.find((item) => item.id === location.deviceId);
  if (!device) return null;
  return {
    id: device.id,
    title: device.name,
    subtitle:
      [device.manufacturer, device.model].filter(Boolean).join(' ') || 'Home Assistant device',
    available: device.available,
    sections: [
      {
        id: 'identity',
        title: 'Identity',
        fields: [
          {
            id: 'manufacturer',
            label: 'Manufacturer',
            kind: 'status',
            value: device.manufacturer ?? 'Unknown',
            readOnly: true,
          },
          {
            id: 'model',
            label: 'Model',
            kind: 'status',
            value: device.model ?? 'Unknown',
            readOnly: true,
          },
          {
            id: 'entities',
            label: 'Entities',
            kind: 'status',
            value: device.entityIds.length,
            readOnly: true,
          },
        ],
      },
      {
        id: 'capabilities',
        title: 'Capabilities',
        description: 'Generic capability hosts. Device-specific controls arrive in 4.6.5.',
        fields: device.capabilities.map((capability) => ({
          id: `capability.${capability}`,
          label: capability,
          kind: 'status' as const,
          value:
            device.optimistic[capability] === undefined
              ? 'Available'
              : String(device.optimistic[capability]),
          readOnly: true,
        })),
      },
      {
        id: 'preferences',
        title: 'UI Preferences',
        description: 'Framework-owned demo values used to validate history and saving.',
        fields: [
          { id: 'favorite', label: 'Favourite device', kind: 'toggle', value: false },
          { id: 'displayName', label: 'Display name', kind: 'text', value: device.name },
        ],
        actions: [{ id: 'identify', label: 'Identify device' }],
      },
    ],
  };
};

const configurator = new UiConfigurator({
  root,
  adapter: {
    commit: async (_documentId: string, _changes: Readonly<Record<string, ConfiguratorValue>>) =>
      Promise.resolve(),
    invoke: async (_documentId: string, _actionId: string) => Promise.resolve(),
  },
  validate: (_document, values) => {
    const displayName = values['displayName'];
    return typeof displayName === 'string' && displayName.trim().length === 0
      ? [{ fieldId: 'displayName', message: 'Display name cannot be empty.' }]
      : [];
  },
});

const navigation = new UiNavigation({
  root,
  onNavigate: (location) => configurator.setDocument(createDocument(latestHomeSnapshot, location)),
});

const runtime = createRuntime({
  config: { application: { environment: import.meta.env.DEV ? 'development' : 'production' } },
});
const graphicsHandle = attachGraphicsRuntime({
  runtime,
  canvas: ui.canvas,
  viewportElement: ui.stage,
  qualityTier: 'balanced',
});
const hero = graphicsHandle.engine.createFallbackHero();
graphicsHandle.engine.cameraRig.frameObject(hero, { padding: 1.65, reducedMotion: true });

const interaction = new InteractionEngine({
  runtime,
  graphics: graphicsHandle.engine,
  surface: ui.stage,
  reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
});
interaction.selection.register('device.demo-lamp', hero);
const orbit = semanticOrbitHandler(hero);
interaction.registerTarget({
  id: 'device.demo-lamp',
  layer: 'object',
  gestures: ['tap', 'orbit', 'pinch', 'wheel', 'keyboard-action'],
  onIntent: (intent) => {
    orbit(intent);
    if (intent.type === 'tap.commit' || intent.type === 'activate') interaction.focusSelection();
  },
});
interaction.animations.play({
  id: 'configurator-float',
  durationMs: 4200,
  loop: true,
  onUpdate: (progress) => {
    hero.position.y = Math.sin(progress * Math.PI * 2) * 0.06;
  },
});

const observedAt = '2026-07-11T12:00:00.000Z';
const entityState = (
  entityId: string,
  state: string,
  attributes: Readonly<Record<string, unknown>>,
): HAState => ({
  entity_id: entityId,
  state,
  attributes,
  last_changed: observedAt,
  last_updated: observedAt,
});

const homeAssistant = new HomeAssistantEngine({
  config: {
    url: 'http://homeassistant.demo',
    accessToken: 'memory-transport-only',
    reconnect: { enabled: false },
  },
  diagnostics: runtime.diagnostics,
  transport: new MemoryHomeAssistantTransport({
    floors: [{ floor_id: 'ground', name: 'Ground Floor', level: 0 }],
    areas: [
      { area_id: 'living-room', name: 'Living Room', floor_id: 'ground' },
      { area_id: 'bedroom', name: 'Bedroom', floor_id: 'ground' },
      { area_id: 'kitchen', name: 'Kitchen', floor_id: 'ground' },
    ],
    devices: [
      {
        id: 'ikea-lamp',
        name: 'IKEA Lamp',
        area_id: 'living-room',
        manufacturer: 'IKEA',
        model: 'TRÅDFRI',
      },
      { id: 'living-tv', name: 'Living Room TV', area_id: 'living-room' },
      { id: 'bedroom-ac', name: 'Bedroom AC', area_id: 'bedroom' },
      { id: 'kitchen-lights', name: 'Kitchen Lights', area_id: 'kitchen' },
    ],
    entities: [
      {
        entity_id: 'light.ikea_lamp',
        unique_id: 'ikea-lamp-light',
        platform: 'zha',
        device_id: 'ikea-lamp',
      },
      {
        entity_id: 'media_player.living_room_tv',
        unique_id: 'living-tv-player',
        platform: 'webostv',
        device_id: 'living-tv',
      },
      {
        entity_id: 'climate.bedroom_ac',
        unique_id: 'bedroom-ac-climate',
        platform: 'climate',
        device_id: 'bedroom-ac',
      },
      {
        entity_id: 'switch.kitchen_lights',
        unique_id: 'kitchen-lights-switch',
        platform: 'switch',
        device_id: 'kitchen-lights',
      },
    ],
    states: [
      entityState('light.ikea_lamp', 'on', {
        friendly_name: 'IKEA Lamp',
        brightness: 168,
        supported_color_modes: ['hs', 'color_temp'],
      }),
      entityState('media_player.living_room_tv', 'playing', {
        friendly_name: 'Living Room TV',
        volume_level: 0.34,
      }),
      entityState('climate.bedroom_ac', 'cool', { friendly_name: 'Bedroom AC', temperature: 22 }),
      entityState('switch.kitchen_lights', 'off', { friendly_name: 'Kitchen Lights' }),
    ],
  }),
});

let runtimePhase = 'idle';
let homeAssistantStatus = 'uninitialized';
let rooms = 0;
let devices = 0;

runtime.events.on('runtime.phase', ({ current }) => {
  runtimePhase = current;
  ui.setRuntimeStatus(current === 'running' ? 'Online' : current);
});

homeAssistant.subscribe(({ snapshot }) => {
  latestHomeSnapshot = snapshot;
  homeAssistantStatus = snapshot.status;
  rooms = snapshot.rooms.length;
  devices = snapshot.devices.length;
  navigation.setItems(
    snapshot.rooms.map((room) => ({ id: room.id, name: room.name, deviceIds: room.deviceIds })),
    snapshot.devices.map((device) => ({
      id: device.id,
      name: device.name,
      roomId: device.roomId,
      available: device.available,
      meta: [device.manufacturer, device.model].filter(Boolean).join(' '),
    })),
  );
  configurator.setDocument(createDocument(snapshot, navigation.snapshot()));
});

runtime.diagnostics.subscribe((snapshot) => {
  const location = navigation.snapshot();
  ui.setDiagnostics({
    runtime: runtimePhase,
    homeAssistant: homeAssistantStatus,
    rooms,
    devices,
    room: location.roomId ?? 'none',
    device: location.deviceId ?? 'none',
    dirty: String(configurator.snapshot().dirty),
    frame: snapshot.gauges['scheduler.frame'] ?? 0,
    gestures: snapshot.counters['interaction.completed'] ?? 0,
  });
});

void Promise.all([runtime.start(), homeAssistant.connect()]);

let disposed = false;
const shutdown = async (): Promise<void> => {
  if (disposed) return;
  disposed = true;
  configurator.dispose();
  navigation.dispose();
  ui.dispose();
  interaction.dispose();
  await homeAssistant.disconnect();
  homeAssistant.dispose();
  await runtime.stop();
  graphicsHandle.dispose();
};

window.addEventListener('pagehide', () => void shutdown());
