import type { ISODate } from '@/lib/dates';
import type { Task, TaskPriority } from '@/features/personal/types';

export type DueGroup = 'overdue' | 'today' | 'upcoming';

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

export function dueGroup(task: Task, today: ISODate): DueGroup {
  if (task.date < today) return 'overdue';
  return task.date === today ? 'today' : 'upcoming';
}

/** Por prazo: data, depois horário (sem horário por último), depois prioridade. */
export function sortByDue(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? '99:99').localeCompare(b.time ?? '99:99') ||
      PRIORITY_RANK[a.priority ?? 'medium'] - PRIORITY_RANK[b.priority ?? 'medium'] ||
      a.title.localeCompare(b.title),
  );
}

export const pendingByDue = (tasks: Task[]) => sortByDue(tasks.filter((t) => t.status !== 'done'));
