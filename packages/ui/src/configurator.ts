import { ConfiguratorModel } from './configurator-model.js';
import { ControlLibrary } from './control-library.js';
import type {
  ConfiguratorDocument,
  ConfiguratorField,
  ConfiguratorRendererOptions,
  ConfiguratorSnapshot,
} from './configurator-types.js';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export class UiConfigurator {
  readonly #host: HTMLElement;
  readonly #model: ConfiguratorModel;
  readonly #controls = new ControlLibrary();
  readonly #unsubscribe: () => void;
  readonly #collapsed = new Set<string>();

  public constructor(options: ConfiguratorRendererOptions) {
    this.#host = document.createElement('aside');
    this.#host.className = 'ui-configurator';
    this.#host.setAttribute('aria-label', 'Device configurator');
    const shell = options.root.querySelector<HTMLElement>('[data-ui-shell]');
    if (!shell) throw new Error('UI Foundation shell is required before configurator');
    shell.append(this.#host);

    this.#model = new ConfiguratorModel(options.adapter, options.validate);
    this.#host.addEventListener('click', this.#handleClick);
    this.#host.addEventListener('input', this.#handleInput);
    this.#host.addEventListener('change', this.#handleInput);
    this.#unsubscribe = this.#model.subscribe((snapshot) => this.#render(snapshot));
  }

  public setDocument(document: ConfiguratorDocument | null): void {
    this.#collapsed.clear();
    for (const section of document?.sections ?? []) {
      if (section.collapsed) this.#collapsed.add(section.id);
    }
    this.#model.setDocument(document);
  }

  public snapshot(): ConfiguratorSnapshot {
    return this.#model.snapshot();
  }

  public dispose(): void {
    this.#unsubscribe();
    this.#host.removeEventListener('click', this.#handleClick);
    this.#host.removeEventListener('input', this.#handleInput);
    this.#host.removeEventListener('change', this.#handleInput);
    this.#host.remove();
  }

  readonly #handleClick = (event: Event): void => {
    const element = event.target instanceof Element ? event.target : null;
    const control = element?.closest<HTMLButtonElement>('button[data-configurator-field]');
    if (control) {
      const field = this.#findField(control.dataset['configuratorField']);
      if (field && !control.disabled) {
        this.#model.setValue(field.id, this.#controls.read(field.kind, control));
      }
      return;
    }

    const target = element?.closest<HTMLElement>('[data-configurator-action]');
    const action = target?.dataset['configuratorAction'];
    const id = target?.dataset['configuratorId'];
    if (action === 'undo') this.#model.undo();
    if (action === 'redo') this.#model.redo();
    if (action === 'reset') this.#model.reset();
    if (action === 'save') void this.#model.save();
    if (action === 'invoke' && id) void this.#model.invoke(id);
    if (action === 'toggle-section' && id) {
      if (this.#collapsed.has(id)) this.#collapsed.delete(id);
      else this.#collapsed.add(id);
      this.#render(this.#model.snapshot());
    }
  };

  readonly #handleInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    const field = this.#findField(target.dataset['configuratorField']);
    if (!field) return;
    this.#model.setValue(field.id, this.#controls.read(field.kind, target));
  };

  #findField(fieldId: string | undefined): ConfiguratorField | undefined {
    if (!fieldId) return undefined;
    return this.#model
      .snapshot()
      .document?.sections.flatMap((section) => section.fields)
      .find((field) => field.id === fieldId);
  }

  #render(snapshot: ConfiguratorSnapshot): void {
    const document = snapshot.document;
    if (!document) {
      this.#host.innerHTML =
        '<div class="ui-configurator-empty"><p>Configurator</p><h2>Select a device</h2><span>Choose a room and device to inspect its available controls.</span></div>';
      return;
    }

    this.#host.innerHTML = `
      <div class="ui-configurator-header">
        <div><p>Configurator</p><h2>${escapeHtml(document.title)}</h2>${document.subtitle ? `<span>${escapeHtml(document.subtitle)}</span>` : ''}</div>
        <div class="ui-configurator-history">
          <button type="button" data-configurator-action="undo" ${snapshot.canUndo ? '' : 'disabled'} aria-label="Undo change">↶</button>
          <button type="button" data-configurator-action="redo" ${snapshot.canRedo ? '' : 'disabled'} aria-label="Redo change">↷</button>
        </div>
      </div>
      ${document.available ? '' : '<div class="ui-configurator-notice" role="status">This device is currently unavailable.</div>'}
      <div class="ui-configurator-sections">
        ${document.sections.map((section) => this.#renderSection(section.id, section.title, section.description, section.fields, section.actions ?? [], snapshot)).join('')}
      </div>
      <div class="ui-configurator-footer">
        <button type="button" data-configurator-action="reset" ${snapshot.dirty && !snapshot.saving ? '' : 'disabled'}>Reset</button>
        <button class="is-primary" type="button" data-configurator-action="save" ${snapshot.dirty && snapshot.issues.length === 0 && !snapshot.saving ? '' : 'disabled'}>${snapshot.saving ? 'Saving…' : 'Apply'}</button>
      </div>
    `;
  }

  #renderSection(
    id: string,
    title: string,
    description: string | undefined,
    fields: readonly ConfiguratorField[],
    actions: readonly {
      readonly id: string;
      readonly label: string;
      readonly disabled?: boolean;
    }[],
    snapshot: ConfiguratorSnapshot,
  ): string {
    const collapsed = this.#collapsed.has(id);
    return `
      <section class="ui-configurator-section" data-collapsed="${String(collapsed)}">
        <button class="ui-configurator-section-toggle" type="button" data-configurator-action="toggle-section" data-configurator-id="${escapeHtml(id)}" aria-expanded="${String(!collapsed)}">
          <span><strong>${escapeHtml(title)}</strong>${description ? `<small>${escapeHtml(description)}</small>` : ''}</span><i aria-hidden="true">⌄</i>
        </button>
        <div class="ui-configurator-section-body" ${collapsed ? 'hidden' : ''}>
          ${fields.map((field) => this.#renderField(field, snapshot)).join('')}
          ${actions.length > 0 ? `<div class="ui-configurator-actions">${actions.map((action) => `<button type="button" data-configurator-action="invoke" data-configurator-id="${escapeHtml(action.id)}" ${action.disabled ? 'disabled' : ''}>${escapeHtml(action.label)}</button>`).join('')}</div>` : ''}
        </div>
      </section>
    `;
  }

  #renderField(field: ConfiguratorField, snapshot: ConfiguratorSnapshot): string {
    const value = Object.prototype.hasOwnProperty.call(snapshot.pendingValues, field.id)
      ? snapshot.pendingValues[field.id]!
      : field.value;
    const issue = snapshot.issues.find((item) => item.fieldId === field.id);
    const disabled = Boolean(field.disabled || field.readOnly || snapshot.saving);
    return `
      <div class="ui-configurator-field" data-kind="${field.kind}" data-invalid="${String(Boolean(issue))}">
        <div class="ui-configurator-field-label"><strong>${escapeHtml(field.label)}</strong>${field.description ? `<small>${escapeHtml(field.description)}</small>` : ''}</div>
        ${this.#controls.render({ field, value, disabled })}
        ${issue ? `<em role="alert">${escapeHtml(issue.message)}</em>` : ''}
      </div>
    `;
  }
}
