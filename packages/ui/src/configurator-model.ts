import type {
  ConfiguratorAdapter,
  ConfiguratorDocument,
  ConfiguratorSnapshot,
  ConfiguratorValidationIssue,
  ConfiguratorValue,
} from './configurator-types.js';

interface HistoryEntry {
  readonly fieldId: string;
  readonly previousValue: ConfiguratorValue;
  readonly nextValue: ConfiguratorValue;
}

export class ConfiguratorModel {
  readonly #adapter: ConfiguratorAdapter;
  readonly #validate: (
    document: ConfiguratorDocument,
    values: Readonly<Record<string, ConfiguratorValue>>,
  ) => readonly ConfiguratorValidationIssue[];
  readonly #listeners = new Set<(snapshot: ConfiguratorSnapshot) => void>();
  #document: ConfiguratorDocument | null = null;
  #pendingValues: Record<string, ConfiguratorValue> = {};
  #issues: readonly ConfiguratorValidationIssue[] = [];
  #undoStack: HistoryEntry[] = [];
  #redoStack: HistoryEntry[] = [];
  #saving = false;

  public constructor(
    adapter: ConfiguratorAdapter,
    validate: (
      document: ConfiguratorDocument,
      values: Readonly<Record<string, ConfiguratorValue>>,
    ) => readonly ConfiguratorValidationIssue[] = () => [],
  ) {
    this.#adapter = adapter;
    this.#validate = validate;
  }

  public snapshot(): ConfiguratorSnapshot {
    return {
      document: this.#document,
      pendingValues: { ...this.#pendingValues },
      issues: this.#issues,
      dirty: Object.keys(this.#pendingValues).length > 0,
      saving: this.#saving,
      canUndo: this.#undoStack.length > 0,
      canRedo: this.#redoStack.length > 0,
    };
  }

  public subscribe(listener: (snapshot: ConfiguratorSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.snapshot());
    return () => this.#listeners.delete(listener);
  }

  public setDocument(document: ConfiguratorDocument | null): void {
    this.#document = document;
    this.#pendingValues = {};
    this.#issues = [];
    this.#undoStack = [];
    this.#redoStack = [];
    this.#saving = false;
    this.#publish();
  }

  public setValue(fieldId: string, value: ConfiguratorValue): void {
    const document = this.#document;
    if (!document || this.#saving) return;
    const field = document.sections.flatMap((section) => section.fields).find((item) => item.id === fieldId);
    if (!field || field.disabled || field.readOnly) return;

    const currentValue = this.#pendingValues[fieldId] ?? field.value;
    if (Object.is(currentValue, value)) return;

    this.#pendingValues[fieldId] = value;
    this.#undoStack.push({ fieldId, previousValue: currentValue, nextValue: value });
    this.#redoStack = [];
    this.#issues = this.#validate(document, this.#pendingValues);
    this.#publish();
  }

  public undo(): void {
    const entry = this.#undoStack.pop();
    if (!entry || !this.#document || this.#saving) return;
    this.#applyHistoryValue(entry.fieldId, entry.previousValue);
    this.#redoStack.push(entry);
    this.#issues = this.#validate(this.#document, this.#pendingValues);
    this.#publish();
  }

  public redo(): void {
    const entry = this.#redoStack.pop();
    if (!entry || !this.#document || this.#saving) return;
    this.#applyHistoryValue(entry.fieldId, entry.nextValue);
    this.#undoStack.push(entry);
    this.#issues = this.#validate(this.#document, this.#pendingValues);
    this.#publish();
  }

  public reset(): void {
    if (this.#saving) return;
    this.#pendingValues = {};
    this.#issues = [];
    this.#undoStack = [];
    this.#redoStack = [];
    this.#publish();
  }

  public async save(): Promise<boolean> {
    const document = this.#document;
    if (!document || this.#saving || Object.keys(this.#pendingValues).length === 0) return false;
    this.#issues = this.#validate(document, this.#pendingValues);
    if (this.#issues.length > 0) {
      this.#publish();
      return false;
    }

    const changes = { ...this.#pendingValues };
    this.#saving = true;
    this.#publish();
    try {
      await this.#adapter.commit(document.id, changes);
      this.#document = this.#mergeDocument(document, changes);
      this.#pendingValues = {};
      this.#undoStack = [];
      this.#redoStack = [];
      return true;
    } finally {
      this.#saving = false;
      this.#publish();
    }
  }

  public invoke(actionId: string): Promise<void> {
    const document = this.#document;
    if (!document) return Promise.resolve();
    return this.#adapter.invoke(document.id, actionId);
  }

  #applyHistoryValue(fieldId: string, value: ConfiguratorValue): void {
    const original = this.#document?.sections
      .flatMap((section) => section.fields)
      .find((field) => field.id === fieldId)?.value;
    if (Object.is(original, value)) delete this.#pendingValues[fieldId];
    else this.#pendingValues[fieldId] = value;
  }

  #mergeDocument(
    document: ConfiguratorDocument,
    values: Readonly<Record<string, ConfiguratorValue>>,
  ): ConfiguratorDocument {
    return {
      ...document,
      sections: document.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) =>
          Object.prototype.hasOwnProperty.call(values, field.id)
            ? { ...field, value: values[field.id] ?? null }
            : field,
        ),
      })),
    };
  }

  #publish(): void {
    const snapshot = this.snapshot();
    for (const listener of this.#listeners) listener(snapshot);
  }
}
