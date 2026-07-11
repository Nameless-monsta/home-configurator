export type MaybePromise<T> = T | Promise<T>;

export type RuntimePhase = 'idle' | 'bootstrapping' | 'running' | 'stopping' | 'stopped' | 'failed';

export interface Disposable {
  dispose(): MaybePromise<void>;
}

export interface Startable {
  start(): MaybePromise<void>;
}

export interface Stoppable {
  stop(): MaybePromise<void>;
}

export interface RuntimeService {
  readonly id: string;
  start?(): MaybePromise<void>;
  stop?(): MaybePromise<void>;
  dispose?(): MaybePromise<void>;
}

export interface FrameContext {
  readonly timestampMs: number;
  readonly deltaMs: number;
  readonly frame: number;
}

export interface RuntimeClock {
  now(): number;
  requestFrame(callback: (timestampMs: number) => void): unknown;
  cancelFrame(handle: unknown): void;
}
