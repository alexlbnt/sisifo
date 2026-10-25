import { useId, useState, type FormEvent } from 'react';
import { CircleDollarSign, ListChecks, TrendingUp } from 'lucide-react';
import { Button, Field, Input, Modal, SegmentedControl, Select, Textarea } from '@/components/ui';
import { useAccounts } from '@/features/finance/accountHooks';
import { ACCOUNT_KINDS } from '@/features/finance/accounts';
import { centsToInput } from '@/lib/money';
import { HORIZONS, HORIZON_ORDER, WORKOUT_KINDS, defaultAreaFor, selectableAreas, useAreas } from '../meta';
import { usePersonalStore } from '../store';
import { useExerciseNames } from '../training/ExerciseListSheet';
import type { Area, Goal, GoalHorizon, GoalInput, GoalKind, GoalMeasure, GoalSource, WorkoutKind } from '../types';
import { parseGoalValue } from './goalFormat';
import { sourceUnit } from './sources';

/** De onde vem o número de uma meta numérica. */
type SourceType = 'manual' | GoalSource['type'];

interface GoalFormProps {
  open: boolean;
  onClose: () => void;
  goal?: Goal | null;
}

export function GoalForm(props: GoalFormProps) {
  if (!props.open) return null;
  return <GoalFormInner key={props.goal?.id ?? 'new'} {...props} />;
}

const toInput = (goal: Goal | null | undefined, value: number | undefined) =>
  value === undefined ? '' : goal?.kind === 'savings' ? centsToInput(value) : String(value).replace('.', ',');

function GoalFormInner({ onClose, goal }: GoalFormProps) {
  const id = useId();
  const addGoal = usePersonalStore((s) => s.addGoal);
  const updateGoal = usePersonalStore((s) => s.updateGoal);
  const accounts = useAccounts().filter((a) => a.kind !== 'credit' && (!a.archived || a.id === goal?.accountId));

  const [title, setTitle] = useState(goal?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [horizon, setHorizon] = useState<GoalHorizon>(goal?.horizon ?? 'short');
  const areas = useAreas();
  const [area, setArea] = useState<Area>(goal?.area ?? defaultAreaFor(areas));
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? 'checklist');
  const [target, setTarget] = useState(toInput(goal, goal?.target));
  const [start, setStart] = useState(toInput(goal, goal?.start));
  const [unit, setUnit] = useState(goal?.unit ?? '');
  const [measure, setMeasure] = useState<GoalMeasure>(goal?.measure ?? 'sum');
  const [accountId, setAccountId] = useState(goal?.accountId ?? '');
  const [sourceType, setSourceType] = useState<SourceType>(goal?.source?.type ?? 'manual');
  const [exercise, setExercise] = useState(goal?.source?.type === 'exercise' ? goal.source.exercise : '');
  const [workoutKind, setWorkoutKind] = useState<WorkoutKind | ''>(goal?.source?.type === 'workouts' ? (goal.source.kind ?? '') : '');
  const habits = usePersonalStore((s) => s.habits);
  const activeHabits = habits.filter((h) => !h.archived || (goal?.source?.type === 'habit' && goal.source.habitId === h.id));
  const [habitId, setHabitId] = useState(goal?.source?.type === 'habit' ? goal.source.habitId : (activeHabits[0]?.id ?? ''));
  const exerciseNames = useExerciseNames();
  const [steps, setSteps] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Dê um nome à meta.');
    const input: GoalInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      horizon,
      area,
      deadline: deadline || undefined,
      kind,
      target: undefined,
      start: undefined,
      unit: undefined,
      measure: undefined,
      accountId: undefined,
      source: undefined,
    };
    if (kind !== 'checklist') {
      const targetValue = parseGoalValue({ kind }, target);
      if (targetValue === null) {
        return setError(kind === 'savings' ? 'Informe o valor a juntar, ex.: 15.000,00.' : 'Informe o valor-alvo.');
      }
      input.target = targetValue;
      const startValue = start.trim() ? parseGoalValue({ kind }, start) : null;
      if (start.trim() && startValue === null) return setError('Valor inicial inválido.');
      if (kind === 'numeric') {
        let source: GoalSource | undefined;
        if (sourceType === 'exercise') {
          if (!exercise.trim()) return setError('Escolha o exercício cujo recorde conta para a meta.');
          source = { type: 'exercise', exercise: exercise.trim() };
        } else if (sourceType === 'workouts') {
          source = { type: 'workouts', ...(workoutKind && { kind: workoutKind }) };
        } else if (sourceType === 'habit') {
          if (!habitId) return setError('Escolha o hábito que conta para a meta.');
          source = { type: 'habit', habitId };
        }
        input.source = source;
        input.unit = unit.trim() || (source ? sourceUnit(source, habits) : undefined);
        input.measure = source ? undefined : measure;
        input.start = startValue ?? undefined;
      } else if (accountId) {
        input.accountId = accountId;
      } else {
        input.start = startValue ?? undefined;
      }
    }
    if (goal) updateGoal(goal.id, input);
    else addGoal(input, kind === 'checklist' ? steps.split('\n') : []);
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
        <Field label="Meta" htmlFor={`${id}-title`}>
          <Input
            id={`${id}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              kind === 'savings' ? 'Ex.: Reserva de emergência' : kind === 'numeric' ? 'Ex.: Ler 12 livros' : 'Ex.: Correr 10 km'
            }
            maxLength={100}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">Como medir o progresso</span>
          <SegmentedControl<GoalKind>
            label="Como medir o progresso"
            value={kind}
            onChange={setKind}
            className="w-full"
            options={[
              { value: 'checklist', label: 'Etapas', icon: ListChecks },
              { value: 'numeric', label: 'Número', icon: TrendingUp },
              { value: 'savings', label: 'Dinheiro', icon: CircleDollarSign },
            ]}
          />
        </div>

        {kind === 'numeric' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Alvo" htmlFor={`${id}-target`}>
                <Input id={`${id}-target`} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="12" />
              </Field>
              <Field label="Começa em" htmlFor={`${id}-start`}>
                <Input id={`${id}-start`} inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} placeholder="0" />
              </Field>
              <Field label="Unidade" htmlFor={`${id}-unit`}>
                <Input
                  id={`${id}-unit`}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder={sourceType === 'exercise' ? 'kg' : sourceType === 'workouts' ? 'treinos' : sourceType === 'habit' ? 'dias' : 'livros'}
                  maxLength={20}
                />
              </Field>
            </div>
            <Field
              label="De onde vem o número"
              htmlFor={`${id}-source`}
              hint={
                sourceType === 'manual'
                  ? 'Você registra cada avanço no cartão da meta.'
                  : sourceType === 'exercise'
                    ? 'A meta acompanha sozinha a maior carga registrada no modo treino.'
                    : 'Conta sozinha a partir de hoje. Use "Começa em" para o que já foi feito antes.'
              }
            >
              <Select id={`${id}-source`} value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)}>
                <option value="manual">Eu registro</option>
                <option value="exercise">Recorde de carga de um exercício</option>
                <option value="workouts">Treinos registrados</option>
                <option value="habit" disabled={!activeHabits.length}>
                  Marcações de um hábito
                </option>
              </Select>
            </Field>
            {sourceType === 'exercise' && (
              <Field label="Exercício" htmlFor={`${id}-exercise`}>
                <Input id={`${id}-exercise`} list={`${id}-exercises`} value={exercise} onChange={(e) => setExercise(e.target.value)} placeholder="Ex.: Supino reto" />
                <datalist id={`${id}-exercises`}>
                  {exerciseNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </Field>
            )}
            {sourceType === 'workouts' && (
              <Field label="Modalidade" htmlFor={`${id}-wkind`}>
                <Select id={`${id}-wkind`} value={workoutKind} onChange={(e) => setWorkoutKind(e.target.value as WorkoutKind | '')}>
                  <option value="">Todas</option>
                  {Object.entries(WORKOUT_KINDS).map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {sourceType === 'habit' && (
              <Field label="Hábito" htmlFor={`${id}-habit`} hint="Nos hábitos de quantidade, soma o que foi registrado em cada dia.">
                <Select id={`${id}-habit`} value={habitId} onChange={(e) => setHabitId(e.target.value)}>
                  {activeHabits.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.title}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {sourceType === 'manual' && (
              <Field
                label="Cada registro"
                htmlFor={`${id}-measure`}
                hint={
                  measure === 'sum'
                    ? 'Ex.: +1 a cada livro terminado.'
                    : 'Ex.: o peso medido; vale o mais recente. O alvo pode ser menor que o início.'
                }
              >
                <Select id={`${id}-measure`} value={measure} onChange={(e) => setMeasure(e.target.value as GoalMeasure)}>
                  <option value="sum">Soma ao total</option>
                  <option value="last">É a medição atual</option>
                </Select>
              </Field>
            )}
          </>
        )}

        {kind === 'savings' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Juntar (R$)" htmlFor={`${id}-target`}>
                <Input id={`${id}-target`} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="15.000,00" />
              </Field>
              <Field label="Conta da meta" htmlFor={`${id}-account`}>
                <Select id={`${id}-account`} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">Registrar aportes à mão</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({ACCOUNT_KINDS[a.kind].label.toLowerCase()})
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {accountId ? (
              <p className="text-xs text-ink-3">O progresso é o saldo da conta. Para avançar, transfira dinheiro para ela.</p>
            ) : (
              <Field label="Já guardado (R$)" htmlFor={`${id}-start`} hint="Quanto já tem antes de começar a registrar.">
                <Input id={`${id}-start`} inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} placeholder="0,00" />
              </Field>
            )}
          </>
        )}

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
              {selectableAreas(areas, goal?.area).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Data-alvo (opcional)"
          htmlFor={`${id}-deadline`}
          hint={kind !== 'checklist' ? 'Com data, o Sísifo calcula quanto precisa avançar por mês.' : undefined}
        >
          <Input id={`${id}-deadline`} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        {!goal && kind === 'checklist' && (
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
        {error && (
          <p className="text-sm text-expense" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
