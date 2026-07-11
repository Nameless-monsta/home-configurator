import { describe, expect, it } from 'vitest';
import { ServiceContainer, ServiceResolutionError, createServiceToken } from '../src/index.js';

describe('ServiceContainer', () => {
  it('resolves singleton services once', () => {
    const token = createServiceToken<{ id: number }>('test.singleton');
    const container = new ServiceContainer();
    let created = 0;
    container.registerFactory(token, () => ({ id: ++created }));

    expect(container.resolve(token)).toBe(container.resolve(token));
    expect(created).toBe(1);
  });

  it('detects circular dependencies', () => {
    const left = createServiceToken<string>('left');
    const right = createServiceToken<string>('right');
    const container = new ServiceContainer();
    container.registerFactory(left, (services) => services.resolve(right));
    container.registerFactory(right, (services) => services.resolve(left));

    expect(() => container.resolve(left)).toThrow(ServiceResolutionError);
  });
});
