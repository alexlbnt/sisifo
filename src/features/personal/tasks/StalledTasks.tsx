import { useState } from 'react';
import { Link } from 'react-router';
import { Hourglass } from 'lucide-react';
import { cn } from '@/lib/cn';
import { relativeDay, todayISO } from '@/lib/dates';
import { stalledTasks } from '../selectors';
import { usePersonalStore } from '../store';
import type { Task } from '../types';

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

function StalledRow({ task }: { task: Task }) {
  const restartTask = usePersonalStore((s) => s.restartTask);
  const deleteTask = usePersonalStore((s) => s.deleteTask);
  const addHabit = usePersonalStore((s) => s.addHabit);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const today = todayISO();

  const btn = 'min-h-9 rounded-lg px-2.5 text-xs font-medium';
  return (
    <li className="flex flex-col gap-2 px-5 py-2.5 sm:flex-row sm:items-center">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{task.title}</span>
        <span className="text-xs text-ink-3">
          Adiada {task.postponed} vezes, agora para {relativeDay(task.date, today).toLowerCase()}
        </span>
      </span>
      <span className="flex flex-wrap gap-1.5">
        <button type="button" className={cn(btn, 'bg-accent text-accent-ink')} onClick={() => restartTask(task.id, today)}>
          Fazer hoje
        </button>
        <button
          type="button"
          className={cn(btn, 'ring-1 ring-line ring-inset')}
          title="Cria um hábito diário com este nome e tira a tarefa da lista"
          onClick={() => {
            addHabit({ title: task.title, area: task.area, schedule: EVERY_DAY, kind: 'check', frequency: 'days' });
            deleteTask(task.id);
          }}
        >
          Virar hábito
        </button>
        {confirmDelete ? (
          <button type="button" className={cn(btn, 'bg-expense text-white dark:text-bg')} onClick={() => deleteTask(task.id)}>
            Apagar mesmo
          </button>
        ) : (
          <button type="button" className={cn(btn, 'text-expense')} onClick={() => setConfirmDelete(true)}>
            Apagar
          </button>
        )}
      </span>
    </li>
  );
}

/**
 * Tarefas "zumbis": adiadas 3 vezes ou mais. Em vez de empurrar de novo,
 * pede uma decisão: fazer hoje, virar hábito ou apagar.
 */
export function StalledTasks({ className, limit = 3 }: { className?: string; limit?: number }) {
  const tasks = usePersonalStore((s) => s.tasks);
  const stalled = stalledTasks(tasks);
  if (!stalled.length) return null;

  return (
    <section aria-label="Tarefas adiadas várias vezes" className={cn('rounded-xl border border-warn/40 bg-warn-soft/40', className)}>
      <p className="flex items-center gap-2 px-5 pt-3 text-sm font-medium text-warn">
        <Hourglass className="size-4 shrink-0" aria-hidden />
        {stalled.length === 1 ? 'Uma tarefa vem sendo adiada' : `${stalled.length} tarefas vêm sendo adiadas`}
      </p>
      <p className="px-5 text-xs text-ink-2">Em vez de empurrar de novo, decida o que fazer com elas.</p>
      <ul className="divide-y divide-line/70">
        {stalled.slice(0, limit).map((t) => (
          <StalledRow key={t.id} task={t} />
        ))}
      </ul>
      {stalled.length > limit && (
        <Link to="/review" className="block px-5 pb-3 text-xs font-medium text-accent hover:underline">
          Ver as outras {stalled.length - limit} na revisão semanal
        </Link>
      )}
    </section>
  );
}
