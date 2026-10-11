import { describe, expect, it } from 'vitest';
import {
  accountBalances,
  cardInvoices,
  invoiceDueDate,
  invoiceMonthOf,
  liquidBalance,
  netWorth,
  splitInstallments,
} from './accounts';
import { monthForecast, upcomingItems } from './forecast';
import type { Account, RecurringRule, Transaction } from './types';

const main: Account = { id: 'main', name: 'Conta', kind: 'checking', initialBalanceCents: 100000, archived: false };
const savings: Account = { id: 'sav', name: 'Reserva', kind: 'savings', initialBalanceCents: 0, archived: false };
const invest: Account = { id: 'inv', name: 'Corretora', kind: 'investment', initialBalanceCents: 50000, archived: false };
const card: Account = {
  id: 'card',
  name: 'Cartão',
  kind: 'credit',
  initialBalanceCents: 0,
  closingDay: 3,
  dueDay: 10,
  archived: false,
};
const accounts = [main, savings, invest, card];

let n = 0;
const tx = (p: Partial<Transaction> & Pick<Transaction, 'type' | 'amountCents' | 'date'>): Transaction => ({
  id: `t${n++}`,
  title: 't',
  category: p.type === 'income' ? 'salary' : p.type === 'transfer' ? 'transfer' : 'food',
  createdAt: '2026-01-01T00:00:00Z',
  ...p,
});

describe('saldos por conta', () => {
  const data = [
    tx({ type: 'income', amountCents: 500000, date: '2026-10-05' }), // sem conta: principal
    tx({ type: 'expense', amountCents: 20000, date: '2026-10-06', accountId: 'card' }),
    tx({ type: 'transfer', amountCents: 80000, date: '2026-10-07', toAccountId: 'sav' }),
    tx({ type: 'expense', amountCents: 999, date: '2026-12-01' }), // futuro
  ];

  it('soma saldo inicial e efeitos; transferência sai de uma e entra na outra', () => {
    const b = accountBalances(accounts, data, '2026-10-31');
    expect(b.get('main')).toBe(100000 + 500000 - 80000);
    expect(b.get('sav')).toBe(80000);
    expect(b.get('card')).toBe(-20000);
    expect(b.get('inv')).toBe(50000);
  });

  it('disponível ignora investimentos e cartão; patrimônio soma tudo', () => {
    expect(liquidBalance(accounts, data, '2026-10-31')).toBe(520000 + 80000);
    expect(netWorth(accounts, data, '2026-10-31')).toBe(520000 + 80000 + 50000 - 20000);
  });
});

describe('fatura do cartão', () => {
  it('compra até o fechamento cai na fatura do mês; depois, na seguinte', () => {
    expect(invoiceMonthOf('2026-10-03', 3)).toBe('2026-10');
    expect(invoiceMonthOf('2026-10-04', 3)).toBe('2026-11');
    expect(invoiceMonthOf('2026-02-28', 31)).toBe('2026-02');
  });

  it('vencimento antes do fechamento cai no mês seguinte', () => {
    expect(invoiceDueDate('2026-10', 3, 10)).toBe('2026-10-10');
    expect(invoiceDueDate('2026-10', 25, 5)).toBe('2026-11-05');
  });

  it('pagamentos quitam as faturas mais antigas primeiro', () => {
    const data = [
      tx({ type: 'expense', amountCents: 30000, date: '2026-09-10', accountId: 'card' }), // fatura 10
      tx({ type: 'expense', amountCents: 10000, date: '2026-10-05', accountId: 'card' }), // fatura 11
      tx({ type: 'transfer', amountCents: 30000, date: '2026-10-10', toAccountId: 'card' }),
    ];
    const [oct, nov] = cardInvoices(card, data, '2026-10-20');
    expect(oct).toMatchObject({ month: '2026-10', totalCents: 30000, paidCents: 30000, status: 'paid' });
    expect(nov).toMatchObject({ month: '2026-11', totalCents: 10000, remainingCents: 10000, status: 'open' });
  });

  it('fatura fechada e não paga depois do vencimento fica atrasada', () => {
    const data = [tx({ type: 'expense', amountCents: 5000, date: '2026-09-20', accountId: 'card' })];
    expect(cardInvoices(card, data, '2026-10-05')[0]?.status).toBe('closed');
    expect(cardInvoices(card, data, '2026-10-11')[0]?.status).toBe('overdue');
  });

  it('parcelas dividem o total sem perder centavos', () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(splitInstallments(10000, 3).reduce((a, b) => a + b)).toBe(10000);
  });
});

describe('previsão do mês', () => {
  const rules: RecurringRule[] = [
    { id: 'sal', title: 'Salário', amountCents: 500000, type: 'income', category: 'salary', dayOfMonth: 5, startDate: '2026-01-01', active: true },
    { id: 'alu', title: 'Aluguel', amountCents: 150000, type: 'expense', category: 'housing', dayOfMonth: 25, startDate: '2026-01-01', active: true },
    { id: 'net', title: 'Internet', amountCents: 10000, type: 'expense', category: 'housing', dayOfMonth: 28, startDate: '2026-01-01', active: true, skippedMonths: ['2026-10'] },
  ];
  const data = [
    tx({ type: 'income', amountCents: 500000, date: '2026-10-05', recurringId: 'sal', id: 'rec-sal-2026-10' }),
    tx({ type: 'expense', amountCents: 40000, date: '2026-10-08' }), // variável
    tx({ type: 'expense', amountCents: 20000, date: '2026-10-09', accountId: 'card' }), // fatura 11, vence em 10/11
  ];

  it('lista o que ainda vem: recorrências não lançadas (sem as puladas)', () => {
    const items = upcomingItems(accounts, data, rules, '2026-10-11', '2026-10-31');
    expect(items.map((i) => i.title)).toEqual(['Aluguel']);
  });

  it('faturas a vencer entram na lista e no saldo previsto', () => {
    const items = upcomingItems(accounts, data, rules, '2026-11-01', '2026-11-30');
    expect(items.find((i) => i.source === 'invoice')).toMatchObject({ date: '2026-11-10', amountCents: 20000 });
  });

  it('saldo previsto e quanto dá para gastar por dia', () => {
    const f = monthForecast(accounts, data, rules, '2026-10-11', 100000);
    expect(f.liquidNowCents).toBe(100000 + 500000 - 40000);
    expect(f.projectedEndCents).toBe(560000 - 150000);
    expect(f.daysLeft).toBe(21);
    // receita 5000 − fixas 1500 (aluguel) − variáveis 400 + 200 (cartão) − poupança 1000
    expect(f.budget).toEqual({ incomeCents: 500000, fixedCents: 150000, variableSpentCents: 60000, savingsCents: 100000 });
    expect(f.dailyAllowanceCents).toBe(Math.floor((500000 - 150000 - 60000 - 100000) / 21));
  });
});
