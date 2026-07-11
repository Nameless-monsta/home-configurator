import type {
  ConfiguratorDocument,
  ConfiguratorField,
  ConfiguratorSection,
  ConfiguratorValue,
} from './configurator-types.js';

export type DevicePanelCapability =
  | 'power'
  | 'brightness'
  | 'color'
  | 'colorTemperature'
  | 'targetTemperature'
  | 'hvacMode'
  | 'fanMode'
  | 'volume'
  | 'mediaPlayback'
  | 'mediaSource'
  | 'coverPosition'
  | 'sensor';

export interface DevicePanelSource {
  readonly id: string;
  readonly name: string;
  readonly subtitle?: string;
  readonly available: boolean;
  readonly capabilities: readonly DevicePanelCapability[];
  readonly values: Readonly<Partial<Record<DevicePanelCapability | string, unknown>>>;
  readonly metadata?: Readonly<Record<string, ConfiguratorValue>>;
}

export interface DevicePanelProvider {
  readonly id: string;
  readonly priority: number;
  supports(source: DevicePanelSource): boolean;
  build(source: DevicePanelSource): readonly ConfiguratorSection[];
}

const primitiveValue = (value: unknown, fallback: ConfiguratorValue): ConfiguratorValue =>
  value === null || ['string', 'number', 'boolean'].includes(typeof value)
    ? (value as ConfiguratorValue)
    : fallback;

const has = (source: DevicePanelSource, capability: DevicePanelCapability): boolean =>
  source.capabilities.includes(capability);

const option = (value: string, label: string) => ({ value, label });

const lightProvider: DevicePanelProvider = {
  id: 'light',
  priority: 100,
  supports: (source) =>
    has(source, 'brightness') || has(source, 'color') || has(source, 'colorTemperature'),
  build: (source) => {
    const fields: ConfiguratorField[] = [];
    if (has(source, 'power'))
      fields.push({
        id: 'power',
        label: 'Power',
        kind: 'toggle',
        value: primitiveValue(source.values['power'], false),
      });
    if (has(source, 'brightness'))
      fields.push({
        id: 'brightness',
        label: 'Brightness',
        kind: 'slider',
        value: primitiveValue(source.values['brightness'], 50),
        minimum: 0,
        maximum: 100,
        step: 1,
        unit: '%',
      });
    if (has(source, 'colorTemperature'))
      fields.push({
        id: 'colorTemperature',
        label: 'Colour temperature',
        kind: 'slider',
        value: primitiveValue(source.values['colorTemperature'], 3500),
        minimum: 2000,
        maximum: 6500,
        step: 100,
        unit: 'K',
      });
    if (has(source, 'color'))
      fields.push({
        id: 'color',
        label: 'Colour',
        kind: 'color',
        value: primitiveValue(source.values['color'], '#ffffff'),
      });
    return [
      {
        id: 'lighting',
        title: 'Lighting',
        description: 'Light output and colour controls.',
        fields,
      },
    ];
  },
};

const climateProvider: DevicePanelProvider = {
  id: 'climate',
  priority: 90,
  supports: (source) =>
    has(source, 'targetTemperature') || has(source, 'hvacMode') || has(source, 'fanMode'),
  build: (source) => {
    const fields: ConfiguratorField[] = [];
    if (has(source, 'power'))
      fields.push({
        id: 'power',
        label: 'Power',
        kind: 'toggle',
        value: primitiveValue(source.values['power'], true),
      });
    if (has(source, 'hvacMode'))
      fields.push({
        id: 'hvacMode',
        label: 'Mode',
        kind: 'segmented',
        value: primitiveValue(source.values['hvacMode'], 'cool'),
        options: [
          option('off', 'Off'),
          option('cool', 'Cool'),
          option('heat', 'Heat'),
          option('auto', 'Auto'),
        ],
      });
    if (has(source, 'targetTemperature'))
      fields.push({
        id: 'targetTemperature',
        label: 'Target temperature',
        kind: 'number',
        value: primitiveValue(source.values['targetTemperature'], 22),
        minimum: 16,
        maximum: 30,
        step: 0.5,
        unit: '°C',
      });
    if (has(source, 'fanMode'))
      fields.push({
        id: 'fanMode',
        label: 'Fan speed',
        kind: 'select',
        value: primitiveValue(source.values['fanMode'], 'auto'),
        options: [
          option('auto', 'Auto'),
          option('low', 'Low'),
          option('medium', 'Medium'),
          option('high', 'High'),
        ],
      });
    const statusFields: ConfiguratorField[] = [];
    if (source.values['currentTemperature'] !== undefined)
      statusFields.push({
        id: 'currentTemperature',
        label: 'Current temperature',
        kind: 'status',
        value: primitiveValue(source.values['currentTemperature'], '—'),
        unit: '°C',
        readOnly: true,
      });
    if (source.values['humidity'] !== undefined)
      statusFields.push({
        id: 'humidity',
        label: 'Humidity',
        kind: 'status',
        value: primitiveValue(source.values['humidity'], '—'),
        unit: '%',
        readOnly: true,
      });
    const sections: ConfiguratorSection[] = [
      { id: 'climate', title: 'Climate', description: 'Temperature, mode and airflow.', fields },
    ];
    if (statusFields.length > 0)
      sections.push({ id: 'climate-status', title: 'Environment', fields: statusFields });
    return sections;
  },
};

const coverProvider: DevicePanelProvider = {
  id: 'cover',
  priority: 80,
  supports: (source) => has(source, 'coverPosition'),
  build: (source) => [
    {
      id: 'cover',
      title: 'Cover',
      description: 'Position and movement controls.',
      fields: [
        {
          id: 'coverPosition',
          label: 'Position',
          kind: 'slider',
          value: primitiveValue(source.values['coverPosition'], 0),
          minimum: 0,
          maximum: 100,
          step: 1,
          unit: '%',
        },
      ],
      actions: [
        { id: 'cover.open', label: 'Open' },
        { id: 'cover.stop', label: 'Stop' },
        { id: 'cover.close', label: 'Close' },
      ],
    },
  ],
};

const mediaProvider: DevicePanelProvider = {
  id: 'media',
  priority: 70,
  supports: (source) =>
    has(source, 'volume') || has(source, 'mediaPlayback') || has(source, 'mediaSource'),
  build: (source) => {
    const fields: ConfiguratorField[] = [];
    if (has(source, 'volume'))
      fields.push({
        id: 'volume',
        label: 'Volume',
        kind: 'slider',
        value: primitiveValue(source.values['volume'], 25),
        minimum: 0,
        maximum: 100,
        step: 1,
        unit: '%',
      });
    if (has(source, 'mediaSource'))
      fields.push({
        id: 'mediaSource',
        label: 'Source',
        kind: 'select',
        value: primitiveValue(source.values['mediaSource'], 'default'),
        options: [
          option('default', 'Default'),
          option('tv', 'TV'),
          option('music', 'Music'),
          option('bluetooth', 'Bluetooth'),
        ],
      });
    if (source.values['nowPlaying'] !== undefined)
      fields.push({
        id: 'nowPlaying',
        label: 'Now playing',
        kind: 'status',
        value: primitiveValue(source.values['nowPlaying'], 'Nothing playing'),
        readOnly: true,
      });
    return [
      {
        id: 'media',
        title: 'Media',
        description: 'Playback, source and volume.',
        fields,
        actions: has(source, 'mediaPlayback')
          ? [
              { id: 'media.previous', label: 'Previous' },
              { id: 'media.playPause', label: 'Play / Pause', intent: 'primary' },
              { id: 'media.next', label: 'Next' },
            ]
          : [],
      },
    ];
  },
};

const sensorProvider: DevicePanelProvider = {
  id: 'sensor',
  priority: 10,
  supports: (source) => has(source, 'sensor'),
  build: (source) => {
    const fields = Object.entries(source.values)
      .filter(([key]) => !source.capabilities.includes(key as DevicePanelCapability))
      .map(([key, value]) => ({
        id: key,
        label: key.replaceAll('_', ' '),
        kind: 'status' as const,
        value: primitiveValue(value, '—'),
        readOnly: true,
      }));
    return [
      {
        id: 'sensors',
        title: 'Sensors',
        description: 'Read-only measurements and diagnostics.',
        fields,
      },
    ];
  },
};

const fallbackProvider: DevicePanelProvider = {
  id: 'fallback',
  priority: -1,
  supports: () => true,
  build: (source) => [
    {
      id: 'overview',
      title: 'Overview',
      fields: source.capabilities.map((capability) => ({
        id: capability,
        label: capability,
        kind: 'status' as const,
        value: primitiveValue(source.values[capability], 'Available'),
        readOnly: true,
      })),
    },
  ],
};

export class DevicePanelRegistry {
  readonly #providers: DevicePanelProvider[] = [];

  public constructor() {
    for (const provider of [
      lightProvider,
      climateProvider,
      coverProvider,
      mediaProvider,
      sensorProvider,
      fallbackProvider,
    ])
      this.register(provider);
  }

  public register(provider: DevicePanelProvider): void {
    const existing = this.#providers.findIndex((item) => item.id === provider.id);
    if (existing >= 0) this.#providers.splice(existing, 1);
    this.#providers.push(provider);
    this.#providers.sort((left, right) => right.priority - left.priority);
  }

  public resolve(source: DevicePanelSource): readonly DevicePanelProvider[] {
    const matching = this.#providers.filter(
      (provider) => provider.id !== 'fallback' && provider.supports(source),
    );
    return matching.length > 0
      ? matching
      : this.#providers.filter((provider) => provider.id === 'fallback');
  }

  public buildDocument(source: DevicePanelSource): ConfiguratorDocument {
    const metadataFields = Object.entries(source.metadata ?? {}).map(([id, value]) => ({
      id: `meta.${id}`,
      label: id.replaceAll('_', ' '),
      kind: 'status' as const,
      value,
      readOnly: true,
    }));
    const sections = this.resolve(source).flatMap((provider) => provider.build(source));
    if (metadataFields.length > 0)
      sections.unshift({
        id: 'identity',
        title: 'Identity',
        collapsed: true,
        fields: metadataFields,
      });
    return {
      id: source.id,
      title: source.name,
      subtitle: source.subtitle,
      available: source.available,
      sections,
    };
  }
}
