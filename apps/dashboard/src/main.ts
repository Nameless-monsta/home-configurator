import { GraphicsEngine } from '@home-configurator/graphics';
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
    <div class="runtime-stage" data-stage>
      <canvas class="graphics-canvas" data-graphics-canvas aria-label="Home Configurator 3D stage"></canvas>
      <div class="stage-caption">
        <h1 class="runtime-title">Graphics Engine</h1>
        <p class="runtime-subtitle">Persistent scene, camera, lighting and render pipeline online.</p>
      </div>
    </div>
    <footer class="runtime-footer">
      <span>v0.3.0</span>
      <div class="runtime-diagnostics" aria-label="Runtime diagnostics">
        <span>Phase<strong data-phase>idle</strong></span>
        <span>Frame<strong data-frame>0</strong></span>
        <span>Draws<strong data-draws>0</strong></span>
        <span>Triangles<strong data-triangles>0</strong></span>
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

const runtime = createRuntime({
  config: { application: { environment: import.meta.env.DEV ? 'development' : 'production' } },
});
const graphics = new GraphicsEngine({ canvas, diagnostics: runtime.diagnostics, qualityTier: 'balanced' });
const hero = graphics.createFallbackHero();

runtime.scheduler.register(graphics);
runtime.scheduler.register({
  id: 'graphics.demo-motion',
  priority: 90,
  tick: ({ deltaMs }) => {
    hero.rotation.y += deltaMs * 0.00018;
    hero.rotation.x = Math.sin(performance.now() * 0.00035) * 0.08;
  },
});

const resize = (): void => {
  const bounds = stage.getBoundingClientRect();
  graphics.resize({
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
    devicePixelRatio: window.devicePixelRatio || 1,
  });
};

const observer = new ResizeObserver(resize);
observer.observe(stage);
resize();

runtime.events.on('runtime.phase', ({ current }) => {
  if (phaseNode) phaseNode.textContent = current;
  if (statusNode) statusNode.textContent = current === 'running' ? 'Online' : current;
});

runtime.diagnostics.subscribe((snapshot) => {
  if (frameNode) frameNode.textContent = String(snapshot.gauges['scheduler.frame'] ?? 0);
  if (drawsNode) drawsNode.textContent = String(snapshot.gauges['graphics.drawCalls'] ?? 0);
  if (trianglesNode) trianglesNode.textContent = String(snapshot.gauges['graphics.triangles'] ?? 0);
});

void runtime.start();

window.addEventListener('pagehide', () => {
  observer.disconnect();
  graphics.dispose();
  void runtime.stop();
});
