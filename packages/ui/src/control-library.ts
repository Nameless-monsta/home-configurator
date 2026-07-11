import type {
  ConfiguratorField,
  ConfiguratorFieldKind,
  ConfiguratorValue,
} from './configurator-types.js';

export interface ControlRenderContext {
  readonly field: ConfiguratorField;
  readonly value: ConfiguratorValue;
  readonly disabled: boolean;
}

export interface ControlRenderer {
  render(context: ControlRenderContext): string;
  read(target: HTMLInputElement | HTMLSelectElement | HTMLButtonElement): ConfiguratorValue;
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const fieldAttributes = (context: ControlRenderContext): string =>
  `data-configurator-field="${escapeHtml(context.field.id)}" ${context.disabled ? 'disabled' : ''}`;

const primitiveText = (value: ConfiguratorValue): string => (value === null ? '' : String(value));

const inputRenderer = (
  type: 'text' | 'number' | 'color',
  read: ControlRenderer['read'],
): ControlRenderer => ({
  render: (context) => {
    const { field, value } = context;
    const numeric = type === 'number';
    const constraints = numeric
      ? `${field.minimum === undefined ? '' : `min="${field.minimum}"`} ${
          field.maximum === undefined ? '' : `max="${field.maximum}"`
        } ${field.step === undefined ? '' : `step="${field.step}"`}`
      : '';
    return `<input class="ui-control-input" type="${type}" ${fieldAttributes(context)} value="${escapeHtml(
      primitiveText(value),
    )}" ${constraints}>`;
  },
  read,
});

const toggleRenderer: ControlRenderer = {
  render: (context) => `
    <button class="ui-control-toggle" type="button" role="switch" aria-checked="${String(
      context.value === true,
    )}" ${fieldAttributes(context)} data-control-value="${String(context.value === true)}">
      <span aria-hidden="true"></span>
      <strong>${context.value === true ? 'On' : 'Off'}</strong>
    </button>`,
  read: (target) => target.dataset['controlValue'] !== 'true',
};

const sliderRenderer: ControlRenderer = {
  render: (context) => {
    const { field, value } = context;
    const numericValue = typeof value === 'number' ? value : (field.minimum ?? 0);
    return `<div class="ui-control-slider">
      <input type="range" ${fieldAttributes(context)} value="${numericValue}" min="${
        field.minimum ?? 0
      }" max="${field.maximum ?? 100}" step="${field.step ?? 1}" aria-valuetext="${escapeHtml(
        `${numericValue}${field.unit ?? ''}`,
      )}">
      <output>${numericValue}${field.unit ? escapeHtml(field.unit) : ''}</output>
    </div>`;
  },
  read: (target) => Number(target.value),
};

const selectRenderer: ControlRenderer = {
  render: (context) => `<select class="ui-control-select" ${fieldAttributes(context)}>
    ${(context.field.options ?? [])
      .map(
        (option) =>
          `<option value="${escapeHtml(option.value)}" ${
            option.value === context.value ? 'selected' : ''
          }>${escapeHtml(option.label)}</option>`,
      )
      .join('')}
  </select>`,
  read: (target) => target.value,
};

const segmentedRenderer: ControlRenderer = {
  render: (
    context,
  ) => `<div class="ui-control-segmented" role="radiogroup" aria-label="${escapeHtml(
    context.field.label,
  )}">
    ${(context.field.options ?? [])
      .map(
        (option) =>
          `<button type="button" role="radio" aria-checked="${String(
            option.value === context.value,
          )}" ${fieldAttributes(context)} data-control-value="${escapeHtml(option.value)}">${escapeHtml(
            option.label,
          )}</button>`,
      )
      .join('')}
  </div>`,
  read: (target) => target.dataset['controlValue'] ?? null,
};

const statusRenderer: ControlRenderer = {
  render: (context) =>
    `<output class="ui-control-status">${escapeHtml(
      context.value === null ? '—' : String(context.value),
    )}${context.field.unit ? escapeHtml(context.field.unit) : ''}</output>`,
  read: () => null,
};

export class ControlLibrary {
  readonly #renderers = new Map<ConfiguratorFieldKind, ControlRenderer>();

  public constructor() {
    this.register('toggle', toggleRenderer);
    this.register('slider', sliderRenderer);
    this.register(
      'number',
      inputRenderer('number', (target) => Number(target.value)),
    );
    this.register('select', selectRenderer);
    this.register('segmented', segmentedRenderer);
    this.register(
      'text',
      inputRenderer('text', (target) => target.value),
    );
    this.register(
      'color',
      inputRenderer('color', (target) => target.value),
    );
    this.register('status', statusRenderer);
  }

  public register(kind: ConfiguratorFieldKind, renderer: ControlRenderer): void {
    this.#renderers.set(kind, renderer);
  }

  public render(context: ControlRenderContext): string {
    const renderer = this.#renderers.get(context.field.kind);
    if (!renderer) throw new Error(`No control renderer registered for ${context.field.kind}`);
    return renderer.render(context);
  }

  public read(
    kind: ConfiguratorFieldKind,
    target: HTMLInputElement | HTMLSelectElement | HTMLButtonElement,
  ): ConfiguratorValue {
    const renderer = this.#renderers.get(kind);
    if (!renderer) throw new Error(`No control renderer registered for ${kind}`);
    return renderer.read(target);
  }
}
