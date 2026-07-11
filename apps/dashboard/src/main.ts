import { attachGraphicsRuntime } from '@home-configurator/graphics';
import {
  HomeAssistantEngine,
  MemoryHomeAssistantTransport,
  type HAState,
} from '@home-configurator/home-assistant';
import { InteractionEngine, semanticOrbitHandler } from '@home-configurator/interaction';
import { createRuntime } from '@home-configurator/runtime';
import { UiFoundation } from '@home-configurator/ui';

import './styles.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Application root was not found');

const ui = new UiFoundation({
  root,
  version: '0.6.1',
  subtitle: 'The visual shell is online. Navigation and controls arrive in the next milestones.',
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
  id: 'foundation-float',
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
    areas: [{ area_id: 'living-room', name: 'Living Room', floor_id: 'ground' }],
    devices: [
      {
        id: 'ikea-lamp',
        name: 'IKEA Lamp',
        area_id: 'living-room',
        manufacturer: 'IKEA',
        model: 'TRÅDFRI',
      },
    ],
    entities: [
      {
        entity_id: 'light.ikea_lamp',
        unique_id: 'ikea-lamp-light',
        platform: 'zha',
        device_id: 'ikea-lamp',
      },
    ],
    states: [
      entityState('light.ikea_lamp', 'on', {
        friendly_name: 'IKEA Lamp',
        brightness: 168,
        supported_color_modes: ['hs', 'color_temp'],
      }),
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
  homeAssistantStatus = snapshot.status;
  rooms = snapshot.rooms.length;
  devices = snapshot.devices.length;
});

runtime.diagnostics.subscribe((snapshot) => {
  ui.setDiagnostics({
    runtime: runtimePhase,
    homeAssistant: homeAssistantStatus,
    rooms,
    devices,
    frame: snapshot.gauges['scheduler.frame'] ?? 0,
    drawCalls: snapshot.gauges['graphics.drawCalls'] ?? 0,
    gestures: snapshot.counters['interaction.completed'] ?? 0,
  });
});

void Promise.all([runtime.start(), homeAssistant.connect()]);

let disposed = false;
const shutdown = async (): Promise<void> => {
  if (disposed) return;
  disposed = true;
  ui.dispose();
  interaction.dispose();
  await homeAssistant.disconnect();
  homeAssistant.dispose();
  await runtime.stop();
  graphicsHandle.dispose();
};

window.addEventListener('pagehide', () => {
  void shutdown();
});
