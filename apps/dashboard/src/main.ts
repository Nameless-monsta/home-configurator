import { attachGraphicsRuntime } from '@home-configurator/graphics';
import {
  HomeAssistantEngine,
  MemoryHomeAssistantTransport,
  type CapabilityKind,
  type HAState,
  type SemanticCommand,
} from '@home-configurator/home-assistant';
import { InteractionEngine, semanticOrbitHandler } from '@home-configurator/interaction';
import { createRuntime } from '@home-configurator/runtime';
import { HomeConfiguratorUi } from '@home-configurator/ui';

import './styles.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Application root was not found');

const runtime = createRuntime({
  config: { application: { environment: import.meta.env.DEV ? 'development' : 'production' } },
});

let homeAssistant: HomeAssistantEngine | undefined;
let interaction: InteractionEngine | undefined;
let commandSequence = 0;

const commandPayload = (
  capability: CapabilityKind,
  action: string,
): Pick<SemanticCommand, 'action' | 'value'> => {
  if (capability === 'brightness') return { action, value: 0.72 };
  if (capability === 'color') return { action, value: [32, 58] };
  if (capability === 'colorTemperature') return { action, value: 3200 };
  if (capability === 'targetTemperature') return { action, value: 22 };
  if (capability === 'hvacMode') return { action, value: 'cool' };
  if (capability === 'fanMode') return { action, value: 'auto' };
  if (capability === 'volume') return { action, value: 0.45 };
  if (capability === 'mediaPlayback') return { action: 'toggle' };
  if (capability === 'mediaSource') return { action, value: 'Apple TV' };
  if (capability === 'coverPosition') return { action, value: 50 };
  if (capability === 'lock') return { action: 'lock' };
  return { action };
};

const ui = new HomeConfiguratorUi({
  root,
  version: '0.6.0',
  onRoomSelected: () => {
    interaction?.navigation.go({ level: 'room' });
  },
  onDeviceSelected: () => {
    interaction?.navigation.go({ level: 'device' });
    interaction?.focusSelection();
  },
  onDeviceAction: (deviceId, capabilityName, actionName) => {
    if (!homeAssistant) return;
    const capability = capabilityName as CapabilityKind;
    const device = homeAssistant
      .getConfirmedSnapshot()
      .devices.find((candidate) => candidate.id === deviceId);
    if (!device || !device.capabilities.includes(capability) || capability === 'sensor') return;

    let action = actionName;
    let value: unknown;
    if (capability === 'power') {
      const binding = device.bindings.find((candidate) => candidate.capabilities.includes('power'));
      const state = binding
        ? homeAssistant.getConfirmedSnapshot().states[binding.entityId]?.state
        : undefined;
      action = state === 'on' ? 'off' : 'on';
    } else {
      const payload = commandPayload(capability, actionName);
      action = payload.action;
      value = payload.value;
    }

    commandSequence += 1;
    void homeAssistant.dispatch({
      id: `ui-${commandSequence}`,
      deviceId,
      capability,
      action,
      ...(value === undefined ? {} : { value }),
      issuedAt: Date.now(),
      policy: 'reject-offline',
    });
  },
});

const graphicsHandle = attachGraphicsRuntime({
  runtime,
  canvas: ui.canvas,
  viewportElement: ui.stage,
  qualityTier: 'balanced',
});
const hero = graphicsHandle.engine.createFallbackHero();
graphicsHandle.engine.cameraRig.frameObject(hero, { padding: 1.65, reducedMotion: true });

interaction = new InteractionEngine({
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
    if (intent.type === 'tap.commit' || intent.type === 'activate') interaction?.focusSelection();
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

homeAssistant = new HomeAssistantEngine({
  config: {
    url: 'http://homeassistant.demo',
    accessToken: 'memory-transport-only',
    reconnect: { enabled: false },
  },
  diagnostics: runtime.diagnostics,
  transport: homeAssistantTransport,
});

let runtimePhase = 'idle';
let homeAssistantStatus = 'uninitialized';
runtime.events.on('runtime.phase', ({ current }) => {
  runtimePhase = current;
  ui.setRuntimeStatus(current === 'running' ? 'Online' : current);
});

homeAssistant.subscribe(({ snapshot }) => {
  homeAssistantStatus = snapshot.status;
  ui.setHome(snapshot);
});

runtime.diagnostics.subscribe((snapshot) => {
  ui.setDiagnostics({
    runtimePhase,
    homeAssistantStatus,
    frame: snapshot.gauges['scheduler.frame'] ?? 0,
    gestures: snapshot.counters['interaction.completed'] ?? 0,
    drawCalls: snapshot.gauges['graphics.drawCalls'] ?? 0,
  });
});

void Promise.all([runtime.start(), homeAssistant.connect()]).then(() => {
  ui.setHome(homeAssistant?.getConfirmedSnapshot() ?? homeAssistantTransportFixtureFallback());
});

const homeAssistantTransportFixtureFallback = (): ReturnType<
  HomeAssistantEngine['getConfirmedSnapshot']
> => ({
  status: 'uninitialized',
  rooms: [],
  devices: [],
  states: {},
  observedAt: 0,
  stale: true,
});

let disposed = false;
const shutdown = async (): Promise<void> => {
  if (disposed) return;
  disposed = true;
  ui.dispose();
  interaction?.dispose();
  await homeAssistant?.disconnect();
  homeAssistant?.dispose();
  await runtime.stop();
  graphicsHandle.dispose();
};

window.addEventListener('pagehide', () => {
  void shutdown();
});
