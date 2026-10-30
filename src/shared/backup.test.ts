import { describe, expect, it } from 'vitest';
import { backupFromRecords, backupPathname, backupSchema, backupsToDelete } from './backup';

const rows = [
  { collection: 'transactions', id: 't1', data: { id: 't1', title: 'Café', amountCents: 850, type: 'expense', category: 'food', date: '2026-10-29', createdAt: '2026-10-29T10:00:00.000Z' } },
  { collection: 'goals', id: 'g1', data: { id: 'g1', title: 'TCC', horizon: 'medium', area: 'academic', createdAt: '2026-10-01T08:00:00.000Z' } },
  { collection: 'subtasks', id: 's2', data: { id: 's2', title: 'Escrever', done: false, order: 1, goalId: 'g1' } },
  { collection: 'subtasks', id: 's1', data: { id: 's1', title: 'Tema', done: true, order: 0, goalId: 'g1' } },
  { collection: 'habits', id: 'h1', data: { id: 'h1', title: 'Ler', area: 'routine', schedule: [0, 1, 2, 3, 4, 5, 6], archived: false, createdAt: '2026-10-01T08:00:00.000Z' } },
  { collection: 'habitLogs', id: 'h1:2026-10-05', data: { habitId: 'h1', date: '2026-10-05' } },
  { collection: 'habitLogs', id: 'h1:2026-10-06', data: { habitId: 'h1', date: '2026-10-06' } },
  { collection: 'settings', id: 'budgets', data: { food: 50000 } },
  // Lápide não entra.
  { collection: 'tasks', id: 'k1', data: null },
];

describe('backup a partir dos registros do servidor', () => {
  const backup = backupFromRecords(rows, '2026-11-01T06:00:00.000Z');

  it('passa no mesmo schema da importação do app', () => {
    const parsed = backupSchema.safeParse(JSON.parse(JSON.stringify(backup)));
    expect(parsed.success, parsed.error?.message).toBe(true);
  });

  it('junta etapas às metas e marcações aos hábitos', () => {
    expect(backup.personal.goals[0]?.subtasks.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(backup.personal.habits[0]?.completions).toEqual(['2026-10-05', '2026-10-06']);
    expect(backup.finance.budgets).toEqual({ food: 50000 });
    expect(backup.finance.transactions.map((t) => t.id)).toEqual(['t1']);
    expect(backup.personal.tasks).toEqual([]);
  });
});

describe('retenção', () => {
  const blob = (date: string) => ({ pathname: backupPathname(date), uploadedAt: new Date(`${date}T06:00:00Z`) });

  it('fica com as 8 mais novas e apaga o resto', () => {
    const dates = Array.from({ length: 10 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}-04`);
    const old = backupsToDelete(dates.map(blob).reverse());
    expect(old.map((b) => b.pathname)).toEqual([backupPathname('2026-02-04'), backupPathname('2026-01-04')]);
  });

  it('com até 8 cópias, não apaga nada', () => {
    expect(backupsToDelete([blob('2026-10-04'), blob('2026-10-11')])).toEqual([]);
  });
});
