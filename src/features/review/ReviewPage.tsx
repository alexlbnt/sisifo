import { useId, useMemo, useState, type FormEvent } from 'react';
import { CalendarArrowUp, ChevronLeft, ChevronRight, CircleCheck, Dumbbell, Flame, ListTodo, Target, Wallet } from 'lucide-react';
import { Button, Card, Field, IconButton, PageHeader, ProgressBar, Textarea } from '@/components/ui';
import { expenseCategoryOrder, useCategoryLookup } from '@/features/finance/categories';
import { useFinanceStore } from '@/features/finance/store';
import { formatGoalValue } from '@/features/personal/goals/goalFormat';
import { usePersonalStore } from '@/features/personal/store';
import { cn } from '@/lib/cn';
import { addDaysISO, fmt, relativeDay, startOfWeekISO, todayISO } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { suggestedReviewWeek, weekSummary } from './summary';

const pct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : null);

export function ReviewPage() {
  const today = todayISO();
  const [week, setWeek] = useState(() => suggestedReviewWeek(today));
  const personal = usePersonalStore();
  const finance = useFinanceStore();
  const categories = useCategoryLookup();
  const thisWeek = startOfWeekISO(today);

  const summary = useMemo(
    () =>
      weekSummary(week, today, {
        tasks: personal.tasks,
        habits: personal.habits,
        plans: personal.workoutPlans,
        sessions: personal.workoutSessions,
        transactions: finance.transactions,
        budgets: finance.budgets,
        categoryOrder: expenseCategoryOrder(finance.categories),
        goals: personal.goals,
        goalEntries: personal.goalEntries,
      }),
    [week, today, personal, finance],
  );
  const saved = personal.reviews.find((r) => r.id === week);
  const habitRate = pct(summary.habits.done, summary.habits.expected);
  const taskRate = pct(summary.tasks.done, summary.tasks.total);

  return (
    <>
      <PageHeader title="Revisão semanal" subtitle="Olhar a semana que passou e escolher o foco da próxima" />

      <div className="mb-5 flex items-center gap-2">
        <div className="inline-flex items-center rounded-lg border border-line bg-surface">
          <IconButton icon={ChevronLeft} label="Semana anterior" size="sm" onClick={() => setWeek(addDaysISO(week, -7))} />
          <span className="min-w-44 text-center text-sm font-medium" aria-live="polite">
            {fmt.short(summary.start)} a {fmt.short(summary.end)}
          </span>
          <IconButton
            icon={ChevronRight}
            label="Próxima semana"
            size="sm"
            disabled={week >= thisWeek}
            onClick={() => setWeek(addDaysISO(week, 7))}
          />
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-income">
            <CircleCheck className="size-4" aria-hidden /> Revisada
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              icon={ListTodo}
              title="Tarefas"
              value={`${summary.tasks.done} de ${summary.tasks.total}`}
              rate={taskRate}
              hint={summary.tasks.open.length ? `${summary.tasks.open.length} ainda abertas` : 'Nada pendente'}
            />
            <StatCard
              icon={Flame}
              title="Hábitos"
              value={habitRate === null ? '—' : `${habitRate}%`}
              rate={habitRate}
              hint={`${summary.habits.done} de ${summary.habits.expected} marcações previstas`}
            />
            <StatCard
              icon={Dumbbell}
              title="Treinos"
              value={`${summary.training.sessions} de ${summary.training.planned}`}
              rate={pct(Math.min(summary.training.sessions, summary.training.planned), summary.training.planned)}
              hint={`${summary.training.minutes} minutos no total`}
            />
            <StatCard
              icon={Wallet}
              title="Gastos da semana"
              value={formatBRL(summary.money.expenseCents)}
              hint={
                summary.money.topCategories.length
                  ? summary.money.topCategories.map((c) => `${categories.label(c.category)} ${formatBRL(c.cents)}`).join(' · ')
                  : 'Nenhuma despesa'
              }
            />
          </div>

          {summary.habits.items.length > 0 && (
            <Card title="Hábitos na semana" flush>
              <ul className="divide-y divide-line pb-2">
                {summary.habits.items.map(({ habit, expected, done }) => (
                  <li key={habit.id} className="flex items-center gap-3 px-5 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{habit.title}</span>
                    <ProgressBar value={expected ? done / expected : 0} className="max-w-32" label={`${habit.title}: ${done} de ${expected}`} />
                    <span className="w-12 text-right text-sm text-ink-2 tabular">
                      {done}/{expected}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(summary.goals.length > 0 || summary.money.alerts.length > 0) && (
            <Card title="Metas e orçamento">
              <ul className="flex flex-col gap-2 text-sm">
                {summary.goals.map(({ goal, delta }) => (
                  <li key={goal.id} className="flex items-center gap-2">
                    <Target className="size-4 shrink-0 text-accent" aria-hidden />
                    <span className="flex-1">{goal.title}</span>
                    <span className="font-medium text-income tabular">
                      {delta > 0 ? '+' : ''}
                      {formatGoalValue(goal, delta)}
                    </span>
                  </li>
                ))}
                {summary.money.alerts.map((a) => (
                  <li key={a.category} className={cn('flex items-center gap-2', a.level === 'over' ? 'text-expense' : 'text-warn')}>
                    <Wallet className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1">{categories.label(a.category)}</span>
                    <span className="tabular">{Math.round(a.ratio * 100)}% do limite do mês</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <ReviewForm key={week} week={week} openCount={summary.tasks.open.length} openIds={summary.tasks.open.map((t) => t.id)} />
      </div>

      {summary.tasks.open.length > 0 && (
        <Card title="Tarefas que ficaram para trás" flush className="mt-4">
          <ul className="divide-y divide-line pb-2">
            {summary.tasks.open.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-2 text-sm">
                <span className="w-20 shrink-0 text-xs text-ink-3">{relativeDay(t.date, today)}</span>
                <span className="flex-1 truncate">{t.title}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  rate,
  hint,
}: {
  icon: typeof ListTodo;
  title: string;
  value: string;
  rate?: number | null;
  hint: string;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <p className="flex items-center gap-2 text-[13px] text-ink-2">
        <Icon className="size-4 text-ink-3" aria-hidden />
        {title}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold tabular">{value}</p>
      {rate !== undefined && rate !== null && (
        <ProgressBar value={rate / 100} tone={rate >= 80 ? 'good' : rate >= 50 ? 'accent' : 'warn'} className="mt-2" label={`${title}: ${rate}%`} />
      )}
      <p className="mt-2 text-xs text-ink-3">{hint}</p>
    </section>
  );
}

function ReviewForm({ week, openCount, openIds }: { week: string; openCount: number; openIds: string[] }) {
  const id = useId();
  const saved = usePersonalStore((s) => s.reviews.find((r) => r.id === week));
  const saveReview = usePersonalStore((s) => s.saveReview);
  const moveTasksToDay = usePersonalStore((s) => s.moveTasksToDay);
  const [wins, setWins] = useState(saved?.wins ?? '');
  const [notes, setNotes] = useState(saved?.notes ?? '');
  const [focus, setFocus] = useState(saved?.focus ?? '');
  const [moved, setMoved] = useState(false);
  const [done, setDone] = useState(false);
  const nextMonday = addDaysISO(week, 7);
  const target = nextMonday < todayISO() ? todayISO() : nextMonday;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    saveReview({ id: week, focus: focus.trim(), wins: wins.trim() || undefined, notes: notes.trim() || undefined });
    setDone(true);
  };

  return (
    <Card title="Sua revisão" description="Fica salva e o foco aparece na tela Hoje durante a semana">
      <form id={id} onSubmit={submit} className="flex flex-col gap-4">
        <Field label="O que deu certo?" htmlFor={`${id}-wins`}>
          <Textarea id={`${id}-wins`} value={wins} onChange={(e) => setWins(e.target.value)} rows={3} maxLength={2000} />
        </Field>
        <Field label="O que atrapalhou ou precisa mudar?" htmlFor={`${id}-notes`}>
          <Textarea id={`${id}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} />
        </Field>
        <Field label="Foco da próxima semana" htmlFor={`${id}-focus`} hint="Uma frase. Ex.: terminar a metodologia do TCC.">
          <Textarea id={`${id}-focus`} value={focus} onChange={(e) => setFocus(e.target.value)} rows={2} maxLength={500} />
        </Field>
        {openCount > 0 && (
          <Button
            type="button"
            variant="secondary"
            icon={CalendarArrowUp}
            disabled={moved}
            onClick={() => {
              moveTasksToDay(openIds, target);
              setMoved(true);
            }}
          >
            {moved ? 'Tarefas reagendadas' : `Levar ${openCount} ${openCount === 1 ? 'tarefa aberta' : 'tarefas abertas'} para ${relativeDay(target)}`}
          </Button>
        )}
        <Button type="submit">{saved ? 'Atualizar revisão' : 'Salvar revisão'}</Button>
        {done && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-income">
            <CircleCheck className="size-4" aria-hidden /> Revisão salva.
          </p>
        )}
      </form>
    </Card>
  );
}
