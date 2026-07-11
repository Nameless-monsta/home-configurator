import { describe, expect, it } from 'vitest';

import { validateUiTree, type UiValidationNode } from '../src/validation.js';

const validTree = (): UiValidationNode => ({
  tag: 'main',
  id: 'app',
  children: [
    { tag: 'button', id: 'open-diagnostics', name: 'Open diagnostics', focusable: true },
    {
      tag: 'section',
      id: 'diagnostics-dialog',
      role: 'dialog',
      labelledBy: ['diagnostics-title'],
      children: [
        { tag: 'h2', id: 'diagnostics-title', name: 'Diagnostics' },
        { tag: 'button', id: 'close-diagnostics', name: 'Close diagnostics', focusable: true },
      ],
    },
    {
      tag: 'button',
      id: 'room-selector',
      name: 'Select room',
      controls: ['room-listbox'],
      focusable: true,
    },
    { tag: 'div', id: 'room-listbox', role: 'listbox', name: 'Rooms' },
  ],
});

describe('validateUiTree', () => {
  it('accepts a complete accessible UI tree', () => {
    expect(validateUiTree(validTree())).toMatchObject({ valid: true, errors: 0, warnings: 0 });
  });

  it('reports duplicate IDs', () => {
    const report = validateUiTree({
      tag: 'main',
      children: [
        { tag: 'div', id: 'duplicate' },
        { tag: 'div', id: 'duplicate' },
      ],
    });

    expect(report.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'duplicate-id' })]),
    );
  });

  it('reports unnamed interactive controls', () => {
    const report = validateUiTree({
      tag: 'main',
      children: [{ tag: 'button', focusable: true }],
    });

    expect(report.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'missing-accessible-name' })]),
    );
  });

  it('reports unnamed dialogs', () => {
    const report = validateUiTree({ tag: 'section', role: 'dialog' });

    expect(report.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'missing-dialog-name' })]),
    );
  });

  it('reports invalid ARIA references', () => {
    const report = validateUiTree({
      tag: 'button',
      name: 'Open menu',
      focusable: true,
      controls: ['missing-menu'],
    });

    expect(report.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'invalid-aria-reference' })]),
    );
  });

  it('reports enabled focusable controls hidden from assistive technology', () => {
    const report = validateUiTree({
      tag: 'button',
      name: 'Hidden action',
      hidden: true,
      focusable: true,
    });

    expect(report.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'hidden-focusable-control' })]),
    );
  });
});
