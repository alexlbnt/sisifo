import { ChevronLeft, ChevronRight, Pencil, Target, Trash2 } from 'lucide-react';
import { Badge, IconButton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { AREAS, TASK_STATUS, TASK_STATUS_ORDER } from '../meta';
import { usePersonalStore } from '../store';
import type { Task } from '../types';

interface TaskBoardProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

/** Quadro Kanban (só no desktop). Os cartões andam entre colunas pelas setas. */
export function TaskBoard({ tasks, onEdit, onDelete }: TaskBoardProps) {
  const setTaskStatus = usePersonalStore((s) => s.setTaskStatus);
  const goals = usePersonalStore((s) => s.goals);

  return (
    <div className="grid grid-cols-3 gap-4">
      {TASK_STATUS_ORDER.map((status, col) => {
        const items = tasks.filter((t) => t.status === status);
        return (
          <section
            key={status}
            aria-label={TASK_STATUS[status]}
            className="flex min-h-64 flex-col rounded-2xl border border-line bg-surface-2/60 p-3"
          >
            <h2 className="mb-3 flex items-center justify-between px-1 font-sans text-sm font-semibold">
              {TASK_STATUS[status]}
              <span className="text-xs font-medium text-ink-3 tabular">{items.length}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {items.map((task) => {
                const Icon = AREAS[task.area].icon;
                const goal = task.link && goals.find((g) => g.id === task.link?.goalId);
                const prev = TASK_STATUS_ORDER[col - 1];
                const next = TASK_STATUS_ORDER[col + 1];
                return (
                  <li key={task.id} className="group rounded-xl border border-line bg-surface p-3">
                    <p className={cn('text-sm', status === 'done' && 'text-ink-3 line-through')}>
                      {task.title}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge>
                        <Icon className="size-3" aria-hidden />
                        {AREAS[task.area].label}
                      </Badge>
                      {goal && (
                        <Badge tone="accent">
                          <Target className="size-3" aria-hidden />
                          <span className="max-w-32 truncate">{goal.title}</span>
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                        <IconButton icon={Pencil} label={`Editar ${task.title}`} size="sm" onClick={() => onEdit(task)} />
                        <IconButton icon={Trash2} label={`Excluir ${task.title}`} size="sm" onClick={() => onDelete(task)} />
                      </div>
                      <div className="flex">
                        {prev && (
                          <IconButton
                            icon={ChevronLeft}
                            label={`Mover para ${TASK_STATUS[prev]}`}
                            size="sm"
                            onClick={() => setTaskStatus(task.id, prev)}
                          />
                        )}
                        {next && (
                          <IconButton
                            icon={ChevronRight}
                            label={`Mover para ${TASK_STATUS[next]}`}
                            size="sm"
                            onClick={() => setTaskStatus(task.id, next)}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
              {items.length === 0 && (
                <li className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-ink-3">
                  Nenhuma tarefa aqui
                </li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
