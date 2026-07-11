import type { CommandReceipt, SemanticCommand } from '@home-configurator/home-assistant';
import { describe, expect, it } from 'vitest';

import { HomeAssistantConfiguratorAdapter, hexToHs } from '../src/configurator-command-adapter.js';

const acknowledged = (command: SemanticCommand): CommandReceipt => ({
  commandId: command.id,
  state: 'acknowledged',
});

const createHarness = (receipt: (command: SemanticCommand) => CommandReceipt = acknowledged) => {
  const commands: SemanticCommand[] = [];
  const adapter = new HomeAssistantConfiguratorAdapter({
    homeAssistant: {
      dispatch: async (command) => {
        commands.push(command);
        return receipt(command);
      },
    },
    now: () => 42,
  });
  return { adapter, commands };
};

describe('hexToHs', () => {
  it('converts dashboard colour values to Home Assistant hue and saturation', () => {
    expect(hexToHs('#ff0000')).toEqual([0, 100]);
    expect(hexToHs('#00ff00')).toEqual([120, 100]);
    expect(hexToHs('#ffffff')).toEqual([0, 0]);
  });
});

describe('HomeAssistantConfiguratorAdapter', () => {
  it('translates configurator fields into semantic commands', async () => {
    const { adapter, commands } = createHarness();

    await adapter.commit('ha-device:lamp', {
      power: true,
      brightness: 64,
      color: '#3366ff',
      colorTemperature: 3200,
    });

    expect(commands).toMatchObject([
      {
        deviceId: 'ha-device:lamp',
        capability: 'power',
        action: 'on',
        value: true,
        policy: 'reject-offline',
        final: true,
      },
      {
        capability: 'brightness',
        action: 'set',
        value: 0.64,
      },
      {
        capability: 'color',
        action: 'set',
        value: [225, 80],
      },
      {
        capability: 'colorTemperature',
        action: 'set',
        value: 3200,
      },
    ]);
    expect(new Set(commands.map((command) => command.id)).size).toBe(4);
  });

  it('normalizes percentage controls before dispatch', async () => {
    const { adapter, commands } = createHarness();

    await adapter.commit('ha-device:media', { volume: 125, coverPosition: -10 });

    expect(commands[0]?.value).toBe(1);
    expect(commands[1]?.value).toBe(0);
  });

  it('translates panel actions into semantic actions', async () => {
    const { adapter, commands } = createHarness();

    await adapter.invoke('ha-device:shade', 'cover.stop');
    await adapter.invoke('ha-device:tv', 'media.playPause');

    expect(commands).toMatchObject([
      { capability: 'coverPosition', action: 'stop' },
      { capability: 'mediaPlayback', action: 'toggle' },
    ]);
  });

  it('surfaces failed Home Assistant commands to the configurator', async () => {
    const { adapter } = createHarness((command) => ({
      commandId: command.id,
      state: 'failed',
      error: {
        code: 'ha.connection',
        category: 'connection',
        recoverable: true,
        userMessage: 'Home Assistant is not connected',
      },
    }));

    await expect(adapter.commit('ha-device:lamp', { power: true })).rejects.toThrow(
      'Home Assistant is not connected',
    );
  });

  it('rejects fields that have no semantic command contract', async () => {
    const { adapter } = createHarness();

    await expect(adapter.commit('ha-device:lamp', { unknown: 1 })).rejects.toThrow(
      'Unsupported configurator field: unknown',
    );
  });
});
