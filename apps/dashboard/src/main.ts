import { attachGraphicsRuntime } from '@home-configurator/graphics';
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
        <p class="stage-kicker">Touch and pointer interaction online</p>
        <h1 class="runtime-title">Interaction Engine</h1>
        <p class="runtime-subtitle">Tap the lamp to select it, then drag to inspect it. Keyboard arrow controls are also available.</p>
      </div>
    </main>
    <footer class="runtime-footer">
      <span>v0.4.0</span>
      <div class="runtime-diagnostics" aria-label="Runtime diagnostics">
        <span>Phase<strong data-phase>idle</strong></span>
        <span>Frame<strong data-frame>0</strong></span>
        <span>Draws<strong data-draws>0</strong></span>
        <span>Gestures<strong data-gestures>0</strong></span>
        <span>Selection<strong data-selection>none</strong></span>
        <span>Level<strong data-level>home</strong></span>
      </div>
    </footer>
  </section>
`;

const canvas = root.querySelector<HTMLCanvasElement>('[data-graphics-canvas]');
const stage = root.querySelector<HTMLElement>('[data-stage]');
if (!canvas || !stage) throw new Error('Graphics stage was not created');

const statusNode = root.querySelector<HTMLElement>('[data-runtime-status]');
const phaseNode = root.querySelector<HTMLElement>('[data-phase]');
const frameNode = root.querySelector<HTMLElement>('[data-frame]');
const drawsNode = root.querySelector<HTMLElement>('[data-draws]');
const gesturesNode = root.querySelector<HTMLElement>('[data-gestures]');
const selectionNode = root.querySelector<HTMLElement>('[data-selection]');
const levelNode = root.querySelector<HTMLElement>('[data-level]');

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

runtime.events.on('runtime.phase', ({ current }) => {
  if (phaseNode) phaseNode.textContent = current;
  if (statusNode) statusNode.textContent = current === 'running' ? 'Online' : current;
});

runtime.diagnostics.subscribe((snapshot) => {
  if (frameNode) frameNode.textContent = String(snapshot.gauges['scheduler.frame'] ?? 0);
  if (drawsNode) drawsNode.textContent = String(snapshot.gauges['graphics.drawCalls'] ?? 0);
  if (gesturesNode)
    gesturesNode.textContent = String(snapshot.counters['interaction.completed'] ?? 0);
  if (selectionNode)
    selectionNode.textContent = interaction.selection.snapshot().selectedId ?? 'none';
  if (levelNode) levelNode.textContent = interaction.navigation.location.level;
});

void runtime.start();

let disposed = false;
const shutdown = async (): Promise<void> => {
  if (disposed) return;
  disposed = true;
  interaction.dispose();
  await runtime.stop();
  graphicsHandle.dispose();
};

window.addEventListener('pagehide', () => {
  void shutdown();
});
