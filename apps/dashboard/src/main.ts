/**
 * Home Configurator — Phase 5 IYO experience entry point.
 *
 * Boots the shared runtime, graphics engine, Home Assistant engine (memory
 * transport demo home) and runtime device store, then mounts the object-first
 * experience shell. All device commands flow through the existing Home
 * Assistant command path (HomeAssistantStateAdapter.dispatch); the experience
 * layer never writes to Home Assistant directly. See docs/PHASE-5-IYO-EXPERIENCE.md.
 */

import { attachGraphicsRuntime } from '@home-configurator/graphics';
import {
  HomeAssistantEngine,
  HomeAssistantStateAdapter,
  MemoryHomeAssistantTransport,
  type ConfirmedRuntimeSnapshot,
  type HAState,
} from '@home-configurator/home-assistant';
import { createRuntime, DeviceStore } from '@home-configurator/runtime';

import { ExperienceDataSource } from './phase5/experience-data.js';
import { ExperienceShell } from './phase5/experience-shell.js';
import './phase5/experience.css';
import './phase5/prototype-home-v1.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Application root was not found');

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

const runtime = createRuntime({
  config: { application: { environment: import.meta.env.DEV ? 'development' : 'production' } },
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
      { area_id: 'terrace', name: 'Terrace', floor_id: 'ground' },
    ],
    devices: [
      {
        id: 'ikea-lamp',
        name: 'Floor Lamp',
        area_id: 'living-room',
        manufacturer: 'IKEA',
        model: 'TRÅDFRI',
      },
      { id: 'living-tv', name: 'Living Room TV', area_id: 'living-room' },
      { id: 'front-lock', name: 'Front Door', area_id: 'living-room', manufacturer: 'Yale' },
      { id: 'bedroom-ac', name: 'Bedroom Climate', area_id: 'bedroom' },
      { id: 'bedroom-lamp', name: 'Bedside Light', area_id: 'bedroom' },
      { id: 'kitchen-sensor', name: 'Kitchen Environment', area_id: 'kitchen' },
      { id: 'robot-vac', name: 'Robot Vacuum', area_id: 'kitchen', manufacturer: 'Roborock' },
      { id: 'terrace-shade', name: 'Terrace Shade', area_id: 'terrace' },
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
        entity_id: 'lock.front_door',
        unique_id: 'front-lock-lock',
        platform: 'zwave_js',
        device_id: 'front-lock',
      },
      {
        entity_id: 'climate.bedroom_ac',
        unique_id: 'bedroom-ac-climate',
        platform: 'climate',
        device_id: 'bedroom-ac',
      },
      {
        entity_id: 'light.bedroom_lamp',
        unique_id: 'bedroom-lamp-light',
        platform: 'hue',
        device_id: 'bedroom-lamp',
      },
      {
        entity_id: 'sensor.kitchen_temperature',
        unique_id: 'kitchen-temperature',
        platform: 'sensor',
        device_id: 'kitchen-sensor',
      },
      {
        entity_id: 'sensor.kitchen_humidity',
        unique_id: 'kitchen-humidity',
        platform: 'sensor',
        device_id: 'kitchen-sensor',
      },
      {
        entity_id: 'vacuum.robot_vac',
        unique_id: 'robot-vac-vacuum',
        platform: 'roborock',
        device_id: 'robot-vac',
      },
      {
        entity_id: 'cover.terrace_shade',
        unique_id: 'terrace-shade-cover',
        platform: 'cover',
        device_id: 'terrace-shade',
      },
    ],
    states: [
      entityState('light.ikea_lamp', 'on', {
        friendly_name: 'Floor Lamp',
        brightness: 168,
        color_temp_kelvin: 3200,
        rgb_color: [255, 191, 128],
        supported_color_modes: ['rgb', 'color_temp'],
      }),
      entityState('media_player.living_room_tv', 'playing', {
        friendly_name: 'Living Room TV',
        volume_level: 0.34,
        source: 'tv',
        media_title: 'Home Configurator Demo',
      }),
      entityState('lock.front_door', 'locked', { friendly_name: 'Front Door' }),
      entityState('climate.bedroom_ac', 'cool', {
        friendly_name: 'Bedroom Climate',
        temperature: 22,
        current_temperature: 23.5,
        current_humidity: 48,
        fan_mode: 'auto',
        fan_modes: ['auto', 'low', 'high'],
      }),
      entityState('light.bedroom_lamp', 'off', {
        friendly_name: 'Bedside Light',
        brightness: 90,
        supported_color_modes: ['color_temp'],
      }),
      entityState('sensor.kitchen_temperature', '24.1', {
        friendly_name: 'Temperature',
        unit_of_measurement: '°C',
      }),
      entityState('sensor.kitchen_humidity', '52', {
        friendly_name: 'Humidity',
        unit_of_measurement: '%',
      }),
      entityState('vacuum.robot_vac', 'docked', {
        friendly_name: 'Robot Vacuum',
        battery_level: 96,
      }),
      entityState('cover.terrace_shade', 'open', {
        friendly_name: 'Terrace Shade',
        current_position: 72,
      }),
    ],
  }),
});

const deviceStore = new DeviceStore();
const homeAssistantState = new HomeAssistantStateAdapter({ homeAssistant, store: deviceStore });
homeAssistantState.start();

let latestSnapshot: ConfirmedRuntimeSnapshot | null = null;

const data = new ExperienceDataSource({
  snapshot: () => latestSnapshot,
  store: deviceStore,
});

const shell = new ExperienceShell({
  root,
  sink: homeAssistantState,
  data,
  reducedMotion,
});

const graphicsHandle = attachGraphicsRuntime({
  runtime,
  canvas: shell.canvas,
  viewportElement: shell.stage,
  qualityTier: 'balanced',
});
graphicsHandle.engine.setBackground(0x101010);
shell.attach(graphicsHandle.engine);

const unregisterExperienceTick = runtime.scheduler.register({
  id: 'phase5.experience',
  priority: 200,
  tick: (context) => shell.tick(context.deltaMs),
});

homeAssistant.subscribe(({ snapshot }) => {
  latestSnapshot = snapshot;
});

const unsubscribeStore = deviceStore.subscribe(() => shell.refresh());

runtime.events.on('runtime.phase', ({ current }) => {
  runtime.diagnostics.record('info', 'phase5', 'Runtime phase', { current });
});

void Promise.all([runtime.start(), homeAssistant.connect()]);

let disposed = false;
const shutdown = async (): Promise<void> => {
  if (disposed) return;
  disposed = true;
  unregisterExperienceTick();
  unsubscribeStore();
  shell.dispose();
  homeAssistantState.dispose();
  deviceStore.dispose();
  await homeAssistant.disconnect();
  homeAssistant.dispose();
  await runtime.stop();
  graphicsHandle.dispose();
};

window.addEventListener('pagehide', () => void shutdown());
