import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ClipboardCheck,
  Compass,
  Flame,
  ListTodo,
  OctagonAlert,
  Plus,
  Target,
  Undo2,
} from 'lucide-react';
import { Button, Card, CheckCircle, EmptyState, IconButton, Input, ProgressBar, Select, SwipeRow } from '@/components/ui';
import { liquidBalance } from '@/features/finance/accounts';
import { expenseCategoryOrder, useCategoryLookup } from '@/features/finance/categories';
import { UpcomingRow } from '@/features/finance/components/ForecastCard';
import { TransactionForm } from '@/features/finance/components/TransactionForm';
import { budgetStatus, summarizeMonth } from '@/features/finance/selectors';
import { useFinanceStore } from '@/features/finance/store';
import { useDueSoon, useMonthForecast } from '@/features/finance/useForecast';
import { formatGoalValue, useGoalContext } from '@/features/personal/goals/goalFormat';
import { habitFrequencyLabel, QuantityStepper, weeklyProgress } from '@/features/personal/habits/HabitControls';
import { defaultAreaFor, selectableAreas, useAreaLookup, useAreas } from '@/features/personal/meta';
import {
  computeStreak,
  goalMetrics,
  isDueOn,
  isWeekly,
  overdueTasks,
  plansForDay,
  sortTasks,
  tasksForDay,
} from '@/features/personal/selectors';
import { usePersonalStore } from '@/features/personal/store';
import { TaskItem } from '@/features/personal/tasks/TaskItem';
import type { Area, WorkoutPlan } from '@/features/personal/types';
import { currentFocus, reviewPending } from '@/features/review/summary';
import { cn } from '@/lib/cn';
import { currentMonthKey, daysBetween, todayISO } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { formatBRL } from '@/lib/money';
import { StalledTasks } from '@/features/personal/tasks/StalledTasks';
import { BoulderHero } from './BoulderHero';
import { TodayAgenda } from './TodayAgenda';
import { WeekGlance } from './WeekGlance';
import { TrainingCard } from './TrainingCard';

export function TodayPage() {
  const today = todayISO();
  const tasks = usePersonalStore((s) => s.tasks);
  const habits = usePersonalStore((s) => s.habits);
  const plans = usePersonalStore((s) => s.workoutPlans);
  const sessions = usePersonalStore((s) => s.workoutSessions);
  const reviews = usePersonalStore((s) => s.reviews);
  const toggleHabitDay = usePersonalStore((s) => s.toggleHabitDay);
  const addTask = usePersonalStore((s) => s.addTask);
  const moveTasksToDay = usePersonalStore((s) => s.moveTasksToDay);

  const areas = useAreas();
  const areaLookup = useAreaLookup();
  const [draft, setDraft] = useState('');
  const [draftArea, setDraftArea] = useState<Area>(() => defaultAreaFor(areas));

  const todayTasks = useMemo(() => sortTasks(tasksForDay(tasks, today)), [tasks, today]);
  const overdue = useMemo(() => overdueTasks(tasks, today), [tasks, today]);
  const dueHabits = useMemo(() => habits.filter((h) => isDueOn(h, today)), [habits, today]);
  const todayPlans = useMemo(() => plansForDay(plans, today), [plans, today]);
  const todaySessions = sessions.filter((s) => s.date === today);
  const planDone = (p: WorkoutPlan) => todaySessions.some((s) => s.planId === p.id);
  const focus = currentFocus(reviews, today);
  const showReviewReminder = reviewPending(reviews, today);

  const total = todayTasks.length + dueHabits.length + todayPlans.length;
  const done =
    todayTasks.filter((t) => t.status === 'done').length +
    dueHabits.filter((h) => h.completions.includes(today)).length +
    todayPlans.filter(planDone).length;

  const submitTask = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    addTask({ title: draft.trim(), area: draftArea, date: today });
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-4">
      <BoulderHero done={done} total={total} />

      {(focus || showReviewReminder) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {focus && (
            <div className="flex items-start gap-3 rounded-2xl border border-line bg-accent-soft/50 px-4 py-3">
              <Compass className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-3">Foco da semana</p>
                <p className="text-sm font-medium text-ink">{focus.focus}</p>
              </div>
            </div>
          )}
          {showReviewReminder && (
            <Link
              to="/review"
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 hover:bg-surface-2"
            >
              <ClipboardCheck className="size-5 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Hora da revisão semanal</span>
                <span className="text-xs text-ink-3">5 minutos para fechar a semana e escolher o foco da próxima.</span>
              </span>
            </Link>
          )}
        </div>
      )}

      <WeekGlance today={today} />

      {/*
        Ordem de uso no dia. No celular: tarefas, treino, hábitos, dinheiro, metas.
        No computador, o "dense" sobe Hábitos e Dinheiro para a terceira coluna,
        ao lado de Tarefas e Treino, e Metas fica numa faixa inteira.
      */}
      <div className="grid gap-4 lg:grid-flow-row-dense lg:grid-cols-3 [&>*]:min-w-0">
        <Card
          title="Tarefas de hoje"
          flush
          className="lg:col-span-2"
          action={
            <Link to="/personal/tasks" className="text-sm font-medium text-accent hover:underline">
              Planejamento
            </Link>
          }
        >
          {overdue.length > 0 && (
            <div className="mx-5 mt-2 mb-1 flex flex-wrap items-center gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">
                {overdue.length === 1 ? '1 tarefa atrasada' : `${overdue.length} tarefas atrasadas`}
              </span>
              <button
                type="button"
                className="rounded-md px-2 py-0.5 font-medium hover:bg-warn/10"
                onClick={() => moveTasksToDay(overdue.map((t) => t.id), today)}
              >
                Trazer para hoje
              </button>
              <Link to="/personal/tasks" className="rounded-md px-2 py-0.5 hover:bg-warn/10">
                Ver
              </Link>
            </div>
          )}
          <StalledTasks className="mx-5 mt-2 mb-1" />
          <TodayAgenda today={today} className="mx-5 mt-2 mb-1" />
          {todayTasks.length === 0 ? (
            <EmptyState icon={ListTodo} title="Nenhuma tarefa para hoje" text="Use o campo abaixo para adicionar." className="py-6" />
          ) : (
            <ul className="divide-y divide-line">
              {todayTasks.map((t) => (
                <TaskItem key={t.id} task={t} meta={areaLookup.label(t.area)} />
              ))}
            </ul>
          )}
          <form onSubmit={submitTask} className="flex gap-2 border-t border-line px-5 py-3">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Adicionar tarefa para hoje"
              aria-label="Nova tarefa para hoje"
            />
            <Select aria-label="Área" value={draftArea} onChange={(e) => setDraftArea(e.target.value as Area)} className="w-28 shrink-0 sm:w-36">
              {selectableAreas(areas, draftArea).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
            <IconButton icon={Plus} label="Adicionar tarefa" type="submit" disabled={!draft.trim()} className="border border-line" />
          </form>
        </Card>

        <TrainingCard today={today} className="lg:col-span-2" />

        <Card
          title="Hábitos"
          flush
          action={
            <Link to="/personal/habits" className="text-sm font-medium text-accent hover:underline">
              Ver todos
            </Link>
          }
        >
          {dueHabits.length === 0 ? (
            <EmptyState icon={Flame} title="Nenhum hábito previsto hoje" className="py-6" />
          ) : (
            <ul className="divide-y divide-line pb-2">
              {dueHabits.map((h) => {
                const checked = h.completions.includes(today);
                const streak = computeStreak(h, today);
                const toggle = () => {
                  if (!checked) haptic();
                  toggleHabitDay(h.id, today);
                };
                return (
                  <SwipeRow
                    key={h.id}
                    right={{ label: checked ? 'Desmarcar' : 'Feito', icon: checked ? Undo2 : Check, tone: checked ? 'accent' : 'good', onAction: toggle }}
                  >
                  <div className="flex items-center gap-3 px-5 py-2.5">
                    {h.kind !== 'quantity' && (
                      <CheckCircle
                        checked={checked}
                        onChange={toggle}
                        label={checked ? `Desmarcar ${h.title}` : `Marcar ${h.title} como feito`}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm', checked && 'text-ink-3')}>{h.title}</span>
                      {isWeekly(h) && <span className="text-xs text-ink-3">{weeklyProgress(h, today)}</span>}
                      {h.kind === 'quantity' && !isWeekly(h) && (
                        <span className="text-xs text-ink-3">{habitFrequencyLabel(h).split(' · ')[1]}</span>
                      )}
                    </span>
                    {h.kind === 'quantity' && <QuantityStepper habit={h} day={today} compact />}
                    <span
                      className="flex items-center gap-0.5 text-xs text-ink-3 tabular"
                      title={`Sequência de ${streak.current} ${streak.unit === 'weeks' ? 'semanas' : 'dias'}`}
                    >
                      <Flame className={cn('size-3.5', streak.current > 0 && 'text-warn')} aria-hidden />
                      {streak.current}
                    </span>
                  </div>
                  </SwipeRow>
                );
              })}
            </ul>
          )}
        </Card>

        <FinanceGlance />

        <FocusGoals className="lg:col-span-3" />
      </div>

    </div>
  );
}

function FinanceGlance() {
  const transactions = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const { label: categoryLabel } = useCategoryLookup();
  const forecast = useMonthForecast();
  const dueSoon = useDueSoon(7);
  const [formOpen, setFormOpen] = useState(false);
  const today = todayISO();

  const data = useMemo(() => {
    const month = currentMonthKey();
    return {
      balance: liquidBalance(accounts, transactions, today),
      summary: summarizeMonth(transactions, month),
      alerts: budgetStatus(transactions, budgets, month, expenseCategoryOrder(categories)).filter((b) => b.level !== 'ok'),
    };
  }, [transactions, budgets, categories, accounts, today]);

  return (
    <Card
      title="Dinheiro"
      flush
      action={
        <Link to="/finance" className="text-sm font-medium text-accent hover:underline">
          Finanças
        </Link>
      }
    >
      <div className="px-5 pt-1">
        <p className="text-[13px] text-ink-3">Saldo disponível</p>
        <p className={cn('font-display text-[28px] leading-tight font-semibold tabular', data.balance < 0 && 'text-expense')}>
          {formatBRL(data.balance)}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-ink-3">Dá para gastar hoje</dt>
            <dd className="font-medium tabular">
              {forecast.dailyAllowanceCents === null ? '—' : formatBRL(forecast.dailyAllowanceCents)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Saiu no mês</dt>
            <dd className="font-medium tabular">{formatBRL(data.summary.expenseCents)}</dd>
          </div>
        </dl>
      </div>
      {data.alerts.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 px-5">
          {data.alerts.map((a) => (
            <li
              key={a.category}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs',
                a.level === 'over' ? 'bg-danger-soft text-expense' : 'bg-warn-soft text-warn',
              )}
            >
              {a.level === 'over' ? (
                <OctagonAlert className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              )}
              {categoryLabel(a.category)}: {Math.round(a.ratio * 100)}% do limite
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 border-t border-line">
        <p className="flex items-center gap-1.5 px-5 pt-3 pb-1 text-xs font-medium text-ink-3">
          <CalendarClock className="size-3.5" aria-hidden />
          Vence nos próximos 7 dias
        </p>
        {dueSoon.length === 0 ? (
          <p className="px-5 pb-3 text-sm text-ink-3">Nada a vencer.</p>
        ) : (
          <ul className="pb-1">
            {dueSoon.slice(0, 5).map((item) => (
              <UpcomingRow key={item.key} item={item} today={today} />
            ))}
          </ul>
        )}
      </div>
      <div className="px-5 pb-4">
        <Button variant="secondary" size="sm" icon={Plus} className="mt-2 w-full" onClick={() => setFormOpen(true)}>
          Novo lançamento
        </Button>
      </div>
      <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} />
    </Card>
  );
}

function FocusGoals({ className }: { className?: string }) {
  const goals = usePersonalStore((s) => s.goals);
  const entries = usePersonalStore((s) => s.goalEntries);
  const ctx = useGoalContext();
  const today = ctx.today;

  const focusGoals = useMemo(
    () =>
      goals
        .map((goal) => ({ goal, metrics: goalMetrics(goal, entries, ctx) }))
        .filter(({ metrics }) => !metrics.done)
        .sort((a, b) => (a.goal.deadline ?? '9999').localeCompare(b.goal.deadline ?? '9999'))
        .slice(0, 3),
    [goals, entries, ctx],
  );

  return (
    <Card
      title="Metas em andamento"
      flush
      className={className}
      action={
        <Link to="/personal/goals" className="text-sm font-medium text-accent hover:underline">
          Todas
        </Link>
      }
    >
      {focusGoals.length === 0 ? (
        <EmptyState icon={Target} title="Nenhuma meta em andamento" className="py-6" />
      ) : (
        <ul className="flex flex-col gap-4 px-5 pt-2 pb-5 lg:grid lg:grid-cols-3 lg:gap-8">
          {focusGoals.map(({ goal, metrics }) => {
            const days = goal.deadline ? daysBetween(today, goal.deadline) : null;
            const value =
              metrics.kind === 'checklist'
                ? `${Math.round(metrics.progress * 100)}%`
                : `${formatGoalValue(goal, metrics.current)} de ${formatGoalValue(goal, metrics.target)}`;
            return (
              <li key={goal.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{goal.title}</span>
                  <span className="shrink-0 text-xs text-ink-3 tabular">
                    {value}
                    {days !== null && days >= 0 && ` · ${days} dias`}
                  </span>
                </div>
                <ProgressBar
                  value={metrics.progress}
                  tone={metrics.pace?.onTrack === false ? 'warn' : 'accent'}
                  label={`Progresso de ${goal.title}`}
                />
                {metrics.pace?.onTrack === false && (
                  <p className="mt-1 text-xs text-warn">
                    Abaixo do ritmo: precisa de {formatGoalValue(goal, metrics.pace.neededPerMonth)}/mês.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
