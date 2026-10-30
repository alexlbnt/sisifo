import { describe, expect, it } from 'vitest';
import { boulderAt } from './summit';

describe('boulderAt', () => {
  it('sem itens, fica no pé', () => expect(boulderAt(0, 0)).toEqual({ t: 0, x: 0, y: 0.86 }));
  it('tudo feito, fica no topo', () => expect(boulderAt(7, 7)).toMatchObject({ t: 1, x: 1, y: 0.4 }));
  it('mais feitos que o total não passa do topo', () => expect(boulderAt(9, 7).t).toBe(1));
  it('meio caminho fica na linha', () => {
    const p = boulderAt(1, 2);
    expect(p.x).toBeCloseTo(0.5);
    expect(p.y).toBeCloseTo(0.63);
  });
});
