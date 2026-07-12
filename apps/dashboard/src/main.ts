import { attachGraphicsRuntime, SelectedDeviceLightBinding } from '@home-configurator/graphics';
import {
  HomeAssistantEngine,
  HomeAssistantStateAdapter,
  MemoryHomeAssistantTransport,
  type ConfirmedRuntimeSnapshot,
  type HAState,
} from '@home-configurator/home-assistant';
import { InteractionEngine, type SemanticIntent } from '@home-configurator/interaction';
import { createRuntime, DeviceStore, summarizeRuntimeState } from '@home-configurator/runtime';
import {
  DevicePanelRegistry,
  UiConfigurator,
  UiFoundation,
  UiMotionOrchestrator,
  UiNavigation,
  type UiNavigationLocation,
} from '@home-configurator/ui';

import { HomeAssistantConfiguratorAdapter } from './configurator-command-adapter.js';
import { toDevicePanelSource } from './device-panel-adapter.js';
import { HomeAssistantGestureCommandAdapter } from './gesture-command-adapter.js';
import {
  mapBrightnessGesture,
  mapColourGesture,
  type LightGestureState,
} from './light-gesture-mapping.js';
import './styles.css';
import './navigation.css';
import './configurator.css';
import './motion.css';
import './responsive.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Application root was not found');

const ui = new UiFoundation({
  root,
  version: '0.7.4',
  subtitle: 'Drag the lamp for colour. Use two fingers or the wheel for brightness.',
});

let latestHomeSnapshot: ConfirmedRuntimeSnapshot | null = null;
const panelRegistry = new DevicePanelRegistry();

const createDocument = (
  snapshot: ConfirmedRuntimeSnapshot | null,
  location: UiNavigationLocation,
) => {
  const device = snapshot?.devices.find((item) => item.id === location.deviceId);
  return snapshot && device
    ? panelRegistry.buildDocument(toDevicePanelSource(snapshot, device))
    : null;
};

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
      { area_id: 'terrace', name: 'Terrace', floor_id: 'ground' },
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
      { id: 'kitchen-sensor', name: 'Kitchen Environment', area_id: 'kitchen' },
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
        entity_id: 'climate.bedroom_ac',
        unique_id: 'bedroom-ac-climate',
        platform: 'climate',
        device_id: 'bedroom-ac',
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
        entity_id: 'cover.terrace_shade',
        unique_id: 'terrace-shade-cover',
        platform: 'cover',
        device_id: 'terrace-shade',
      },
    ],
    states: [
      entityState('light.ikea_lamp', 'on', {
        friendly_name: 'IKEA Lamp',
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
      entityState('climate.bedroom_ac', 'cool', {
        friendly_name: 'Bedroom AC',
        temperature: 22,
        current_temperature: 23.5,
        current_humidity: 48,
        fan_mode: 'auto',
      }),
      entityState('sensor.kitchen_temperature', '24.1', {
        friendly_name: 'Temperature',
        unit_of_measurement: '°C',
      }),
      entityState('sensor.kitchen_humidity', '52', {
        friendly_name: 'Humidity',
        unit_of_measurement: '%',
      }),
      entityState('cover.terrace_shade', 'open', {
        friendly_name: 'Terrace Shade',
        current_position: 72,
      }),
    ],
  }),
});

const deviceStore = new DeviceStore();
const homeAssistantState = new HomeAssistantStateAdapter({
  homeAssistant,
  store: deviceStore,
});
homeAssistantState.start();
const selectedModelBinding = new SelectedDeviceLightBinding({
  store: deviceStore,
  model: hero,
});
let runtimeStateSummary = summarizeRuntimeState(deviceStore.snapshot());
const unsubscribeRuntimeState = deviceStore.subscribe(() => {
  runtimeStateSummary = summarizeRuntimeState(deviceStore.snapshot());
});

let latestCommandState = 'idle';
const recordReceipt = (
  command: { readonly capability: string },
  receipt: { readonly state: string },
): void => {
  latestCommandState = `${command.capability}:${receipt.state}`;
  runtime.diagnostics.increment(`prototype.commands.${receipt.state}`);
};
const configuratorAdapter = new HomeAssistantConfiguratorAdapter({
  homeAssistant: homeAssistantState,
  onReceipt: recordReceipt,
});
const gestureAdapter = new HomeAssistantGestureCommandAdapter({
  homeAssistant: homeAssistantState,
  onReceipt: recordReceipt,
});

const lightState = (): LightGestureState => {
  const state = deviceStore.get('ikea-lamp')?.snapshot().effectiveState;
  const colour = state?.['color'];
  return {
    hue: Array.isArray(colour) && typeof colour[0] === 'number' ? colour[0] : 35,
    saturation: Array.isArray(colour) && typeof colour[1] === 'number' ? colour[1] : 65,
    brightness: typeof state?.['brightness'] === 'number' ? state['brightness'] : 0.66,
  };
};

let colourGestureStart: LightGestureState | null = null;
let brightnessGestureStart: number | null = null;
const dispatchGesture = (promise: Promise<void>): void => {
  void promise.catch((error: unknown) => {
    runtime.diagnostics.record('warn', 'prototype.gesture', 'Gesture command failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  });
};
const handleLightIntent = (intent: SemanticIntent): void => {
  if (intent.type === 'tap.commit' || intent.type === 'activate') {
    interaction.focusSelection();
    return;
  }
  if (intent.type === 'drag.update' || intent.type === 'drag.commit') {
    colourGestureStart ??= lightState();
    const [hue, saturation] = mapColourGesture(intent, colourGestureStart);
    const final = intent.type.endsWith('.commit');
    dispatchGesture(gestureAdapter.setColour('ikea-lamp', hue, saturation, { final }));
    if (final) colourGestureStart = null;
    return;
  }
  if (
    intent.type === 'two-finger-vertical.update' ||
    intent.type === 'two-finger-vertical.commit'
  ) {
    brightnessGestureStart ??= lightState().brightness;
    const brightness = mapBrightnessGesture(intent, brightnessGestureStart);
    const final = intent.type.endsWith('.commit');
    dispatchGesture(gestureAdapter.setBrightness('ikea-lamp', brightness, { final }));
    if (final) brightnessGestureStart = null;
    return;
  }
  if (intent.type === 'wheel') {
    const brightness = mapBrightnessGesture(intent, lightState().brightness);
    dispatchGesture(gestureAdapter.setBrightness('ikea-lamp', brightness, { final: true }));
  }
};
interaction.registerTarget({
  id: 'device.demo-lamp',
  layer: 'object',
  gestures: ['tap', 'drag', 'two-finger-vertical', 'wheel', 'keyboard-action'],
  enabled: () => deviceStore.get('ikea-lamp')?.snapshot().available === true,
  onIntent: handleLightIntent,
});

const configurator = new UiConfigurator({
  root,
  adapter: configuratorAdapter,
});

const navigation = new UiNavigation({
  root,
  onNavigate: (location) => {
    selectedModelBinding.setSelectedDevice(location.deviceId);
    configurator.setDocument(createDocument(latestHomeSnapshot, location));
  },
});

const motion = new UiMotionOrchestrator({
  root,
  reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
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
  const location = navigation.snapshot();
  selectedModelBinding.setSelectedDevice(location.deviceId);
  configurator.setDocument(createDocument(snapshot, location));
});

runtime.diagnostics.subscribe((snapshot) => {
  const location = navigation.snapshot();
  ui.setDiagnostics({
    runtime: runtimePhase,
    homeAssistant: homeAssistantStatus,
    rooms,
    devices,
    runtimeDevices: runtimeStateSummary.deviceCount,
    optimistic: runtimeStateSummary.optimisticCount,
    rollbacks: runtimeStateSummary.rollbackCount,
    room: location.roomId ?? 'none',
    device: location.deviceId ?? 'none',
    command: latestCommandState,
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
  motion.dispose();
  configurator.dispose();
  navigation.dispose();
  selectedModelBinding.dispose();
  ui.dispose();
  interaction.dispose();
  unsubscribeRuntimeState();
  homeAssistantState.dispose();
  deviceStore.dispose();
  await homeAssistant.disconnect();
  homeAssistant.dispose();
  await runtime.stop();
  graphicsHandle.dispose();
};

window.addEventListener('pagehide', () => void shutdown());
