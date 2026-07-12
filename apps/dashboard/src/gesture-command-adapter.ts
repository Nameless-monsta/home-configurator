import type {
  CommandReceipt,
  HomeAssistantRuntime,
  SemanticCommand,
} from '@home-configurator/home-assistant';

export interface GestureCommandAdapterOptions {
  readonly homeAssistant: Pick<HomeAssistantRuntime, 'dispatch'>;
  readonly now?: () => number;
  readonly onReceipt?: (command: SemanticCommand, receipt: CommandReceipt) => void;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const finite = (value: number, label: string): number => {
  if (!Number.isFinite(value)) throw new Error(`${label} requires a finite number`);
  return value;
};

const failedReceipt = (receipt: CommandReceipt): boolean =>
  receipt.state === 'failed' || receipt.state === 'timed-out' || receipt.state === 'canceled';

export class HomeAssistantGestureCommandAdapter {
  readonly #homeAssistant: Pick<HomeAssistantRuntime, 'dispatch'>;
  readonly #now: () => number;
  readonly #onReceipt: ((command: SemanticCommand, receipt: CommandReceipt) => void) | undefined;
  #sequence = 0;

  public constructor(options: GestureCommandAdapterOptions) {
    this.#homeAssistant = options.homeAssistant;
    this.#now = options.now ?? Date.now;
    this.#onReceipt = options.onReceipt;
  }

  public setColour(
    deviceId: string,
    hue: number,
    saturation: number,
    options: { readonly final?: boolean } = {},
  ): Promise<void> {
    return this.#dispatch({
      deviceId,
      capability: 'color',
      action: 'set',
      value: [clamp(finite(hue, 'Hue'), 0, 360), clamp(finite(saturation, 'Saturation'), 0, 100)],
      final: options.final ?? false,
    });
  }

  public setBrightness(
    deviceId: string,
    brightness: number,
    options: { readonly final?: boolean } = {},
  ): Promise<void> {
    return this.#dispatch({
      deviceId,
      capability: 'brightness',
      action: 'set',
      value: clamp(finite(brightness, 'Brightness'), 0, 1),
      final: options.final ?? false,
    });
  }

  async #dispatch(
    template: Pick<SemanticCommand, 'deviceId' | 'capability' | 'action' | 'value' | 'final'>,
  ): Promise<void> {
    const issuedAt = this.#now();
    const command: SemanticCommand = {
      id: `gesture-${issuedAt}-${++this.#sequence}`,
      deviceId: template.deviceId,
      capability: template.capability,
      action: template.action,
      value: template.value,
      issuedAt,
      policy: 'reject-offline',
      continuous: !template.final,
      final: template.final,
    };

    const receipt = await this.#homeAssistant.dispatch(command);
    this.#onReceipt?.(command, receipt);
    if (failedReceipt(receipt)) {
      throw new Error(receipt.error?.userMessage ?? `Command ${command.id} ${receipt.state}`);
    }
  }
}
