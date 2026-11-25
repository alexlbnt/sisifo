import { useId, useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal } from '@/components/ui';
import { todayISO, type ISODate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { usePersonalStore } from '../store';
import type { BodyWeight } from '../types';
import { latestWeight, weightReplaced } from './view';

interface WeightSheetProps {
  open: boolean;
  onClose: () => void;
  /** Editar uma pesagem existente; sem ela, registra a de hoje. */
  weight?: BodyWeight | null;
}

export function WeightSheet(props: WeightSheetProps) {
  if (!props.open) return null;
  return <WeightSheetInner key={props.weight?.id ?? 'new'} {...props} />;
}

const toInput = (kg: number | undefined) => (kg === undefined ? '' : kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
const parseKg = (value: string) => Number(value.replace(/\s|kg/gi, '').replace(',', '.'));

function WeightSheetInner({ onClose, weight }: WeightSheetProps) {
  const id = useId();
  const weights = usePersonalStore((s) => s.bodyWeights);
  const setBodyWeight = usePersonalStore((s) => s.setBodyWeight);
  const today = todayISO();

  // O campo já vem com a última pesagem: quase sempre muda só a casa decimal.
  const [kg, setKg] = useState(toInput(weight?.kg ?? latestWeight(weights)?.kg));
  const [date, setDate] = useState<ISODate>(weight?.date ?? today);
  const [note, setNote] = useState(weight?.note ?? '');

  const value = parseKg(kg);
  const valid = Number.isFinite(value) && value >= 20 && value <= 300 && Boolean(date) && date <= today;
  const replaces = weightReplaced(weights, date, weight);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    // Mudar a data de uma pesagem é mover: a do dia antigo sai.
    if (weight && weight.date !== date) usePersonalStore.getState().deleteBodyWeight(weight.date);
    setBodyWeight({ date, kg: value, note });
    haptic();
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={weight ? 'Editar pesagem' : 'Registrar peso'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={id} disabled={!valid}>
            Salvar
          </Button>
        </>
      }
    >
      <form id={id} onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Peso (kg)" htmlFor={`${id}-kg`}>
          <Input
            id={`${id}-kg`}
            inputMode="decimal"
            autoComplete="off"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            placeholder="Ex.: 68,4"
            className="h-12 text-lg tabular"
          />
        </Field>
        {kg.trim() !== '' && !(value >= 20 && value <= 300) && (
          <p className="-mt-2 text-sm text-expense">Use um peso entre 20 e 300 kg.</p>
        )}
        <Field label="Data" htmlFor={`${id}-date`}>
          <Input id={`${id}-date`} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {replaces && <p className="-mt-2 text-sm text-ink-3">Já há uma pesagem nesse dia ({toInput(replaces.kg)} kg). Ela será substituída.</p>}
        <Field label="Nota (opcional)" htmlFor={`${id}-note`}>
          <Input id={`${id}-note`} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: depois do treino" />
        </Field>
      </form>
    </Modal>
  );
}
