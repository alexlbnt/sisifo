import { describe, expect, it } from 'vitest';
import {
  balanceUpTo,
  budgetStatus,
  expensesByCategory,
  materializeRecurring,
  summarizeMonth,
} from './selectors';
import type { RecurringRule, Transaction } from './types';

const tx = (p: Partial<Transaction> & Pick<Transaction, 'date' | 'amountCents' | 'type'>): Transaction => ({
  id: Math.random().toString(36),
  title: 't',
  category: p.type === 'income' ? 'salary' : 'food',
  createdAt: '2026-01-01T00:00:00Z',
  ...p,
});

const data: Transaction[] = [
  tx({ date: '2026-09-05', amountCents: 500000, type: 'income' }),
  tx({ date: '2026-09-10', amountCents: 150000, type: 'expense', category: 'housing' }),
  tx({ date: '2026-09-12', amountCents: 50000, type: 'expense', category: 'food' }),
  tx({ date: '2026-10-05', amountCents: 500000, type: 'income' }),
  tx({ date: '2026-10-08', amountCents: 120000, type: 'expense', category: 'food' }),
];

describe('summarizeMonth', () => {
  it('soma receitas, despesas e taxa de poupança', () => {
    expect(summarizeMonth(data, '2026-09')).toEqual({
      incomeCents: 500000,
      expenseCents: 200000,
      netCents: 300000,
      savingsRate: 0.6,
    });
  });

  it('taxa nula sem receita', () => {
    expect(summarizeMonth(data, '2026-08').savingsRate).toBeNull();
  });
});

describe('balanceUpTo', () => {
  it('ignora lançamentos futuros', () => {
    expect(balanceUpTo(data, '2026-09-30')).toBe(300000);
    expect(balanceUpTo(data, '2026-10-31')).toBe(680000);
  });
});

describe('expensesByCategory', () => {
  it('ordena por valor e calcula participação', () => {
    const slices = expensesByCategory(data, '2026-09');
    expect(slices.map((s) => s.category)).toEqual(['housing', 'food']);
    expect(slices[0]!.share).toBeCloseTo(0.75);
  });
});

describe('budgetStatus', () => {
  it('classifica por nível de uso', () => {
    const status = budgetStatus(data, { food: 100000, housing: 200000 }, '2026-10');
    expect(status.find((s) => s.category === 'food')?.level).toBe('over');
    expect(status.find((s) => s.category === 'housing')?.level).toBe('ok');
  });
});

describe('materializeRecurring', () => {
  const rule: RecurringRule = {
    id: 'r1',
    title: 'Aluguel',
    amountCents: 100000,
    type: 'expense',
    category: 'housing',
    dayOfMonth: 31,
    startDate: '2026-01-15',
    active: true,
  };

  it('gera um lançamento por mês até hoje, ajustando o dia', () => {
    const created = materializeRecurring([rule], [], '2026-03-10');
    expect(created.map((t) => t.date)).toEqual(['2026-01-31', '2026-02-28']);
  });

  it('é idempotente', () => {
    const first = materializeRecurring([rule], [], '2026-03-31');
    expect(materializeRecurring([rule], first, '2026-03-31')).toHaveLength(0);
  });

  it('ignora regras inativas', () => {
    expect(materializeRecurring([{ ...rule, active: false }], [], '2026-05-01')).toHaveLength(0);
  });
});
