import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Dumbbell, Play } from 'lucide-react';
import { ConfirmDialog, Modal } from '@/components/ui';
import { todayISO } from '@/lib/dates';
import { WORKOUT_KINDS } from '../meta';
import { plansForDay } from '../selectors';
import { usePersonalStore } from '../store';
import { useRunStore } from './runStore';
import { progressOf } from './workoutRun';

/**
 * Único caminho para abrir o modo treino. Se já houver um treino em andamento,
 * pergunta antes de trocá-lo (as séries marcadas nele seriam perdidas).
 */
export function useStartWorkout() {
  const navigate = useNavigate();
  const current = useRunStore((s) => s.run);
  const [pending, setPending] = useState<(() => void) | null>(null);

  const begin = (prepare: () => void) => {
    const go = () => {
      prepare();
      navigate('/treino');
    };
    if (current) setPending(() => go);
    else go();
  };

  const dialog = (
    <ConfirmDialog
      open={Boolean(pending)}
      title="Trocar o treino em andamento?"
      message={`"${current?.label ?? ''}" ainda não foi concluído. Se continuar, as séries marcadas nele são descartadas.`}
      confirmLabel="Descartar e começar"
      onConfirm={() => pending?.()}
      onClose={() => setPending(null)}
    />
  );

  return { begin, dialog };
}

/** Aviso de treino em andamento, com atalho para voltar a ele. */
export function ActiveWorkoutBanner({ className }: { className?: string }) {
  const run = useRunStore((s) => s.run);
  if (!run) return null;
  const { done, total } = progressOf(run);
  return (
    <Link
      to="/treino"
      className={`flex items-center gap-3 rounded-2xl border border-accent bg-accent-soft px-4 py-3 ${className ?? ''}`}
    >
      <Dumbbell className="size-5 shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{run.editingId ? `Editando: ${run.label}` : `Treino em andamento: ${run.label}`}</span>
        <span className="block text-xs text-ink-2 tabular">
          {done} de {total} séries feitas
        </span>
      </span>
      <span className="text-sm font-semibold text-accent">Continuar</span>
    </Link>
  );
}

/** Escolher o que treinar: os previstos para hoje primeiro, depois a divisão inteira e o avulso. */
export function StartWorkoutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const plans = usePersonalStore((s) => s.workoutPlans);
  const startFromPlan = useRunStore((s) => s.startFromPlan);
  const { begin, dialog } = useStartWorkout();
  if (!open) return dialog;

  const today = plansForDay(plans, todayISO());
  const others = plans.filter((p) => !today.includes(p));
  const row = (label: string, meta: string, plan: (typeof plans)[number] | null) => (
    <li key={plan?.id ?? 'free'}>
      <button
        type="button"
        onClick={() => {
          onClose();
          begin(() => startFromPlan(plan));
        }}
        className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-line px-3 text-left hover:border-accent"
      >
        <Play className="size-5 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium">{label}</span>
          <span className="block text-sm text-ink-3">{meta}</span>
        </span>
      </button>
    </li>
  );
  const meta = (p: (typeof plans)[number]) =>
    p.exercises?.length ? `${p.exercises.length} exercícios` : `${WORKOUT_KINDS[p.kind]}, sem lista de exercícios`;

  return (
    <>
      <Modal open onClose={onClose} title="Começar treino" focusFirstField={false}>
        {today.length > 0 && (
          <>
            <h3 className="mb-2 text-sm font-medium text-ink-2">Previstos para hoje</h3>
            <ul className="mb-4 flex flex-col gap-1.5">{today.map((p) => row(p.label, meta(p), p))}</ul>
          </>
        )}
        {others.length > 0 && (
          <>
            <h3 className="mb-2 text-sm font-medium text-ink-2">{today.length ? 'Outros da divisão' : 'Da divisão'}</h3>
            <ul className="mb-4 flex flex-col gap-1.5">{others.map((p) => row(p.label, meta(p), p))}</ul>
          </>
        )}
        <ul>{row('Treino avulso', 'Adicione os exercícios durante o treino', null)}</ul>
      </Modal>
      {dialog}
    </>
  );
}
