import { useId, useState, type FormEvent } from 'react';
import { ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button, Field, IconButton, Input, Modal, Select, WeekdayPicker } from '@/components/ui';
import { uid } from '@/lib/id';
import { WORKOUT_KINDS } from '../meta';
import { usePersonalStore } from '../store';
import type { PlanExercise, WorkoutKind, WorkoutPlan } from '../types';
import { useExerciseNames } from './ExerciseListSheet';
import { DEFAULT_REST_SEC } from './workoutRun';

/** Linha do editor: números como texto enquanto a pessoa digita. */
interface ExerciseDraft {
  id: string;
  name: string;
  sets: string;
  reps: string;
  restSec: string;
}

const toDraft = (ex: PlanExercise): ExerciseDraft => ({ ...ex, sets: String(ex.sets), restSec: String(ex.restSec) });
const blankDraft = (): ExerciseDraft => ({ id: uid(), name: '', sets: '3', reps: '10', restSec: String(DEFAULT_REST_SEC) });

function ExercisesEditor({ value, onChange }: { value: ExerciseDraft[]; onChange: (v: ExerciseDraft[]) => void }) {
  const id = useId();
  const names = useExerciseNames();
  const patch = (i: number, p: Partial<ExerciseDraft>) => onChange(value.map((d, k) => (k === i ? { ...d, ...p } : d)));
  const move = (i: number) => {
    const next = [...value];
    [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <datalist id={`${id}-names`}>
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {value.map((d, i) => (
        <div key={d.id} className="flex flex-col gap-2 rounded-xl border border-line p-2.5">
          <div className="flex items-center gap-1">
            <Input aria-label={`Exercício ${i + 1}`} list={`${id}-names`} value={d.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="Ex.: Supino reto" />
            <IconButton icon={ArrowUp} label={`Subir ${d.name || 'exercício'}`} disabled={i === 0} onClick={() => move(i)} />
            <IconButton icon={Trash2} label={`Remover ${d.name || 'exercício'}`} onClick={() => onChange(value.filter((_, k) => k !== i))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1 text-xs text-ink-3">
              Séries
              <Input type="number" min={1} value={d.sets} onChange={(e) => patch(i, { sets: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-3">
              Repetições
              <Input value={d.reps} onChange={(e) => patch(i, { reps: e.target.value })} placeholder="8-10" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-3">
              Descanso (s)
              <Input type="number" min={0} step={15} value={d.restSec} onChange={(e) => patch(i, { restSec: e.target.value })} />
            </label>
          </div>
        </div>
      ))}
      <Button variant="secondary" icon={Plus} onClick={() => onChange([...value, blankDraft()])} className="self-start">
        Adicionar exercício
      </Button>
    </div>
  );
}

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
  const [exercises, setExercises] = useState<ExerciseDraft[]>(() => plan?.exercises?.map(toDraft) ?? []);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const minutes = Number(duration);
    if (!label.trim()) return setError('Dê um nome ao treino.');
    if (!weekdays.length) return setError('Escolha pelo menos um dia da semana.');
    if (!Number.isInteger(minutes) || minutes <= 0) return setError('A duração deve ser maior que zero.');
    const filled = exercises.filter((d) => d.name.trim());
    const list: PlanExercise[] = [];
    for (const d of filled) {
      const sets = Number(d.sets);
      const restSec = Number(d.restSec || 0);
      if (!Number.isInteger(sets) || sets < 1 || sets > 50) return setError(`Séries de "${d.name.trim()}": use um número de 1 a 50.`);
      if (!Number.isInteger(restSec) || restSec < 0) return setError(`Descanso de "${d.name.trim()}": use segundos, de 0 para cima.`);
      list.push({ id: d.id, name: d.name.trim(), sets, reps: d.reps.trim(), restSec });
    }
    const input = { label: label.trim(), kind, weekdays, durationMin: minutes, ...(list.length && { exercises: list }) };
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
      size="lg"
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
        <Field
          label="Exercícios"
          htmlFor={`${id}-exercises`}
          hint="No modo treino, cada série já vem com a carga e as repetições da última vez."
        >
          <div id={`${id}-exercises`}>
            <ExercisesEditor value={exercises} onChange={setExercises} />
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
