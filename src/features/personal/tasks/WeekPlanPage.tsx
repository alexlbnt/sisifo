import { useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { AlertCircle, CalendarDays, Check, ChevronLeft, ChevronRight, Dumbbell, GripVertical, Plus } from 'lucide-react';
import { Button, CheckCircle, IconButton, Input, Modal, PageHeader, SectionTabs } from '@/components/ui';
import { cn } from '@/lib/cn';
import { addDaysISO, fmt, relativeDay, startOfWeekISO, todayISO, weekDaysFrom, weekdayOf, type ISODate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { busyHours, eventsOnLocalDay, useAgendaWeek } from '@/features/agenda/agendaStore';
import { hhmm } from '@/features/panel/format';
import type { AgendaEvent } from '@/shared/agenda';
import { defaultAreaFor, useAreas } from '../meta';
import { overdueTasks, plansForDay, sortTasks, tasksForDay } from '../selectors';
import { usePersonalStore } from '../store';
import type { Task, WorkoutPlan } from '../types';
import { PLANNING_TABS } from './TasksPage';
import { dayLoad, loadLabel, type DayLoad } from './weekPlan';

const DRAG_TYPE = 'application/x-sisifo-task';

interface DayData {
  date: ISODate;
  tasks: Task[];
  events: AgendaEvent[];
  plans: Array<{ plan: WorkoutPlan; done: boolean }>;
  load: DayLoad;
}

/* ───────── Tarefa ───────── */

function TaskChip({ task, onMove }: { task: Task; onMove: (task: Task) => void }) {
  const toggleTask = usePersonalStore((s) => s.toggleTask);
  const done = task.status === 'done';
  return (
    <li
      draggable={!done}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={cn('group flex items-start gap-2 rounded-lg px-1.5 py-1', !done && 'cursor-grab hover:bg-surface-2 active:cursor-grabbing')}
    >
      <CheckCircle
        size="sm"
        checked={done}
        label={done ? `Desmarcar ${task.title}` : `Concluir ${task.title}`}
        onChange={() => {
          if (!done) haptic();
          toggleTask(task.id);
        }}
      />
      <button
        type="button"
        disabled={done}
        onClick={() => onMove(task)}
        title={done ? undefined : 'Mover para outro dia'}
        className={cn('min-w-0 flex-1 text-left text-sm leading-snug', done ? 'text-ink-3 line-through' : 'text-ink')}
      >
        <span className="line-clamp-2">
          {task.time && <span className="mr-1 text-xs text-ink-3 tabular">{task.time}</span>}
          {task.title}
        </span>
      </button>
      {!done && <GripVertical className="mt-0.5 hidden size-3.5 shrink-0 text-ink-3 opacity-0 group-hover:opacity-100 lg:block" aria-hidden />}
    </li>
  );
}

/* ───────── Dia ───────── */

function QuickAdd({ date }: { date: ISODate }) {
  const addTask = usePersonalStore((s) => s.addTask);
  const areas = useAreas();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addTask({ title: title.trim(), area: defaultAreaFor(areas), date });
    setTitle('');
  };
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-9 items-center gap-1 rounded-lg px-1.5 text-xs font-medium text-ink-3 hover:bg-surface-2 hover:text-accent">
        <Plus className="size-3.5" aria-hidden /> Tarefa
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="flex gap-1">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !title.trim() && setOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="Nova tarefa"
        aria-label={`Nova tarefa para ${fmt.long(date)}`}
        className="h-9"
      />
      <IconButton icon={Plus} label="Adicionar" type="submit" size="sm" className="size-9 border border-line" />
    </form>
  );
}

function DayColumn({
  day,
  today,
  dragging,
  onMove,
  onDropTask,
}: {
  day: DayData;
  today: ISODate;
  dragging: boolean;
  onMove: (task: Task) => void;
  onDropTask: (id: string, date: ISODate) => void;
}) {
  const [over, setOver] = useState(false);
  const past = day.date < today;
  const isToday = day.date === today;
  const label = loadLabel(day.load);
  const canDrop = !past;

  const onDragOver = (e: DragEvent) => {
    if (!canDrop || !e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    setOver(true);
  };
  const onDrop = (e: DragEvent) => {
    setOver(false);
    const id = e.dataTransfer.getData(DRAG_TYPE);
    if (id && canDrop) {
      e.preventDefault();
      onDropTask(id, day.date);
    }
  };

  return (
    <li
      onDragOver={onDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      aria-label={fmt.long(day.date)}
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-2xl border bg-surface p-3 transition-colors lg:min-h-64',
        isToday ? 'border-accent' : 'border-line',
        past && 'bg-surface-2/60',
        dragging && canDrop && 'border-dashed',
        over && 'border-accent bg-accent-soft/50',
      )}
    >
      <header className="flex items-baseline justify-between gap-2">
        <p className={cn('text-sm font-semibold', isToday ? 'text-accent' : past ? 'text-ink-3' : 'text-ink')}>
          {fmt.weekdayShort(day.date)} <span className="font-normal tabular">{day.date.slice(8, 10)}</span>
          {isToday && <span className="ml-1 text-xs font-medium">hoje</span>}
        </p>
        {day.load.heavy && !past && (
          <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">Dia cheio</span>
        )}
      </header>
      {label && !past && <p className="-mt-1.5 text-xs text-ink-3 first-letter:uppercase">{label}</p>}

      {day.events.length > 0 && (
        <ul className="flex flex-col gap-0.5 border-l-2 border-ink-3/30 pl-2" aria-label="Compromissos">
          {day.events.map((e) => (
            <li key={e.id} className="text-xs leading-snug text-ink-2">
              <span className="text-ink-3 tabular">{e.allDay ? 'Dia todo' : hhmm(e.start)}</span> <span className="line-clamp-2 inline">{e.title}</span>
            </li>
          ))}
        </ul>
      )}

      {day.plans.length > 0 && (
        <ul className="flex flex-col gap-0.5" aria-label="Treinos previstos">
          {day.plans.map(({ plan, done }) => (
            <li key={plan.id} className={cn('flex items-center gap-1.5 text-xs', done ? 'text-income' : 'text-ink-2')}>
              {done ? <Check className="size-3.5 shrink-0" aria-hidden /> : <Dumbbell className="size-3.5 shrink-0 text-ink-3" aria-hidden />}
              <span className="truncate">{plan.label}</span>
            </li>
          ))}
        </ul>
      )}

      {day.tasks.length > 0 && (
        <ul className="-mx-1.5 flex flex-col" aria-label="Tarefas">
          {day.tasks.map((t) => (
            <TaskChip key={t.id} task={t} onMove={onMove} />
          ))}
        </ul>
      )}

      {!past && <QuickAdd date={day.date} />}
    </li>
  );
}

/* ───────── Mover (toque) ───────── */

/** "Hoje", "Amanhã" ou "Ter, 27 de out". */
function dayName(date: ISODate, today: ISODate): string {
  const rel = relativeDay(date, today);
  return rel === 'Hoje' || rel === 'Amanhã' ? rel : `${fmt.weekdayShort(date)}, ${fmt.short(date)}`;
}

function MoveSheet({ task, days, today, onClose }: { task: Task; days: DayData[]; today: ISODate; onClose: () => void }) {
  const moveTasksToDay = usePersonalStore((s) => s.moveTasksToDay);
  const move = (date: ISODate) => {
    moveTasksToDay([task.id], date);
    onClose();
  };
  // Mesmo dia da semana, na semana seguinte à que está na tela.
  const base = task.date < today ? today : task.date;
  const nextWeek = addDaysISO(days[0]!.date, 7 + ((weekdayOf(base) + 6) % 7));
  return (
    <Modal open onClose={onClose} title="Mover para" description={task.title} focusFirstField={false}>
      <ul className="flex flex-col gap-1.5">
        {days
          .filter((d) => d.date >= today)
          .map((d) => (
            <li key={d.date}>
              <button
                type="button"
                disabled={d.date === task.date}
                onClick={() => move(d.date)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-line px-3 text-left hover:border-accent disabled:opacity-50"
              >
                <span className="w-28 shrink-0 text-sm font-medium">{dayName(d.date, today)}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-ink-3">{loadLabel(d.load) || 'livre'}</span>
                {d.load.heavy && <span className="text-[11px] font-semibold text-warn">Dia cheio</span>}
                {d.date === task.date && <span className="text-xs text-ink-3">atual</span>}
              </button>
            </li>
          ))}
        <li>
          <button
            type="button"
            onClick={() => move(nextWeek)}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-dashed border-line px-3 text-left text-sm hover:border-accent"
          >
            Semana seguinte: {dayName(nextWeek, today)}
          </button>
        </li>
      </ul>
    </Modal>
  );
}

/* ───────── Página ───────── */

/** A semana inteira: compromissos do Google, treinos previstos e tarefas, para distribuir o trabalho. */
export function WeekPlanPage() {
  const today = todayISO();
  const thisWeek = startOfWeekISO(today);
  // No domingo, planejar é olhar a semana que começa amanhã.
  const [monday, setMonday] = useState(() => (weekdayOf(today) === 0 ? addDaysISO(thisWeek, 7) : thisWeek));
  const tasks = usePersonalStore((s) => s.tasks);
  const plans = usePersonalStore((s) => s.workoutPlans);
  const sessions = usePersonalStore((s) => s.workoutSessions);
  const moveTasksToDay = usePersonalStore((s) => s.moveTasksToDay);
  const agenda = useAgendaWeek(monday);
  const [moving, setMoving] = useState<Task | null>(null);
  const [dragging, setDragging] = useState(false);

  const days: DayData[] = useMemo(
    () =>
      weekDaysFrom(monday).map((date) => {
        const dayTasks = sortTasks(tasksForDay(tasks, date));
        const events = agenda ? eventsOnLocalDay(agenda.events, date) : [];
        const dayPlans = plansForDay(plans, date).map((plan) => ({
          plan,
          done: sessions.some((s) => s.date === date && s.planId === plan.id),
        }));
        return {
          date,
          tasks: dayTasks,
          events,
          plans: dayPlans,
          load: dayLoad(dayTasks.filter((t) => t.status !== 'done').length, busyHours(events, date), dayPlans.filter((p) => !p.done).length),
        };
      }),
    [monday, tasks, plans, sessions, agenda],
  );
  // Atrasadas aparecem para distribuir na semana atual ou na próxima.
  const overdue = monday === thisWeek || monday === addDaysISO(thisWeek, 7) ? overdueTasks(tasks, today) : [];
  const heavyDays = days.filter((d) => d.date >= today && d.load.heavy).length;

  return (
    <div onDragStart={() => setDragging(true)} onDragEnd={() => setDragging(false)}>
      <PageHeader title="Planejamento" subtitle="A semana inteira: compromissos, treinos e tarefas" />
      <SectionTabs tabs={PLANNING_TABS} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-lg border border-line bg-surface">
          <IconButton icon={ChevronLeft} label="Semana anterior" size="sm" onClick={() => setMonday(addDaysISO(monday, -7))} />
          <span className="min-w-40 text-center text-sm font-medium" aria-live="polite">
            {fmt.short(monday)} a {fmt.short(addDaysISO(monday, 6))}
          </span>
          <IconButton icon={ChevronRight} label="Próxima semana" size="sm" onClick={() => setMonday(addDaysISO(monday, 7))} />
        </div>
        {monday !== thisWeek && (
          <Button variant="ghost" size="sm" onClick={() => setMonday(thisWeek)}>
            Esta semana
          </Button>
        )}
        <p className="text-sm text-ink-3">
          {heavyDays > 0
            ? `${heavyDays} ${heavyDays === 1 ? 'dia cheio' : 'dias cheios'} pela frente.`
            : 'Arraste as tarefas entre os dias, ou toque numa delas para mover.'}
        </p>
      </div>

      {agenda && !agenda.configured && (
        <p className="mb-3 flex items-center gap-2 text-xs text-ink-3">
          <CalendarDays className="size-3.5" aria-hidden />
          Para ver os compromissos do Google aqui, configure GOOGLE_ICAL_URL no servidor.
        </p>
      )}

      {overdue.length > 0 && (
        <section aria-label="Tarefas atrasadas" className="mb-4 rounded-2xl border border-warn/40 bg-warn-soft/40 p-3">
          <p className="mb-1.5 flex items-center gap-2 text-sm font-medium text-warn">
            <AlertCircle className="size-4" aria-hidden />
            {overdue.length === 1 ? '1 tarefa atrasada' : `${overdue.length} tarefas atrasadas`}: distribua pela semana
          </p>
          <ul className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
            {overdue.map((t) => (
              <TaskChip key={t.id} task={t} onMove={setMoving} />
            ))}
          </ul>
        </section>
      )}

      {/* Sete colunas só em tela larga; antes disso, quatro por linha (títulos legíveis). */}
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {days.map((day) => (
          <DayColumn
            key={day.date}
            day={day}
            today={today}
            dragging={dragging}
            onMove={setMoving}
            onDropTask={(id, date) => {
              moveTasksToDay([id], date);
              setDragging(false);
            }}
          />
        ))}
      </ol>

      {moving && <MoveSheet task={moving} days={days} today={today} onClose={() => setMoving(null)} />}
    </div>
  );
}
