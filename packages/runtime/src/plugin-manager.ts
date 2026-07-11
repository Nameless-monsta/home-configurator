import type { Diagnostics } from './diagnostics.js';
import type { ServiceContainer } from './service-container.js';
import type { MaybePromise } from './types.js';

export interface PluginContext {
  readonly services: ServiceContainer;
  readonly diagnostics: Diagnostics;
}

export interface PluginHandle {
  dispose(): MaybePromise<void>;
}

export interface RuntimePlugin {
  readonly id: string;
  readonly version: string;
  setup(context: PluginContext): MaybePromise<PluginHandle | void>;
}

interface ActivePlugin {
  readonly plugin: RuntimePlugin;
  readonly handle?: PluginHandle;
}

export class PluginManager {
  readonly #services: ServiceContainer;
  readonly #diagnostics: Diagnostics;
  readonly #registered = new Map<string, RuntimePlugin>();
  readonly #active = new Map<string, ActivePlugin>();

  public constructor(services: ServiceContainer, diagnostics: Diagnostics) {
    this.#services = services;
    this.#diagnostics = diagnostics;
  }

  public register(plugin: RuntimePlugin): void {
    if (this.#registered.has(plugin.id)) {
      throw new Error(`Plugin already registered: ${plugin.id}`);
    }
    this.#registered.set(plugin.id, plugin);
  }

  public async startAll(): Promise<void> {
    for (const plugin of this.#registered.values()) {
      try {
        const handle = await plugin.setup({
          services: this.#services,
          diagnostics: this.#diagnostics,
        });
        const active: ActivePlugin = handle ? { plugin, handle } : { plugin };
        this.#active.set(plugin.id, active);
        this.#diagnostics.record('info', 'plugins', `Plugin active: ${plugin.id}`, {
          version: plugin.version,
        });
      } catch (error) {
        this.#diagnostics.increment('plugins.failures');
        this.#diagnostics.record('error', 'plugins', `Plugin failed: ${plugin.id}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  public async stopAll(): Promise<void> {
    for (const active of [...this.#active.values()].reverse()) {
      await active.handle?.dispose();
      this.#diagnostics.record('info', 'plugins', `Plugin stopped: ${active.plugin.id}`);
    }
    this.#active.clear();
  }

  public activePluginIds(): readonly string[] {
    return [...this.#active.keys()];
  }
}
