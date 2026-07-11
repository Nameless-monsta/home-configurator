export type ConfiguratorValue = string | number | boolean | null;

export type ConfiguratorFieldKind =
  | 'toggle'
  | 'slider'
  | 'number'
  | 'select'
  | 'segmented'
  | 'text'
  | 'color'
  | 'status';

export interface ConfiguratorOption {
  readonly value: string;
  readonly label: string;
}

export interface ConfiguratorField {
  readonly id: string;
  readonly label: string;
  readonly kind: ConfiguratorFieldKind;
  readonly value: ConfiguratorValue;
  readonly description?: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly step?: number;
  readonly unit?: string;
  readonly options?: readonly ConfiguratorOption[];
}

export interface ConfiguratorAction {
  readonly id: string;
  readonly label: string;
  readonly intent?: 'primary' | 'secondary' | 'danger';
  readonly disabled?: boolean;
}

export interface ConfiguratorSection {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly collapsed?: boolean;
  readonly fields: readonly ConfiguratorField[];
  readonly actions?: readonly ConfiguratorAction[];
}

export interface ConfiguratorDocument {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly available: boolean;
  readonly sections: readonly ConfiguratorSection[];
}

export interface ConfiguratorValidationIssue {
  readonly fieldId: string;
  readonly message: string;
}

export interface ConfiguratorChange {
  readonly fieldId: string;
  readonly previousValue: ConfiguratorValue;
  readonly nextValue: ConfiguratorValue;
  readonly changedAt: number;
}

export interface ConfiguratorSnapshot {
  readonly document: ConfiguratorDocument | null;
  readonly pendingValues: Readonly<Record<string, ConfiguratorValue>>;
  readonly issues: readonly ConfiguratorValidationIssue[];
  readonly dirty: boolean;
  readonly saving: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface ConfiguratorAdapter {
  commit(documentId: string, changes: Readonly<Record<string, ConfiguratorValue>>): Promise<void>;
  invoke(documentId: string, actionId: string): Promise<void>;
}

export interface ConfiguratorRendererOptions {
  readonly root: HTMLElement;
  readonly adapter: ConfiguratorAdapter;
  readonly validate?: (
    document: ConfiguratorDocument,
    values: Readonly<Record<string, ConfiguratorValue>>,
  ) => readonly ConfiguratorValidationIssue[];
}
