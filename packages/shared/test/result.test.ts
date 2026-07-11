import { describe, expect, it } from 'vitest';

import { err, ok } from '../src/index.js';

describe('Result helpers', () => {
  it('creates a successful result', () => {
    expect(ok('ready')).toEqual({ ok: true, value: 'ready' });
  });

  it('creates a failed result', () => {
    const error = new Error('failed');
    expect(err(error)).toEqual({ ok: false, error });
  });
});
