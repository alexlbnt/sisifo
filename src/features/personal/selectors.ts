import {
  addDaysISO,
  startOfWeekISO,
  weekDaysFrom,
  weekdayOf,
  type ISODate,
} from '@/lib/dates';
import type {
  Goal,
  Habit,
  StreakInfo,
  Task,
  WorkoutPlan,
  WorkoutSession,
} from './types';

/* ───────── Metas ───────── */

/** Progresso de 0 a 1 baseado nas subtasks concluídas. */
export function goalProgress(goal: Goal): number {
  if (!goal.subtasks.length) return 0;
  return goal.subtasks.filter((s) => s.done).length / goal.subtasks.length;
}

/* ───────── Tarefas ───────── */

export function tasksForDay(tasks: Task[], day: ISODate): Task[] {
  return tasks.filter((t) => t.date === day);
}

/** Tarefas não concluídas com data anterior a `today`. */
export function overdueTasks(tasks: Task[], today: ISODate): Task[] {
  return tasks
    .filter((t) => t.status !== 'done' && t.date < today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ───────── Hábitos ───────── */

export function isScheduled(habit: Pick<Habit, 'schedule'>, day: ISODate): boolean {
  return habit.schedule.includes(weekdayOf(day));
}

/**
 * Sequência atual: dias previstos consecutivos cumpridos, contando para trás.
 * Dias fora da agenda não quebram nem somam. Se hoje é dia previsto e ainda
 * não foi feito, a sequência não quebra: o dia ainda não acabou.
 */
export function computeStreak(habit: Habit, today: ISODate): StreakInfo {
  const done = new Set(habit.completions);
  const createdDay = habit.createdAt.slice(0, 10);
  const earliest = [createdDay, ...habit.completions].sort()[0] ?? today;

  if (!habit.schedule.length) return { current: 0, best: 0, rate30: null };

  // Sequência atual
  let current = 0;
  let day = today;
  if (isScheduled(habit, day) && !done.has(day)) day = addDaysISO(day, -1);
  while (day >= earliest) {
    if (isScheduled(habit, day)) {
      if (!done.has(day)) break;
      current++;
    }
    day = addDaysISO(day, -1);
  }

  // Melhor sequência
  let best = 0;
  let run = 0;
  for (let d = earliest; d <= today; d = addDaysISO(d, 1)) {
    if (!isScheduled(habit, d)) continue;
    if (done.has(d)) {
      run++;
      best = Math.max(best, run);
    } else if (d !== today) {
      run = 0;
    }
  }

  // Taxa dos últimos 30 dias (sem contar hoje se ainda pendente)
  let due = 0;
  let hit = 0;
  for (let i = 0; i < 30; i++) {
    const d = addDaysISO(today, -i);
    if (d < earliest) break;
    if (!isScheduled(habit, d)) continue;
    if (d === today && !done.has(d)) continue;
    due++;
    if (done.has(d)) hit++;
  }

  return { current, best: Math.max(best, current), rate30: due ? hit / due : null };
}

/* ───────── Treino ───────── */

export function plansForDay(plans: WorkoutPlan[], day: ISODate): WorkoutPlan[] {
  return plans.filter((p) => p.weekdays.includes(weekdayOf(day)));
}

export interface WeekDayTraining {
  date: ISODate;
  planned: WorkoutPlan[];
  sessions: WorkoutSession[];
}

export function trainingWeek(
  plans: WorkoutPlan[],
  sessions: WorkoutSession[],
  anyDayInWeek: ISODate,
): WeekDayTraining[] {
  return weekDaysFrom(startOfWeekISO(anyDayInWeek)).map((date) => ({
    date,
    planned: plansForDay(plans, date),
    sessions: sessions.filter((s) => s.date === date),
  }));
}

export interface TrainingStats {
  sessionsThisWeek: number;
  plannedThisWeek: number;
  minutesThisWeek: number;
  /** Semanas seguidas (até a atual) com pelo menos uma sessão. */
  activeWeeksStreak: number;
}

export function trainingStats(
  plans: WorkoutPlan[],
  sessions: WorkoutSession[],
  today: ISODate,
): TrainingStats {
  const week = trainingWeek(plans, sessions, today);
  const thisWeek = week.flatMap((d) => d.sessions);
  const sessionDays = new Set(sessions.map((s) => s.date));

  let activeWeeksStreak = 0;
  let monday = startOfWeekISO(today);
  // A semana atual só conta se já tiver treino; se não tiver, começa da anterior.
  if (!weekDaysFrom(monday).some((d) => sessionDays.has(d))) monday = addDaysISO(monday, -7);
  while (weekDaysFrom(monday).some((d) => sessionDays.has(d))) {
    activeWeeksStreak++;
    monday = addDaysISO(monday, -7);
  }

  return {
    sessionsThisWeek: thisWeek.length,
    plannedThisWeek: week.reduce((sum, d) => sum + d.planned.length, 0),
    minutesThisWeek: thisWeek.reduce((sum, s) => sum + s.durationMin, 0),
    activeWeeksStreak,
  };
}
