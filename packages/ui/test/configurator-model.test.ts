import { describe, expect, it, vi } from 'vitest';

import { ConfiguratorModel } from '../src/configurator-model.js';
import type {
  ConfiguratorAdapter,
  ConfiguratorDocument,
  ConfiguratorValue,
} from '../src/configurator-types.js';

const document: ConfiguratorDocument = {
  id: 'device.lamp',
  title: 'Lamp',
  available: true,
  sections: [
    {
      id: 'main',
      title: 'Main',
      fields: [
        { id: 'power', label: 'Power', kind: 'toggle', value: false },
        { id: 'name', label: 'Name', kind: 'text', value: 'Lamp' },
        { id: 'nullable', label: 'Nullable', kind: 'text', value: 'value' },
      ],
      actions: [{ id: 'identify', label: 'Identify' }],
    },
  ],
};

const createAdapter = (): ConfiguratorAdapter & {
  commit: ReturnType<typeof vi.fn>;
  invoke: ReturnType<typeof vi.fn>;
} => ({
  commit: vi.fn(async () => Promise.resolve()),
  invoke: vi.fn(async () => Promise.resolve()),
});

describe('ConfiguratorModel', () => {
  it('tracks pending values and supports undo and redo', () => {
    const model = new ConfiguratorModel(createAdapter());
    model.setDocument(document);

    model.setValue('power', true);
    expect(model.snapshot()).toMatchObject({ dirty: true, canUndo: true, canRedo: false });
    expect(model.snapshot().pendingValues['power']).toBe(true);

    model.undo();
    expect(model.snapshot()).toMatchObject({ dirty: false, canUndo: false, canRedo: true });

    model.redo();
    expect(model.snapshot().pendingValues['power']).toBe(true);
  });

  it('preserves an explicit null pending value', () => {
    const model = new ConfiguratorModel(createAdapter());
    model.setDocument(document);
    model.setValue('nullable', null);

    expect(Object.prototype.hasOwnProperty.call(model.snapshot().pendingValues, 'nullable')).toBe(true);
    expect(model.snapshot().pendingValues['nullable']).toBeNull();
  });

  it('blocks save when validation returns issues', async () => {
    const adapter = createAdapter();
    const model = new ConfiguratorModel(adapter, (_document, values) =>
      values['name'] === '' ? [{ fieldId: 'name', message: 'Required' }] : [],
    );
    model.setDocument(document);
    model.setValue('name', '');

    await expect(model.save()).resolves.toBe(false);
    expect(adapter.commit).not.toHaveBeenCalled();
    expect(model.snapshot().issues).toHaveLength(1);
  });

  it('commits changes and merges confirmed values into the document', async () => {
    const adapter = createAdapter();
    const model = new ConfiguratorModel(adapter);
    model.setDocument(document);
    model.setValue('power', true);

    await expect(model.save()).resolves.toBe(true);
    expect(adapter.commit).toHaveBeenCalledWith('device.lamp', { power: true });
    expect(model.snapshot().dirty).toBe(false);
    expect(
      model
        .snapshot()
        .document?.sections.flatMap((section) => section.fields)
        .find((field) => field.id === 'power')?.value,
    ).toBe(true);
  });

  it('dispatches document actions through the adapter', async () => {
    const adapter = createAdapter();
    const model = new ConfiguratorModel(adapter);
    model.setDocument(document);

    await model.invoke('identify');
    expect(adapter.invoke).toHaveBeenCalledWith('device.lamp', 'identify');
  });

  it('ignores unknown, disabled, and read-only fields', () => {
    const adapter = createAdapter();
    const guardedDocument: ConfiguratorDocument = {
      ...document,
      sections: [
        {
          id: 'guarded',
          title: 'Guarded',
          fields: [
            { id: 'disabled', label: 'Disabled', kind: 'text', value: 'a', disabled: true },
            { id: 'readonly', label: 'Read only', kind: 'status', value: 'b', readOnly: true },
          ],
        },
      ],
    };
    const model = new ConfiguratorModel(adapter);
    model.setDocument(guardedDocument);

    for (const [fieldId, value] of [
      ['missing', 'x'],
      ['disabled', 'x'],
      ['readonly', 'x'],
    ] as readonly (readonly [string, ConfiguratorValue])[]) {
      model.setValue(fieldId, value);
    }

    expect(model.snapshot().dirty).toBe(false);
  });
});
