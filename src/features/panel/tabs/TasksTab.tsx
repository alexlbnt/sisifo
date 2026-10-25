import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, PartyPopper, Timer, Undo2 } from 'lucide-react';
import { relativeDay, type ISODate } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';
import { usePersonalStore } from '@/features/personal/store';
import type { Task } from '@/features/personal/types';
import { minutesLabel } from '../format';
import { usePanelStore } from '../panelStore';
import { dueGroup, sortByDue, type DueGroup } from '../tasks';

/** Tempo em que a tarefa concluída continua na tela, com "Desfazer" (toque sem querer). */
const UNDO_MS = 5000;

const GROUP_STYLE: Record<DueGroup, string> = {
  overdue: 'border-expense bg-danger-soft',
  today: 'border-accent bg-surface',
  upcoming: 'border-line bg-surface',
};

const GROUP_TEXT: Record<DueGroup, string> = {
  overdue: 'text-expense font-semibold',
  today: 'text-accent font-semibold',
  upcoming: 'text-ink-3',
};

function TaskRow({ task, today, done, onToggle }: { task: Task; today: ISODate; done: boolean; onToggle: () => void }) {
  const focusMs = usePanelStore((s) => s.focusByTask[task.id] ?? 0);
  const group = dueGroup(task, today);
  const when = group === 'overdue' ? `Atrasada · ${relativeDay(task.date, today)}` : relativeDay(task.date, today);

  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        onClick={onToggle}
        className={cn(
          'flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left',
          done ? 'border-line bg-good-soft' : GROUP_STYLE[group],
        )}
      >
        <span
          className={cn(
            'grid size-12 shrink-0 place-items-center rounded-full border-[3px]',
            done ? 'border-income bg-income text-bg' : 'border-ink-3 text-transparent',
          )}
        >
          {done ? <Undo2 className="size-6" aria-hidden /> : <Check className="size-6" strokeWidth={3} aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-lg leading-snug font-medium', done && 'text-ink-3 line-through')}>
            {task.title}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-sm">
            {done ? (
              <span className="text-income">Concluída · toque para desfazer</span>
            ) : (
              <>
                <span className={GROUP_TEXT[group]}>{when}</span>
                {task.time && <span className="text-ink-2 tabular">{task.time}</span>}
                {task.priority === 'high' && <span className="text-warn font-semibold">! alta</span>}
                {focusMs > 0 && (
                  <span className="inline-flex items-center gap-1 text-ink-3">
                    <Timer className="size-3.5" aria-hidden />
                    {minutesLabel(focusMs)}
                  </span>
                )}
              </>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

export function TasksTab({ today }: { today: ISODate }) {
  const tasks = usePersonalStore((s) => s.tasks);
  const toggleTask = usePersonalStore((s) => s.toggleTask);
  // Concluídas há pouco: continuam na lista por alguns segundos.
  const [recent, setRecent] = useState<Record<string, number>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  const list = useMemo(() => sortByDue(tasks.filter((t) => t.status !== 'done' || recent[t.id])), [tasks, recent]);

  const overdue = list.filter((t) => t.status !== 'done' && t.date < today).length;
  const dueToday = list.filter((t) => t.status !== 'done' && t.date === today).length;

  const toggle = (task: Task) => {
    haptic();
    toggleTask(task.id);
    const id = task.id;
    clearTimeout(timers.current.get(id));
    if (task.status === 'done') {
      // Desfez: sai da lista de recentes.
      setRecent(({ [id]: _, ...rest }) => rest);
      return;
    }
    setRecent((r) => ({ ...r, [id]: Date.now() }));
    timers.current.set(
      id,
      setTimeout(() => setRecent(({ [id]: _, ...rest }) => rest), UNDO_MS),
    );
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-1">
        <h2 className="text-[clamp(1.5rem,5vmin,2.5rem)] font-semibold">Tarefas</h2>
        {overdue > 0 && <span className="text-lg font-semibold text-expense">{overdue} atrasada{overdue > 1 && 's'}</span>}
        <span className="text-lg text-ink-2">{dueToday} para hoje</span>
      </header>
      {list.length === 0 ? (
        <p className="flex flex-1 flex-col items-center justify-center gap-3 text-xl text-ink-2">
          <PartyPopper className="size-12 text-income" aria-hidden />
          Nenhuma tarefa pendente.
        </p>
      ) : (
        <ul className="scroll-y task-grid min-h-0 flex-1 content-start pb-2">
          {list.map((task) => (
            <TaskRow key={task.id} task={task} today={today} done={task.status === 'done'} onToggle={() => toggle(task)} />
          ))}
        </ul>
      )}
    </div>
  );
}
