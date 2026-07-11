import type { Diagnostics } from '@home-configurator/runtime';

import type {
  HAEvent,
  HomeAssistantConnectionConfig,
  HomeAssistantTransport,
  Unsubscribe,
} from './types.js';

interface WebSocketMessageEventLike {
  readonly data: unknown;
}

interface WebSocketCloseEventLike {
  readonly reason?: string;
  readonly code?: number;
}

export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'open', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: WebSocketMessageEventLike) => void): void;
  addEventListener(type: 'close', listener: (event: WebSocketCloseEventLike) => void): void;
  addEventListener(type: 'error', listener: () => void): void;
  removeEventListener(type: 'open', listener: () => void): void;
  removeEventListener(type: 'message', listener: (event: WebSocketMessageEventLike) => void): void;
  removeEventListener(type: 'close', listener: (event: WebSocketCloseEventLike) => void): void;
  removeEventListener(type: 'error', listener: () => void): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
}

interface Subscription {
  readonly listener: (event: HAEvent<unknown>) => void;
}

interface IncomingMessage {
  readonly type?: string;
  readonly id?: number;
  readonly success?: boolean;
  readonly result?: unknown;
  readonly error?: { readonly code?: string; readonly message?: string };
  readonly event?: HAEvent<unknown>;
  readonly ha_version?: string;
  readonly message?: string;
}

const websocketUrl = (baseUrl: string): string => {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/api/websocket`;
  url.search = '';
  url.hash = '';
  return url.toString();
};

const browserWebSocketFactory: WebSocketFactory = (url) => new WebSocket(url);

const parseMessage = (data: unknown): IncomingMessage | undefined => {
  if (typeof data !== 'string') return undefined;
  try {
    const parsed: unknown = JSON.parse(data);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as IncomingMessage)
      : undefined;
  } catch {
    return undefined;
  }
};

export class HomeAssistantWebSocketClient implements HomeAssistantTransport {
  readonly #config: HomeAssistantConnectionConfig;
  readonly #diagnostics: Diagnostics;
  readonly #factory: WebSocketFactory;
  readonly #pending = new Map<number, PendingRequest>();
  readonly #subscriptions = new Map<number, Subscription>();
  readonly #disconnectListeners = new Set<(reason?: string) => void>();
  #socket: WebSocketLike | undefined;
  #nextId = 1;
  #connectPromise: Promise<void> | undefined;
  #intentionalClose = false;

  public constructor(
    config: HomeAssistantConnectionConfig,
    diagnostics: Diagnostics,
    factory: WebSocketFactory = browserWebSocketFactory,
  ) {
    this.#config = config;
    this.#diagnostics = diagnostics;
    this.#factory = factory;
  }

  public connect(): Promise<void> {
    if (this.#socket?.readyState === 1) return Promise.resolve();
    if (this.#connectPromise) return this.#connectPromise;
    this.#intentionalClose = false;
    this.#connectPromise = this.#openAndAuthenticate().finally(() => {
      this.#connectPromise = undefined;
    });
    return this.#connectPromise;
  }

  public async disconnect(): Promise<void> {
    this.#intentionalClose = true;
    const socket = this.#socket;
    this.#socket = undefined;
    if (socket && socket.readyState < 2) socket.close(1000, 'client disconnect');
    this.#rejectPending(new Error('Home Assistant transport disconnected'));
    this.#subscriptions.clear();
  }

  public request<T>(message: Readonly<Record<string, unknown>>): Promise<T> {
    const socket = this.#socket;
    if (!socket || socket.readyState !== 1) {
      return Promise.reject(new Error('Home Assistant transport is not connected'));
    }
    const id = this.#nextId++;
    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      socket.send(JSON.stringify({ ...message, id }));
    });
  }

  public async subscribe<TData>(
    eventType: string,
    listener: (event: HAEvent<TData>) => void,
  ): Promise<Unsubscribe> {
    const id = this.#nextId++;
    const socket = this.#socket;
    if (!socket || socket.readyState !== 1) {
      throw new Error('Home Assistant transport is not connected');
    }

    await new Promise<void>((resolve, reject) => {
      this.#pending.set(id, { resolve: () => resolve(), reject });
      this.#subscriptions.set(id, {
        listener: listener as (event: HAEvent<unknown>) => void,
      });
      socket.send(JSON.stringify({ id, type: 'subscribe_events', event_type: eventType }));
    }).catch((error: unknown) => {
      this.#subscriptions.delete(id);
      throw error;
    });

    return () => {
      this.#subscriptions.delete(id);
      if (this.#socket?.readyState === 1) {
        void this.request({ type: 'unsubscribe_events', subscription: id }).catch(
          () => undefined,
        );
      }
    };
  }

  public onDisconnect(listener: (reason?: string) => void): Unsubscribe {
    this.#disconnectListeners.add(listener);
    return () => this.#disconnectListeners.delete(listener);
  }

  async #openAndAuthenticate(): Promise<void> {
    const socket = this.#factory(websocketUrl(this.#config.url));
    this.#socket = socket;

    await new Promise<void>((resolve, reject) => {
      let opened = false;
      let authenticated = false;

      const cleanupHandshake = (): void => {
        socket.removeEventListener('open', onOpen);
        socket.removeEventListener('error', onError);
      };
      const onOpen = (): void => {
        opened = true;
        this.#diagnostics.record('info', 'home-assistant.transport', 'WebSocket connected');
      };
      const onError = (): void => {
        if (!authenticated) {
          cleanupHandshake();
          reject(new Error('Unable to connect to Home Assistant WebSocket'));
        }
      };
      const onMessage = (event: WebSocketMessageEventLike): void => {
        const message = parseMessage(event.data);
        if (!message) return;
        if (message.type === 'auth_required') {
          socket.send(
            JSON.stringify({ type: 'auth', access_token: this.#config.accessToken }),
          );
          return;
        }
        if (message.type === 'auth_ok') {
          authenticated = true;
          cleanupHandshake();
          this.#diagnostics.record(
            'info',
            'home-assistant.transport',
            'WebSocket authenticated',
            { version: message.ha_version ?? 'unknown' },
          );
          resolve();
          return;
        }
        if (message.type === 'auth_invalid') {
          cleanupHandshake();
          reject(new Error(message.message ?? 'Home Assistant authentication failed'));
          return;
        }
        if (authenticated) this.#handleMessage(message);
      };
      const onClose = (event: WebSocketCloseEventLike): void => {
        this.#socket = undefined;
        this.#rejectPending(new Error(event.reason || 'Home Assistant WebSocket closed'));
        if (!authenticated && opened) {
          reject(
            new Error(event.reason || 'Home Assistant WebSocket closed during authentication'),
          );
        }
        if (!this.#intentionalClose) {
          for (const listener of [...this.#disconnectListeners]) listener(event.reason);
        }
      };

      socket.addEventListener('open', onOpen);
      socket.addEventListener('error', onError);
      socket.addEventListener('message', onMessage);
      socket.addEventListener('close', onClose);
    });
  }

  #handleMessage(message: IncomingMessage): void {
    if (message.type === 'event' && message.id !== undefined && message.event) {
      this.#subscriptions.get(message.id)?.listener(message.event);
      return;
    }
    if (message.type !== 'result' || message.id === undefined) return;
    const pending = this.#pending.get(message.id);
    if (!pending) return;
    this.#pending.delete(message.id);
    if (message.success === false) {
      pending.reject(
        new Error(
          message.error?.message ?? message.error?.code ?? 'Home Assistant request failed',
        ),
      );
    } else {
      pending.resolve(message.result);
    }
  }

  #rejectPending(error: Error): void {
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
  }
}
