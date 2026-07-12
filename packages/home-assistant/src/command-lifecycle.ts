import type { CommandReceipt, CommandState, SemanticCommand, Unsubscribe } from './types.js';

export type CommandLifecycleReason =
  | 'validation'
  | 'connection'
  | 'service'
  | 'confirmation'
  | 'timeout'
  | 'superseded'
  | 'disconnect';

export interface CommandLifecycleEvent {
  readonly command: SemanticCommand;
  readonly state: CommandState;
  readonly at: number;
  readonly receipt?: CommandReceipt;
  readonly reason?: CommandLifecycleReason;
}

export interface CommandLifecycleSource {
  subscribeCommandLifecycle(listener: (event: CommandLifecycleEvent) => void): Unsubscribe;
}
