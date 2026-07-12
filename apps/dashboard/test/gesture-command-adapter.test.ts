import type { CommandReceipt, SemanticCommand } from '@home-configurator/home-assistant';
import { describe, expect, it, vi } from 'vitest';

import { HomeAssistantGestureCommandAdapter } from '../src/gesture-command-adapter.js';

const receipt: CommandReceipt = {
  commandId: 'command',
  state: 'awaiting-confirmation',
  issuedAt: 10,
  updatedAt: 11,
};

describe('HomeAssistantGestureCommandAdapter', () => {
  it('emits clamped continuous colour updates and a final commit', async () => {
    const commands: SemanticCommand[] = [];
    const dispatch = vi.fn(async (command: SemanticCommand) => {
      commands.push(command);
      return { ...receipt, commandId: command.id };
    });
    const adapter = new HomeAssistantGestureCommandAdapter({
      homeAssistant: { dispatch },
      now: () => 10,
    });

    await adapter.setColour('light-1', 410, -5);
    await adapter.setColour('light-1', 120, 80, { final: true });

    expect(commands[0]).toMatchObject({
      deviceId: 'light-1',
      capability: 'color',
      value: [360, 0],
      continuous: true,
      final: false,
    });
    expect(commands[1]).toMatchObject({
      value: [120, 80],
      continuous: false,
      final: true,
    });
  });

  it('emits clamped brightness commands', async () => {
    const dispatch = vi.fn(async (command: SemanticCommand) => ({
      ...receipt,
      commandId: command.id,
    }));
    const adapter = new HomeAssistantGestureCommandAdapter({
      homeAssistant: { dispatch },
      now: () => 20,
    });

    await adapter.setBrightness('light-1', 1.4, { final: true });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: 'brightness',
        value: 1,
        continuous: false,
        final: true,
      }),
    );
  });
});
