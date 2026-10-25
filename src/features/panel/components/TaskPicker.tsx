import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { relativeDay, type ISODate } from '@/lib/dates';
import { usePersonalStore } from '@/features/personal/store';
import { dueGroup, pendingByDue } from '../tasks';

interface TaskPickerProps {
  today: ISODate;
  selected: string | null;
  onPick: (taskId: string | null) => void;
  onClose: () => void;
}

/** Escolhe a tarefa do Sísifo que recebe o tempo de foco. */
export function TaskPicker({ today, selected, onPick, onClose }: TaskPickerProps) {
  const tasks = usePersonalStore((s) => s.tasks);
  const pending = useMemo(() => pendingByDue(tasks).slice(0, 60), [tasks]);

  const row = (id: string | null, title: string, meta?: string, tone?: string) => (
    <li key={id ?? 'none'}>
      <button
        type="button"
        onClick={() => onPick(id)}
        className={cn(
          'flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-2 text-left',
          selected === id ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-medium">{title}</span>
          {meta && <span className={cn('block text-sm', tone ?? 'text-ink-3')}>{meta}</span>}
        </span>
        {selected === id && <Check className="size-6 shrink-0 text-accent" aria-hidden />}
      </button>
    </li>
  );

  return (
    <div className="panel-fade absolute inset-0 z-20 flex flex-col bg-bg p-3" role="dialog" aria-label="Ligar foco a uma tarefa">
      <header className="mb-3 flex items-center gap-3">
        <h2 className="flex-1 text-2xl font-semibold">Focar em qual tarefa?</h2>
        <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-12 place-items-center rounded-xl text-ink-2">
          <X className="size-7" aria-hidden />
        </button>
      </header>
      <ul className="scroll-y task-grid flex-1 content-start pb-3">
        {row(null, 'Sem tarefa', 'O foco conta só no total do dia')}
        {pending.map((t) => {
          const group = dueGroup(t, today);
          return row(
            t.id,
            t.title,
            group === 'overdue' ? `Atrasada · ${relativeDay(t.date, today)}` : relativeDay(t.date, today) + (t.time ? ` · ${t.time}` : ''),
            group === 'overdue' ? 'text-expense' : group === 'today' ? 'text-accent' : undefined,
          );
        })}
      </ul>
    </div>
  );
}
