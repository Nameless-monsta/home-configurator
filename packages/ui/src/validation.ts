export type UiValidationSeverity = 'error' | 'warning';

export interface UiValidationNode {
  readonly tag: string;
  readonly id?: string;
  readonly role?: string;
  readonly name?: string;
  readonly hidden?: boolean;
  readonly disabled?: boolean;
  readonly focusable?: boolean;
  readonly labelledBy?: readonly string[];
  readonly describedBy?: readonly string[];
  readonly controls?: readonly string[];
  readonly children?: readonly UiValidationNode[];
}

export interface UiValidationIssue {
  readonly code:
    | 'duplicate-id'
    | 'missing-accessible-name'
    | 'missing-dialog-name'
    | 'invalid-aria-reference'
    | 'hidden-focusable-control';
  readonly severity: UiValidationSeverity;
  readonly path: string;
  readonly message: string;
}

export interface UiValidationReport {
  readonly valid: boolean;
  readonly errors: number;
  readonly warnings: number;
  readonly issues: readonly UiValidationIssue[];
}

const interactiveTags = new Set(['button', 'input', 'select', 'textarea', 'a']);
const interactiveRoles = new Set([
  'button',
  'checkbox',
  'combobox',
  'link',
  'listbox',
  'menuitem',
  'option',
  'radio',
  'slider',
  'switch',
  'tab',
]);

const isInteractive = (node: UiValidationNode): boolean =>
  node.focusable === true ||
  interactiveTags.has(node.tag) ||
  (node.role ? interactiveRoles.has(node.role) : false);

const nodeLabel = (node: UiValidationNode, index: number): string =>
  node.id ? `${node.tag}#${node.id}` : `${node.tag}[${index}]`;

export const validateUiTree = (root: UiValidationNode): UiValidationReport => {
  const issues: UiValidationIssue[] = [];
  const ids = new Map<string, string>();
  const references: Array<{ readonly id: string; readonly path: string }> = [];

  const visit = (node: UiValidationNode, path: string): void => {
    if (node.id) {
      const previousPath = ids.get(node.id);
      if (previousPath) {
        issues.push({
          code: 'duplicate-id',
          severity: 'error',
          path,
          message: `ID “${node.id}” is already used at ${previousPath}.`,
        });
      } else ids.set(node.id, path);
    }

    if (isInteractive(node) && !node.disabled && !node.name?.trim()) {
      issues.push({
        code: 'missing-accessible-name',
        severity: 'error',
        path,
        message: 'Interactive control requires an accessible name.',
      });
    }

    if (node.role === 'dialog' && !node.name?.trim() && (node.labelledBy?.length ?? 0) === 0) {
      issues.push({
        code: 'missing-dialog-name',
        severity: 'error',
        path,
        message: 'Dialog requires an accessible name or aria-labelledby reference.',
      });
    }

    if (node.hidden && isInteractive(node) && !node.disabled) {
      issues.push({
        code: 'hidden-focusable-control',
        severity: 'error',
        path,
        message: 'Hidden content must not contain an enabled focusable control.',
      });
    }

    for (const id of [
      ...(node.labelledBy ?? []),
      ...(node.describedBy ?? []),
      ...(node.controls ?? []),
    ]) {
      references.push({ id, path });
    }

    for (const [index, child] of (node.children ?? []).entries()) {
      visit(child, `${path}/${nodeLabel(child, index)}`);
    }
  };

  visit(root, `/${nodeLabel(root, 0)}`);

  for (const reference of references) {
    if (ids.has(reference.id)) continue;
    issues.push({
      code: 'invalid-aria-reference',
      severity: 'error',
      path: reference.path,
      message: `ARIA reference “${reference.id}” does not match an element ID.`,
    });
  }

  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;
  return { valid: errors === 0, errors, warnings, issues };
};
