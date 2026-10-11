import { describe, expect, it } from 'vitest';
import { centsToInput, parseAmount, parseBRL } from './money';

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

describe('parseAmount', () => {
  it('soma e subtrai valores no formato brasileiro', () => {
    expect(parseAmount('12+8,50')).toBe(2050);
    expect(parseAmount('1.200 - 200,50')).toBe(99950);
    expect(parseAmount('R$ 30')).toBe(3000);
  });
  it('rejeita expressões incompletas', () => {
    expect(parseAmount('12+')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});
