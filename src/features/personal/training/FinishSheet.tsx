import { useId, useMemo, useState, type FormEvent } from 'react';
import { Flag } from 'lucide-react';
import { Button, Field, Input, Modal, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { INTENSITY_LABELS } from '../meta';
import { usePersonalStore } from '../store';
import type { Intensity } from '../types';
import { exerciseKey, formatLoad, recordFor, RECORD_LABEL, type ExerciseRecord } from './progress';
import { useRunStore } from './runStore';
import { progressOf } from './workoutRun';

interface FinishSheetProps {
  records: Map<string, ExerciseRecord>;
  onClose: () => void;
  onSaved: () => void;
}

/** Concluir o treino: resumo, recordes batidos, duração, intensidade e anotações. */
export function FinishSheet({ records, onClose, onSaved }: FinishSheetProps) {
  const id = useId();
  const run = useRunStore((s) => s.run);
  const finish = useRunStore((s) => s.finish);
  const original = usePersonalStore((s) => s.workoutSessions.find((x) => x.id === run?.editingId));

  const elapsed = run ? Math.max(1, Math.round((Date.now() - run.startedAt) / 60_000)) : 1;
  const [duration, setDuration] = useState(String(original?.durationMin ?? elapsed));
  const [intensity, setIntensity] = useState<Intensity>(original?.intensity ?? 3);
  const [notes, setNotes] = useState(original?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (!run) return null;
    let volume = 0;
    const hits: string[] = [];
    for (const ex of run.exercises) {
      let best: string | null = null;
      for (const set of ex.sets) {
        if (!set.done) continue;
        volume += (set.load ?? 0) * set.reps;
        const kind = recordFor(records.get(exerciseKey(ex.name)), { reps: set.reps, ...(set.load && { load: set.load }) });
        if (kind) best = `${ex.name}: ${RECORD_LABEL[kind].toLowerCase()}, ${set.load ? `${formatLoad(set.load)} × ` : ''}${set.reps}`;
      }
      if (best) hits.push(best);
    }
    return { ...progressOf(run), volume: Math.round(volume), hits };
  }, [run, records]);

  if (!run || !summary) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const minutes = Number(duration);
    if (!Number.isInteger(minutes) || minutes <= 0) return setError('A duração deve ser em minutos, maior que zero.');
    finish({ durationMin: minutes, intensity, notes: notes.trim() || undefined });
    onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={run.editingId ? 'Salvar as séries' : 'Concluir treino'}
      focusFirstField={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Voltar ao treino
          </Button>
          <Button type="submit" form={id}>
            {run.editingId ? 'Salvar alterações' : 'Salvar treino'}
          </Button>
        </>
      }
    >
      <form id={id} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="text-base text-ink-2">
          {summary.done} de {summary.total} séries feitas
          {summary.volume > 0 && `, ${summary.volume.toLocaleString('pt-BR')} kg levantados no total`}.
          {summary.done < summary.total && ' As séries não marcadas ficam de fora.'}
        </p>

        {summary.hits.length > 0 && (
          <ul className="flex flex-col gap-1.5 rounded-xl bg-good-soft p-3">
            {summary.hits.map((hit) => (
              <li key={hit} className="flex items-start gap-2 text-sm font-medium text-income">
                <Flag className="mt-0.5 size-4 shrink-0" aria-hidden />
                {hit}
              </li>
            ))}
          </ul>
        )}

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
                  'h-12 flex-1 rounded-lg border text-base font-medium transition-colors',
                  n <= intensity ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-3',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Anotações (opcional)" htmlFor={`${id}-notes`}>
          <Textarea id={`${id}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Como se sentiu, dores, ajustes para a próxima..." />
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
