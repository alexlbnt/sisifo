import { useId, useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, Select, WeekdayPicker } from '@/components/ui';
import { WORKOUT_KINDS } from '../meta';
import { usePersonalStore } from '../store';
import type { WorkoutKind, WorkoutPlan } from '../types';

interface PlanFormProps {
  open: boolean;
  onClose: () => void;
  plan?: WorkoutPlan | null;
}

export function PlanForm(props: PlanFormProps) {
  if (!props.open) return null;
  return <PlanFormInner key={props.plan?.id ?? 'new'} {...props} />;
}

function PlanFormInner({ onClose, plan }: PlanFormProps) {
  const id = useId();
  const addPlan = usePersonalStore((s) => s.addPlan);
  const updatePlan = usePersonalStore((s) => s.updatePlan);

  const [label, setLabel] = useState(plan?.label ?? '');
  const [kind, setKind] = useState<WorkoutKind>(plan?.kind ?? 'strength');
  const [weekdays, setWeekdays] = useState<number[]>(plan?.weekdays ?? []);
  const [duration, setDuration] = useState(String(plan?.durationMin ?? 60));
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const minutes = Number(duration);
    if (!label.trim()) return setError('Dê um nome ao treino.');
    if (!weekdays.length) return setError('Escolha pelo menos um dia da semana.');
    if (!Number.isInteger(minutes) || minutes <= 0) return setError('A duração deve ser maior que zero.');
    const input = { label: label.trim(), kind, weekdays, durationMin: minutes };
    if (plan) updatePlan(plan.id, input);
    else addPlan(input);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={plan ? 'Editar treino da divisão' : 'Novo treino na divisão'}
      description="Os dias escolhidos aparecem como previstos na semana."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={id}>
            {plan ? 'Salvar alterações' : 'Adicionar à divisão'}
          </Button>
        </>
      }
    >
      <form id={id} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Nome" htmlFor={`${id}-label`}>
          <Input id={`${id}-label`} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Treino A: peito e tríceps" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Modalidade" htmlFor={`${id}-kind`}>
            <Select id={`${id}-kind`} value={kind} onChange={(e) => setKind(e.target.value as WorkoutKind)}>
              {Object.entries(WORKOUT_KINDS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Duração (min)" htmlFor={`${id}-duration`}>
            <Input id={`${id}-duration`} type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Field>
        </div>
        <Field label="Dias da semana" htmlFor={`${id}-days`}>
          <WeekdayPicker id={`${id}-days`} value={weekdays} onChange={setWeekdays} />
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
