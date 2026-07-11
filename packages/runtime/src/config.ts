export interface RuntimeConfig {
  readonly application: {
    readonly name: string;
    readonly environment: "development" | "test" | "production";
  };
  readonly diagnostics: {
    readonly enabled: boolean;
    readonly capacity: number;
  };
  readonly scheduler: {
    readonly enabled: boolean;
  };
  readonly plugins: {
    readonly enabled: boolean;
  };
  readonly assets: {
    readonly baseUrl: string;
  };
}

export type RuntimeConfigInput = {
  readonly application?: Partial<RuntimeConfig["application"]>;
  readonly diagnostics?: Partial<RuntimeConfig["diagnostics"]>;
  readonly scheduler?: Partial<RuntimeConfig["scheduler"]>;
  readonly plugins?: Partial<RuntimeConfig["plugins"]>;
  readonly assets?: Partial<RuntimeConfig["assets"]>;
};

export const defaultRuntimeConfig: RuntimeConfig = {
  application: { name: "Home Configurator", environment: "development" },
  diagnostics: { enabled: true, capacity: 250 },
  scheduler: { enabled: true },
  plugins: { enabled: true },
  assets: { baseUrl: "/assets" },
};

export const loadRuntimeConfig = (input: RuntimeConfigInput = {}): RuntimeConfig => {
  const config: RuntimeConfig = {
    application: { ...defaultRuntimeConfig.application, ...input.application },
    diagnostics: { ...defaultRuntimeConfig.diagnostics, ...input.diagnostics },
    scheduler: { ...defaultRuntimeConfig.scheduler, ...input.scheduler },
    plugins: { ...defaultRuntimeConfig.plugins, ...input.plugins },
    assets: { ...defaultRuntimeConfig.assets, ...input.assets },
  };

  if (config.diagnostics.capacity < 25) {
    throw new Error("diagnostics.capacity must be at least 25");
  }
  if (!config.application.name.trim()) {
    throw new Error("application.name must not be empty");
  }
  return config;
};
