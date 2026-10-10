import { CirclePlay, Pencil, Target, Trash2 } from 'lucide-react';
import { Badge, CheckCircle, IconButton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { usePersonalStore } from '../store';
import type { Task } from '../types';

interface TaskItemProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  /** Texto extra abaixo do título (ex.: "Ontem"). */
  meta?: string;
}

export function TaskItem({ task, onEdit, onDelete, meta }: TaskItemProps) {
  const toggleTask = usePersonalStore((s) => s.toggleTask);
  const setTaskStatus = usePersonalStore((s) => s.setTaskStatus);
  const goalTitle = usePersonalStore((s) =>
    task.link ? s.goals.find((g) => g.id === task.link?.goalId)?.title : undefined,
  );
  const done = task.status === 'done';

  return (
    <li className="group flex items-center gap-3 px-5 py-2.5">
      <CheckCircle
        checked={done}
        onChange={() => toggleTask(task.id)}
        label={done ? `Desmarcar ${task.title}` : `Concluir ${task.title}`}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', done ? 'text-ink-3 line-through' : 'text-ink')}>{task.title}</p>
        {(goalTitle || meta || task.status === 'doing') && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
            {task.status === 'doing' && <Badge tone="accent">Fazendo</Badge>}
            {meta && <span>{meta}</span>}
            {goalTitle && (
              <span className="flex min-w-0 items-center gap-1">
                <Target className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{goalTitle}</span>
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        {task.status === 'todo' && (
          <IconButton
            icon={CirclePlay}
            label={`Começar ${task.title}`}
            size="sm"
            onClick={() => setTaskStatus(task.id, 'doing')}
          />
        )}
        {onEdit && <IconButton icon={Pencil} label={`Editar ${task.title}`} size="sm" onClick={() => onEdit(task)} />}
        {onDelete && (
          <IconButton icon={Trash2} label={`Excluir ${task.title}`} size="sm" onClick={() => onDelete(task)} />
        )}
      </div>
    </li>
  );
}
