import { describe, expect, it } from 'vitest';

import { ControlLibrary, type ControlRenderer } from '../src/control-library.js';
import type { ConfiguratorField } from '../src/configurator-types.js';

const field = (overrides: Partial<ConfiguratorField> = {}): ConfiguratorField => ({
  id: 'field.demo',
  label: 'Demo',
  kind: 'text',
  value: 'Hello',
  ...overrides,
});

const inputTarget = (value: string): HTMLInputElement =>
  ({ value, dataset: {} }) as unknown as HTMLInputElement;

const buttonTarget = (value: string): HTMLButtonElement =>
  ({ value: '', dataset: { controlValue: value } }) as unknown as HTMLButtonElement;

describe('ControlLibrary', () => {
  it('renders each default control kind', () => {
    const library = new ControlLibrary();
    const cases: readonly ConfiguratorField[] = [
      field({ kind: 'toggle', value: true }),
      field({ kind: 'slider', value: 42, minimum: 0, maximum: 100, unit: '%' }),
      field({ kind: 'number', value: 3, minimum: 1, maximum: 5 }),
      field({ kind: 'select', value: 'auto', options: [{ value: 'auto', label: 'Auto' }] }),
      field({ kind: 'segmented', value: 'cool', options: [{ value: 'cool', label: 'Cool' }] }),
      field({ kind: 'text', value: 'Lamp' }),
      field({ kind: 'color', value: '#ffffff' }),
      field({ kind: 'status', value: 'Online' }),
    ];

    for (const item of cases) {
      const markup = library.render({ field: item, value: item.value, disabled: false });
      expect(markup).toContain(item.id);
    }
  });

  it('escapes user-facing labels and values', () => {
    const library = new ControlLibrary();
    const markup = library.render({
      field: field({
        kind: 'segmented',
        label: '<Room>',
        options: [{ value: 'a', label: '<Auto>' }],
      }),
      value: 'a',
      disabled: false,
    });

    expect(markup).toContain('&lt;Room&gt;');
    expect(markup).toContain('&lt;Auto&gt;');
    expect(markup).not.toContain('<Room>');
  });

  it('parses native and button controls', () => {
    const library = new ControlLibrary();

    expect(library.read('number', inputTarget('24'))).toBe(24);
    expect(library.read('slider', inputTarget('0.65'))).toBe(0.65);
    expect(library.read('text', inputTarget('Kitchen'))).toBe('Kitchen');
    expect(library.read('color', inputTarget('#123456'))).toBe('#123456');
    expect(library.read('toggle', buttonTarget('true'))).toBe(false);
    expect(library.read('segmented', buttonTarget('heat'))).toBe('heat');
  });

  it('propagates disabled state into rendered controls', () => {
    const library = new ControlLibrary();
    const markup = library.render({
      field: field({ kind: 'toggle', value: false }),
      value: false,
      disabled: true,
    });

    expect(markup).toContain('disabled');
  });

  it('allows a renderer to be replaced', () => {
    const library = new ControlLibrary();
    const custom: ControlRenderer = {
      render: ({ value }) => `<custom-control>${String(value)}</custom-control>`,
      read: () => 'custom',
    };

    library.register('text', custom);

    expect(library.render({ field: field(), value: 'replacement', disabled: false })).toBe(
      '<custom-control>replacement</custom-control>',
    );
    expect(library.read('text', inputTarget('ignored'))).toBe('custom');
  });
});
