export type DeviceState = Readonly<Record<string, unknown>>;

export interface DeviceDescriptor {
  readonly id: string;
  readonly roomId: string;
  readonly entityIds: readonly string[];
  readonly name?: string;
  readonly available?: boolean;
  readonly connected?: boolean;
}

export type DeviceTransitionKind =
  | 'registered'
  | 'metadata'
  | 'optimistic'
  | 'confirmed'
  | 'rollback'
  | 'availability'
  | 'selection';

export interface DeviceTransition {
  readonly sequence: number;
  readonly kind: DeviceTransitionKind;
  readonly at: number;
  readonly detail: Readonly<Record<string, unknown>>;
}

export interface DeviceRuntimeMetrics {
  readonly optimisticUpdates: number;
  readonly confirmations: number;
  readonly rollbacks: number;
  readonly availabilityChanges: number;
  readonly selectionChanges: number;
  readonly averageLatencyMs?: number;
  readonly lastLatencyMs?: number;
}

export interface DeviceRuntimeSnapshot {
  readonly id: string;
  readonly roomId: string;
  readonly entityIds: readonly string[];
  readonly name?: string;
  readonly available: boolean;
  readonly connected: boolean;
  readonly selected: boolean;
  readonly confirmedState: DeviceState;
  readonly optimisticState: DeviceState | null;
  readonly effectiveState: DeviceState;
  readonly version: number;
  readonly lastUpdatedAt: number;
  readonly pendingCommandId?: string;
  readonly history: readonly DeviceTransition[];
  readonly metrics: DeviceRuntimeMetrics;
}

export interface DeviceRuntimeInput {
  readonly descriptor: DeviceDescriptor;
  readonly confirmedState?: DeviceState;
  readonly historyLimit?: number;
  readonly now?: () => number;
}

export interface OptimisticUpdateOptions {
  readonly commandId: string;
  readonly issuedAt?: number;
  readonly at?: number;
}

export interface ConfirmationOptions {
  readonly commandId?: string;
  readonly at?: number;
}

export interface RollbackOptions {
  readonly reason: string;
  readonly at?: number;
}

export interface AvailabilityOptions {
  readonly connected?: boolean;
  readonly at?: number;
}

export type DeviceStorePatchKind = 'registered' | 'updated' | 'removed';

export interface DeviceStorePatch {
  readonly kind: DeviceStorePatchKind;
  readonly deviceId: string;
  readonly roomIds: readonly string[];
  readonly version: number;
  readonly snapshot?: DeviceRuntimeSnapshot;
}

export interface DeviceStoreSnapshot {
  readonly version: number;
  readonly devices: readonly DeviceRuntimeSnapshot[];
  readonly rooms: Readonly<Record<string, readonly string[]>>;
}

export interface DeviceStoreRoomSnapshot {
  readonly roomId: string;
  readonly version: number;
  readonly devices: readonly DeviceRuntimeSnapshot[];
}

export interface SelectionSnapshot {
  readonly version: number;
  readonly selectedRoomId: string | null;
  readonly selectedDeviceId: string | null;
  readonly hoveredDeviceId: string | null;
  readonly focusedDeviceId: string | null;
}

export interface RuntimeStateDiagnostics {
  readonly deviceCount: number;
  readonly availableCount: number;
  readonly connectedCount: number;
  readonly selectedCount: number;
  readonly optimisticCount: number;
  readonly rollbackCount: number;
  readonly transitionCount: number;
  readonly averageLatencyMs?: number;
}
