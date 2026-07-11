export type HAConnectionStatus =
  | 'uninitialized'
  | 'connecting'
  | 'authenticating'
  | 'syncing'
  | 'ready'
  | 'degraded'
  | 'reconnecting'
  | 'disconnected'
  | 'auth-failed'
  | 'fatal';

export interface HomeAssistantConnectionConfig {
  readonly url: string;
  readonly accessToken: string;
  readonly reconnect?: {
    readonly enabled?: boolean;
    readonly minimumDelayMs?: number;
    readonly maximumDelayMs?: number;
    readonly jitterRatio?: number;
  };
  readonly commandTimeoutMs?: number;
}

export interface HAState {
  readonly entity_id: string;
  readonly state: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly last_changed: string;
  readonly last_updated: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface HAAreaRegistryEntry {
  readonly area_id: string;
  readonly name: string;
  readonly floor_id?: string | null;
  readonly aliases?: readonly string[];
}

export interface HAFloorRegistryEntry {
  readonly floor_id: string;
  readonly name: string;
  readonly level?: number | null;
  readonly aliases?: readonly string[];
}

export interface HADeviceRegistryEntry {
  readonly id: string;
  readonly name?: string | null;
  readonly name_by_user?: string | null;
  readonly area_id?: string | null;
  readonly manufacturer?: string | null;
  readonly model?: string | null;
  readonly model_id?: string | null;
  readonly sw_version?: string | null;
  readonly hw_version?: string | null;
  readonly disabled_by?: string | null;
  readonly identifiers?: readonly (readonly [string, string])[];
}

export interface HAEntityRegistryEntry {
  readonly entity_id: string;
  readonly unique_id: string;
  readonly platform: string;
  readonly device_id?: string | null;
  readonly area_id?: string | null;
  readonly name?: string | null;
  readonly original_name?: string | null;
  readonly icon?: string | null;
  readonly disabled_by?: string | null;
  readonly hidden_by?: string | null;
  readonly entity_category?: string | null;
}

export interface HARegistrySnapshot {
  readonly areas: readonly HAAreaRegistryEntry[];
  readonly floors: readonly HAFloorRegistryEntry[];
  readonly devices: readonly HADeviceRegistryEntry[];
  readonly entities: readonly HAEntityRegistryEntry[];
  readonly states: readonly HAState[];
  readonly services: Readonly<Record<string, unknown>>;
  readonly config: Readonly<Record<string, unknown>>;
  readonly observedAt: number;
}

export type CapabilityKind =
  | 'power'
  | 'brightness'
  | 'color'
  | 'colorTemperature'
  | 'targetTemperature'
  | 'hvacMode'
  | 'fanMode'
  | 'volume'
  | 'mediaPlayback'
  | 'mediaSource'
  | 'vacuumCleaning'
  | 'vacuumReturnHome'
  | 'vacuumLocate'
  | 'coverPosition'
  | 'lock'
  | 'sensor';

export interface EntityBinding {
  readonly entityId: string;
  readonly domain: string;
  readonly capabilities: readonly CapabilityKind[];
  readonly available: boolean;
  readonly stale: boolean;
}

export interface CanonicalRoom {
  readonly id: string;
  readonly name: string;
  readonly floorId?: string;
  readonly aliases: readonly string[];
  readonly deviceIds: readonly string[];
}

export interface CanonicalDevice {
  readonly id: string;
  readonly name: string;
  readonly roomId: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly entityIds: readonly string[];
  readonly bindings: readonly EntityBinding[];
  readonly capabilities: readonly CapabilityKind[];
  readonly available: boolean;
  readonly optimistic: Readonly<Partial<Record<CapabilityKind, unknown>>>;
}

export interface ConfirmedRuntimeSnapshot {
  readonly status: HAConnectionStatus;
  readonly rooms: readonly CanonicalRoom[];
  readonly devices: readonly CanonicalDevice[];
  readonly states: Readonly<Record<string, HAState>>;
  readonly observedAt: number;
  readonly stale: boolean;
}

export interface ConfirmedStatePatch {
  readonly reason:
    'initial-sync' | 'state-changed' | 'registry-changed' | 'optimistic' | 'reconnect' | 'stale';
  readonly snapshot: ConfirmedRuntimeSnapshot;
  readonly affectedEntityIds: readonly string[];
  readonly affectedDeviceIds: readonly string[];
}

export type CommandPolicy = 'reject-offline' | 'queue-safe' | 'read-only';
export type CommandState =
  | 'queued'
  | 'dispatching'
  | 'acknowledged'
  | 'awaiting-confirmation'
  | 'confirmed'
  | 'failed'
  | 'timed-out'
  | 'canceled';

export interface SemanticCommand {
  readonly id: string;
  readonly deviceId: string;
  readonly capability: CapabilityKind;
  readonly action: string;
  readonly value?: unknown;
  readonly issuedAt: number;
  readonly policy: CommandPolicy;
  readonly continuous?: boolean;
  readonly final?: boolean;
}

export interface CommandReceipt {
  readonly commandId: string;
  readonly state: CommandState;
  readonly acknowledgedAt?: number;
  readonly confirmedAt?: number;
  readonly error?: HAAdapterError;
}

export interface HAAdapterError {
  readonly code: string;
  readonly category:
    | 'authentication'
    | 'connection'
    | 'registry'
    | 'subscription'
    | 'service'
    | 'validation'
    | 'timeout'
    | 'integration';
  readonly recoverable: boolean;
  readonly userMessage: string;
  readonly technicalMessage?: string;
  readonly commandId?: string;
  readonly entityId?: string;
}

export interface HAEvent<TData = unknown> {
  readonly event_type: string;
  readonly data: TData;
  readonly origin?: string;
  readonly time_fired?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface StateChangedEventData {
  readonly entity_id: string;
  readonly old_state: HAState | null;
  readonly new_state: HAState | null;
}

export type Unsubscribe = () => void;

export interface HomeAssistantTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  request<T>(message: Readonly<Record<string, unknown>>): Promise<T>;
  subscribe<TData>(
    eventType: string,
    listener: (event: HAEvent<TData>) => void,
  ): Promise<Unsubscribe>;
  onDisconnect(listener: (reason?: string) => void): Unsubscribe;
}

export interface HomeAssistantRuntime {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): HAConnectionStatus;
  getConfirmedSnapshot(): ConfirmedRuntimeSnapshot;
  subscribe(listener: (patch: ConfirmedStatePatch) => void): Unsubscribe;
  dispatch(command: SemanticCommand): Promise<CommandReceipt>;
  refresh(scope?: 'all' | 'states' | 'registries'): Promise<void>;
}
