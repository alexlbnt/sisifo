import { useId, useState, type FormEvent } from 'react';
import { CalendarDays, CheckCheck, Hash, Repeat } from 'lucide-react';
import { Button, Field, Input, Modal, SegmentedControl, Select, WeekdayPicker } from '@/components/ui';
import { defaultAreaFor, selectableAreas, useAreas } from '../meta';
import { usePersonalStore } from '../store';
import type { Area, Habit, HabitFrequency, HabitInput, HabitKind } from '../types';

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
  const [kind, setKind] = useState<HabitKind>(habit?.kind ?? 'check');
  const [target, setTarget] = useState(String(habit?.target ?? 8).replace('.', ','));
  const [unit, setUnit] = useState(habit?.unit ?? '');
  const [frequency, setFrequency] = useState<HabitFrequency>(habit?.frequency ?? 'days');
  const [timesPerWeek, setTimesPerWeek] = useState(habit?.timesPerWeek ?? 3);
  const [schedule, setSchedule] = useState<number[]>(habit?.schedule ?? [0, 1, 2, 3, 4, 5, 6]);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Dê um nome ao hábito.');
    if (frequency === 'days' && !schedule.length) return setError('Escolha pelo menos um dia da semana.');
    const input: HabitInput = {
      title: title.trim(),
      area,
      schedule: frequency === 'days' ? schedule : [0, 1, 2, 3, 4, 5, 6],
      kind: kind === 'quantity' ? 'quantity' : undefined,
      frequency: frequency === 'weekly' ? 'weekly' : undefined,
      timesPerWeek: frequency === 'weekly' ? timesPerWeek : undefined,
    };
    if (kind === 'quantity') {
      const value = Number(target.replace(',', '.'));
      if (!Number.isFinite(value) || value <= 0) return setError('A meta diária deve ser maior que zero.');
      input.target = value;
      input.unit = unit.trim() || undefined;
    }
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
            placeholder={kind === 'quantity' ? 'Ex.: Beber água' : 'Ex.: Meditar 10 minutos'}
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

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">Como registrar</span>
          <SegmentedControl<HabitKind>
            label="Como registrar"
            value={kind}
            onChange={setKind}
            className="w-full"
            options={[
              { value: 'check', label: 'Feito ou não', icon: CheckCheck },
              { value: 'quantity', label: 'Quantidade', icon: Hash },
            ]}
          />
        </div>
        {kind === 'quantity' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Meta por dia" htmlFor={`${id}-target`}>
              <Input id={`${id}-target`} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
            </Field>
            <Field label="Unidade" htmlFor={`${id}-unit`}>
              <Input id={`${id}-unit`} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="copos, min, páginas" maxLength={20} />
            </Field>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">Frequência</span>
          <SegmentedControl<HabitFrequency>
            label="Frequência"
            value={frequency}
            onChange={setFrequency}
            className="w-full"
            options={[
              { value: 'days', label: 'Dias fixos', icon: CalendarDays },
              { value: 'weekly', label: 'Vezes por semana', icon: Repeat },
            ]}
          />
        </div>
        {frequency === 'days' ? (
          <Field label="Em quais dias" htmlFor={`${id}-days`} hint="Dias fora da lista não quebram a sequência.">
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
        ) : (
          <Field
            label="Quantas vezes por semana"
            htmlFor={`${id}-times`}
            hint="Em qualquer dia. A sequência conta semanas seguidas com a meta batida."
          >
            <Select id={`${id}-times`} value={timesPerWeek} onChange={(e) => setTimesPerWeek(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}x por semana
                </option>
              ))}
            </Select>
          </Field>
        )}
        {error && (
          <p className="text-sm text-expense" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
