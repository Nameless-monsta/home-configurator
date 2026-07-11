import { describe, expect, it } from 'vitest';

import { classifyLayout } from '../src/layout.js';

describe('classifyLayout', () => {
  it('returns compact for phone widths', () => {
    expect(classifyLayout(390)).toBe('compact');
  });

  it('returns regular for tablet widths', () => {
    expect(classifyLayout(1024)).toBe('regular');
  });

  it('returns wide for desktop widths', () => {
    expect(classifyLayout(1440)).toBe('wide');
  });
});
