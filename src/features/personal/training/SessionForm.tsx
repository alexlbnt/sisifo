import { useId, useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { todayISO, type ISODate } from '@/lib/dates';
import { INTENSITY_LABELS, WORKOUT_KINDS } from '../meta';
import { usePersonalStore } from '../store';
import type { Intensity, WorkoutKind, WorkoutPlan, WorkoutSession } from '../types';

interface SessionFormProps {
  open: boolean;
  onClose: () => void;
  session?: WorkoutSession | null;
  /** Pré-preenche a partir de um treino planejado. */
  plan?: WorkoutPlan | null;
  date?: ISODate;
}

export function SessionForm(props: SessionFormProps) {
  if (!props.open) return null;
  return <SessionFormInner key={props.session?.id ?? props.plan?.id ?? 'new'} {...props} />;
}

function SessionFormInner({ onClose, session, plan, date: defaultDate }: SessionFormProps) {
  const id = useId();
  const plans = usePersonalStore((s) => s.workoutPlans);
  const addSession = usePersonalStore((s) => s.addSession);
  const updateSession = usePersonalStore((s) => s.updateSession);

  const [planId, setPlanId] = useState(session?.planId ?? plan?.id ?? '');
  const [date, setDate] = useState(session?.date ?? defaultDate ?? todayISO());
  const [kind, setKind] = useState<WorkoutKind>(session?.kind ?? plan?.kind ?? 'strength');
  const [label, setLabel] = useState(session?.label ?? plan?.label ?? '');
  const [duration, setDuration] = useState(String(session?.durationMin ?? plan?.durationMin ?? 60));
  const [intensity, setIntensity] = useState<Intensity>(session?.intensity ?? 3);
  const [notes, setNotes] = useState(session?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const pickPlan = (value: string) => {
    setPlanId(value);
    const p = plans.find((x) => x.id === value);
    if (p) {
      setKind(p.kind);
      setLabel(p.label);
      setDuration(String(p.durationMin));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const minutes = Number(duration);
    if (!label.trim()) return setError('Descreva o treino.');
    if (!Number.isInteger(minutes) || minutes <= 0) return setError('A duração deve ser em minutos, maior que zero.');
    const input = {
      date,
      kind,
      label: label.trim(),
      durationMin: minutes,
      intensity,
      notes: notes.trim() || undefined,
      planId: planId || undefined,
    };
    if (session) updateSession(session.id, input);
    else addSession(input);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={session ? 'Editar treino' : 'Registrar treino'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={id}>
            {session ? 'Salvar alterações' : 'Registrar treino'}
          </Button>
        </>
      }
    >
      <form id={id} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {plans.length > 0 && (
          <Field label="Da divisão" htmlFor={`${id}-plan`}>
            <Select id={`${id}-plan`} value={planId} onChange={(e) => pickPlan(e.target.value)}>
              <option value="">Treino avulso</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Descrição" htmlFor={`${id}-label`}>
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
          <Field label="Dia" htmlFor={`${id}-date`}>
            <Input id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Duração (min)" htmlFor={`${id}-duration`}>
          <Input id={`${id}-duration`} type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
        <Field label={`Intensidade: ${INTENSITY_LABELS[intensity]}`} htmlFor={`${id}-intensity`}>
          <div id={`${id}-intensity`} className="flex gap-1.5" role="radiogroup" aria-label="Intensidade">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={intensity === n}
                aria-label={INTENSITY_LABELS[n]}
                onClick={() => setIntensity(n)}
                className={cn(
                  'h-9 flex-1 rounded-lg border text-sm font-medium transition-colors',
                  n <= intensity ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-3',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Anotações (opcional)" htmlFor={`${id}-notes`}>
          <Textarea id={`${id}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Cargas, como se sentiu, dores..." />
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
