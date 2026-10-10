import { useId, useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { AREAS, AREA_ORDER, HORIZONS, HORIZON_ORDER } from '../meta';
import { usePersonalStore } from '../store';
import type { Area, Goal, GoalHorizon } from '../types';

interface GoalFormProps {
  open: boolean;
  onClose: () => void;
  goal?: Goal | null;
}

export function GoalForm(props: GoalFormProps) {
  if (!props.open) return null;
  return <GoalFormInner key={props.goal?.id ?? 'new'} {...props} />;
}

function GoalFormInner({ onClose, goal }: GoalFormProps) {
  const id = useId();
  const addGoal = usePersonalStore((s) => s.addGoal);
  const updateGoal = usePersonalStore((s) => s.updateGoal);

  const [title, setTitle] = useState(goal?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [horizon, setHorizon] = useState<GoalHorizon>(goal?.horizon ?? 'short');
  const [area, setArea] = useState<Area>(goal?.area ?? 'routine');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [steps, setSteps] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Dê um nome à meta.');
      return;
    }
    const input = {
      title: title.trim(),
      description: description.trim() || undefined,
      horizon,
      area,
      deadline: deadline || undefined,
    };
    if (goal) updateGoal(goal.id, input);
    else addGoal(input, steps.split('\n'));
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={goal ? 'Editar meta' : 'Nova meta'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={id}>
            {goal ? 'Salvar alterações' : 'Criar meta'}
          </Button>
        </>
      }
    >
      <form id={id} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Meta" htmlFor={`${id}-title`} error={error ?? undefined}>
          <Input
            id={`${id}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Correr 10 km"
            aria-invalid={Boolean(error)}
            maxLength={100}
          />
        </Field>
        <Field label="Por que importa (opcional)" htmlFor={`${id}-desc`}>
          <Textarea id={`${id}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prazo" htmlFor={`${id}-horizon`} hint={HORIZONS[horizon].hint}>
            <Select id={`${id}-horizon`} value={horizon} onChange={(e) => setHorizon(e.target.value as GoalHorizon)}>
              {HORIZON_ORDER.map((h) => (
                <option key={h} value={h}>
                  {HORIZONS[h].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Área" htmlFor={`${id}-area`}>
            <Select id={`${id}-area`} value={area} onChange={(e) => setArea(e.target.value as Area)}>
              {AREA_ORDER.map((a) => (
                <option key={a} value={a}>
                  {AREAS[a].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Data-alvo (opcional)" htmlFor={`${id}-deadline`}>
          <Input id={`${id}-deadline`} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        {!goal && (
          <Field label="Etapas" htmlFor={`${id}-steps`} hint="Uma por linha. O progresso da meta vem delas.">
            <Textarea
              id={`${id}-steps`}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              rows={4}
              placeholder={'Comprar tênis\nCorrer 3 km sem parar\nCorrer 5 km'}
            />
          </Field>
        )}
      </form>
    </Modal>
  );
}
