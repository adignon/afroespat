import { describe, expect, it } from 'vitest';
import { rangFr } from '../rang';

describe('le rang en français', () => {
  it('1re, 2e, 12e', () => {
    expect(rangFr(1)).toBe('1re');
    expect(rangFr(2)).toBe('2e');
    expect(rangFr(12)).toBe('12e');
  });
});
