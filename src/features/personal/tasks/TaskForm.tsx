import { useId, useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, Select } from '@/components/ui';
import { todayISO, type ISODate } from '@/lib/dates';
import { defaultAreaFor, selectableAreas, useAreas } from '../meta';
import { usePersonalStore } from '../store';
import type { Area, Task } from '../types';

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  defaultDate?: ISODate;
  defaultArea?: Area;
}

export function TaskForm(props: TaskFormProps) {
  if (!props.open) return null;
  return <TaskFormInner key={props.task?.id ?? 'new'} {...props} />;
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
  const [link, setLink] = useState(task?.link ? `${task.link.goalId}|${task.link.subtaskId}` : '');
  const [error, setError] = useState<string | null>(null);

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
    const input = {
      title: title.trim(),
      area,
      date,
      link: goalId && subtaskId ? { goalId, subtaskId } : undefined,
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
          <Field label="Dia" htmlFor={`${id}-date`}>
            <Input id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
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
