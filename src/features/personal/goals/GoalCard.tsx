import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { CalendarClock, CircleAlert, CircleCheck, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Badge, Button, CheckCircle, IconButton, Input, ProgressBar } from '@/components/ui';
import { useAccountName } from '@/features/finance/accountHooks';
import { cn } from '@/lib/cn';
import { daysBetween, fmt, relativeDay, todayISO } from '@/lib/dates';
import { useAreaLookup } from '../meta';
import { goalMetrics, type GoalMetrics } from '../selectors';
import { usePersonalStore } from '../store';
import type { Goal } from '../types';
import { formatGoalValue, parseGoalValue, useGoalContext } from './goalFormat';

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
}

function deadlineLabel(deadline: string): { text: string; tone: 'neutral' | 'warn' | 'danger' } {
  const days = daysBetween(todayISO(), deadline);
  if (days < 0) return { text: `Venceu em ${fmt.short(deadline)}`, tone: 'danger' };
  if (days === 0) return { text: 'Vence hoje', tone: 'warn' };
  if (days <= 14) return { text: `Faltam ${days} dias`, tone: 'warn' };
  return { text: `Até ${fmt.numeric(deadline)}`, tone: 'neutral' };
}

export function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
  const entries = usePersonalStore((s) => s.goalEntries);
  const ctx = useGoalContext();
  const metrics = useMemo(() => goalMetrics(goal, entries, ctx), [goal, entries, ctx]);
  const areas = useAreaLookup();
  const AreaIcon = areas.icon(goal.area);
  const deadline = goal.deadline && !metrics.done ? deadlineLabel(goal.deadline) : null;

  return (
    <article className="flex flex-col rounded-2xl border border-line bg-surface">
      <header className="flex items-start gap-3 px-5 pt-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] leading-snug font-semibold">{goal.title}</h3>
          {goal.description && <p className="mt-0.5 text-sm text-ink-3">{goal.description}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge>
              <AreaIcon className="size-3" aria-hidden />
              {areas.label(goal.area)}
            </Badge>
            {deadline && (
              <Badge tone={deadline.tone}>
                <CalendarClock className="size-3" aria-hidden />
                {deadline.text}
              </Badge>
            )}
            {metrics.done && <Badge tone="good">Concluída</Badge>}
          </div>
        </div>
        <div className="-mr-2 flex">
          <IconButton icon={Pencil} label={`Editar ${goal.title}`} size="sm" onClick={() => onEdit(goal)} />
          <IconButton icon={Trash2} label={`Excluir ${goal.title}`} size="sm" onClick={() => onDelete(goal)} />
        </div>
      </header>

      {metrics.kind === 'checklist' ? (
        <ChecklistBody goal={goal} metrics={metrics} />
      ) : (
        <MeasuredBody goal={goal} metrics={metrics} />
      )}
    </article>
  );
}

function ChecklistBody({ goal, metrics }: { goal: Goal; metrics: GoalMetrics }) {
  const toggleSubtask = usePersonalStore((s) => s.toggleSubtask);
  const addSubtask = usePersonalStore((s) => s.addSubtask);
  const deleteSubtask = usePersonalStore((s) => s.deleteSubtask);
  const [draft, setDraft] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    addSubtask(goal.id, draft);
    setDraft('');
  };

  return (
    <>
      <div className="px-5 pt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="font-display text-xl font-semibold tabular">{Math.round(metrics.progress * 100)}%</span>
          <span className="text-ink-3 tabular">
            {metrics.current} de {metrics.target} etapas
          </span>
        </div>
        <ProgressBar value={metrics.progress} tone={metrics.done ? 'good' : 'accent'} label={`Progresso de ${goal.title}`} />
      </div>

      <ul className="mt-3 flex flex-col">
        {goal.subtasks.map((s) => (
          <li key={s.id} className="group flex items-center gap-2.5 px-5 py-1.5">
            <CheckCircle
              size="sm"
              checked={s.done}
              onChange={() => toggleSubtask(goal.id, s.id)}
              label={s.done ? `Desmarcar ${s.title}` : `Concluir ${s.title}`}
            />
            <span className={cn('flex-1 text-sm', s.done ? 'text-ink-3 line-through' : 'text-ink')}>{s.title}</span>
            <IconButton
              icon={X}
              label={`Remover etapa ${s.title}`}
              size="sm"
              className="size-7 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
              onClick={() => deleteSubtask(goal.id, s.id)}
            />
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="mt-auto flex items-center gap-2 px-5 pt-2 pb-4">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Adicionar etapa"
          aria-label={`Nova etapa para ${goal.title}`}
          className="h-9"
        />
        <IconButton icon={Plus} label="Adicionar etapa" size="sm" type="submit" disabled={!draft.trim()} />
      </form>
    </>
  );
}

function MeasuredBody({ goal, metrics }: { goal: Goal; metrics: GoalMetrics }) {
  const allEntries = usePersonalStore((s) => s.goalEntries);
  const addGoalEntry = usePersonalStore((s) => s.addGoalEntry);
  const deleteGoalEntry = usePersonalStore((s) => s.deleteGoalEntry);
  const accountName = useAccountName();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const today = todayISO();
  const format = (v: number) => formatGoalValue(goal, v);
  const linkedAccount = goal.kind === 'savings' && goal.accountId;
  const lastMode = goal.kind === 'numeric' && goal.measure === 'last';

  const recent = allEntries
    .filter((e) => e.goalId === goal.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = parseGoalValue(goal, draft);
    if (value === null || (!lastMode && value === 0)) {
      setError(goal.kind === 'savings' ? 'Use o formato 250,00 (ou -250,00 para retirada).' : 'Digite um número, ex.: 1 ou 2,5.');
      return;
    }
    addGoalEntry({ goalId: goal.id, date: today, value });
    setDraft('');
    setError(null);
  };

  const pace = metrics.pace;
  return (
    <div className="flex flex-1 flex-col px-5 pt-4 pb-4">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="font-display text-xl font-semibold tabular">{format(metrics.current)}</span>
        <span className="text-sm text-ink-3 tabular">
          meta {format(metrics.target)} · {Math.round(metrics.progress * 100)}%
        </span>
      </div>
      <ProgressBar value={metrics.progress} tone={metrics.done ? 'good' : 'accent'} label={`Progresso de ${goal.title}`} />

      {!metrics.done && (
        <p className="mt-2 text-sm text-ink-2">
          Faltam <span className="font-medium tabular">{format(metrics.remaining)}</span>
          {linkedAccount && <> no saldo de {accountName(goal.accountId)}</>}.
        </p>
      )}
      {pace && (
        <p
          className={cn(
            'mt-2 flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs',
            pace.onTrack === false ? 'bg-warn-soft text-warn' : pace.onTrack ? 'bg-good-soft text-income' : 'bg-surface-2 text-ink-2',
          )}
        >
          {pace.onTrack === false ? (
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          ) : (
            <CircleCheck className="mt-px size-3.5 shrink-0" aria-hidden />
          )}
          <span>
            {pace.monthsLeft >= 1
              ? `Precisa de ${format(pace.neededPerMonth)} por mês até o prazo.`
              : `Falta menos de um mês: ${format(pace.neededPerMonth)} até o prazo.`}{' '}
            {pace.avgPerMonth === null
              ? 'Ainda sem histórico para medir o ritmo.'
              : `Ritmo recente: ${format(Math.max(0, pace.avgPerMonth))}/mês${pace.onTrack ? ', no caminho.' : ', abaixo do necessário.'}`}
          </span>
        </p>
      )}

      {linkedAccount ? (
        <Link
          to={`/finance/transactions?conta=${goal.accountId}`}
          className="mt-auto pt-4 text-sm font-medium text-accent hover:underline"
        >
          Ver movimentações da conta
        </Link>
      ) : (
        <>
          {recent.length > 0 && (
            <ul className="mt-3 flex flex-col">
              {recent.map((entry) => (
                <li key={entry.id} className="group flex items-center gap-2 py-1 text-sm">
                  <span className="w-20 shrink-0 text-xs text-ink-3">{relativeDay(entry.date, today)}</span>
                  <span className="flex-1 tabular">
                    {!lastMode && entry.value > 0 && '+'}
                    {format(entry.value)}
                  </span>
                  <IconButton
                    icon={X}
                    label="Remover registro"
                    size="sm"
                    className="size-7 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                    onClick={() => deleteGoalEntry(entry.id)}
                  />
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={submit} className="mt-auto flex items-center gap-2 pt-3">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              inputMode="decimal"
              placeholder={goal.kind === 'savings' ? 'Aporte, ex.: 300,00' : lastMode ? 'Nova medição' : 'Quanto avançou, ex.: 1'}
              aria-label={`Registrar avanço em ${goal.title}`}
              aria-invalid={Boolean(error)}
              className="h-9"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={!draft.trim()}>
              Registrar
            </Button>
          </form>
          {error && (
            <p className="mt-1 text-xs text-expense" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
