import type { HomeConfiguratorRuntime } from '@home-configurator/runtime';

import { GraphicsEngine, type GraphicsEngineOptions } from './graphics-engine.js';
import { GraphicsPerformanceObservabilityTask } from './performance-observability-task.js';
import { GraphicsViewportController } from './viewport-controller.js';

export interface AttachGraphicsOptions extends Omit<
  GraphicsEngineOptions,
  'canvas' | 'diagnostics'
> {
  readonly runtime: HomeConfiguratorRuntime;
  readonly canvas: HTMLCanvasElement;
  readonly viewportElement: HTMLElement;
}

export interface GraphicsRuntimeHandle {
  readonly engine: GraphicsEngine;
  readonly viewport: GraphicsViewportController;
  dispose(): void;
}

export const attachGraphicsRuntime = (options: AttachGraphicsOptions): GraphicsRuntimeHandle => {
  const engine = new GraphicsEngine({
    canvas: options.canvas,
    diagnostics: options.runtime.diagnostics,
    ...(options.qualityTier ? { qualityTier: options.qualityTier } : {}),
    ...(options.background !== undefined ? { background: options.background } : {}),
  });
  const performance = new GraphicsPerformanceObservabilityTask(
    engine,
    options.runtime.diagnostics,
  );
  const unregisterEngine = options.runtime.scheduler.register(engine);
  const unregisterPerformance = options.runtime.scheduler.register(performance);
  const viewport = new GraphicsViewportController(
    options.viewportElement,
    (nextViewport) => engine.resize(nextViewport),
    options.runtime.diagnostics,
  );
  viewport.start();

  return {
    engine,
    viewport,
    dispose: () => {
      viewport.stop();
      unregisterPerformance();
      unregisterEngine();
      performance.dispose();
      engine.dispose();
    },
  };
};
