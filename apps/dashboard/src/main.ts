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
    <div class="runtime-stage">
      <div>
        <h1 class="runtime-title">Runtime Core</h1>
        <p class="runtime-subtitle">The engine is alive. Graphics arrive in 4.3.</p>
      </div>
    </div>
    <footer class="runtime-footer">
      <span>v0.2.0</span>
      <div class="runtime-diagnostics" aria-label="Runtime diagnostics">
        <span>Phase<strong data-phase>idle</strong></span>
        <span>Frame<strong data-frame>0</strong></span>
        <span>Events<strong data-events>0</strong></span>
      </div>
    </footer>
  </section>
`;

const statusNode = root.querySelector<HTMLElement>('[data-runtime-status]');
const phaseNode = root.querySelector<HTMLElement>('[data-phase]');
const frameNode = root.querySelector<HTMLElement>('[data-frame]');
const eventsNode = root.querySelector<HTMLElement>('[data-events]');

const runtime = createRuntime({
  config: { application: { environment: import.meta.env.DEV ? 'development' : 'production' } },
});

let eventCount = 0;
runtime.events.onAny(() => {
  eventCount += 1;
  if (eventsNode) eventsNode.textContent = String(eventCount);
});

runtime.events.on('runtime.phase', ({ current }) => {
  if (phaseNode) phaseNode.textContent = current;
  if (statusNode) statusNode.textContent = current === 'running' ? 'Online' : current;
});

runtime.diagnostics.subscribe((snapshot) => {
  if (frameNode) frameNode.textContent = String(snapshot.gauges['scheduler.frame'] ?? 0);
});

void runtime.start();

window.addEventListener('pagehide', () => {
  void runtime.stop();
});
