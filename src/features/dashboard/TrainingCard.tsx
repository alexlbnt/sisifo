import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Check, Dumbbell } from 'lucide-react';
import { Button, Card, Heatmap } from '@/components/ui';
import { cn } from '@/lib/cn';
import { addDaysISO, fmt, type ISODate } from '@/lib/dates';
import { plansForDay, trainingStats } from '@/features/personal/selectors';
import { usePersonalStore } from '@/features/personal/store';
import { useRunStore } from '@/features/personal/training/runStore';
import { SessionForm } from '@/features/personal/training/SessionForm';
import { ActiveWorkoutBanner, useStartWorkout } from '@/features/personal/training/StartWorkout';
import type { WorkoutPlan } from '@/features/personal/types';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    // Rótulo antes do valor no HTML (dt → dd); na tela, o número vem primeiro.
    <div className="flex min-w-0 flex-col-reverse">
      <dt className="mt-1 text-xs text-ink-3">{label}</dt>
      <dd className="font-display text-2xl leading-none font-semibold tabular">{value}</dd>
    </div>
  );
}

/**
 * Treino na tela Hoje: o que fazer hoje e, logo abaixo, os dias treinados.
 * A grade é o lembrete diário de constância, por isso fica à vista e não só na página Treino.
 */
export function TrainingCard({ today, className }: { today: ISODate; className?: string }) {
  const plans = usePersonalStore((s) => s.workoutPlans);
  const sessions = usePersonalStore((s) => s.workoutSessions);
  const startFromPlan = useRunStore((s) => s.startFromPlan);
  const { begin, dialog } = useStartWorkout();
  const [sessionPlan, setSessionPlan] = useState<WorkoutPlan | null>(null);

  const todayPlans = useMemo(() => plansForDay(plans, today), [plans, today]);
  const todaySessions = useMemo(() => sessions.filter((s) => s.date === today), [sessions, today]);
  const trainedDays = useMemo(() => new Set(sessions.map((s) => s.date)), [sessions]);
  const stats = useMemo(() => trainingStats(plans, sessions, today), [plans, sessions, today]);
  const last30 = useMemo(() => {
    const from = addDaysISO(today, -30);
    return [...trainedDays].filter((d) => d > from && d <= today).length;
  }, [trainedDays, today]);
  const planDone = (p: WorkoutPlan) => todaySessions.some((s) => s.planId === p.id);
  const extra = todaySessions.filter((s) => !s.planId || !todayPlans.some((p) => p.id === s.planId));

  return (
    <Card
      title="Treino"
      flush
      // min-w-0: a grade de dias se ajusta à largura em vez de alargar a página.
      className={cn('min-w-0', className)}
      action={
        <Link to="/personal/training" className="text-sm font-medium text-accent hover:underline">
          Semana
        </Link>
      }
    >
      <ActiveWorkoutBanner className="mx-5 mt-1 mb-2" />

      {todayPlans.length === 0 && extra.length === 0 ? (
        <p className="flex items-center gap-2 px-5 py-2 text-sm text-ink-2">
          <Dumbbell className="size-4 shrink-0 text-ink-3" aria-hidden />
          Dia de descanso: nada previsto na divisão para hoje.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {todayPlans.map((p) => {
            const ok = planDone(p);
            return (
              <li key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm', ok && 'text-ink-3')}>{p.label}</span>
                  <span className="text-xs text-ink-3">
                    {p.exercises?.length ? `${p.exercises.length} exercícios, ` : ''}
                    {p.durationMin} min previstos
                  </span>
                </span>
                {ok ? (
                  <span className="flex items-center gap-1 text-sm font-medium text-income">
                    <Check className="size-4" aria-hidden /> Feito
                  </span>
                ) : p.exercises?.length ? (
                  <Button size="sm" onClick={() => begin(() => startFromPlan(p))}>
                    Começar
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setSessionPlan(p)}>
                    Registrar
                  </Button>
                )}
              </li>
            );
          })}
          {extra.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
              <span className="flex-1 truncate text-sm text-ink-3">{s.label}</span>
              <span className="flex items-center gap-1 text-sm font-medium text-income">
                <Check className="size-4" aria-hidden /> Feito
              </span>
            </li>
          ))}
        </ul>
      )}

      <section aria-label="Dias treinados" className="mt-1 border-t border-line px-5 pt-3 pb-5">
        <h3 className="mb-2.5 text-sm font-medium text-ink-2">Dias treinados</h3>
        <Heatmap
          fit
          weeks={52}
          label="Dias com treino nas últimas semanas"
          state={(d) => (trainedDays.has(d) ? 'done' : 'missed')}
          describe={(d, s) => `${fmt.short(d)}: ${s === 'done' ? 'treinou' : 'sem treino'}`}
        />
        <dl className="mt-4 grid grid-cols-3 gap-3">
          <Stat value={String(stats.activeWeeksStreak)} label={stats.activeWeeksStreak === 1 ? 'semana seguida' : 'semanas seguidas'} />
          <Stat
            value={stats.plannedThisWeek ? `${stats.sessionsThisWeek} de ${stats.plannedThisWeek}` : String(stats.sessionsThisWeek)}
            label="treinos nesta semana"
          />
          <Stat value={String(last30)} label="dias nos últimos 30" />
        </dl>
      </section>

      <SessionForm open={Boolean(sessionPlan)} plan={sessionPlan} date={today} onClose={() => setSessionPlan(null)} />
      {dialog}
    </Card>
  );
}
