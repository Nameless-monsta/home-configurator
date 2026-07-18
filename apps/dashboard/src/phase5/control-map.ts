/**
 * Capability-driven control mapping. Builds the adaptive control tray contents
 * for a device from its real capabilities, and translates tray/gesture actions
 * into SemanticCommands dispatched through the existing Home Assistant command
 * path. No hard-coding around demo devices. docs/PHASE-5-IYO-EXPERIENCE §5.3/5.4.
 */

import type {
  CapabilityKind,
  CommandReceipt,
  SemanticCommand,
} from '@home-configurator/home-assistant';

import type { AdaptiveControl } from './adaptive-controls.js';
import type { DeviceView } from './experience-model.js';

export interface CommandSink {
  dispatch(command: SemanticCommand): Promise<CommandReceipt>;
}

const cap = (view: DeviceView, kind: CapabilityKind): boolean => view.capabilities.includes(kind);

export const primaryControlTitle = (view: DeviceView): string => {
  switch (view.category) {
    case 'light':
      return 'Brightness';
    case 'climate':
      return 'Target';
    case 'cover':
      return 'Position';
    case 'media':
      return 'Volume';
    case 'security':
      return view.capabilities.includes('lock') ? 'Lock' : 'Privacy';
    case 'cleaning':
      return 'Cleaning';
    case 'sensor':
      return 'Reading';
    case 'appliance':
      return 'Power';
  }
};

export const buildControls = (view: DeviceView): AdaptiveControl[] => {
  const s = view.state;
  const controls: AdaptiveControl[] = [];

  switch (view.category) {
    case 'light':
      controls.push({
        id: 'noop',
        label: 'Brightness',
        value: s.on ? `${Math.round(s.brightness * 100)}%` : 'Off',
        kind: 'action',
        disabled: true,
      });
      if (cap(view, 'power'))
        controls.push({ id: 'power', label: 'Power', kind: 'toggle', active: s.on });
      if (cap(view, 'brightness')) {
        controls.push({ id: 'brightness.down', label: 'Dim', kind: 'stepper', value: '−' });
        controls.push({ id: 'brightness.up', label: 'Brighten', kind: 'stepper', value: '+' });
      }
      if (cap(view, 'colorTemperature')) {
        controls.push({ id: 'temp.warm', label: 'Warmer', kind: 'stepper', value: '−' });
        controls.push({ id: 'temp.cool', label: 'Cooler', kind: 'stepper', value: '+' });
      }
      break;
    case 'climate':
      controls.push({
        id: 'noop',
        label: 'Target',
        value: `${s.targetTemp.toFixed(1)}°`,
        kind: 'action',
        disabled: true,
      });
      if (cap(view, 'targetTemperature')) {
        controls.push({ id: 'target.down', label: 'Cooler', kind: 'stepper', value: '−0.5°' });
        controls.push({ id: 'target.up', label: 'Warmer', kind: 'stepper', value: '+0.5°' });
      }
      if (cap(view, 'hvacMode'))
        controls.push({
          id: 'hvac',
          label: 'Mode',
          kind: 'segmented',
          options: ['off', 'heat', 'cool', 'auto'].map((mode) => ({
            id: mode,
            label: mode,
            active: s.hvac === mode,
          })),
        });
      if (cap(view, 'fanMode'))
        controls.push({
          id: 'fan',
          label: 'Fan',
          kind: 'segmented',
          options: ['auto', 'low', 'high'].map((mode) => ({
            id: mode,
            label: mode,
            active: s.fan === mode,
          })),
        });
      break;
    case 'cover':
      controls.push({
        id: 'noop',
        label: 'Position',
        value: `${Math.round(s.position)}%`,
        kind: 'action',
        disabled: true,
      });
      controls.push({ id: 'cover.open', label: 'Open', kind: 'action' });
      controls.push({ id: 'cover.stop', label: 'Stop', kind: 'action' });
      controls.push({ id: 'cover.close', label: 'Close', kind: 'action' });
      controls.push({
        id: 'cover.favourite',
        label: 'Favourite',
        kind: 'segmented',
        options: [
          { id: '25', label: '25%' },
          { id: '50', label: '50%' },
          { id: '75', label: '75%' },
        ],
      });
      break;
    case 'media':
      controls.push({
        id: 'noop',
        label: 'Volume',
        value: `${Math.round(s.volume * 100)}%`,
        kind: 'action',
        disabled: true,
      });
      if (cap(view, 'mediaPlayback'))
        controls.push({
          id: 'media.playPause',
          label: s.playing ? 'Pause' : 'Play',
          kind: 'toggle',
          active: s.playing,
        });
      if (cap(view, 'volume')) {
        controls.push({ id: 'volume.down', label: 'Volume', kind: 'stepper', value: '−' });
        controls.push({ id: 'volume.up', label: 'Volume', kind: 'stepper', value: '+' });
      }
      break;
    case 'security':
      if (cap(view, 'lock')) {
        controls.push({
          id: 'noop',
          label: 'Lock',
          value: s.locked ? 'Locked' : 'Unlocked',
          kind: 'action',
          disabled: true,
        });
        controls.push({
          id: 'lock.toggle',
          label: s.locked ? 'Unlock (hold)' : 'Lock',
          kind: 'action',
        });
      }
      break;
    case 'cleaning':
      controls.push({
        id: 'noop',
        label: 'State',
        value: s.cleaning ? 'Cleaning' : s.docked ? 'Docked' : 'Paused',
        kind: 'action',
        disabled: true,
      });
      controls.push({ id: 'vacuum.start', label: 'Start', kind: 'action', disabled: s.cleaning });
      controls.push({ id: 'vacuum.pause', label: 'Pause', kind: 'action', disabled: !s.cleaning });
      controls.push({ id: 'vacuum.dock', label: 'Return to dock', kind: 'action' });
      break;
    case 'sensor':
      controls.push({
        id: 'noop',
        label: 'Reading',
        value: s.reading || `${s.currentTemp.toFixed(1)}°`,
        kind: 'action',
        disabled: true,
      });
      break;
    case 'appliance':
      controls.push({
        id: 'noop',
        label: 'Power',
        value: s.on ? 'On' : 'Off',
        kind: 'action',
        disabled: true,
      });
      if (cap(view, 'power'))
        controls.push({ id: 'power', label: 'Power', kind: 'toggle', active: s.on });
      break;
  }
  return controls;
};

export const isSensitiveAction = (action: string): boolean =>
  action === 'lock.toggle' || action.startsWith('alarm.');

let sequence = 0;
const command = (
  deviceId: string,
  capability: CapabilityKind,
  action: string,
  value?: unknown,
  final = true,
): SemanticCommand => ({
  id: `p5-${Date.now()}-${(sequence += 1)}`,
  deviceId,
  capability,
  action,
  ...(value === undefined ? {} : { value }),
  issuedAt: Date.now(),
  policy: 'reject-offline',
  continuous: !final,
  final,
});

export const dispatchAction = (
  sink: CommandSink,
  view: DeviceView,
  action: string,
): Promise<CommandReceipt> | null => {
  const s = view.state;
  const id = view.id;
  const send = (
    capability: CapabilityKind,
    verb: string,
    value?: unknown,
    final = true,
  ): Promise<CommandReceipt> => sink.dispatch(command(id, capability, verb, value, final));
  const [group, argument] = action.split(':');
  switch (group) {
    case 'power':
      return send('power', s.on ? 'off' : 'on', !s.on);
    case 'brightness.down':
      return send('brightness', 'set', Math.max(0, s.brightness - 0.1));
    case 'brightness.up':
      return send('brightness', 'set', Math.min(1, s.brightness + 0.1));
    case 'brightness':
      return send('brightness', 'set', Math.min(1, Math.max(0, Number(argument))), true);
    case 'temp.warm':
      return send('colorTemperature', 'set', Math.max(2000, s.colourTempK - 250));
    case 'temp.cool':
      return send('colorTemperature', 'set', Math.min(6500, s.colourTempK + 250));
    case 'color':
      return send('color', 'set', argument ? argument.split(',').map(Number) : undefined);
    case 'target.down':
      return send('targetTemperature', 'set', Math.max(16, s.targetTemp - 0.5));
    case 'target.up':
      return send('targetTemperature', 'set', Math.min(30, s.targetTemp + 0.5));
    case 'target':
      return send('targetTemperature', 'set', Math.min(30, Math.max(16, Number(argument))), true);
    case 'hvac':
      return send('hvacMode', 'set', argument);
    case 'fan':
      return send('fanMode', 'set', argument);
    case 'cover.open':
      return send('coverPosition', 'open');
    case 'cover.close':
      return send('coverPosition', 'close');
    case 'cover.stop':
      return send('coverPosition', 'stop');
    case 'cover.favourite':
      return send('coverPosition', 'set', Number(argument));
    case 'position':
      return send('coverPosition', 'set', Math.min(100, Math.max(0, Number(argument))), true);
    case 'media.playPause':
      return send('mediaPlayback', 'toggle');
    case 'volume.down':
      return send('volume', 'set', Math.max(0, s.volume - 0.05));
    case 'volume.up':
      return send('volume', 'set', Math.min(1, s.volume + 0.05));
    case 'volume':
      return send('volume', 'set', Math.min(1, Math.max(0, Number(argument))), true);
    case 'lock.toggle':
      return send('lock', s.locked ? 'unlock' : 'lock', !s.locked);
    case 'vacuum.start':
      return send('vacuumCleaning', 'start', true);
    case 'vacuum.pause':
      return send('vacuumCleaning', 'pause', false);
    case 'vacuum.dock':
      return send('vacuumReturnHome', 'return');
    default:
      return null;
  }
};
