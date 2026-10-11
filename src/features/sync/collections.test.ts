import { describe, expect, it } from 'vitest';
import { defaultCategories } from '@/features/finance/defaultCategories';
import type { FinanceState } from '@/features/finance/types';
import { defaultAreas } from '@/features/personal/defaultAreas';
import type { Goal, Habit, PersonalState } from '@/features/personal/types';
import type { CollectionName } from '@/shared/sync';
import { rebuild, recordKey, toRecords, type LocalRecord } from './collections';
import { detectChanges } from './diff';

const finance = (): FinanceState => ({
  transactions: [],
  recurring: [],
  categories: defaultCategories(),
  budgets: { food: 50000 },
});

const habit = (completions: string[]): Habit => ({
  id: 'h1',
  title: 'Ler',
  area: 'routine',
  schedule: [0, 1, 2, 3, 4, 5, 6],
  completions,
  archived: false,
  createdAt: '2026-10-01T08:00:00.000Z',
});

const goal = (subtasks: Goal['subtasks']): Goal => ({
  id: 'g1',
  title: 'TCC',
  horizon: 'medium',
  area: 'academic',
  subtasks,
  createdAt: '2026-10-01T08:00:00.000Z',
});

const personal = (p: Partial<PersonalState> = {}): PersonalState => ({
  areas: defaultAreas(),
  goals: [],
  tasks: [],
  habits: [],
  workoutPlans: [],
  workoutSessions: [],
  ...p,
});

const rec = (collection: CollectionName, id: string, data: unknown): [string, LocalRecord] => [
  recordKey(collection, id),
  { collection, id, data },
];

/** Simula o servidor: junta os registros dos aparelhos; o último a escrever vence por registro. */
const server = (...devices: Map<string, LocalRecord>[]) => new Map(devices.flatMap((d) => [...d]));

describe('toRecords / rebuild', () => {
  it('ida e volta não altera o estado', () => {
    const p = personal({
      goals: [goal([
        { id: 's1', title: 'Tema', done: true, order: 0 },
        { id: 's2', title: 'Escrever', done: false, order: 1 },
      ])],
      habits: [habit(['2026-10-05', '2026-10-06'])],
    });
    const back = rebuild(toRecords(finance(), p));
    expect(back.personal).toEqual(p);
    expect(back.finance).toEqual(finance());
    expect(back.orphans.size).toBe(0);
  });

  it('meta e hábito sobem sem etapas e marcações; cada uma vira um registro', () => {
    const records = toRecords(finance(), personal({
      goals: [goal([{ id: 's1', title: 'Tema', done: true, order: 0 }])],
      habits: [habit(['2026-10-05'])],
    }));
    expect(records.get('goals|g1')?.data).not.toHaveProperty('subtasks');
    expect(records.get('habits|h1')?.data).not.toHaveProperty('completions');
    expect(records.get('subtasks|s1')?.data).toMatchObject({ goalId: 'g1', done: true });
    expect(records.get('habitLogs|h1:2026-10-05')?.data).toEqual({ habitId: 'h1', date: '2026-10-05' });
  });
});

describe('alterações em aparelhos diferentes não se apagam', () => {
  it('hábito marcado em dias diferentes no celular e no computador', () => {
    const phone = toRecords(finance(), personal({ habits: [habit(['2026-10-05'])] }));
    const desktop = toRecords(finance(), personal({ habits: [habit(['2026-10-06'])] }));
    const merged = rebuild(server(phone, desktop));
    expect(merged.personal.habits[0]?.completions).toEqual(['2026-10-05', '2026-10-06']);
  });

  it('desmarcar um dia vira exclusão só daquela marcação', () => {
    const before = toRecords(finance(), personal({ habits: [habit(['2026-10-05', '2026-10-06'])] }));
    const after = toRecords(finance(), personal({ habits: [habit(['2026-10-06'])] }));
    const { shadow } = detectChanges(before, {}, 't0');
    const { changes } = detectChanges(after, shadow, 't1');
    expect(changes).toEqual([{ collection: 'habitLogs', id: 'h1:2026-10-05', data: null, updatedAt: 't1' }]);
  });

  it('etapas concluídas em aparelhos diferentes', () => {
    const steps = [
      { id: 's1', title: 'Tema', done: false, order: 0 },
      { id: 's2', title: 'Escrever', done: false, order: 1 },
    ];
    const a = toRecords(finance(), personal({ goals: [goal([{ ...steps[0]!, done: true }, steps[1]!])] }));
    const b = toRecords(finance(), personal({ goals: [goal([steps[0]!, { ...steps[1]!, done: true }])] }));
    // Só as etapas alteradas sobem de cada aparelho.
    const base = toRecords(finance(), personal({ goals: [goal(steps)] }));
    const changed = (m: Map<string, LocalRecord>) => {
      const { shadow } = detectChanges(base, {}, 't0');
      return new Map(detectChanges(m, shadow, 't1').changes.map((c) => rec(c.collection, c.id, c.data)));
    };
    const merged = rebuild(server(base, changed(a), changed(b)));
    expect(merged.personal.goals[0]?.subtasks.map((s) => s.done)).toEqual([true, true]);
  });
});

describe('formato antigo e registros sem dono', () => {
  it('usa as marcações de dentro do hábito enquanto não há registros próprios', () => {
    const legacy = new Map([rec('habits', 'h1', habit(['2026-09-01']))]);
    expect(rebuild(legacy).personal.habits[0]?.completions).toEqual(['2026-09-01']);

    const withLogs = new Map([...legacy, rec('habitLogs', 'h1:2026-10-01', { habitId: 'h1', date: '2026-10-01' })]);
    expect(rebuild(withLogs).personal.habits[0]?.completions).toEqual(['2026-10-01']);
  });

  it('etapas antigas sem ordem recebem a posição em que estavam', () => {
    const legacyGoal = { ...goal([]), subtasks: [{ id: 'b', title: 'B', done: false }, { id: 'a', title: 'A', done: true }] };
    const back = rebuild(new Map([rec('goals', 'g1', legacyGoal)]));
    expect(back.personal.goals[0]?.subtasks).toEqual([
      { id: 'b', title: 'B', done: false, order: 0 },
      { id: 'a', title: 'A', done: true, order: 1 },
    ]);
  });

  it('etapa que chega antes da meta fica guardada e é encaixada depois', () => {
    const step = rec('subtasks', 's1', { id: 's1', title: 'Tema', done: true, order: 0, goalId: 'g1' });
    const first = rebuild(new Map([step]));
    expect(first.personal.goals).toHaveLength(0);
    expect([...first.orphans.keys()]).toEqual(['subtasks|s1']);

    const { subtasks: _, ...bareGoal } = goal([]);
    const second = rebuild(new Map([...first.orphans, rec('goals', 'g1', bareGoal)]));
    expect(second.personal.goals[0]?.subtasks).toHaveLength(1);
    expect(second.orphans.size).toBe(0);
  });

  it('coleção de uma versão mais nova do app é preservada', () => {
    const future = ['future|x', { collection: 'future' as CollectionName, id: 'x', data: { a: 1 } }] as const;
    expect(rebuild(new Map([future])).orphans.get('future|x')).toEqual(future[1]);
  });

  it('dados de antes das categorias e áreas editáveis recebem as de fábrica', () => {
    const back = rebuild(new Map());
    expect(back.finance.categories.map((c) => c.id)).toContain('food');
    expect(back.personal.areas.map((a) => a.id)).toEqual(['routine', 'academic', 'training']);
  });
});
