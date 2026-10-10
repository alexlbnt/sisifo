import { describe, expect, it } from 'vitest';
import { centsToInput, parseBRL } from './money';

describe('parseBRL', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1234.56', 123456],
    ['1234', 123400],
    ['R$ 12,5', 1250],
    ['1.000', 100000],
    ['0,99', 99],
  ])('%s -> %i', (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });

  it.each(['', 'abc', '12,345', '-5', '1,2,3'])('rejeita %s', (input) => {
    expect(parseBRL(input)).toBeNull();
  });

  it('ida e volta com centsToInput', () => {
    expect(parseBRL(centsToInput(98765))).toBe(98765);
  });
});
