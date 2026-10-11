import { describe, expect, it } from 'vitest';
import { billsOn, buildNotifications, DEFAULT_NOTIFY_PREFS, localDate, pendingHabits, type DigestRecord } from './digest';

const habit = (p: Record<string, unknown>) => ({ id: 'h', title: 'Ler', archived: false, schedule: [0, 1, 2, 3, 4, 5, 6], ...p });

describe('resumo das notificações', () => {
  it('"hoje" respeita o fuso do aparelho', () => {
    const now = new Date('2026-10-12T01:30:00Z'); // 22h30 de 11/10 em São Paulo
    expect(localDate(now, 'America/Sao_Paulo')).toBe('2026-10-11');
    expect(localDate(now, 'UTC')).toBe('2026-10-12');
  });

  it('hábitos pendentes: ignora feitos, pulados e semanais já cumpridos', () => {
    const habits = [
      habit({ id: 'a', title: 'Feito' }),
      habit({ id: 'b', title: 'Pulado' }),
      habit({ id: 'c', title: 'Água', kind: 'quantity', target: 8 }),
      habit({ id: 'd', title: 'Semanal ok', frequency: 'weekly', timesPerWeek: 1 }),
      habit({ id: 'e', title: 'Fora da agenda', schedule: [1] }),
    ];
    const logs = [
      { habitId: 'a', date: '2026-10-11' },
      { habitId: 'b', date: '2026-10-11', skip: 'Doente' },
      { habitId: 'c', date: '2026-10-11', value: 5 },
      { habitId: 'd', date: '2026-10-06' },
    ];
    expect(pendingHabits(habits, logs, '2026-10-11').map((h) => h.title)).toEqual(['Água']);
  });

  it('contas do dia: recorrência (dia 31 vira 30) e fatura', () => {
    const rules = [
      { title: 'Aluguel', amountCents: 185000, type: 'expense', active: true, dayOfMonth: 31, startDate: '2026-01-01' },
      { title: 'Salário', amountCents: 500000, type: 'income', active: true, dayOfMonth: 30, startDate: '2026-01-01' },
    ];
    const accounts = [{ name: 'Nubank', kind: 'credit', dueDay: 30, archived: false }];
    // O Intl usa espaço inseparável depois do "R$".
    const bills = billsOn(rules, accounts, '2026-09-30').map((b) => b.replace(/ /g, ' '));
    expect(bills).toEqual(['Aluguel (R$ 1.850,00)', 'Fatura Nubank']);
  });

  it('manhã: resumo do dia; noite de domingo: hábitos e revisão', () => {
    const records: DigestRecord[] = [
      { collection: 'tasks', data: { title: 'Dentista', status: 'todo', date: '2026-10-11', time: '09:30' } },
      { collection: 'habits', data: habit({}) },
    ];
    const morning = buildNotifications(records, '2026-10-11', 'morning', DEFAULT_NOTIFY_PREFS);
    expect(morning[0]?.body).toBe('Hoje: 1 tarefa · 1 hábito. Primeiro compromisso: Dentista às 09:30.');

    const evening = buildNotifications(records, '2026-10-11', 'evening', DEFAULT_NOTIFY_PREFS);
    expect(evening.map((n) => n.tag)).toEqual(['sisifo-evening', 'sisifo-review']);
    expect(buildNotifications(records, '2026-10-11', 'evening', { ...DEFAULT_NOTIFY_PREFS, evening: false, review: false })).toEqual([]);
  });
});
