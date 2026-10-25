import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Check, ChevronLeft, ChevronRight, Flag, ListOrdered, Minus, Plus, Timer, X } from 'lucide-react';
import { Hill } from '@/components/ui';
import { cn } from '@/lib/cn';
import { fmt } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { playAlarm, unlockAudio } from '@/features/panel/alarm';
import { formatClock } from '@/features/panel/pomodoro';
import { useNow } from '@/features/panel/useNow';
import { useWakeLock } from '@/features/panel/useWakeLock';
import { usePersonalStore } from '../store';
import { ExerciseListSheet } from './ExerciseListSheet';
import { FinishSheet } from './FinishSheet';
import { exerciseKey, exerciseRecords, formatLoad, formatSets, recordFor, RECORD_LABEL, type ExerciseRecord } from './progress';
import { useRunStore } from './runStore';
import { progressOf, type RunExercise, type RunSet } from './workoutRun';

const LOAD_STEP = 2.5;
/** Fim de descanso visto depois disso (tela travada) não toca alerta. */
const LATE_ALARM_MS = 30_000;

/* ───────── Descanso ───────── */

/** Toca e encerra o descanso na hora certa, mesmo se a tela travou no meio. */
function useRestAlarm() {
  const restEndsAt = useRunStore((s) => s.run?.restEndsAt ?? null);
  const endRest = useRunStore((s) => s.endRest);

  useEffect(() => {
    if (restEndsAt === null) return;
    const settle = () => {
      if (Date.now() < restEndsAt) return false;
      if (Date.now() - restEndsAt < LATE_ALARM_MS) playAlarm('short', { sound: true, vibrate: true });
      endRest();
      return true;
    };
    if (settle()) return;
    const timer = setTimeout(settle, restEndsAt - Date.now() + 30);
    const onVisible = () => document.visibilityState === 'visible' && settle();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [restEndsAt, endRest]);
}

function RestBar({ endsAt, totalMs }: { endsAt: number; totalMs: number }) {
  const now = useNow(1000);
  const { extendRest, endRest } = useRunStore.getState();
  const left = Math.max(0, endsAt - now);
  return (
    <div className="flex items-center gap-3" role="timer" aria-label="Descanso">
      <Timer className="size-6 shrink-0 text-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-3">Descanso</p>
        <p className="font-display text-3xl leading-none font-semibold tabular [font-stretch:75%]">{formatClock(left)}</p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-accent-soft">
          <span
            className="block h-full origin-left bg-accent transition-transform duration-1000 ease-linear"
            style={{ transform: `scaleX(${totalMs ? left / totalMs : 0})` }}
          />
        </div>
      </div>
      <button type="button" onClick={() => extendRest(15)} className="min-h-12 rounded-xl px-3 text-base font-medium text-ink-2 ring-1 ring-line ring-inset">
        +15 s
      </button>
      <button type="button" onClick={endRest} className="min-h-12 rounded-xl bg-accent px-4 text-base font-semibold text-accent-ink">
        Pular
      </button>
    </div>
  );
}

/* ───────── Séries ───────── */

function Stepper({
  label,
  value,
  onChange,
  step,
  decimal,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step: number;
  decimal?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(value === null ? '' : String(value).replace('.', ','));
  useEffect(() => setText(value === null ? '' : String(value).replace('.', ',')), [value]);
  const commit = (raw: string) => {
    const n = Number(raw.replace(',', '.'));
    onChange(raw.trim() === '' || !Number.isFinite(n) ? (decimal ? null : 0) : Math.max(0, decimal ? Math.round(n * 4) / 4 : Math.round(n)));
  };
  const btn = 'grid size-12 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2 active:bg-line';
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-sm text-ink-3">{label}</span>
      <button type="button" className={btn} aria-label={`Menos ${label.toLowerCase()}`} onClick={() => onChange(Math.max(0, (value ?? 0) - step) || (decimal ? null : 0))}>
        <Minus className="size-5" aria-hidden />
      </button>
      <input
        aria-label={label}
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="h-12 w-full min-w-0 rounded-xl border border-line bg-surface text-center text-xl font-semibold text-ink tabular placeholder:text-base placeholder:font-normal placeholder:text-ink-3"
      />
      <button type="button" className={btn} aria-label={`Mais ${label.toLowerCase()}`} onClick={() => onChange((value ?? 0) + step)}>
        <Plus className="size-5" aria-hidden />
      </button>
    </div>
  );
}

function SetRow({
  index,
  set,
  open,
  record,
  onOpen,
  onToggle,
  onEdit,
  onRemove,
}: {
  index: number;
  set: RunSet;
  open: boolean;
  record: string | null;
  onOpen: () => void;
  onToggle: () => void;
  onEdit: (patch: Partial<Pick<RunSet, 'reps' | 'load'>>) => void;
  onRemove: (() => void) | null;
}) {
  return (
    <li className={cn('rounded-2xl border', set.done ? 'border-transparent bg-good-soft' : open ? 'border-accent bg-surface' : 'border-line bg-surface')}>
      <div className="flex items-center gap-3 p-2 pl-3">
        <button type="button" onClick={onOpen} aria-expanded={open} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left">
          <span className="w-6 shrink-0 text-center text-base font-semibold text-ink-3 tabular">{index + 1}</span>
          <span className="min-w-0">
            <span className={cn('block text-xl font-semibold tabular', set.done && 'text-ink-2')}>
              {set.load ? formatLoad(set.load) : 'Peso do corpo'} <span className="text-ink-3">×</span> {set.reps}
            </span>
            {record && (
              <span className="flex items-center gap-1 text-sm font-semibold text-income">
                <Flag className="size-3.5" aria-hidden /> {record}
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          role="checkbox"
          aria-checked={set.done}
          aria-label={`Série ${index + 1} feita`}
          onClick={onToggle}
          className={cn(
            'grid size-14 shrink-0 place-items-center rounded-full border-[3px]',
            set.done ? 'border-income bg-income text-bg' : 'border-ink-3/60 text-ink-3',
          )}
        >
          <Check className="size-7" strokeWidth={3} aria-hidden />
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-2 border-t border-line p-3">
          <Stepper label="Carga" value={set.load} step={LOAD_STEP} decimal placeholder="corpo" onChange={(v) => onEdit({ load: v })} />
          <Stepper label="Reps" value={set.reps} step={1} onChange={(v) => onEdit({ reps: v ?? 0 })} />
          {onRemove && (
            <button type="button" onClick={onRemove} className="min-h-12 self-start px-1 text-sm font-medium text-expense">
              Remover série
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function ExerciseView({ exercise, index, record }: { exercise: RunExercise; index: number; record: ExerciseRecord | undefined }) {
  const { toggleSet, editSet, addSet, removeSet } = useRunStore.getState();
  const firstOpen = exercise.sets.findIndex((s) => !s.done);
  const [open, setOpen] = useState<number | null>(firstOpen);
  // Ao concluir a série aberta, abre a próxima pendente.
  useEffect(() => setOpen(firstOpen === -1 ? null : firstOpen), [firstOpen, index]);

  return (
    <section aria-label={exercise.name}>
      <ul className="flex flex-col gap-2">
        {exercise.sets.map((set, si) => {
          const kind = set.done ? recordFor(record, { reps: set.reps, ...(set.load && { load: set.load }) }) : null;
          return (
            <SetRow
              key={si}
              index={si}
              set={set}
              open={open === si}
              record={kind && RECORD_LABEL[kind]}
              onOpen={() => setOpen(open === si ? null : si)}
              onToggle={() => {
                unlockAudio();
                haptic();
                toggleSet(index, si);
              }}
              onEdit={(patch) => editSet(index, si, patch)}
              onRemove={exercise.sets.length > 1 ? () => removeSet(index, si) : null}
            />
          );
        })}
      </ul>
      <button type="button" onClick={() => addSet(index)} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-base font-medium text-ink-2">
        <Plus className="size-5" aria-hidden /> Adicionar série
      </button>
    </section>
  );
}

/* ───────── Tela ───────── */

function Elapsed({ since }: { since: number }) {
  const now = useNow(30_000);
  return <span className="tabular">{Math.max(0, Math.floor((now - since) / 60_000))} min</span>;
}

/** Modo "no treino": uma tela para usar com o celular na mão, série por série. */
export function WorkoutScreen() {
  useWakeLock();
  useRestAlarm();
  const navigate = useNavigate();
  const run = useRunStore((s) => s.run);
  const goTo = useRunStore((s) => s.goTo);
  const sessions = usePersonalStore((s) => s.workoutSessions);
  const [sheet, setSheet] = useState<'list' | 'finish' | null>(null);

  // Recordes de antes deste treino (sem a sessão em edição), para marcar as séries que os batem.
  const editingId = run?.editingId;
  const records = useMemo(
    () => new Map(exerciseRecords(sessions.filter((s) => s.id !== editingId)).map((r) => [r.key, r])),
    [sessions, editingId],
  );

  if (!run) return <Navigate to="/personal/training" replace />;

  const { done, total } = progressOf(run);
  const exercise = run.exercises[run.current];
  const allDone = total > 0 && done === total;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95 px-3 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/personal/training')}
            aria-label="Sair (o treino continua salvo)"
            title="Sair (o treino continua salvo)"
            className="grid size-12 shrink-0 place-items-center rounded-xl text-ink-2"
          >
            <X className="size-6" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{run.label}</p>
            <p className="text-sm text-ink-3">
              {run.editingId ? `Editando o treino de ${fmt.short(run.date)}` : <Elapsed since={run.startedAt} />}
              {total > 0 && `, ${done} de ${total} séries`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSheet('finish')}
            className={cn('min-h-12 shrink-0 rounded-xl px-4 text-base font-semibold', allDone ? 'bg-accent text-accent-ink' : 'text-accent ring-1 ring-accent/40 ring-inset')}
          >
            Concluir
          </button>
        </div>
      </header>

      <div className="-mt-px" style={{ ['--phase' as string]: 'var(--accent)', ['--phase-soft' as string]: 'var(--accent-soft)' }}>
        <Hill at={total ? done / total : 0} label={`${done} de ${total} séries feitas`} className="mx-auto max-w-xl" />
      </div>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-3 pt-3 pb-4">
        {exercise ? (
          <>
            <div className="flex items-start gap-1">
              <button
                type="button"
                aria-label="Exercício anterior"
                disabled={run.current === 0}
                onClick={() => goTo(run.current - 1)}
                className="grid size-12 shrink-0 place-items-center rounded-xl text-ink-2 disabled:opacity-30"
              >
                <ChevronLeft className="size-6" aria-hidden />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="text-sm text-ink-3 tabular">
                  Exercício {run.current + 1} de {run.exercises.length}
                </p>
                <h1 className="text-[1.75rem] leading-tight font-semibold">{exercise.name}</h1>
              </div>
              <button
                type="button"
                aria-label="Próximo exercício"
                disabled={run.current >= run.exercises.length - 1}
                onClick={() => goTo(run.current + 1)}
                className="grid size-12 shrink-0 place-items-center rounded-xl text-ink-2 disabled:opacity-30"
              >
                <ChevronRight className="size-6" aria-hidden />
              </button>
            </div>

            <dl className="grid gap-1 rounded-2xl bg-surface-2 px-4 py-3 text-base">
              {exercise.target && (
                <div className="flex gap-2">
                  <dt className="text-ink-3">Alvo</dt>
                  <dd>
                    {exercise.sets.length} × {exercise.target}
                    {exercise.restSec > 0 && <span className="text-ink-3">, descanso de {formatClock(exercise.restSec * 1000)}</span>}
                  </dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="shrink-0 text-ink-3">{exercise.last ? `Em ${fmt.short(exercise.last.date)}` : 'Última vez'}</dt>
                <dd className="min-w-0">{exercise.last ? formatSets(exercise.last.sets) : 'primeira vez neste exercício'}</dd>
              </div>
            </dl>

            <ExerciseView exercise={exercise} index={run.current} record={records.get(exerciseKey(exercise.name))} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-xl font-semibold">Treino sem exercícios</p>
            <p className="max-w-xs text-base text-ink-2">Adicione o primeiro para começar a marcar as séries.</p>
            <button type="button" onClick={() => setSheet('list')} className="min-h-12 rounded-xl bg-accent px-5 text-base font-semibold text-accent-ink">
              Adicionar exercício
            </button>
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 border-t border-line bg-surface px-3 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="mx-auto max-w-xl">
          {run.restEndsAt ? (
            <RestBar endsAt={run.restEndsAt} totalMs={run.restTotalMs} />
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => setSheet('list')} className="flex min-h-12 items-center gap-2 rounded-xl px-4 text-base font-medium text-ink-2 ring-1 ring-line ring-inset">
                <ListOrdered className="size-5" aria-hidden /> Exercícios
              </button>
              {allDone ? (
                <button type="button" onClick={() => setSheet('finish')} className="min-h-12 flex-1 rounded-xl bg-accent text-base font-semibold text-accent-ink">
                  Concluir treino
                </button>
              ) : (
                run.current < run.exercises.length - 1 && (
                  <button
                    type="button"
                    onClick={() => goTo(run.current + 1)}
                    className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl bg-surface-2 px-3 text-base font-semibold"
                  >
                    <span className="truncate">{run.exercises[run.current + 1]!.name}</span>
                    <ChevronRight className="size-5 shrink-0" aria-hidden />
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </footer>

      {sheet === 'list' && <ExerciseListSheet onClose={() => setSheet(null)} />}
      {sheet === 'finish' && (
        <FinishSheet
          records={records}
          onClose={() => setSheet(null)}
          onSaved={() => navigate('/personal/training', { replace: true })}
        />
      )}
    </div>
  );
}
