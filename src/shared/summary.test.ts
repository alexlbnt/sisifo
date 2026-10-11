import { describe, expect, it } from 'vitest';
import type { DigestRecord } from './digest';
import { daySummary, summaryText } from './summary';

describe('resumo do Atalho', () => {
  const records: DigestRecord[] = [
    { collection: 'accounts', data: { id: 'main', kind: 'checking', initialBalanceCents: 100000 } },
    { collection: 'accounts', data: { id: 'card', kind: 'credit', initialBalanceCents: 0 } },
    { collection: 'transactions', data: { amountCents: 500000, type: 'income', date: '2026-10-05' } },
    { collection: 'transactions', data: { amountCents: 30000, type: 'expense', date: '2026-10-08' } },
    { collection: 'transactions', data: { amountCents: 20000, type: 'expense', date: '2026-10-09', accountId: 'card' } },
    {
      collection: 'recurring',
      data: { id: 'alu', title: 'Aluguel', amountCents: 150000, type: 'expense', active: true, dayOfMonth: 12, startDate: '2026-01-01' },
    },
    { collection: 'tasks', data: { status: 'todo', date: '2026-10-11' } },
    { collection: 'tasks', data: { status: 'todo', date: '2026-10-01' } },
  ];

  it('saldo disponível ignora o cartão; valor diário desconta o que ainda vence', () => {
    const s = daySummary(records, '2026-10-11');
    expect(s.liquidCents).toBe(100000 + 500000 - 30000);
    // (5000 − 300 − 200 − 1500 do aluguel do dia 12) ÷ 21 dias
    expect(s.dailyAllowanceCents).toBe(Math.floor((500000 - 50000 - 150000) / 21));
    expect(s.billsTomorrow).toHaveLength(1);
  });

  it('texto em linhas curtas, sem espaço inseparável', () => {
    const text = summaryText(daySummary(records, '2026-10-11'));
    expect(text).toBe(
      'Disponível: R$ 5.700,00 · dá para gastar R$ 142,85 hoje\nFalta hoje: 1 tarefa\n1 tarefa atrasada\nVence amanhã: Aluguel (R$ 1.500,00)',
    );
  });
});
