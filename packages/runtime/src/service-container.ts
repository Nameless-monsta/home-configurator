import type { ServiceToken } from './tokens.js';

export type ServiceFactory<T> = (container: ServiceContainer) => T;

interface Registration<T> {
  readonly factory: ServiceFactory<T>;
  readonly singleton: boolean;
  instance?: T;
}

export class ServiceResolutionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ServiceResolutionError';
  }
}

export class ServiceContainer {
  readonly #registrations = new Map<symbol, Registration<unknown>>();
  readonly #resolving: symbol[] = [];

  public registerValue<T>(token: ServiceToken<T>, value: T): this {
    return this.registerFactory(token, () => value, true);
  }

  public registerFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    singleton = true,
  ): this {
    if (this.#registrations.has(token.key)) {
      throw new ServiceResolutionError(`Service already registered: ${token.description}`);
    }

    this.#registrations.set(token.key, { factory, singleton });
    return this;
  }

  public replaceValue<T>(token: ServiceToken<T>, value: T): this {
    this.#registrations.delete(token.key);
    return this.registerValue(token, value);
  }

  public has<T>(token: ServiceToken<T>): boolean {
    return this.#registrations.has(token.key);
  }

  public resolve<T>(token: ServiceToken<T>): T {
    const registration = this.#registrations.get(token.key) as Registration<T> | undefined;
    if (!registration) {
      throw new ServiceResolutionError(`Service not registered: ${token.description}`);
    }

    if (registration.singleton && 'instance' in registration) {
      return registration.instance;
    }

    if (this.#resolving.includes(token.key)) {
      const chain = [...this.#resolving, token.key]
        .map((key) => key.description ?? 'unknown')
        .join(' -> ');
      throw new ServiceResolutionError(`Circular service dependency: ${chain}`);
    }

    this.#resolving.push(token.key);
    try {
      const instance = registration.factory(this);
      if (registration.singleton) {
        registration.instance = instance;
      }
      return instance;
    } finally {
      this.#resolving.pop();
    }
  }

  public resolvedInstances(): readonly unknown[] {
    return [...this.#registrations.values()]
      .filter((registration) => 'instance' in registration)
      .map((registration) => registration.instance);
  }
}
