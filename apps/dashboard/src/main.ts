import { attachGraphicsRuntime } from '@home-configurator/graphics';
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
    <main class="runtime-stage" data-stage>
      <canvas class="graphics-canvas" data-graphics-canvas aria-label="Interactive Home Configurator 3D stage"></canvas>
      <div class="stage-caption">
        <p class="stage-kicker">Persistent WebGL stage</p>
        <h1 class="runtime-title">Graphics Engine</h1>
        <p class="runtime-subtitle">Camera, studio lighting, post processing and resource ownership online.</p>
      </div>
    </main>
    <footer class="runtime-footer">
      <span>v0.3.0</span>
      <div class="runtime-diagnostics" aria-label="Runtime diagnostics">
        <span>Phase<strong data-phase>idle</strong></span>
        <span>Frame<strong data-frame>0</strong></span>
        <span>Draws<strong data-draws>0</strong></span>
        <span>Triangles<strong data-triangles>0</strong></span>
        <span>Textures<strong data-textures>0</strong></span>
        <span>Quality<strong data-quality>balanced</strong></span>
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
const trianglesNode = root.querySelector<HTMLElement>('[data-triangles]');
const texturesNode = root.querySelector<HTMLElement>('[data-textures]');
const qualityNode = root.querySelector<HTMLElement>('[data-quality]');

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

const unregisterMotion = runtime.scheduler.register({
  id: 'graphics.demo-motion',
  priority: 90,
  tick: ({ deltaMs, timestampMs }) => {
    hero.rotation.y += deltaMs * 0.00016;
    hero.rotation.x = Math.sin(timestampMs * 0.00035) * 0.06;
    hero.position.y = Math.sin(timestampMs * 0.0005) * 0.06;
  },
});

runtime.events.on('runtime.phase', ({ current }) => {
  if (phaseNode) phaseNode.textContent = current;
  if (statusNode) statusNode.textContent = current === 'running' ? 'Online' : current;
});

runtime.diagnostics.subscribe((snapshot) => {
  if (frameNode) frameNode.textContent = String(snapshot.gauges['scheduler.frame'] ?? 0);
  if (drawsNode) drawsNode.textContent = String(snapshot.gauges['graphics.drawCalls'] ?? 0);
  if (trianglesNode) trianglesNode.textContent = String(snapshot.gauges['graphics.triangles'] ?? 0);
  if (texturesNode) texturesNode.textContent = String(snapshot.gauges['graphics.textures'] ?? 0);
  if (qualityNode) qualityNode.textContent = graphicsHandle.engine.quality.tier;
});

void runtime.start();

let disposed = false;
const shutdown = async (): Promise<void> => {
  if (disposed) return;
  disposed = true;
  await runtime.stop();
  unregisterMotion();
  graphicsHandle.dispose();
};

window.addEventListener('pagehide', () => {
  void shutdown();
});
