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
import './phase5/iyo-fidelity-v2.css';

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
        entity_id: 'vacuum.robot_vacuum',
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
        brightness: 184,
        color_temp_kelvin: 2700,
        rgb_color: [255, 190, 120],
        supported_color_modes: ['color_temp', 'rgb'],
      }),
      entityState('media_player.living_room_tv', 'off', {
        friendly_name: 'Living Room TV',
        supported_features: 152463,
        volume_level: 0.24,
      }),
      entityState('lock.front_door', 'locked', { friendly_name: 'Front Door' }),
      entityState('climate.bedroom_ac', 'cool', {
        friendly_name: 'Bedroom Climate',
        current_temperature: 23,
        temperature: 21,
        hvac_modes: ['off', 'cool', 'heat', 'auto'],
        fan_modes: ['low', 'medium', 'high', 'auto'],
        fan_mode: 'auto',
      }),
      entityState('light.bedroom_lamp', 'off', {
        friendly_name: 'Bedside Light',
        brightness: 90,
        color_temp_kelvin: 3000,
        supported_color_modes: ['color_temp'],
      }),
      entityState('sensor.kitchen_temperature', '22.7', {
        friendly_name: 'Kitchen Temperature',
        unit_of_measurement: '°C',
      }),
      entityState('sensor.kitchen_humidity', '48', {
        friendly_name: 'Kitchen Humidity',
        unit_of_measurement: '%',
      }),
      entityState('vacuum.robot_vacuum', 'docked', {
        friendly_name: 'Robot Vacuum',
        battery_level: 92,
        supported_features: 20539,
      }),
      entityState('cover.terrace_shade', 'open', {
        friendly_name: 'Terrace Shade',
        current_position: 82,
        supported_features: 15,
      }),
    ],
  }),
});

const deviceStore = new DeviceStore();
const data = new ExperienceDataSource({
  deviceStore,
  snapshot: () => homeAssistant.getSnapshot(),
  diagnostics: runtime.diagnostics,
});

const shell = new ExperienceShell({
  root,
  sink: {
    dispatch: async (command) => {
      await homeAssistant.dispatch(command);
    },
  },
  data,
  reducedMotion,
});

const graphics = attachGraphicsRuntime({ runtime, canvas: shell.canvas });
shell.attach(graphics);

let lastTime = performance.now();
const tick = (time: number): void => {
  const delta = Math.min(64, time - lastTime);
  lastTime = time;
  graphics.tick(delta);
  shell.tick(delta);
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

const applySnapshot = (snapshot: ConfirmedRuntimeSnapshot): void => {
  deviceStore.reconcile(snapshot);
  shell.refresh();
};

homeAssistant.subscribe(applySnapshot);
await homeAssistant.start();
applySnapshot(homeAssistant.getSnapshot());

window.addEventListener('beforeunload', () => {
  shell.dispose();
  graphics.dispose();
  homeAssistant.dispose();
  runtime.dispose();
});
