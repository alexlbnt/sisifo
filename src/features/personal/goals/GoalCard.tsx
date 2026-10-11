import { useState, type FormEvent } from 'react';
import { CalendarClock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Badge, CheckCircle, IconButton, Input, ProgressBar } from '@/components/ui';
import { cn } from '@/lib/cn';
import { daysBetween, fmt, todayISO } from '@/lib/dates';
import { useAreaLookup } from '../meta';
import { goalProgress } from '../selectors';
import { usePersonalStore } from '../store';
import type { Goal } from '../types';

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
  const toggleSubtask = usePersonalStore((s) => s.toggleSubtask);
  const addSubtask = usePersonalStore((s) => s.addSubtask);
  const deleteSubtask = usePersonalStore((s) => s.deleteSubtask);
  const [draft, setDraft] = useState('');

  const progress = goalProgress(goal);
  const done = goal.subtasks.filter((s) => s.done).length;
  const complete = goal.subtasks.length > 0 && progress === 1;
  const areas = useAreaLookup();
  const AreaIcon = areas.icon(goal.area);
  const deadline = goal.deadline && !complete ? deadlineLabel(goal.deadline) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    addSubtask(goal.id, draft);
    setDraft('');
  };

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
            {complete && <Badge tone="good">Concluída</Badge>}
          </div>
        </div>
        <div className="-mr-2 flex">
          <IconButton icon={Pencil} label={`Editar ${goal.title}`} size="sm" onClick={() => onEdit(goal)} />
          <IconButton icon={Trash2} label={`Excluir ${goal.title}`} size="sm" onClick={() => onDelete(goal)} />
        </div>
      </header>

      <div className="px-5 pt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="font-display text-xl font-semibold tabular">{Math.round(progress * 100)}%</span>
          <span className="text-ink-3 tabular">
            {done} de {goal.subtasks.length} etapas
          </span>
        </div>
        <ProgressBar value={progress} tone={complete ? 'good' : 'accent'} label={`Progresso de ${goal.title}`} />
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
            <span className={cn('flex-1 text-sm', s.done ? 'text-ink-3 line-through' : 'text-ink')}>
              {s.title}
            </span>
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
    </article>
  );
}
