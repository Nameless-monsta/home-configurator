import type {
  CanonicalDevice,
  CapabilityKind,
  HAState,
  SemanticCommand,
} from './types.js';

export interface ExpectedState {
  readonly entityId: string;
  readonly state?: string;
  readonly attribute?: string;
  readonly value?: unknown;
  readonly tolerance?: number;
}

export interface TranslatedServiceCall {
  readonly domain: string;
  readonly service: string;
  readonly target: Readonly<Record<string, unknown>>;
  readonly data: Readonly<Record<string, unknown>>;
  readonly expected?: ExpectedState;
}

const bindingFor = (device: CanonicalDevice, capability: CapabilityKind): string => {
  const binding = device.bindings.find((candidate) =>
    candidate.capabilities.includes(capability),
  );
  if (!binding) throw new Error(`Device ${device.id} does not support ${capability}`);
  return binding.entityId;
};

const numericValue = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} requires a finite number`);
  }
  return value;
};

const stringValue = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} requires a string`);
  return value;
};

const booleanValue = (command: SemanticCommand): boolean => {
  if (typeof command.value === 'boolean') return command.value;
  if (command.action === 'on' || command.action === 'turn_on') return true;
  if (command.action === 'off' || command.action === 'turn_off') return false;
  throw new Error('Power command requires on/off action or boolean value');
};

export const translateSemanticCommand = (
  device: CanonicalDevice,
  command: SemanticCommand,
): TranslatedServiceCall => {
  const entityId = bindingFor(device, command.capability);
  const domain = entityId.split('.', 1)[0] ?? 'unknown';
  const target = { entity_id: entityId };

  if (command.capability === 'power') {
    const enabled = booleanValue(command);
    return {
      domain,
      service: enabled ? 'turn_on' : 'turn_off',
      target,
      data: {},
      expected: { entityId, state: enabled ? 'on' : 'off' },
    };
  }

  if (command.capability === 'brightness') {
    const normalized = Math.min(1, Math.max(0, numericValue(command.value, 'Brightness')));
    const brightness = Math.round(normalized * 255);
    return {
      domain: 'light',
      service: 'turn_on',
      target,
      data: { brightness },
      expected: { entityId, attribute: 'brightness', value: brightness, tolerance: 3 },
    };
  }

  if (command.capability === 'color') {
    const value = command.value;
    if (
      !Array.isArray(value) ||
      value.length < 2 ||
      !value.every((entry) => typeof entry === 'number')
    ) {
      throw new Error('Color requires [hue, saturation]');
    }
    const hue = Math.min(360, Math.max(0, value[0] ?? 0));
    const saturation = Math.min(100, Math.max(0, value[1] ?? 0));
    return {
      domain: 'light',
      service: 'turn_on',
      target,
      data: { hs_color: [hue, saturation] },
      expected: { entityId, attribute: 'hs_color', value: [hue, saturation], tolerance: 2 },
    };
  }

  if (command.capability === 'colorTemperature') {
    const kelvin = Math.round(numericValue(command.value, 'Color temperature'));
    return {
      domain: 'light',
      service: 'turn_on',
      target,
      data: { color_temp_kelvin: kelvin },
      expected: {
        entityId,
        attribute: 'color_temp_kelvin',
        value: kelvin,
        tolerance: 50,
      },
    };
  }

  if (command.capability === 'targetTemperature') {
    const temperature = numericValue(command.value, 'Target temperature');
    return {
      domain: 'climate',
      service: 'set_temperature',
      target,
      data: { temperature },
      expected: { entityId, attribute: 'temperature', value: temperature, tolerance: 0.2 },
    };
  }

  if (command.capability === 'hvacMode') {
    const hvacMode = stringValue(command.value, 'HVAC mode');
    return {
      domain: 'climate',
      service: 'set_hvac_mode',
      target,
      data: { hvac_mode: hvacMode },
      expected: { entityId, state: hvacMode },
    };
  }

  if (command.capability === 'fanMode') {
    const fanMode = stringValue(command.value, 'Fan mode');
    return {
      domain: 'climate',
      service: 'set_fan_mode',
      target,
      data: { fan_mode: fanMode },
      expected: { entityId, attribute: 'fan_mode', value: fanMode },
    };
  }

  if (command.capability === 'volume') {
    const volumeLevel = Math.min(1, Math.max(0, numericValue(command.value, 'Volume')));
    return {
      domain: 'media_player',
      service: 'volume_set',
      target,
      data: { volume_level: volumeLevel },
      expected: {
        entityId,
        attribute: 'volume_level',
        value: volumeLevel,
        tolerance: 0.02,
      },
    };
  }

  if (command.capability === 'mediaPlayback') {
    const services: Readonly<Record<string, string>> = {
      play: 'media_play',
      pause: 'media_pause',
      stop: 'media_stop',
      next: 'media_next_track',
      previous: 'media_previous_track',
      toggle: 'media_play_pause',
    };
    const service = services[command.action];
    if (!service) throw new Error(`Unsupported media action: ${command.action}`);
    return { domain: 'media_player', service, target, data: {} };
  }

  if (command.capability === 'mediaSource') {
    const source = stringValue(command.value, 'Media source');
    return {
      domain: 'media_player',
      service: 'select_source',
      target,
      data: { source },
      expected: { entityId, attribute: 'source', value: source },
    };
  }

  if (command.capability === 'vacuumCleaning') {
    const service =
      command.action === 'stop' ? 'stop' : command.action === 'pause' ? 'pause' : 'start';
    return { domain: 'vacuum', service, target, data: {} };
  }

  if (command.capability === 'vacuumReturnHome') {
    return { domain: 'vacuum', service: 'return_to_base', target, data: {} };
  }

  if (command.capability === 'vacuumLocate') {
    return { domain: 'vacuum', service: 'locate', target, data: {} };
  }

  if (command.capability === 'coverPosition') {
    if (command.action === 'open') {
      return { domain: 'cover', service: 'open_cover', target, data: {} };
    }
    if (command.action === 'close') {
      return { domain: 'cover', service: 'close_cover', target, data: {} };
    }
    const position = Math.round(
      Math.min(100, Math.max(0, numericValue(command.value, 'Cover position'))),
    );
    return {
      domain: 'cover',
      service: 'set_cover_position',
      target,
      data: { position },
      expected: {
        entityId,
        attribute: 'current_position',
        value: position,
        tolerance: 2,
      },
    };
  }

  if (command.capability === 'lock') {
    const shouldLock = command.action === 'lock' || command.value === true;
    return {
      domain: 'lock',
      service: shouldLock ? 'lock' : 'unlock',
      target,
      data: {},
      expected: { entityId, state: shouldLock ? 'locked' : 'unlocked' },
    };
  }

  throw new Error(`Capability ${command.capability} is read-only or unsupported`);
};

const numericClose = (actual: unknown, expected: unknown, tolerance: number): boolean =>
  typeof actual === 'number' &&
  typeof expected === 'number' &&
  Math.abs(actual - expected) <= tolerance;

const arrayClose = (actual: unknown, expected: unknown, tolerance: number): boolean => {
  if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) {
    return false;
  }
  return actual.every((value, index) => numericClose(value, expected[index], tolerance));
};

export const stateMatchesExpectation = (state: HAState, expected: ExpectedState): boolean => {
  if (state.entity_id !== expected.entityId) return false;
  if (expected.state !== undefined && state.state !== expected.state) return false;
  if (expected.attribute === undefined) return true;
  const actual = state.attributes[expected.attribute];
  const tolerance = expected.tolerance ?? 0;
  if (tolerance > 0) {
    if (Array.isArray(expected.value)) return arrayClose(actual, expected.value, tolerance);
    return numericClose(actual, expected.value, tolerance);
  }
  return Object.is(actual, expected.value);
};
