import { attachGraphicsRuntime } from '@home-configurator/graphics';
import {
  HomeAssistantEngine,
  MemoryHomeAssistantTransport,
  type HAState,
} from '@home-configurator/home-assistant';
import { InteractionEngine, semanticOrbitHandler } from '@home-configurator/interaction';
import { createRuntime } from '@home-configurator/runtime';

import './styles.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Application root was not found');

root.innerHTML = `
  <section class="runtime-shell">
    <header class="runtime-header">
      <span>Home Configurator</span>
      <span class="runtime-status" data-runtime-status>Booting</span>
    </header>
    <main class="runtime-stage" data-stage tabindex="0" aria-label="Interactive Home Configurator 3D stage. Drag to rotate the selected object.">
      <canvas class="graphics-canvas" data-graphics-canvas aria-hidden="true"></canvas>
      <div class="stage-caption">
        <p class="stage-kicker">Automatic Home Assistant discovery online</p>
        <h1 class="runtime-title">Home Assistant Engine</h1>
        <p class="runtime-subtitle">Areas, devices, entities and capabilities are resolved into a portable semantic home model.</p>
      </div>
    </main>
    <footer class="runtime-footer">
      <span>v0.5.0</span>
      <div class="runtime-diagnostics" aria-label="Runtime diagnostics">
        <span>Runtime<strong data-phase>idle</strong></span>
        <span>HA<strong data-ha-status>uninitialized</strong></span>
        <span>Rooms<strong data-rooms>0</strong></span>
        <span>Devices<strong data-devices>0</strong></span>
        <span>Entities<strong data-entities>0</strong></span>
        <span>Frame<strong data-frame>0</strong></span>
        <span>Gestures<strong data-gestures>0</strong></span>
      </div>
    </footer>
  </section>
`;

const canvas = root.querySelector<HTMLCanvasElement>('[data-graphics-canvas]');
const stage = root.querySelector<HTMLElement>('[data-stage]');
if (!canvas || !stage) throw new Error('Graphics stage was not created');

const statusNode = root.querySelector<HTMLElement>('[data-runtime-status]');
const phaseNode = root.querySelector<HTMLElement>('[data-phase]');
const homeAssistantStatusNode = root.querySelector<HTMLElement>('[data-ha-status]');
const roomsNode = root.querySelector<HTMLElement>('[data-rooms]');
const devicesNode = root.querySelector<HTMLElement>('[data-devices]');
const entitiesNode = root.querySelector<HTMLElement>('[data-entities]');
const frameNode = root.querySelector<HTMLElement>('[data-frame]');
const gesturesNode = root.querySelector<HTMLElement>('[data-gestures]');

const runtime = createRuntime({
  config: { application: { environment: import.meta.env.DEV ? 'development' : 'production' } },
});
const graphicsHandle = attachGraphicsRuntime({
  runtime,
  canvas,
  viewportElement: stage,
  qualityTier: 'balanced',
});
const hero = graphicsHandle.engine.createFallbackHero();
graphicsHandle.engine.cameraRig.frameObject(hero, { padding: 1.65, reducedMotion: true });

const interaction = new InteractionEngine({
  runtime,
  graphics: graphicsHandle.engine,
  surface: stage,
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
    if (intent.type === 'adjust-left') hero.rotation.y -= 0.12;
    if (intent.type === 'adjust-right') hero.rotation.y += 0.12;
    if (intent.type === 'adjust-up') hero.rotation.x -= 0.08;
    if (intent.type === 'adjust-down') hero.rotation.x += 0.08;
  },
});
interaction.animations.play({
  id: 'demo-lamp-float',
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

const homeAssistantTransport = new MemoryHomeAssistantTransport({
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
    { id: 'apple-tv', name: 'Apple TV', area_id: 'living-room', manufacturer: 'Apple' },
    {
      id: 'roborock',
      name: 'Roborock S7 Max',
      area_id: 'living-room',
      manufacturer: 'Roborock',
    },
    { id: 'thermostat', name: 'AC Thermostat', area_id: 'bedroom' },
    { id: 'kitchen-switch', name: 'Kitchen Lights', area_id: 'kitchen' },
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
      entity_id: 'media_player.apple_tv',
      unique_id: 'apple-tv-player',
      platform: 'apple_tv',
      device_id: 'apple-tv',
    },
    {
      entity_id: 'vacuum.roborock_s7_max',
      unique_id: 'roborock-vacuum',
      platform: 'roborock',
      device_id: 'roborock',
    },
    {
      entity_id: 'climate.bedroom_ac',
      unique_id: 'bedroom-climate',
      platform: 'climate',
      device_id: 'thermostat',
    },
    {
      entity_id: 'switch.kitchen_lights',
      unique_id: 'kitchen-switch',
      platform: 'switch',
      device_id: 'kitchen-switch',
    },
  ],
  states: [
    entityState('light.ikea_lamp', 'on', {
      friendly_name: 'IKEA Lamp',
      brightness: 168,
      supported_color_modes: ['hs', 'color_temp'],
    }),
    entityState('media_player.living_room_tv', 'on', {
      friendly_name: 'Living Room TV',
      volume_level: 0.34,
      source_list: ['HDMI 1', 'Apple TV'],
    }),
    entityState('media_player.apple_tv', 'playing', {
      friendly_name: 'Apple TV',
      volume_level: 0.28,
      source_list: ['Movies', 'Music'],
    }),
    entityState('vacuum.roborock_s7_max', 'docked', {
      friendly_name: 'Roborock S7 Max',
      battery_level: 92,
    }),
    entityState('climate.bedroom_ac', 'cool', {
      friendly_name: 'AC Thermostat',
      temperature: 22,
      fan_modes: ['auto', 'low', 'high'],
    }),
    entityState('switch.kitchen_lights', 'off', {
      friendly_name: 'Kitchen Lights',
    }),
  ],
});
const homeAssistant = new HomeAssistantEngine({
  config: {
    url: 'http://homeassistant.demo',
    accessToken: 'memory-transport-only',
    reconnect: { enabled: false },
  },
  diagnostics: runtime.diagnostics,
  transport: homeAssistantTransport,
});

runtime.events.on('runtime.phase', ({ current }) => {
  if (phaseNode) phaseNode.textContent = current;
  if (statusNode) statusNode.textContent = current === 'running' ? 'Online' : current;
});

homeAssistant.subscribe(({ snapshot }) => {
  if (homeAssistantStatusNode) homeAssistantStatusNode.textContent = snapshot.status;
  if (roomsNode) roomsNode.textContent = String(snapshot.rooms.length);
  if (devicesNode) devicesNode.textContent = String(snapshot.devices.length);
  if (entitiesNode) entitiesNode.textContent = String(Object.keys(snapshot.states).length);
});

runtime.diagnostics.subscribe((snapshot) => {
  if (frameNode) frameNode.textContent = String(snapshot.gauges['scheduler.frame'] ?? 0);
  if (gesturesNode) {
    gesturesNode.textContent = String(snapshot.counters['interaction.completed'] ?? 0);
  }
});

void Promise.all([runtime.start(), homeAssistant.connect()]);

let disposed = false;
const shutdown = async (): Promise<void> => {
  if (disposed) return;
  disposed = true;
  interaction.dispose();
  await homeAssistant.disconnect();
  homeAssistant.dispose();
  await runtime.stop();
  graphicsHandle.dispose();
};

window.addEventListener('pagehide', () => {
  void shutdown();
});
