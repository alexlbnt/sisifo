import { addDaysISO, todayISO, weekdayOf } from '@/lib/dates';
import { uid } from '@/lib/id';
import { seededRandom } from '@/lib/random';
import { MOCK_SAVINGS_ID } from '@/features/finance/mock';
import { defaultAreas } from './defaultAreas';
import type {
  PlanExercise,
  Goal,
  GoalEntry,
  Habit,
  Intensity,
  PersonalState,
  Subtask,
  Task,
  WorkoutPlan,
  WorkoutSession,
} from './types';

function subtasks(items: Array<[string, boolean]>): Subtask[] {
  return items.map(([title, done], order) => ({ id: uid(), title, done, order }));
}

export function createPersonalMock(): PersonalState {
  const today = todayISO();
  const rng = seededRandom(7);
  const now = new Date().toISOString();
  const daysAgo = (n: number) => addDaysISO(today, -n);
  const stamp = (n: number) => `${daysAgo(n)}T08:00:00.000Z`;

  /* ───────── Metas ───────── */

  const tccGoal: Goal = {
    id: uid(),
    title: 'Entregar o TCC',
    description: 'Sistema de recomendação para a disciplina de projeto final.',
    horizon: 'medium',
    area: 'academic',
    deadline: addDaysISO(today, 75),
    subtasks: subtasks([
      ['Definir tema com o orientador', true],
      ['Revisão bibliográfica', true],
      ['Escrever capítulo de metodologia', false],
      ['Implementar protótipo', false],
      ['Rodar experimentos', false],
      ['Preparar apresentação', false],
    ]),
    createdAt: stamp(60),
  };

  const booksGoal: Goal = {
    id: uid(),
    title: 'Ler 12 livros no ano',
    horizon: 'long',
    area: 'routine',
    deadline: addDaysISO(today, 120),
    subtasks: [],
    kind: 'numeric',
    target: 12,
    unit: 'livros',
    measure: 'sum',
    createdAt: stamp(200),
  };

  const goals: Goal[] = [
    tccGoal,
    {
      id: uid(),
      title: 'Graduar no Muay Thai (prajied amarela)',
      horizon: 'short',
      area: 'training',
      deadline: addDaysISO(today, 40),
      subtasks: subtasks([
        ['Treinar 2x por semana por 2 meses', true],
        ['Dominar sequência de chutes básica', true],
        ['Melhorar condicionamento (5 rounds)', false],
        ['Fazer o exame de graduação', false],
      ]),
      createdAt: stamp(50),
    },
    {
      id: uid(),
      title: 'Reserva de emergência de 6 meses',
      description: 'Juntar o equivalente a 6 meses de gastos fixos.',
      horizon: 'long',
      area: 'routine',
      deadline: addDaysISO(today, 420),
      subtasks: [],
      kind: 'savings',
      target: 30_000_00,
      accountId: MOCK_SAVINGS_ID,
      createdAt: stamp(120),
    },
    booksGoal,
  ];

  // Um livro terminado a cada ~3 semanas.
  const goalEntries: GoalEntry[] = [5, 26, 48, 70, 93, 115, 140].map((n) => ({
    id: uid(),
    goalId: booksGoal.id,
    date: daysAgo(n),
    value: 1,
  }));

  const methodology = tccGoal.subtasks[2]!;

  /* ───────── Tarefas ───────── */

  const task = (
    title: string,
    area: Task['area'],
    date: string,
    status: Task['status'] = 'todo',
    link?: Task['link'],
  ): Task => ({
    id: uid(),
    title,
    area,
    date,
    status,
    link,
    completedAt: status === 'done' ? now : undefined,
    createdAt: now,
  });

  const tasks: Task[] = [
    task('Revisar anotações de Estrutura de Dados', 'academic', today, 'done'),
    task('Escrever 2 páginas da metodologia', 'academic', today, 'doing', {
      goalId: tccGoal.id,
      subtaskId: methodology.id,
    }),
    { ...task('Lista de exercícios de Cálculo II', 'academic', today), time: '19:00', priority: 'medium' },
    task('Arrumar a mesa e organizar a semana', 'routine', today, 'done'),
    { ...task('Pagar fatura do cartão', 'routine', today), priority: 'high', repeat: { freq: 'monthly', day: 10 } },
    task('Treino de pernas + 20 min de esteira', 'training', today),
    task('Ler 30 páginas', 'routine', today),
    task('Enviar e-mail para o orientador', 'academic', daysAgo(1)),
    task('Comprar luvas novas de Muay Thai', 'training', daysAgo(2)),
    task('Estudar para a prova de Redes', 'academic', daysAgo(1), 'done'),
    task('Alongamento pós-treino', 'training', daysAgo(1), 'done'),
    task('Preparar marmitas da semana', 'routine', addDaysISO(today, 1)),
    task('Grupo de estudo de Banco de Dados', 'academic', addDaysISO(today, 1)),
    task('Sparring leve', 'training', addDaysISO(today, 2)),
  ];

  /* ───────── Hábitos ───────── */

  const everyDay = [0, 1, 2, 3, 4, 5, 6];
  const weekdays = [1, 2, 3, 4, 5];

  const habit = (
    title: string,
    area: Habit['area'],
    schedule: number[],
    adherence: number,
    doneToday: boolean,
  ): Habit => {
    const completions: string[] = [];
    for (let i = 90; i >= 1; i--) {
      const d = daysAgo(i);
      // Os últimos dias sempre cumpridos para a sequência atual ficar visível.
      if (schedule.includes(weekdayOf(d)) && (i <= 9 || rng.chance(adherence))) {
        completions.push(d);
      }
    }
    if (doneToday && schedule.includes(weekdayOf(today))) completions.push(today);
    return { id: uid(), title, area, schedule, completions, archived: false, createdAt: stamp(90) };
  };

  // Água: hábito de quantidade (8 copos por dia), com dias parciais.
  const water = habit('Beber 2 L de água', 'routine', everyDay, 0.85, true);
  const amounts: Record<string, number> = {};
  for (let i = 30; i >= 0; i--) {
    const d = daysAgo(i);
    amounts[d] = water.completions.includes(d) ? 8 : rng.int(3, 7);
  }
  amounts[today] = 5;
  water.kind = 'quantity';
  water.target = 8;
  water.unit = 'copos';
  water.amounts = amounts;
  water.completions = water.completions.filter((d) => d < daysAgo(30) || (amounts[d] ?? 0) >= 8);

  const muayThaiExtra: Habit = {
    ...habit('Treino extra de técnica', 'training', everyDay, 0.35, false),
    frequency: 'weekly',
    timesPerWeek: 2,
  };

  const habits: Habit[] = [
    water,
    muayThaiExtra,
    habit('Ler 20 minutos', 'routine', everyDay, 0.7, false),
    habit('Estudar 1 hora', 'academic', weekdays, 0.8, true),
    habit('Alongar ao acordar', 'training', everyDay, 0.6, false),
    habit('Dormir antes da meia-noite', 'routine', [0, 1, 2, 3, 4], 0.65, false),
  ];

  /* ───────── Treino ───────── */

  // [nome, séries, repetições alvo, descanso (s), carga inicial em kg (0 = peso do corpo), reps base]
  type MockExercise = [string, number, string, number, number, number];
  const exercises = (list: MockExercise[]): PlanExercise[] =>
    list.map(([name, sets, reps, restSec]) => ({ id: uid(), name, sets, reps, restSec }));
  const mockLoads = new Map<string, { start: number; reps: number }>();
  const planWith = (list: MockExercise[]) => {
    for (const [name, , , , start, reps] of list) mockLoads.set(name, { start, reps });
    return exercises(list);
  };

  const workoutPlans: WorkoutPlan[] = [
    {
      id: uid(),
      label: 'Treino A: peito e tríceps',
      kind: 'strength',
      weekdays: [1, 4],
      durationMin: 60,
      exercises: planWith([
        ['Supino reto', 4, '8-10', 90, 55, 8],
        ['Supino inclinado com halteres', 3, '10', 75, 20, 10],
        ['Tríceps na corda', 3, '12', 60, 22.5, 12],
        ['Mergulho nas paralelas', 3, 'até a falha', 60, 0, 9],
      ]),
    },
    {
      id: uid(),
      label: 'Treino B: costas e bíceps',
      kind: 'strength',
      weekdays: [2, 5],
      durationMin: 60,
      exercises: planWith([
        ['Barra fixa', 4, '6-8', 120, 0, 6],
        ['Remada curvada', 4, '8-10', 90, 45, 8],
        ['Rosca direta', 3, '10', 60, 17.5, 10],
      ]),
    },
    {
      id: uid(),
      label: 'Treino C: pernas',
      kind: 'strength',
      weekdays: [3],
      durationMin: 70,
      exercises: planWith([
        ['Agachamento livre', 4, '6-8', 150, 70, 6],
        ['Leg press', 3, '10-12', 90, 140, 10],
        ['Panturrilha em pé', 4, '15', 45, 50, 15],
      ]),
    },
    { id: uid(), label: 'Muay Thai', kind: 'muay_thai', weekdays: [2, 4], durationMin: 90 },
    { id: uid(), label: 'Corrida leve', kind: 'cardio', weekdays: [6], durationMin: 35 },
  ];

  const workoutSessions: WorkoutSession[] = [];
  for (let i = 112; i >= 1; i--) {
    const date = daysAgo(i);
    for (const plan of workoutPlans) {
      if (!plan.weekdays.includes(weekdayOf(date))) continue;
      if (!rng.chance(i <= 7 ? 1 : 0.82)) continue;
      workoutSessions.push({
        id: uid(),
        date,
        kind: plan.kind,
        label: plan.label,
        durationMin: plan.durationMin + rng.int(-10, 15),
        intensity: rng.int(2, 5) as Intensity,
        planId: plan.id,
        ...(plan.exercises && {
          // Progressão: +2,5 kg (ou +1 repetição) a cada ~3 semanas, com dias melhores e piores.
          exercises: plan.exercises.map((ex) => {
            const base = mockLoads.get(ex.name)!;
            const steps = Math.floor((112 - i) / 21);
            const load = base.start ? base.start + steps * 2.5 + (rng.chance(0.2) ? -2.5 : 0) : undefined;
            const reps = base.start ? base.reps : base.reps + steps;
            return {
              id: ex.id,
              name: ex.name,
              sets: Array.from({ length: ex.sets }, (_, k) => ({
                reps: Math.max(1, reps - (k >= 2 ? rng.int(0, 2) : 0)),
                ...(load && { load }),
              })),
            };
          }),
        }),
      });
    }
  }

  return { areas: defaultAreas(), goals, goalEntries, reviews: [], tasks, habits, workoutPlans, workoutSessions };
}
