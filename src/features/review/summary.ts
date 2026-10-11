import { budgetStatus, type BudgetStatus } from '@/features/finance/selectors';
import type { Budgets, CategoryId, Transaction } from '@/features/finance/types';
import {
  isScheduled,
  isSkipped,
  isWeekly,
  trainingWeek,
  weekCount,
} from '@/features/personal/selectors';
import type { Goal, GoalEntry, Habit, Task, WeeklyReview, WorkoutPlan, WorkoutSession } from '@/features/personal/types';
import { addDaysISO, monthKeyOf, startOfWeekISO, weekDaysFrom, weekdayOf, type ISODate } from '@/lib/dates';

export interface HabitWeek {
  habit: Habit;
  expected: number;
  done: number;
}

export interface WeekSummary {
  start: ISODate;
  end: ISODate;
  tasks: { total: number; done: number; open: Task[] };
  habits: { items: HabitWeek[]; expected: number; done: number };
  training: { planned: number; sessions: number; minutes: number };
  money: { expenseCents: number; incomeCents: number; topCategories: Array<{ category: CategoryId; cents: number }>; alerts: BudgetStatus[] };
  goals: Array<{ goal: Goal; delta: number }>;
}

export interface SummaryInput {
  tasks: Task[];
  habits: Habit[];
  plans: WorkoutPlan[];
  sessions: WorkoutSession[];
  transactions: Transaction[];
  budgets: Budgets;
  categoryOrder: CategoryId[];
  goals: Goal[];
  goalEntries: GoalEntry[];
}

/**
 * Semana sugerida para revisar: de sexta a domingo, a semana atual (que está
 * terminando); nos outros dias, a anterior.
 */
export function suggestedReviewWeek(today: ISODate): ISODate {
  const monday = startOfWeekISO(today);
  return [5, 6, 0].includes(weekdayOf(today)) ? monday : addDaysISO(monday, -7);
}

/** O que aconteceu na semana que começa em `start` (segunda), contando só até `today`. */
export function weekSummary(start: ISODate, today: ISODate, input: SummaryInput): WeekSummary {
  const days = weekDaysFrom(start);
  const end = days[6]!;
  const inWeek = (d: ISODate) => d >= start && d <= end;
  const elapsed = days.filter((d) => d <= today);

  const weekTasks = input.tasks.filter((t) => inWeek(t.date));
  const open = input.tasks
    .filter((t) => t.status !== 'done' && t.date <= end && t.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const habitItems: HabitWeek[] = input.habits
    .filter((h) => !h.archived && h.createdAt.slice(0, 10) <= end)
    .map((habit) => {
      if (isWeekly(habit)) {
        return { habit, expected: habit.timesPerWeek ?? 1, done: Math.min(weekCount(habit, start), habit.timesPerWeek ?? 1) };
      }
      const due = elapsed.filter((d) => isScheduled(habit, d) && !isSkipped(habit, d));
      return { habit, expected: due.length, done: due.filter((d) => habit.completions.includes(d)).length };
    })
    .filter((h) => h.expected > 0);

  const week = trainingWeek(input.plans, input.sessions, start);
  const sessions = week.flatMap((d) => d.sessions);

  let expenseCents = 0;
  let incomeCents = 0;
  const byCategory = new Map<CategoryId, number>();
  for (const t of input.transactions) {
    if (!inWeek(t.date) || t.date > today) continue;
    if (t.type === 'income') incomeCents += t.amountCents;
    if (t.type === 'expense') {
      expenseCents += t.amountCents;
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amountCents);
    }
  }
  const topCategories = [...byCategory.entries()]
    .map(([category, cents]) => ({ category, cents }))
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 3);
  const alerts = budgetStatus(input.transactions, input.budgets, monthKeyOf(end < today ? end : today), input.categoryOrder).filter(
    (b) => b.level !== 'ok',
  );

  const goals = input.goals
    .map((goal) => ({
      goal,
      delta: input.goalEntries.filter((e) => e.goalId === goal.id && inWeek(e.date)).reduce((sum, e) => sum + e.value, 0),
    }))
    .filter((g) => g.delta !== 0);

  return {
    start,
    end,
    tasks: { total: weekTasks.length, done: weekTasks.filter((t) => t.status === 'done').length, open },
    habits: {
      items: habitItems,
      expected: habitItems.reduce((s, h) => s + h.expected, 0),
      done: habitItems.reduce((s, h) => s + h.done, 0),
    },
    training: {
      planned: week.filter((d) => d.date <= today).reduce((s, d) => s + d.planned.length, 0),
      sessions: sessions.length,
      minutes: sessions.reduce((s, x) => s + x.durationMin, 0),
    },
    money: { expenseCents, incomeCents, topCategories, alerts },
    goals,
  };
}

/** Foco em vigor hoje: o da revisão mais recente da semana passada ou desta. */
export function currentFocus(reviews: WeeklyReview[], today: ISODate): WeeklyReview | null {
  const since = addDaysISO(startOfWeekISO(today), -7);
  return (
    [...reviews]
      .filter((r) => r.id >= since && r.focus.trim())
      .sort((a, b) => b.id.localeCompare(a.id))[0] ?? null
  );
}

/** A revisão sugerida ainda não foi feita (para lembrar na tela Hoje). */
export function reviewPending(reviews: WeeklyReview[], today: ISODate): boolean {
  if (![0, 1].includes(weekdayOf(today))) return false; // domingo e segunda
  const week = suggestedReviewWeek(today);
  return !reviews.some((r) => r.id === week);
}

