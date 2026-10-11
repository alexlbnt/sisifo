import { useId, useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, Select, Textarea, WeekdayPicker } from '@/components/ui';
import { todayISO, weekdayOf, type ISODate } from '@/lib/dates';
import { defaultAreaFor, selectableAreas, useAreas } from '../meta';
import { repeatLabel } from '../recurrence';
import { usePersonalStore } from '../store';
import type { Area, Task, TaskInput, TaskPriority, TaskRepeat } from '../types';

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  defaultDate?: ISODate;
  defaultArea?: Area;
}

type RepeatChoice = 'none' | TaskRepeat['freq'];

export const PRIORITY_LABELS: Record<TaskPriority, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };

export function TaskForm(props: TaskFormProps) {
  if (!props.open) return null;
  return <TaskFormInner key={props.task?.id ?? 'new'} {...props} />;
}

/** Monta a repetição a partir da escolha e da data da tarefa. */
function buildRepeat(choice: RepeatChoice, date: ISODate, weekdays: number[], nth: number): TaskRepeat | undefined {
  const day = Number(date.slice(8, 10));
  switch (choice) {
    case 'none':
      return undefined;
    case 'daily':
    case 'weekdays':
      return { freq: choice };
    case 'weekly':
      return { freq: 'weekly', weekdays: weekdays.length ? weekdays : [weekdayOf(date)] };
    case 'monthly':
      return { freq: 'monthly', day };
    case 'monthlyNth':
      return { freq: 'monthlyNth', nth, weekday: weekdayOf(date) };
  }
}

function TaskFormInner({ onClose, task, defaultDate, defaultArea }: TaskFormProps) {
  const id = useId();
  const goals = usePersonalStore((s) => s.goals);
  const addTask = usePersonalStore((s) => s.addTask);
  const updateTask = usePersonalStore((s) => s.updateTask);

  const [title, setTitle] = useState(task?.title ?? '');
  const areas = useAreas();
  const [area, setArea] = useState<Area>(task?.area ?? defaultArea ?? defaultAreaFor(areas));
  const [date, setDate] = useState(task?.date ?? defaultDate ?? todayISO());
  const [time, setTime] = useState(task?.time ?? '');
  const [priority, setPriority] = useState<TaskPriority | ''>(task?.priority ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [repeatChoice, setRepeatChoice] = useState<RepeatChoice>(task?.repeat?.freq ?? 'none');
  const [weekdays, setWeekdays] = useState<number[]>(
    task?.repeat?.freq === 'weekly' ? task.repeat.weekdays : [weekdayOf(task?.date ?? defaultDate ?? todayISO())],
  );
  const [nth, setNth] = useState(
    task?.repeat?.freq === 'monthlyNth' ? task.repeat.nth : Math.min(4, Math.ceil(Number((task?.date ?? todayISO()).slice(8, 10)) / 7)),
  );
  const [link, setLink] = useState(task?.link ? `${task.link.goalId}|${task.link.subtaskId}` : '');
  const [error, setError] = useState<string | null>(null);

  const repeat = date ? buildRepeat(repeatChoice, date, weekdays, nth) : undefined;

  // Só oferece etapas ainda abertas (ou a que já está ligada).
  const goalOptions = goals
    .map((g) => ({
      goal: g,
      subtasks: g.subtasks.filter((s) => !s.done || s.id === task?.link?.subtaskId),
    }))
    .filter((g) => g.subtasks.length);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Escreva o que precisa ser feito.');
      return;
    }
    const [goalId, subtaskId] = link.split('|');
    const input: TaskInput = {
      title: title.trim(),
      area,
      date,
      link: goalId && subtaskId ? { goalId, subtaskId } : undefined,
      time: time || undefined,
      priority: priority || undefined,
      notes: notes.trim() || undefined,
      repeat,
    };
    if (task) updateTask(task.id, input);
    else addTask(input);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={task ? 'Editar tarefa' : 'Nova tarefa'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={id}>
            {task ? 'Salvar alterações' : 'Adicionar tarefa'}
          </Button>
        </>
      }
    >
      <form id={id} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Tarefa" htmlFor={`${id}-title`} error={error ?? undefined}>
          <Input
            id={`${id}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Revisar capítulo 3"
            aria-invalid={Boolean(error)}
            maxLength={120}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Dia" htmlFor={`${id}-date`}>
            <Input id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Horário" htmlFor={`${id}-time`}>
            <Input id={`${id}-time`} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Prioridade" htmlFor={`${id}-priority`}>
            <Select id={`${id}-priority`} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority | '')}>
              <option value="">Normal</option>
              <option value="high">{PRIORITY_LABELS.high}</option>
              <option value="medium">{PRIORITY_LABELS.medium}</option>
              <option value="low">{PRIORITY_LABELS.low}</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Área" htmlFor={`${id}-area`}>
            <Select id={`${id}-area`} value={area} onChange={(e) => setArea(e.target.value as Area)}>
              {selectableAreas(areas, task?.area).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Repetir"
            htmlFor={`${id}-repeat`}
            hint={repeat ? `${repeatLabel(repeat)}. A próxima aparece ao concluir esta.` : undefined}
          >
            <Select id={`${id}-repeat`} value={repeatChoice} onChange={(e) => setRepeatChoice(e.target.value as RepeatChoice)}>
              <option value="none">Não se repete</option>
              <option value="daily">Todo dia</option>
              <option value="weekdays">Dias úteis</option>
              <option value="weekly">Toda semana</option>
              <option value="monthly">Todo mês, no mesmo dia</option>
              <option value="monthlyNth">Todo mês, no mesmo dia da semana</option>
            </Select>
          </Field>
        </div>
        {repeatChoice === 'weekly' && <WeekdayPicker value={weekdays} onChange={setWeekdays} />}
        {repeatChoice === 'monthlyNth' && (
          <Field label="Qual semana do mês" htmlFor={`${id}-nth`}>
            <Select id={`${id}-nth`} value={nth} onChange={(e) => setNth(Number(e.target.value))}>
              <option value={1}>Primeira</option>
              <option value={2}>Segunda</option>
              <option value={3}>Terceira</option>
              <option value={4}>Quarta</option>
              <option value={-1}>Última</option>
            </Select>
          </Field>
        )}
        <Field label="Notas (opcional)" htmlFor={`${id}-notes`}>
          <Textarea id={`${id}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} />
        </Field>
        <Field
          label="Etapa de uma meta (opcional)"
          htmlFor={`${id}-link`}
          hint="Ao concluir a tarefa, a etapa da meta é marcada junto."
        >
          <Select id={`${id}-link`} value={link} onChange={(e) => setLink(e.target.value)}>
            <option value="">Nenhuma</option>
            {goalOptions.map(({ goal, subtasks }) => (
              <optgroup key={goal.id} label={goal.title}>
                {subtasks.map((s) => (
                  <option key={s.id} value={`${goal.id}|${s.id}`}>
                    {s.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}
