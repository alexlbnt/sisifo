import { beforeEach, describe, expect, it } from 'vitest';
import { nextOccurrence, nthWeekdayOfMonth, repeatLabel } from './recurrence';
import { computeStreak, goalMetrics, isDueOn, sortTasks } from './selectors';
import { usePersonalStore } from './store';
import type { Goal, Habit, Task } from './types';

describe('repetição de tarefas', () => {
  it('diária, dias úteis e semanal', () => {
    expect(nextOccurrence({ freq: 'daily' }, '2026-10-11')).toBe('2026-10-12');
    expect(nextOccurrence({ freq: 'weekdays' }, '2026-10-09')).toBe('2026-10-12'); // sexta → segunda
    expect(nextOccurrence({ freq: 'weekly', weekdays: [1, 4] }, '2026-10-12')).toBe('2026-10-15');
  });

  it('mensal ajusta o dia em meses curtos', () => {
    expect(nextOccurrence({ freq: 'monthly', day: 31 }, '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrence({ freq: 'monthly', day: 10 }, '2026-10-05')).toBe('2026-10-10');
  });

  it('toda primeira segunda e última sexta do mês', () => {
    expect(nthWeekdayOfMonth('2026-10', 1, 1)).toBe('2026-10-05');
    expect(nthWeekdayOfMonth('2026-10', -1, 5)).toBe('2026-10-30');
    expect(nextOccurrence({ freq: 'monthlyNth', nth: 1, weekday: 1 }, '2026-10-05')).toBe('2026-11-02');
    expect(repeatLabel({ freq: 'monthlyNth', nth: 1, weekday: 1 })).toBe('Toda primeira segunda do mês');
    expect(repeatLabel({ freq: 'weekly', weekdays: [0] })).toBe('Todo domingo');
  });
});

const baseHabit: Habit = {
  id: 'h',
  title: 'H',
  area: 'routine',
  schedule: [0, 1, 2, 3, 4, 5, 6],
  completions: [],
  archived: false,
  createdAt: '2026-09-01T08:00:00.000Z',
};

describe('hábitos', () => {
  it('dia pulado não quebra nem soma na sequência', () => {
    const h = { ...baseHabit, completions: ['2026-10-08', '2026-10-10'], skips: { '2026-10-09': 'Doente' } };
    expect(computeStreak(h, '2026-10-10').current).toBe(2);
    expect(isDueOn(h, '2026-10-09')).toBe(false);
  });

  it('X vezes por semana conta semanas seguidas', () => {
    const h: Habit = {
      ...baseHabit,
      frequency: 'weekly',
      timesPerWeek: 2,
      // semana de 28/9: 2x; semana de 5/10: 2x; semana atual (12/10): 1x, ainda em andamento
      completions: ['2026-09-29', '2026-10-01', '2026-10-06', '2026-10-09', '2026-10-12'],
    };
    const streak = computeStreak(h, '2026-10-13');
    expect(streak).toMatchObject({ current: 2, unit: 'weeks' });
    expect(isDueOn(h, '2026-10-13')).toBe(true);
    expect(isDueOn({ ...h, completions: [...h.completions, '2026-10-13'] }, '2026-10-14')).toBe(false);
  });
});

describe('store: hábitos de quantidade e pular', () => {
  beforeEach(() => {
    usePersonalStore.setState({
      habits: [{ ...baseHabit, kind: 'quantity', target: 8, unit: 'copos' }],
    });
  });
  const habit = () => usePersonalStore.getState().habits[0]!;

  it('quantidade abaixo da meta não conta como feito; atingir a meta conta', () => {
    usePersonalStore.getState().setHabitAmount('h', '2026-10-11', 5);
    expect(habit().completions).toEqual([]);
    expect(habit().amounts).toEqual({ '2026-10-11': 5 });
    usePersonalStore.getState().setHabitAmount('h', '2026-10-11', 8);
    expect(habit().completions).toEqual(['2026-10-11']);
  });

  it('baixar a meta recalcula os dias feitos', () => {
    usePersonalStore.getState().setHabitAmount('h', '2026-10-11', 5);
    const { title, area, schedule } = habit();
    usePersonalStore.getState().updateHabit('h', { title, area, schedule, kind: 'quantity', target: 5 });
    expect(habit().completions).toEqual(['2026-10-11']);
  });

  it('pular apaga a marcação do dia; marcar de novo desfaz o pulo', () => {
    usePersonalStore.getState().toggleHabitDay('h', '2026-10-11');
    usePersonalStore.getState().setHabitSkip('h', '2026-10-11', 'Viagem');
    expect(habit()).toMatchObject({ completions: [], skips: { '2026-10-11': 'Viagem' } });
    usePersonalStore.getState().toggleHabitDay('h', '2026-10-11');
    expect(habit().skips).toBeUndefined();
    expect(habit().completions).toEqual(['2026-10-11']);
  });
});

describe('store: tarefa que se repete', () => {
  beforeEach(() => usePersonalStore.setState({ tasks: [] }));

  it('concluir cria a próxima (uma vez só, com id determinístico)', () => {
    const s = usePersonalStore.getState();
    s.addTask({ title: 'Pagar luz', area: 'routine', date: '2026-10-10', repeat: { freq: 'monthly', day: 10 } });
    const first = usePersonalStore.getState().tasks[0]!;
    s.toggleTask(first.id);
    s.toggleTask(first.id); // desmarcar
    s.toggleTask(first.id); // concluir de novo: não duplica
    const tasks = usePersonalStore.getState().tasks;
    expect(tasks).toHaveLength(2);
    expect(tasks[1]).toMatchObject({ id: `${first.id}~2026-11-10`, date: '2026-11-10', status: 'todo', seriesId: first.id });
  });
});

describe('ordem das tarefas', () => {
  const t = (id: string, p: Partial<Task>): Task => ({
    id,
    title: id,
    area: 'routine',
    status: 'todo',
    date: '2026-10-11',
    createdAt: '2026-10-11T00:00:00Z',
    ...p,
  });
  it('pendentes, prioridade alta primeiro, depois horário', () => {
    const sorted = sortTasks([
      t('feita', { status: 'done', priority: 'high' }),
      t('sem', {}),
      t('tarde', { time: '18:00' }),
      t('alta', { priority: 'high' }),
      t('cedo', { time: '08:00' }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(['alta', 'cedo', 'tarde', 'sem', 'feita']);
  });
});

describe('metas numéricas e de poupança', () => {
  const goal = (p: Partial<Goal>): Goal => ({
    id: 'g',
    title: 'G',
    horizon: 'short',
    area: 'routine',
    subtasks: [],
    createdAt: '2026-07-01T00:00:00Z',
    ...p,
  });

  it('soma dos registros (livros lidos)', () => {
    const g = goal({ kind: 'numeric', target: 12, measure: 'sum' });
    const entries = [1, 1, 1].map((value, i) => ({ id: `e${i}`, goalId: 'g', date: `2026-0${7 + i}-15`, value }));
    expect(goalMetrics(g, entries, { today: '2026-10-11' })).toMatchObject({ current: 3, remaining: 9, progress: 0.25 });
  });

  it('último registro, meta para baixo (peso)', () => {
    const g = goal({ kind: 'numeric', target: 75, start: 80, measure: 'last' });
    const entries = [
      { id: 'a', goalId: 'g', date: '2026-08-01', value: 79 },
      { id: 'b', goalId: 'g', date: '2026-10-01', value: 78 },
    ];
    expect(goalMetrics(g, entries, { today: '2026-10-11' })).toMatchObject({ current: 78, remaining: 3, progress: 0.4 });
  });

  it('poupança ligada a uma conta usa o saldo e calcula o ritmo', () => {
    const g = goal({ kind: 'savings', target: 1_200_000, accountId: 'sav', deadline: '2027-04-11' });
    // saldo cresce 100 mil por mês
    const balance = (_: string, upTo: string) => (Number(upTo.slice(5, 7)) + (upTo.startsWith('2027') ? 12 : 0)) * 100_000;
    const m = goalMetrics(g, [], { today: '2026-10-11', accountBalance: balance });
    expect(m.current).toBe(1_000_000);
    expect(m.remaining).toBe(200_000);
    expect(m.pace?.neededPerMonth).toBeCloseTo(200_000 / (182 / 30.44), 0);
    expect(m.pace?.onTrack).toBe(true);
  });
});
