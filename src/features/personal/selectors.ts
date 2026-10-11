import {
  addDaysISO,
  daysBetween,
  startOfWeekISO,
  weekDaysFrom,
  weekdayOf,
  type ISODate,
} from '@/lib/dates';
import type {
  Goal,
  GoalEntry,
  GoalKind,
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

export interface GoalPace {
  /** Meses até o prazo (fração). */
  monthsLeft: number;
  /** Quanto precisa avançar por mês para chegar no prazo (na direção da meta). */
  neededPerMonth: number;
  /** Média de avanço por mês desde a criação, até 3 meses para trás (null sem histórico). */
  avgPerMonth: number | null;
  /** No ritmo: a média recente cobre o necessário. null sem histórico. */
  onTrack: boolean | null;
}

export interface GoalMetrics {
  kind: GoalKind;
  current: number;
  start: number;
  target: number;
  /** De 0 a 1. */
  progress: number;
  /** Quanto falta, na direção da meta (nunca negativo). */
  remaining: number;
  done: boolean;
  pace: GoalPace | null;
}

export interface GoalContext {
  today: ISODate;
  /** Saldo de uma conta numa data (metas de poupança ligadas a conta). */
  accountBalance?: (accountId: string, upTo: ISODate) => number;
}

const PACE_WINDOW_DAYS = 90;
const DAYS_PER_MONTH = 30.44;

/** Valor medido de uma meta numérica ou de poupança numa data. */
function measuredValue(goal: Goal, entries: GoalEntry[], upTo: ISODate, ctx: GoalContext): number {
  const start = goal.start ?? 0;
  if (goal.kind === 'savings' && goal.accountId && ctx.accountBalance) {
    return ctx.accountBalance(goal.accountId, upTo);
  }
  const mine = entries.filter((e) => e.goalId === goal.id && e.date <= upTo);
  if (goal.kind === 'numeric' && goal.measure === 'last') {
    const last = [...mine].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    return last ? last.value : start;
  }
  return start + mine.reduce((sum, e) => sum + e.value, 0);
}

/** Números de uma meta, de qualquer tipo, com o ritmo até o prazo. */
export function goalMetrics(goal: Goal, entries: GoalEntry[], ctx: GoalContext): GoalMetrics {
  const kind = goal.kind ?? 'checklist';
  if (kind === 'checklist' || goal.target === undefined) {
    const total = goal.subtasks.length;
    const doneCount = goal.subtasks.filter((s) => s.done).length;
    return {
      kind: 'checklist',
      current: doneCount,
      start: 0,
      target: total,
      progress: goalProgress(goal),
      remaining: total - doneCount,
      done: total > 0 && doneCount === total,
      pace: null,
    };
  }

  const start = goal.kind === 'savings' && goal.accountId ? 0 : (goal.start ?? 0);
  const target = goal.target;
  const direction = target >= start ? 1 : -1;
  const current = measuredValue(goal, entries, ctx.today, ctx);
  const span = Math.abs(target - start);
  const advanced = (current - start) * direction;
  const progress = span === 0 ? 1 : Math.min(1, Math.max(0, advanced / span));
  const remaining = Math.max(0, (target - current) * direction);

  let pace: GoalPace | null = null;
  if (goal.deadline && remaining > 0) {
    const monthsLeft = Math.max(0, daysBetween(ctx.today, goal.deadline) / DAYS_PER_MONTH);
    const neededPerMonth = monthsLeft >= 1 ? remaining / monthsLeft : remaining;
    const windowStart = addDaysISO(ctx.today, -PACE_WINDOW_DAYS);
    const created = goal.createdAt.slice(0, 10);
    const historyStart = created > windowStart ? created : windowStart;
    const historyDays = daysBetween(historyStart, ctx.today);
    let avgPerMonth: number | null = null;
    if (historyDays >= 14) {
      const before = measuredValue(goal, entries, addDaysISO(historyStart, -1), ctx);
      avgPerMonth = ((current - before) * direction * DAYS_PER_MONTH) / historyDays;
    }
    pace = {
      monthsLeft,
      neededPerMonth,
      avgPerMonth,
      onTrack: avgPerMonth === null ? null : avgPerMonth >= neededPerMonth,
    };
  }

  return { kind, current, start, target, progress, remaining, done: remaining <= 0, pace };
}

/** Quanto as metas de poupança com prazo pedem guardar por mês, somado (centavos). */
export function monthlySavingsTarget(goals: Goal[], entries: GoalEntry[], ctx: GoalContext): number {
  let total = 0;
  for (const goal of goals) {
    if (goal.kind !== 'savings') continue;
    const pace = goalMetrics(goal, entries, ctx).pace;
    if (pace) total += Math.ceil(pace.neededPerMonth);
  }
  return total;
}

/* ───────── Tarefas ───────── */

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

/** Ordem de exibição: pendentes antes, depois prioridade, horário e criação. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      Number(a.status === 'done') - Number(b.status === 'done') ||
      (a.priority ? PRIORITY_RANK[a.priority] : 3) - (b.priority ? PRIORITY_RANK[b.priority] : 3) ||
      (a.time ?? '99:99').localeCompare(b.time ?? '99:99') ||
      a.createdAt.localeCompare(b.createdAt),
  );
}


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

export const isWeekly = (habit: Pick<Habit, 'frequency'>): boolean => habit.frequency === 'weekly';

/** Meta diária: 1 nos hábitos de marcar; `target` nos de quantidade. */
export const habitTarget = (habit: Pick<Habit, 'kind' | 'target'>): number =>
  habit.kind === 'quantity' ? (habit.target && habit.target > 0 ? habit.target : 1) : 1;

export function isSkipped(habit: Pick<Habit, 'skips'>, day: ISODate): boolean {
  return Boolean(habit.skips?.[day]);
}

/** O dia está na agenda: dias fixos na lista, ou qualquer dia nos hábitos semanais. */
export function isScheduled(habit: Pick<Habit, 'schedule' | 'frequency'>, day: ISODate): boolean {
  if (isWeekly(habit)) return true;
  return habit.schedule.includes(weekdayOf(day));
}

/** Quantas vezes foi feito na semana (seg–dom) que contém `day`. */
export function weekCount(habit: Pick<Habit, 'completions'>, day: ISODate): number {
  const days = new Set(weekDaysFrom(startOfWeekISO(day)));
  return habit.completions.filter((d) => days.has(d)).length;
}

/**
 * Aparece na lista do dia: dias fixos quando está na agenda e não foi pulado;
 * semanais enquanto a meta da semana não foi batida (ou se já foi feito hoje).
 */
export function isDueOn(habit: Habit, day: ISODate): boolean {
  if (habit.archived || isSkipped(habit, day)) return false;
  if (isWeekly(habit)) {
    return weekCount(habit, day) < (habit.timesPerWeek ?? 1) || habit.completions.includes(day);
  }
  return isScheduled(habit, day);
}

/** Dias feitos a partir das quantidades (quantidade ≥ meta), sem os pulados. */
export function completionsFromAmounts(
  habit: Pick<Habit, 'kind' | 'target'>,
  amounts: Record<ISODate, number>,
): ISODate[] {
  const target = habitTarget(habit);
  return Object.entries(amounts)
    .filter(([, v]) => v >= target)
    .map(([d]) => d)
    .sort();
}

/**
 * Sequência atual: dias previstos consecutivos cumpridos, contando para trás.
 * Dias fora da agenda e dias pulados não quebram nem somam. Se hoje é dia
 * previsto e ainda não foi feito, a sequência não quebra: o dia ainda não acabou.
 * Hábitos semanais contam semanas seguidas com a meta batida.
 */
export function computeStreak(habit: Habit, today: ISODate): StreakInfo {
  if (isWeekly(habit)) return weeklyStreak(habit, today);

  const done = new Set(habit.completions);
  const createdDay = habit.createdAt.slice(0, 10);
  const earliest = [createdDay, ...habit.completions].sort()[0] ?? today;
  const due = (d: ISODate) => isScheduled(habit, d) && !isSkipped(habit, d);

  if (!habit.schedule.length) return { current: 0, best: 0, rate30: null, unit: 'days' };

  // Sequência atual
  let current = 0;
  let day = today;
  if (due(day) && !done.has(day)) day = addDaysISO(day, -1);
  while (day >= earliest) {
    if (due(day)) {
      if (!done.has(day)) break;
      current++;
    }
    day = addDaysISO(day, -1);
  }

  // Melhor sequência
  let best = 0;
  let run = 0;
  for (let d = earliest; d <= today; d = addDaysISO(d, 1)) {
    if (!due(d)) continue;
    if (done.has(d)) {
      run++;
      best = Math.max(best, run);
    } else if (d !== today) {
      run = 0;
    }
  }

  // Taxa dos últimos 30 dias (sem contar hoje se ainda pendente)
  let expected = 0;
  let hit = 0;
  for (let i = 0; i < 30; i++) {
    const d = addDaysISO(today, -i);
    if (d < earliest) break;
    if (!due(d)) continue;
    if (d === today && !done.has(d)) continue;
    expected++;
    if (done.has(d)) hit++;
  }

  return { current, best: Math.max(best, current), rate30: expected ? hit / expected : null, unit: 'days' };
}

function weeklyStreak(habit: Habit, today: ISODate): StreakInfo {
  const times = habit.timesPerWeek ?? 1;
  const createdWeek = startOfWeekISO([habit.createdAt.slice(0, 10), ...habit.completions].sort()[0] ?? today);
  const thisWeek = startOfWeekISO(today);
  const hitWeek = (monday: ISODate) => weekCount(habit, monday) >= times;

  // A semana atual só soma se já bateu a meta; se não, ainda não quebra.
  let current = 0;
  let monday = hitWeek(thisWeek) ? thisWeek : addDaysISO(thisWeek, -7);
  while (monday >= createdWeek && hitWeek(monday)) {
    current++;
    monday = addDaysISO(monday, -7);
  }

  let best = 0;
  let run = 0;
  for (let m = createdWeek; m <= thisWeek; m = addDaysISO(m, 7)) {
    if (hitWeek(m)) best = Math.max(best, ++run);
    else if (m !== thisWeek) run = 0;
  }

  // Últimas 4 semanas fechadas (mais a atual, se já bateu a meta).
  let expected = 0;
  let hit = 0;
  for (let i = 0; i <= 4; i++) {
    const m = addDaysISO(thisWeek, -7 * i);
    if (m < createdWeek) break;
    if (i === 0 && !hitWeek(m)) continue;
    expected++;
    if (hitWeek(m)) hit++;
  }

  return { current, best: Math.max(best, current), rate30: expected ? hit / expected : null, unit: 'weeks' };
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
