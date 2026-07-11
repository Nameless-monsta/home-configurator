import { AssetManager } from "./asset-manager.js";
import { loadRuntimeConfig, type RuntimeConfig, type RuntimeConfigInput } from "./config.js";
import { Diagnostics } from "./diagnostics.js";
import { EventBus } from "./event-bus.js";
import {
  MockHomeAssistantAdapter,
  type HomeAssistantAdapter,
} from "./home-assistant.js";
import { PluginManager, type RuntimePlugin } from "./plugin-manager.js";
import { RuntimeScheduler } from "./scheduler.js";
import { ServiceContainer } from "./service-container.js";
import { createServiceToken } from "./tokens.js";
import type { RuntimeClock, RuntimePhase } from "./types.js";

export interface RuntimeEvents {
  "runtime.phase": { readonly previous: RuntimePhase; readonly current: RuntimePhase };
  "runtime.ready": { readonly startedAt: string };
  "runtime.failed": { readonly error: Error };
  "runtime.stopped": { readonly stoppedAt: string };
}

export const RuntimeTokens = {
  config: createServiceToken<RuntimeConfig>("runtime.config"),
  diagnostics: createServiceToken<Diagnostics>("runtime.diagnostics"),
  events: createServiceToken<EventBus<RuntimeEvents>>("runtime.events"),
  scheduler: createServiceToken<RuntimeScheduler>("runtime.scheduler"),
  plugins: createServiceToken<PluginManager>("runtime.plugins"),
  assets: createServiceToken<AssetManager>("runtime.assets"),
  homeAssistant: createServiceToken<HomeAssistantAdapter>("runtime.homeAssistant"),
} as const;

export interface RuntimeOptions {
  readonly config?: RuntimeConfigInput;
  readonly clock?: RuntimeClock;
  readonly homeAssistant?: HomeAssistantAdapter;
  readonly plugins?: readonly RuntimePlugin[];
}

export class HomeConfiguratorRuntime {
  public readonly services: ServiceContainer;
  public readonly config: RuntimeConfig;
  public readonly diagnostics: Diagnostics;
  public readonly events: EventBus<RuntimeEvents>;
  public readonly scheduler: RuntimeScheduler;
  public readonly plugins: PluginManager;
  public readonly assets: AssetManager;
  public readonly homeAssistant: HomeAssistantAdapter;

  #phase: RuntimePhase = "idle";

  public constructor(options: RuntimeOptions = {}) {
    this.config = loadRuntimeConfig(options.config);
    this.services = new ServiceContainer();
    this.diagnostics = new Diagnostics(this.config.diagnostics.capacity);
    this.events = new EventBus<RuntimeEvents>();
    this.scheduler = new RuntimeScheduler(this.diagnostics, options.clock);
    this.assets = new AssetManager(this.diagnostics);
    this.homeAssistant = options.homeAssistant ?? new MockHomeAssistantAdapter(this.diagnostics);
    this.plugins = new PluginManager(this.services, this.diagnostics);

    this.services
      .registerValue(RuntimeTokens.config, this.config)
      .registerValue(RuntimeTokens.diagnostics, this.diagnostics)
      .registerValue(RuntimeTokens.events, this.events)
      .registerValue(RuntimeTokens.scheduler, this.scheduler)
      .registerValue(RuntimeTokens.assets, this.assets)
      .registerValue(RuntimeTokens.homeAssistant, this.homeAssistant)
      .registerValue(RuntimeTokens.plugins, this.plugins);

    for (const plugin of options.plugins ?? []) this.plugins.register(plugin);
  }

  public get phase(): RuntimePhase {
    return this.#phase;
  }

  public async start(): Promise<void> {
    if (this.#phase === "running" || this.#phase === "bootstrapping") return;
    this.#setPhase("bootstrapping");

    try {
      this.diagnostics.record("info", "runtime", "Runtime bootstrap started", {
        environment: this.config.application.environment,
      });
      await this.homeAssistant.start();
      if (this.config.plugins.enabled) await this.plugins.startAll();
      if (this.config.scheduler.enabled) this.scheduler.start();
      this.#setPhase("running");
      this.events.emit("runtime.ready", { startedAt: new Date().toISOString() });
      this.diagnostics.record("info", "runtime", "Runtime ready");
    } catch (error) {
      const runtimeError = error instanceof Error ? error : new Error(String(error));
      this.#setPhase("failed");
      this.events.emit("runtime.failed", { error: runtimeError });
      this.diagnostics.record("error", "runtime", "Runtime bootstrap failed", {
        error: runtimeError.message,
      });
      throw runtimeError;
    }
  }

  public async stop(): Promise<void> {
    if (this.#phase === "stopped" || this.#phase === "idle") return;
    this.#setPhase("stopping");
    this.scheduler.stop();
    await this.plugins.stopAll();
    await this.homeAssistant.stop();
    this.assets.clear();
    this.#setPhase("stopped");
    this.events.emit("runtime.stopped", { stoppedAt: new Date().toISOString() });
    this.diagnostics.record("info", "runtime", "Runtime stopped");
  }

  #setPhase(current: RuntimePhase): void {
    const previous = this.#phase;
    this.#phase = current;
    this.events.emit("runtime.phase", { previous, current });
    this.diagnostics.setGauge("runtime.phase", runtimePhaseValue(current));
  }
}

const runtimePhaseValue = (phase: RuntimePhase): number => {
  const order: readonly RuntimePhase[] = [
    "idle",
    "bootstrapping",
    "running",
    "stopping",
    "stopped",
    "failed",
  ];
  return order.indexOf(phase);
};

export const createRuntime = (options?: RuntimeOptions): HomeConfiguratorRuntime =>
  new HomeConfiguratorRuntime(options);
