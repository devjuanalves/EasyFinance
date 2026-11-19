import { describe, it, expect } from 'vitest';
import { decimalToMinor, formatMinor } from '../persistentApi.js';
describe('persistent monetary boundary', () => {
  it('converts decimals without binary rounding and formats exact large integers', () => {
    expect(decimalToMinor('-12.34')).toBe('-1234');
    expect(decimalToMinor('0.01')).toBe('1');
    expect(decimalToMinor('90071992547409.91')).toBe('9007199254740991');
    expect(formatMinor('9007199254740991', 'AUD')).toBe(
      'AUD 90,071,992,547,409.91',
    );
  });
  it('rejects exponent, excess precision and unsafe amounts', () => {
    for (const value of ['1e4', '1.001', '', '90071992547409.92'])
      expect(() => decimalToMinor(value)).toThrow();
  });
});
