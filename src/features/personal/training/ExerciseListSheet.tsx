import { useId, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Check, Plus, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog, Input, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';
import { usePersonalStore } from '../store';
import { exerciseKey, exerciseRecords } from './progress';
import { useRunStore } from './runStore';

/** Nomes já usados (histórico e divisão), para sugerir ao digitar. */
export function useExerciseNames(): string[] {
  const sessions = usePersonalStore((s) => s.workoutSessions);
  const plans = usePersonalStore((s) => s.workoutPlans);
  return useMemo(() => {
    const names = new Map<string, string>();
    for (const r of exerciseRecords(sessions)) names.set(r.key, r.name);
    for (const p of plans) for (const ex of p.exercises ?? []) if (!names.has(exerciseKey(ex.name))) names.set(exerciseKey(ex.name), ex.name);
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }, [sessions, plans]);
}

export function ExerciseListSheet({ onClose }: { onClose: () => void }) {
  const id = useId();
  const navigate = useNavigate();
  const run = useRunStore((s) => s.run);
  const { goTo, addExercise, removeExercise, discard } = useRunStore.getState();
  const names = useExerciseNames();
  const [name, setName] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  if (!run) return null;

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addExercise(name);
    setName('');
    onClose();
  };

  return (
    <>
      <Modal open onClose={onClose} title="Exercícios" focusFirstField={false}>
        <ol className="flex flex-col gap-1.5">
          {run.exercises.map((ex, i) => {
            const done = ex.sets.filter((s) => s.done).length;
            const complete = done === ex.sets.length;
            return (
              <li key={ex.id} className={cn('flex items-center gap-2 rounded-xl border', i === run.current ? 'border-accent' : 'border-line')}>
                <button
                  type="button"
                  onClick={() => {
                    goTo(i);
                    onClose();
                  }}
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 text-left"
                >
                  <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold tabular', complete ? 'bg-income text-bg' : 'bg-surface-2 text-ink-2')}>
                    {complete ? <Check className="size-4" strokeWidth={3} aria-hidden /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-medium">{ex.name}</span>
                    <span className="block text-sm text-ink-3 tabular">
                      {done} de {ex.sets.length} séries
                    </span>
                  </span>
                </button>
                {removing === i ? (
                  <Button
                    variant="danger"
                    size="sm"
                    className="mr-2 h-12"
                    onClick={() => {
                      removeExercise(i);
                      setRemoving(null);
                    }}
                  >
                    Remover
                  </Button>
                ) : (
                  <button type="button" aria-label={`Remover ${ex.name}`} onClick={() => setRemoving(i)} className="grid size-12 shrink-0 place-items-center text-ink-3">
                    <Trash2 className="size-5" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ol>

        <form onSubmit={add} className="mt-4 flex gap-2">
          <Input
            aria-label="Nome do exercício"
            list={`${id}-names`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Adicionar exercício"
            className="h-12"
          />
          <datalist id={`${id}-names`}>
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <Button type="submit" icon={Plus} className="h-12" disabled={!name.trim()}>
            Adicionar
          </Button>
        </form>

        <button type="button" onClick={() => setConfirmDiscard(true)} className="mt-5 min-h-12 text-sm font-medium text-expense">
          Descartar este treino
        </button>
      </Modal>
      <ConfirmDialog
        open={confirmDiscard}
        title="Descartar o treino?"
        message="As séries marcadas aqui não são salvas. Nada muda no histórico."
        confirmLabel="Descartar treino"
        onConfirm={() => {
          discard();
          navigate('/personal/training', { replace: true });
        }}
        onClose={() => setConfirmDiscard(false)}
      />
    </>
  );
}
