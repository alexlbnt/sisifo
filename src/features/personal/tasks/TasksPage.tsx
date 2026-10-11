import { useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Columns3, List, ListTodo, Plus } from 'lucide-react';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  PageHeader,
  ProgressBar,
  SectionTabs,
  SegmentedControl,
} from '@/components/ui';
import { useShortcutParam } from '@/hooks/useShortcutParam';
import { addDaysISO, fmt, relativeDay, todayISO } from '@/lib/dates';
import { findArea, useAreas } from '../meta';
import { iconFor } from '@/components/ui/icons';
import { overdueTasks, sortTasks, tasksForDay } from '../selectors';
import { usePersonalStore } from '../store';
import type { Area, Task } from '../types';
import { TaskBoard } from './TaskBoard';
import { TaskForm } from './TaskForm';
import { TaskItem } from './TaskItem';

export const PLANNING_TABS = [
  { to: '/personal/tasks', label: 'Tarefas' },
  { to: '/personal/goals', label: 'Metas' },
];

type View = 'list' | 'board';

export function TasksPage() {
  const tasks = usePersonalStore((s) => s.tasks);
  const deleteTask = usePersonalStore((s) => s.deleteTask);
  const moveTasksToDay = usePersonalStore((s) => s.moveTasksToDay);

  const today = todayISO();
  const [day, setDay] = useState(today);
  const [view, setView] = useState<View>('list');
  const [form, setForm] = useState<{ task?: Task; area?: Area } | null>(null);
  const [toDelete, setToDelete] = useState<Task | null>(null);
  useShortcutParam('nova', () => setForm({}));

  const dayTasks = useMemo(() => tasksForDay(tasks, day), [tasks, day]);
  const areas = useAreas();
  // Uma coluna por área ativa, mais as arquivadas que ainda têm tarefa no dia.
  const dayAreas = useMemo(() => {
    const ids = new Set(dayTasks.map((t) => t.area));
    const list = areas.filter((a) => !a.archived || ids.has(a.id));
    for (const id of ids) if (!list.some((a) => a.id === id)) list.push(findArea(areas, id));
    return list;
  }, [areas, dayTasks]);
  const overdue = useMemo(() => (day === today ? overdueTasks(tasks, today) : []), [tasks, day, today]);
  const doneCount = dayTasks.filter((t) => t.status === 'done').length;

  const openEdit = (task: Task) => setForm({ task });

  return (
    <>
      <PageHeader
        title="Planejamento"
        subtitle="O que fazer hoje e para onde isso leva"
        actions={
          <Button icon={Plus} onClick={() => setForm({})}>
            Nova tarefa
          </Button>
        }
      />
      <SectionTabs tabs={PLANNING_TABS} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-line bg-surface">
            <IconButton icon={ChevronLeft} label="Dia anterior" size="sm" onClick={() => setDay(addDaysISO(day, -1))} />
            <span className="min-w-28 text-center text-sm font-medium" aria-live="polite">
              {relativeDay(day, today)}
            </span>
            <IconButton icon={ChevronRight} label="Próximo dia" size="sm" onClick={() => setDay(addDaysISO(day, 1))} />
          </div>
          {day !== today && (
            <Button variant="ghost" size="sm" onClick={() => setDay(today)}>
              Voltar para hoje
            </Button>
          )}
        </div>
        <SegmentedControl<View>
          label="Visualização"
          value={view}
          onChange={setView}
          className="hidden lg:inline-flex"
          options={[
            { value: 'list', label: 'Lista', icon: List },
            { value: 'board', label: 'Quadro', icon: Columns3 },
          ]}
        />
      </div>

      <div className="mb-5 flex items-center gap-3">
        <ProgressBar
          value={dayTasks.length ? doneCount / dayTasks.length : 0}
          label="Tarefas concluídas no dia"
          className="max-w-xs"
        />
        <span className="text-sm text-ink-2 tabular">
          {doneCount} de {dayTasks.length} feitas · {fmt.long(day)}
        </span>
      </div>

      {overdue.length > 0 && (
        <Card
          className="mb-4 border-warn/40"
          flush
          title={
            <span className="flex items-center gap-2">
              <AlertCircle className="size-4 text-warn" aria-hidden />
              {overdue.length === 1 ? '1 tarefa atrasada' : `${overdue.length} tarefas atrasadas`}
            </span>
          }
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => moveTasksToDay(overdue.map((t) => t.id), today)}
            >
              Trazer todas para hoje
            </Button>
          }
        >
          <ul className="divide-y divide-line pb-2">
            {overdue.map((t) => (
              <TaskItem key={t.id} task={t} meta={relativeDay(t.date, today)} onEdit={openEdit} onDelete={setToDelete} />
            ))}
          </ul>
        </Card>
      )}

      {view === 'board' ? (
        <div className="hidden lg:block">
          <TaskBoard tasks={dayTasks} onEdit={openEdit} onDelete={setToDelete} />
        </div>
      ) : null}

      <div className={view === 'board' ? 'lg:hidden' : undefined}>
        {dayTasks.length === 0 ? (
          <Card>
            <EmptyState
              icon={ListTodo}
              title="Dia livre"
              text="Nenhuma tarefa marcada para este dia."
              action={
                <Button size="sm" icon={Plus} onClick={() => setForm({})}>
                  Nova tarefa
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dayAreas.map(({ id: area, label, icon }) => {
              const items = sortTasks(dayTasks.filter((t) => t.area === area));
              const Icon = iconFor(icon);
              return (
                <Card
                  key={area}
                  flush
                  title={
                    <span className="flex items-center gap-2">
                      <Icon className="size-4 text-ink-3" aria-hidden />
                      {label}
                    </span>
                  }
                  action={
                    <IconButton
                      icon={Plus}
                      label={`Adicionar tarefa em ${label}`}
                      size="sm"
                      onClick={() => setForm({ area })}
                    />
                  }
                >
                  {items.length === 0 ? (
                    <p className="px-5 pt-2 pb-5 text-sm text-ink-3">Nada nesta área.</p>
                  ) : (
                    <ul className="divide-y divide-line pb-2">
                      {items.map((t) => (
                        <TaskItem key={t.id} task={t} onEdit={openEdit} onDelete={setToDelete} />
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <TaskForm
        open={Boolean(form)}
        task={form?.task}
        defaultArea={form?.area}
        defaultDate={day}
        onClose={() => setForm(null)}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir tarefa?"
        message={toDelete ? `"${toDelete.title}" será removida.` : ''}
        confirmLabel="Excluir tarefa"
        onConfirm={() => toDelete && deleteTask(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
