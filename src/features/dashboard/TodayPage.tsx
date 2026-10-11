import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Check, Dumbbell, Flame, ListTodo, OctagonAlert, Plus, Target } from 'lucide-react';
import {
  Button,
  Card,
  CheckCircle,
  EmptyState,
  IconButton,
  Input,
  ProgressBar,
  Select,
} from '@/components/ui';
import { TransactionForm } from '@/features/finance/components/TransactionForm';
import { expenseCategoryOrder, useCategoryLookup } from '@/features/finance/categories';
import { balanceUpTo, budgetStatus, summarizeMonth } from '@/features/finance/selectors';
import { useFinanceStore } from '@/features/finance/store';
import { defaultAreaFor, selectableAreas, useAreaLookup, useAreas } from '@/features/personal/meta';
import {
  computeStreak,
  goalProgress,
  isScheduled,
  overdueTasks,
  plansForDay,
  tasksForDay,
} from '@/features/personal/selectors';
import { usePersonalStore } from '@/features/personal/store';
import { SessionForm } from '@/features/personal/training/SessionForm';
import { TaskItem } from '@/features/personal/tasks/TaskItem';
import type { Area, WorkoutPlan } from '@/features/personal/types';
import { currentMonthKey, daysBetween, todayISO } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { formatBRL } from '@/lib/money';
import { BoulderHero } from './BoulderHero';

export function TodayPage() {
  const today = todayISO();
  const tasks = usePersonalStore((s) => s.tasks);
  const habits = usePersonalStore((s) => s.habits);
  const goals = usePersonalStore((s) => s.goals);
  const plans = usePersonalStore((s) => s.workoutPlans);
  const sessions = usePersonalStore((s) => s.workoutSessions);
  const toggleHabitDay = usePersonalStore((s) => s.toggleHabitDay);
  const addTask = usePersonalStore((s) => s.addTask);

  const [draft, setDraft] = useState('');
  const areas = useAreas();
  const areaLookup = useAreaLookup();
  const [draftArea, setDraftArea] = useState<Area>(() => defaultAreaFor(areas));
  const [sessionPlan, setSessionPlan] = useState<WorkoutPlan | null>(null);

  const todayTasks = useMemo(
    () =>
      tasksForDay(tasks, today).sort(
        (a, b) => Number(a.status === 'done') - Number(b.status === 'done'),
      ),
    [tasks, today],
  );
  const overdueCount = useMemo(() => overdueTasks(tasks, today).length, [tasks, today]);
  const dueHabits = useMemo(
    () => habits.filter((h) => !h.archived && isScheduled(h, today)),
    [habits, today],
  );
  const todayPlans = useMemo(() => plansForDay(plans, today), [plans, today]);
  const todaySessions = sessions.filter((s) => s.date === today);
  const planDone = (p: WorkoutPlan) => todaySessions.some((s) => s.planId === p.id);

  const total = todayTasks.length + dueHabits.length + todayPlans.length;
  const done =
    todayTasks.filter((t) => t.status === 'done').length +
    dueHabits.filter((h) => h.completions.includes(today)).length +
    todayPlans.filter(planDone).length;

  const focusGoals = useMemo(
    () =>
      goals
        .filter((g) => goalProgress(g) < 1)
        .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))
        .slice(0, 3),
    [goals],
  );

  const submitTask = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    addTask({ title: draft.trim(), area: draftArea, date: today });
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-4">
      <BoulderHero done={done} total={total} />

      <div className="grid gap-4 lg:grid-cols-3">
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
          {overdueCount > 0 && (
            <Link
              to="/personal/tasks"
              className="mx-5 mt-2 mb-1 flex items-center gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn"
            >
              <AlertTriangle className="size-4" aria-hidden />
              {overdueCount === 1 ? '1 tarefa atrasada' : `${overdueCount} tarefas atrasadas`}. Ver e reagendar
            </Link>
          )}
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
            <Select
              aria-label="Área"
              value={draftArea}
              onChange={(e) => setDraftArea(e.target.value as Area)}
              className="w-36 shrink-0"
            >
              {selectableAreas(areas, draftArea).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
            <IconButton icon={Plus} label="Adicionar tarefa" type="submit" disabled={!draft.trim()} className="border border-line" />
          </form>
        </Card>

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
                const streak = computeStreak(h, today).current;
                return (
                  <li key={h.id} className="flex items-center gap-3 px-5 py-2.5">
                    <CheckCircle
                      checked={checked}
                      onChange={() => toggleHabitDay(h.id, today)}
                      label={checked ? `Desmarcar ${h.title}` : `Marcar ${h.title} como feito`}
                    />
                    <span className={cn('flex-1 text-sm', checked && 'text-ink-3')}>{h.title}</span>
                    <span
                      className="flex items-center gap-0.5 text-xs text-ink-3 tabular"
                      title={`Sequência de ${streak} ${streak === 1 ? 'dia' : 'dias'}`}
                    >
                      <Flame className={cn('size-3.5', streak > 0 && 'text-warn')} aria-hidden />
                      {streak}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          title="Treino de hoje"
          flush
          action={
            <Link to="/personal/training" className="text-sm font-medium text-accent hover:underline">
              Semana
            </Link>
          }
        >
          {todayPlans.length === 0 && todaySessions.length === 0 ? (
            <EmptyState icon={Dumbbell} title="Dia de descanso" text="Nada previsto na divisão para hoje." className="py-6" />
          ) : (
            <ul className="divide-y divide-line pb-2">
              {todayPlans.map((p) => {
                const ok = planDone(p);
                return (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm', ok && 'text-ink-3')}>{p.label}</span>
                      <span className="text-xs text-ink-3">{p.durationMin} min previstos</span>
                    </span>
                    {ok ? (
                      <span className="flex items-center gap-1 text-sm font-medium text-income">
                        <Check className="size-4" aria-hidden /> Feito
                      </span>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => setSessionPlan(p)}>
                        Registrar
                      </Button>
                    )}
                  </li>
                );
              })}
              {todaySessions
                .filter((s) => !s.planId || !todayPlans.some((p) => p.id === s.planId))
                .map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="flex-1 truncate text-sm text-ink-3">{s.label}</span>
                    <span className="flex items-center gap-1 text-sm font-medium text-income">
                      <Check className="size-4" aria-hidden /> Feito
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <FinanceGlance />

        <Card
          title="Metas em andamento"
          flush
          action={
            <Link to="/personal/goals" className="text-sm font-medium text-accent hover:underline">
              Todas
            </Link>
          }
        >
          {focusGoals.length === 0 ? (
            <EmptyState icon={Target} title="Nenhuma meta em andamento" className="py-6" />
          ) : (
            <ul className="flex flex-col gap-4 px-5 pt-2 pb-5">
              {focusGoals.map((g) => {
                const p = goalProgress(g);
                const days = g.deadline ? daysBetween(today, g.deadline) : null;
                return (
                  <li key={g.id}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{g.title}</span>
                      <span className="shrink-0 text-xs text-ink-3 tabular">
                        {Math.round(p * 100)}%
                        {days !== null && days >= 0 && ` · ${days} dias`}
                      </span>
                    </div>
                    <ProgressBar value={p} label={`Progresso de ${g.title}`} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <SessionForm
        open={Boolean(sessionPlan)}
        plan={sessionPlan}
        date={today}
        onClose={() => setSessionPlan(null)}
      />
    </div>
  );
}

function FinanceGlance() {
  const transactions = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const categories = useFinanceStore((s) => s.categories);
  const { label: categoryLabel } = useCategoryLookup();
  const [formOpen, setFormOpen] = useState(false);
  const today = todayISO();

  const data = useMemo(() => {
    const month = currentMonthKey();
    return {
      balance: balanceUpTo(transactions, today),
      summary: summarizeMonth(transactions, month),
      alerts: budgetStatus(transactions, budgets, month, expenseCategoryOrder(categories)).filter(
        (b) => b.level !== 'ok',
      ),
    };
  }, [transactions, budgets, categories, today]);

  return (
    <Card
      title="Dinheiro"
      action={
        <Link to="/finance" className="text-sm font-medium text-accent hover:underline">
          Finanças
        </Link>
      }
    >
      <p className="text-[13px] text-ink-3">Saldo atual</p>
      <p className="font-display text-[28px] leading-tight font-semibold tabular">{formatBRL(data.balance)}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-ink-3">Entrou no mês</dt>
          <dd className="font-medium text-income tabular">{formatBRL(data.summary.incomeCents)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Saiu no mês</dt>
          <dd className="font-medium tabular">{formatBRL(data.summary.expenseCents)}</dd>
        </div>
      </dl>
      {data.alerts.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
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
      <Button variant="secondary" size="sm" icon={Plus} className="mt-4 w-full" onClick={() => setFormOpen(true)}>
        Novo lançamento
      </Button>
      <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} />
    </Card>
  );
}
