import type { HomeConfiguratorRuntime } from '@home-configurator/runtime';

import { GraphicsEngine, type GraphicsEngineOptions } from './graphics-engine.js';
import { GraphicsViewportController } from './viewport-controller.js';

export interface AttachGraphicsOptions
  extends Omit<GraphicsEngineOptions, 'canvas' | 'diagnostics'> {
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
  const unregister = options.runtime.scheduler.register(engine);
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
      unregister();
      engine.dispose();
    },
  };
};
