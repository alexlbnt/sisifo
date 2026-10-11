import { useId, useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, Select, WeekdayPicker } from '@/components/ui';
import { defaultAreaFor, selectableAreas, useAreas } from '../meta';
import { usePersonalStore } from '../store';
import type { Area, Habit } from '../types';

const PRESETS = [
  { label: 'Todos os dias', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Dias úteis', days: [1, 2, 3, 4, 5] },
  { label: 'Seg, qua e sex', days: [1, 3, 5] },
];

interface HabitFormProps {
  open: boolean;
  onClose: () => void;
  habit?: Habit | null;
}

export function HabitForm(props: HabitFormProps) {
  if (!props.open) return null;
  return <HabitFormInner key={props.habit?.id ?? 'new'} {...props} />;
}

function HabitFormInner({ onClose, habit }: HabitFormProps) {
  const id = useId();
  const addHabit = usePersonalStore((s) => s.addHabit);
  const updateHabit = usePersonalStore((s) => s.updateHabit);

  const [title, setTitle] = useState(habit?.title ?? '');
  const areas = useAreas();
  const [area, setArea] = useState<Area>(habit?.area ?? defaultAreaFor(areas));
  const [schedule, setSchedule] = useState<number[]>(habit?.schedule ?? [0, 1, 2, 3, 4, 5, 6]);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Dê um nome ao hábito.');
    if (!schedule.length) return setError('Escolha pelo menos um dia da semana.');
    const input = { title: title.trim(), area, schedule };
    if (habit) updateHabit(habit.id, input);
    else addHabit(input);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={habit ? 'Editar hábito' : 'Novo hábito'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={id}>
            {habit ? 'Salvar alterações' : 'Criar hábito'}
          </Button>
        </>
      }
    >
      <form id={id} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Hábito" htmlFor={`${id}-title`}>
          <Input
            id={`${id}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Meditar 10 minutos"
            maxLength={80}
          />
        </Field>
        <Field label="Área" htmlFor={`${id}-area`}>
          <Select id={`${id}-area`} value={area} onChange={(e) => setArea(e.target.value as Area)}>
            {selectableAreas(areas, habit?.area).map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Em quais dias"
          htmlFor={`${id}-days`}
          hint="Dias fora da lista não quebram a sequência."
        >
          <WeekdayPicker id={`${id}-days`} value={schedule} onChange={setSchedule} />
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setSchedule(p.days)}
                className="rounded-md px-2 py-1 text-xs text-accent hover:bg-accent-soft"
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>
        {error && (
          <p className="text-sm text-expense" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
