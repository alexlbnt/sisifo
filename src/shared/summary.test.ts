import { describe, expect, it } from 'vitest';
import type { DigestRecord } from './digest';
import { daySummary, summaryText, widgetSummary } from './summary';

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

describe('resumo do widget', () => {
  const today = '2026-10-30';
  const tz = 'America/Sao_Paulo';
  /** 30/10/2026 às 10h em Brasília (UTC−3). */
  const now = Date.parse('2026-10-30T13:00:00Z');
  const at = (hhmm: string) => Date.parse(`2026-10-30T${hhmm}:00-03:00`);
  const records: DigestRecord[] = [
    { collection: 'transactions', data: { amountCents: 300000, type: 'income', date: '2026-10-01' } },
    { collection: 'tasks', data: { title: 'Mercado', status: 'todo', date: today } },
    { collection: 'tasks', data: { title: 'Dentista', status: 'todo', date: today, time: '14:00' } },
    { collection: 'tasks', data: { title: 'Ligar pro banco', status: 'todo', date: today, time: '09:00' } },
    { collection: 'tasks', data: { title: 'Feita', status: 'done', date: today, time: '08:00' } },
    { collection: 'tasks', data: { title: 'Ontem', status: 'todo', date: '2026-10-29' } },
    { collection: 'habits', data: { id: 'h1', title: 'Ler', archived: false, schedule: [0, 1, 2, 3, 4, 5, 6] } },
  ];
  const s = daySummary(records, today);

  it('conta o que falta e lista as próximas tarefas, com horário primeiro', () => {
    const w = widgetSummary(s, records, today, now, tz, null);
    expect(w).toMatchObject({ v: 1, today, tasks: 3, overdue: 1, habits: 1, pendingHabits: ['Ler'] });
    expect(w.nextTasks).toEqual([{ title: 'Ligar pro banco', time: '09:00' }, { title: 'Dentista', time: '14:00' }, { title: 'Mercado' }]);
    expect(w.allowanceCents).toBe(Math.floor(300000 / 2));
    expect(w.allowance).toBe('R$ 1.500,00');
  });

  it('sem agenda, o próximo compromisso é a próxima tarefa com horário', () => {
    expect(widgetSummary(s, records, today, now, tz, null).next).toEqual({ time: '14:00', title: 'Dentista' });
  });

  it('com agenda, o próximo evento que ainda não acabou; sem evento com hora, o de dia todo', () => {
    const events = [
      { id: 'a', title: 'Reunião cedo', start: at('08:00'), end: at('09:00'), allDay: false },
      { id: 'b', title: 'Aniversário da Ana', start: at('00:00'), end: at('23:59'), allDay: true },
      { id: 'c', title: 'Aula', start: at('19:30'), end: at('21:00'), allDay: false },
    ];
    expect(widgetSummary(s, records, today, now, tz, events).next).toEqual({ time: '19:30', title: 'Aula' });
    expect(widgetSummary(s, records, today, now, tz, [events[1]!]).next).toEqual({ time: 'dia todo', title: 'Aniversário da Ana' });
  });

  it('linha curta para a tela de bloqueio', () => {
    expect(widgetSummary(s, records, today, now, tz, null).line).toBe('3 tarefas · 1 hábito · R$ 1.500 hoje');
    const done = daySummary([], today);
    expect(widgetSummary(done, [], today, now, tz, null).line).toBe('Tudo feito');
  });
});
