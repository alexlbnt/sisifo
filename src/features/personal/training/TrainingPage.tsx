import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Dumbbell, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Heatmap,
  IconButton,
  PageHeader,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { addDaysISO, fmt, relativeDay, startOfWeekISO, todayISO, type ISODate } from '@/lib/dates';
import { INTENSITY_LABELS, WORKOUT_KINDS } from '../meta';
import { trainingStats, trainingWeek } from '../selectors';
import { usePersonalStore } from '../store';
import type { WorkoutPlan, WorkoutSession } from '../types';
import { scheduleLabel } from '../habits/scheduleLabel';
import { GoalForm } from '../goals/GoalForm';
import { WeightCard } from '../weight/WeightCard';
import { PlanForm } from './PlanForm';
import { ProgressCard } from './ProgressCard';
import { useRunStore } from './runStore';
import { SessionForm } from './SessionForm';
import { ActiveWorkoutBanner, StartWorkoutDialog, useStartWorkout } from './StartWorkout';

/** "5 exercícios, 18 séries" para a linha do histórico. */
function setsSummary(session: WorkoutSession): string | null {
  const exercises = session.exercises ?? [];
  if (!exercises.length) return null;
  const sets = exercises.reduce((n, e) => n + e.sets.length, 0);
  return `${exercises.length} ${exercises.length === 1 ? 'exercício' : 'exercícios'}, ${sets} séries`;
}

type SessionFormState = { session?: WorkoutSession; plan?: WorkoutPlan; date?: ISODate };

export function TrainingPage() {
  const plans = usePersonalStore((s) => s.workoutPlans);
  const sessions = usePersonalStore((s) => s.workoutSessions);
  const deleteSession = usePersonalStore((s) => s.deleteSession);
  const deletePlan = usePersonalStore((s) => s.deletePlan);
  const startFromPlan = useRunStore((s) => s.startFromPlan);
  const { begin, dialog: startDialog } = useStartWorkout();
  const [choosing, setChoosing] = useState(false);
  const [weightGoalForm, setWeightGoalForm] = useState(false);

  const today = todayISO();
  const [weekOf, setWeekOf] = useState(today);
  const [sessionForm, setSessionForm] = useState<SessionFormState | null>(null);
  const [planForm, setPlanForm] = useState<{ plan?: WorkoutPlan } | null>(null);
  const [toDelete, setToDelete] = useState<
    { kind: 'session'; item: WorkoutSession } | { kind: 'plan'; item: WorkoutPlan } | null
  >(null);

  const week = useMemo(() => trainingWeek(plans, sessions, weekOf), [plans, sessions, weekOf]);
  const stats = useMemo(() => trainingStats(plans, sessions, today), [plans, sessions, today]);
  const trainedDays = useMemo(() => new Set(sessions.map((s) => s.date)), [sessions]);
  const history = useMemo(
    () => [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12),
    [sessions],
  );
  const isCurrentWeek = startOfWeekISO(weekOf) === startOfWeekISO(today);
  const last30 = [...trainedDays].filter((d) => d > addDaysISO(today, -30) && d <= today).length;
  const statsLine = [
    stats.plannedThisWeek ? `${stats.sessionsThisWeek} de ${stats.plannedThisWeek} previstos` : `${stats.sessionsThisWeek} ${stats.sessionsThisWeek === 1 ? 'treino' : 'treinos'}`,
    `${stats.minutesThisWeek} min`,
    `${stats.activeWeeksStreak} ${stats.activeWeeksStreak === 1 ? 'semana seguida' : 'semanas seguidas'}`,
    `${last30} ${last30 === 1 ? 'dia' : 'dias'} em 30`,
  ].join(' · ');

  return (
    <>
      <PageHeader
        title="Treino"
        subtitle="Divisão da semana, o que foi feito e o histórico"
        actions={
          <>
            <Button variant="secondary" icon={Plus} onClick={() => setSessionForm({})}>
              Registrar
            </Button>
            <Button icon={Play} onClick={() => setChoosing(true)}>
              Começar treino
            </Button>
          </>
        }
      />

      <ActiveWorkoutBanner className="mb-4" />

      <Card
        className="mb-4"
        title={isCurrentWeek ? 'Esta semana' : `Semana de ${fmt.short(startOfWeekISO(weekOf))}`}
        description={statsLine}
        action={
          <div className="flex items-center">
            {!isCurrentWeek && (
              <Button variant="ghost" size="sm" onClick={() => setWeekOf(today)}>
                Semana atual
              </Button>
            )}
            <IconButton icon={ChevronLeft} label="Semana anterior" size="sm" onClick={() => setWeekOf(addDaysISO(weekOf, -7))} />
            <IconButton
              icon={ChevronRight}
              label="Próxima semana"
              size="sm"
              disabled={isCurrentWeek}
              onClick={() => setWeekOf(addDaysISO(weekOf, 7))}
            />
          </div>
        }
      >
        <ol className="grid gap-1.5 sm:grid-cols-7 sm:gap-2">
          {week.map((day) => {
            const isToday = day.date === today;
            const future = day.date > today;
            const pending = day.planned.filter((p) => !day.sessions.some((s) => s.planId === p.id));
            return (
              <li
                key={day.date}
                className={cn(
                  'flex flex-wrap items-center gap-1.5 rounded-xl border px-2.5 py-2 sm:min-h-28 sm:flex-col sm:flex-nowrap sm:items-stretch sm:py-2.5',
                  isToday ? 'border-accent bg-accent-soft/40' : 'border-line',
                )}
              >
                <p className="flex w-14 shrink-0 items-baseline gap-1 text-xs sm:w-auto sm:justify-between">
                  <span className={cn('font-semibold', isToday ? 'text-accent' : 'text-ink-2')}>
                    {fmt.weekdayShort(day.date)}
                  </span>
                  <span className="text-ink-3 tabular">{day.date.slice(8, 10)}</span>
                </p>
                {day.sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSessionForm({ session: s })}
                    className="flex items-start gap-1 rounded-md bg-accent px-2 py-1.5 text-left text-xs text-accent-ink sm:px-1.5 sm:py-1"
                  >
                    <Check className="mt-px size-3 shrink-0" strokeWidth={3} aria-hidden />
                    <span className="line-clamp-2">{s.label}</span>
                  </button>
                ))}
                {pending.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={future}
                    onClick={() => setSessionForm({ plan: p, date: day.date })}
                    title={future ? 'Previsto' : 'Registrar este treino'}
                    className={cn(
                      'rounded-md border border-dashed px-2 py-1.5 text-left text-xs sm:px-1.5 sm:py-1',
                      future
                        ? 'border-line text-ink-3'
                        : 'border-ink-3/50 text-ink-2 hover:border-accent hover:text-accent',
                    )}
                  >
                    <span className="line-clamp-2">{p.label}</span>
                  </button>
                ))}
                {!day.sessions.length && !pending.length && (
                  <span className="text-xs text-ink-3">Descanso</span>
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-xs text-ink-3">
          Treinos tracejados estão previstos. Toque num deles para registrar.
        </p>
      </Card>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-5 lg:items-start">
        {/* No celular as colunas somem (contents) e a ordem vem do uso: peso, evolução, divisão, histórico, dias. */}
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4 lg:col-span-2">
          <WeightCard className="order-1 lg:order-none" onDefineTarget={() => setWeightGoalForm(true)} />
          <Card
            className="order-3 lg:order-none"
            title="Divisão de treino"
            flush
            action={
              <IconButton icon={Plus} label="Adicionar treino à divisão" size="sm" onClick={() => setPlanForm({})} />
            }
          >
            {plans.length === 0 ? (
              <EmptyState
                icon={Dumbbell}
                title="Sem divisão definida"
                text="Monte sua semana (ex.: A/B/C, Muay Thai) para ver o previsto."
              />
            ) : (
              <ul className="divide-y divide-line pb-2">
                {plans.map((p) => (
                  <li key={p.id} className="group flex items-center gap-3 px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.label}</p>
                      <p className="text-xs text-ink-3">
                        {WORKOUT_KINDS[p.kind]} · {scheduleLabel(p.weekdays)} · {p.durationMin} min
                        {p.exercises?.length ? ` · ${p.exercises.length} exercícios` : ''}
                      </p>
                    </div>
                    <IconButton icon={Play} label={`Começar ${p.label}`} size="sm" className="text-accent" onClick={() => begin(() => startFromPlan(p))} />
                    <div className="flex sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                      <IconButton icon={Pencil} label={`Editar ${p.label}`} size="sm" onClick={() => setPlanForm({ plan: p })} />
                      <IconButton
                        icon={Trash2}
                        label={`Excluir ${p.label}`}
                        size="sm"
                        onClick={() => setToDelete({ kind: 'plan', item: p })}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="order-5 lg:order-none" title="Dias treinados" description="Semanas mais recentes">
            <div>
              <Heatmap
                fit
                weeks={52}
                label="Dias com treino nas últimas semanas"
                state={(d) => (trainedDays.has(d) ? 'done' : 'missed')}
                describe={(d, s) => `${fmt.short(d)}: ${s === 'done' ? 'treinou' : 'sem treino'}`}
              />
            </div>
          </Card>
        </div>

        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4 lg:col-span-3">
          <div className="order-2 min-w-0 lg:order-none">
            <ProgressCard />
          </div>
          <Card className="order-4 lg:order-none" title="Histórico" flush>
            {history.length === 0 ? (
              <EmptyState icon={Dumbbell} title="Nenhum treino registrado" />
            ) : (
              <ul className="divide-y divide-line pb-2">
                {history.map((s) => (
                  <li key={s.id} className="group flex items-center gap-3 px-5 py-2.5">
                    <div className="w-14 shrink-0 text-xs text-ink-3">{relativeDay(s.date, today)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.label}</p>
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                        <span>{s.durationMin} min</span>
                        <span>Intensidade: {INTENSITY_LABELS[s.intensity].toLowerCase()}</span>
                        {setsSummary(s) && <span>{setsSummary(s)}</span>}
                        {s.notes && <span className="truncate italic">"{s.notes}"</span>}
                      </p>
                    </div>
                    <Badge className="hidden sm:inline-flex">{WORKOUT_KINDS[s.kind]}</Badge>
                    <div className="flex sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                      <IconButton icon={Pencil} label={`Editar ${s.label}`} size="sm" onClick={() => setSessionForm({ session: s })} />
                      <IconButton
                        icon={Trash2}
                        label={`Excluir ${s.label}`}
                        size="sm"
                        onClick={() => setToDelete({ kind: 'session', item: s })}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <GoalForm open={weightGoalForm} preset="bodyweight" onClose={() => setWeightGoalForm(false)} />
      <StartWorkoutDialog open={choosing} onClose={() => setChoosing(false)} />
      {startDialog}
      <SessionForm
        open={Boolean(sessionForm)}
        session={sessionForm?.session}
        plan={sessionForm?.plan}
        date={sessionForm?.date}
        onClose={() => setSessionForm(null)}
      />
      <PlanForm open={Boolean(planForm)} plan={planForm?.plan} onClose={() => setPlanForm(null)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title={toDelete?.kind === 'plan' ? 'Remover da divisão?' : 'Excluir treino?'}
        message={
          toDelete?.kind === 'plan'
            ? 'Ele deixa de aparecer como previsto. Os treinos já registrados continuam no histórico.'
            : 'Este registro sai do histórico.'
        }
        confirmLabel={toDelete?.kind === 'plan' ? 'Remover da divisão' : 'Excluir treino'}
        onConfirm={() => {
          if (toDelete?.kind === 'plan') deletePlan(toDelete.item.id);
          else if (toDelete) deleteSession(toDelete.item.id);
        }}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}

