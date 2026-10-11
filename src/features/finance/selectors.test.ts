import { describe, expect, it } from 'vitest';
import {
  balanceUpTo,
  budgetStatus,
  expensesByCategory,
  materializeRecurring,
  recurringMonthOf,
  skippedRecurringIds,
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

describe('materializeRecurring entre aparelhos', () => {
  it('gera o mesmo id para a mesma regra e mês', () => {
    const rule: RecurringRule = {
      id: 'r9',
      title: 'Internet',
      amountCents: 9990,
      type: 'expense',
      category: 'housing',
      dayOfMonth: 15,
      startDate: '2026-09-01',
      active: true,
    };
    const a = materializeRecurring([rule], [], '2026-10-20').map((t) => t.id);
    const b = materializeRecurring([rule], [], '2026-10-20').map((t) => t.id);
    expect(a).toEqual(['rec-r9-2026-09', 'rec-r9-2026-10']);
    expect(b).toEqual(a);
  });
});

describe('budgetStatus com categorias editáveis', () => {
  it('segue a ordem das categorias e inclui categorias criadas', () => {
    const extra = [...data, tx({ date: '2026-10-09', amountCents: 9000, type: 'expense', category: 'pets' })];
    const status = budgetStatus(extra, { pets: 10000, food: 100000 }, '2026-10', ['food', 'pets']);
    expect(status.map((s) => s.category)).toEqual(['food', 'pets']);
    expect(status[1]).toMatchObject({ spentCents: 9000, level: 'warning' });
  });

  it('limite de categoria fora da ordem (ex.: excluída) vem no fim', () => {
    const status = budgetStatus(data, { sumiu: 100, food: 100000 }, '2026-10', ['food']);
    expect(status.map((s) => s.category)).toEqual(['food', 'sumiu']);
  });
});

describe('lançamento recorrente excluído', () => {
  const rule: RecurringRule = {
    id: 'r1',
    title: 'Aluguel',
    amountCents: 100000,
    type: 'expense',
    category: 'housing',
    dayOfMonth: 10,
    startDate: '2026-08-01',
    active: true,
  };

  it('não é gerado de novo quando o mês está em skippedMonths', () => {
    const all = materializeRecurring([rule], [], '2026-10-20');
    const withoutSept = all.filter((t) => t.date !== '2026-09-10');
    const skipping = { ...rule, skippedMonths: ['2026-09'] };
    expect(materializeRecurring([skipping], withoutSept, '2026-10-20')).toHaveLength(0);
    // Sem o mês pulado (comportamento antigo), ele voltaria.
    expect(materializeRecurring([rule], withoutSept, '2026-10-20').map((t) => t.date)).toEqual(['2026-09-10']);
  });

  it('mudar a data do lançamento gerado não faz o mês ser gerado de novo', () => {
    const [aug] = materializeRecurring([rule], [], '2026-08-31');
    const moved = { ...aug!, date: '2026-09-02' };
    expect(recurringMonthOf(moved)).toBe('2026-08');
    expect(materializeRecurring([rule], [moved], '2026-08-31')).toHaveLength(0);
  });

  it('aponta o lançamento que outro aparelho recriou para um mês pulado', () => {
    const all = materializeRecurring([rule], [], '2026-10-20');
    const skipping = { ...rule, skippedMonths: ['2026-09'] };
    expect(skippedRecurringIds([skipping], all)).toEqual(['rec-r1-2026-09']);
    expect(skippedRecurringIds([rule], all)).toEqual([]);
  });
});
