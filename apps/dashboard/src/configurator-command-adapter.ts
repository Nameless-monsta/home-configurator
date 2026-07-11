import type {
  CapabilityKind,
  CommandReceipt,
  HomeAssistantRuntime,
  SemanticCommand,
} from '@home-configurator/home-assistant';
import type { ConfiguratorAdapter, ConfiguratorValue } from '@home-configurator/ui';

interface CommandTemplate {
  readonly capability: CapabilityKind;
  readonly action: string;
  readonly value?: unknown;
}

export interface ConfiguratorCommandAdapterOptions {
  readonly homeAssistant: Pick<HomeAssistantRuntime, 'dispatch'>;
  readonly now?: () => number;
  readonly onReceipt?: (command: SemanticCommand, receipt: CommandReceipt) => void;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const finiteNumber = (value: ConfiguratorValue, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} requires a finite number`);
  }
  return value;
};

const textValue = (value: ConfiguratorValue, label: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} requires a non-empty string`);
  }
  return value;
};

export const hexToHs = (value: string): readonly [number, number] => {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
  if (!match) throw new Error('Colour requires a six-digit hexadecimal value');

  const red = Number.parseInt(match[1] ?? '0', 16) / 255;
  const green = Number.parseInt(match[2] ?? '0', 16) / 255;
  const blue = Number.parseInt(match[3] ?? '0', 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;

  let hue = 0;
  if (delta > 0) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;

  const saturation = maximum === 0 ? 0 : (delta / maximum) * 100;
  return [Number(hue.toFixed(2)), Number(saturation.toFixed(2))];
};

const commandForField = (fieldId: string, value: ConfiguratorValue): CommandTemplate => {
  if (fieldId === 'power') {
    if (typeof value !== 'boolean') throw new Error('Power requires a boolean value');
    return { capability: 'power', action: value ? 'on' : 'off', value };
  }
  if (fieldId === 'brightness') {
    return {
      capability: 'brightness',
      action: 'set',
      value: clamp(finiteNumber(value, 'Brightness'), 0, 100) / 100,
    };
  }
  if (fieldId === 'color') {
    return { capability: 'color', action: 'set', value: hexToHs(textValue(value, 'Colour')) };
  }
  if (fieldId === 'colorTemperature') {
    return {
      capability: 'colorTemperature',
      action: 'set',
      value: finiteNumber(value, 'Colour temperature'),
    };
  }
  if (fieldId === 'targetTemperature') {
    return {
      capability: 'targetTemperature',
      action: 'set',
      value: finiteNumber(value, 'Target temperature'),
    };
  }
  if (fieldId === 'hvacMode') {
    return { capability: 'hvacMode', action: 'set', value: textValue(value, 'HVAC mode') };
  }
  if (fieldId === 'fanMode') {
    return { capability: 'fanMode', action: 'set', value: textValue(value, 'Fan mode') };
  }
  if (fieldId === 'volume') {
    return {
      capability: 'volume',
      action: 'set',
      value: clamp(finiteNumber(value, 'Volume'), 0, 100) / 100,
    };
  }
  if (fieldId === 'mediaSource') {
    return {
      capability: 'mediaSource',
      action: 'set',
      value: textValue(value, 'Media source'),
    };
  }
  if (fieldId === 'coverPosition') {
    return {
      capability: 'coverPosition',
      action: 'set',
      value: clamp(finiteNumber(value, 'Cover position'), 0, 100),
    };
  }
  throw new Error(`Unsupported configurator field: ${fieldId}`);
};

const commandForAction = (actionId: string): CommandTemplate => {
  const actions: Readonly<Record<string, CommandTemplate>> = {
    'cover.open': { capability: 'coverPosition', action: 'open' },
    'cover.stop': { capability: 'coverPosition', action: 'stop' },
    'cover.close': { capability: 'coverPosition', action: 'close' },
    'media.previous': { capability: 'mediaPlayback', action: 'previous' },
    'media.playPause': { capability: 'mediaPlayback', action: 'toggle' },
    'media.next': { capability: 'mediaPlayback', action: 'next' },
  };
  const command = actions[actionId];
  if (!command) throw new Error(`Unsupported configurator action: ${actionId}`);
  return command;
};

const failedReceipt = (receipt: CommandReceipt): boolean =>
  receipt.state === 'failed' || receipt.state === 'timed-out' || receipt.state === 'canceled';

export class HomeAssistantConfiguratorAdapter implements ConfiguratorAdapter {
  readonly #homeAssistant: Pick<HomeAssistantRuntime, 'dispatch'>;
  readonly #now: () => number;
  readonly #onReceipt: ((command: SemanticCommand, receipt: CommandReceipt) => void) | undefined;
  #sequence = 0;

  public constructor(options: ConfiguratorCommandAdapterOptions) {
    this.#homeAssistant = options.homeAssistant;
    this.#now = options.now ?? Date.now;
    this.#onReceipt = options.onReceipt;
  }

  public async commit(
    documentId: string,
    changes: Readonly<Record<string, ConfiguratorValue>>,
  ): Promise<void> {
    for (const [fieldId, value] of Object.entries(changes)) {
      await this.#dispatch(documentId, commandForField(fieldId, value));
    }
  }

  public async invoke(documentId: string, actionId: string): Promise<void> {
    await this.#dispatch(documentId, commandForAction(actionId));
  }

  async #dispatch(deviceId: string, template: CommandTemplate): Promise<void> {
    const issuedAt = this.#now();
    const command: SemanticCommand = {
      id: `prototype-${issuedAt}-${++this.#sequence}`,
      deviceId,
      capability: template.capability,
      action: template.action,
      ...(template.value === undefined ? {} : { value: template.value }),
      issuedAt,
      policy: 'reject-offline',
      final: true,
    };
    const receipt = await this.#homeAssistant.dispatch(command);
    this.#onReceipt?.(command, receipt);
    if (failedReceipt(receipt)) {
      throw new Error(receipt.error?.userMessage ?? `Command ${command.id} ${receipt.state}`);
    }
  }
}
