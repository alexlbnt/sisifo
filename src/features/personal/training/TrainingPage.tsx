import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Dumbbell, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { PlanForm } from './PlanForm';
import { SessionForm } from './SessionForm';

type SessionFormState = { session?: WorkoutSession; plan?: WorkoutPlan; date?: ISODate };

export function TrainingPage() {
  const plans = usePersonalStore((s) => s.workoutPlans);
  const sessions = usePersonalStore((s) => s.workoutSessions);
  const deleteSession = usePersonalStore((s) => s.deleteSession);
  const deletePlan = usePersonalStore((s) => s.deletePlan);

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

  return (
    <>
      <PageHeader
        title="Treino"
        subtitle="Divisão da semana, o que foi feito e o histórico"
        actions={
          <Button icon={Plus} onClick={() => setSessionForm({})}>
            Registrar treino
          </Button>
        }
      />

      <section
        aria-label="Resumo da semana"
        className="mb-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-surface lg:grid-cols-4"
      >
        <Stat
          label="Treinos na semana"
          value={`${stats.sessionsThisWeek}`}
          suffix={stats.plannedThisWeek ? `de ${stats.plannedThisWeek} previstos` : undefined}
        />
        <Stat label="Minutos na semana" value={`${stats.minutesThisWeek}`} suffix="min" />
        <Stat label="Semanas seguidas" value={`${stats.activeWeeksStreak}`} suffix="com treino" />
        <Stat
          label="Últimos 30 dias"
          value={`${[...trainedDays].filter((d) => d > addDaysISO(today, -30) && d <= today).length}`}
          suffix="dias treinados"
          last
        />
      </section>

      <Card
        className="mb-4"
        title={isCurrentWeek ? 'Esta semana' : `Semana de ${fmt.short(startOfWeekISO(weekOf))}`}
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
        <ol className="grid gap-2 sm:grid-cols-7">
          {week.map((day) => {
            const isToday = day.date === today;
            const future = day.date > today;
            const pending = day.planned.filter((p) => !day.sessions.some((s) => s.planId === p.id));
            return (
              <li
                key={day.date}
                className={cn(
                  'flex min-h-28 flex-col gap-1.5 rounded-xl border p-2.5',
                  isToday ? 'border-accent bg-accent-soft/40' : 'border-line',
                )}
              >
                <p className="flex items-baseline justify-between text-xs">
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
                    className="flex items-start gap-1 rounded-md bg-accent px-1.5 py-1 text-left text-xs text-accent-ink"
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
                      'rounded-md border border-dashed px-1.5 py-1 text-left text-xs',
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

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card title="Dias treinados" description="Últimas 26 semanas">
            <div className="overflow-x-auto">
              <Heatmap
                weeks={26}
                label="Dias com treino nas últimas 26 semanas"
                state={(d) => (trainedDays.has(d) ? 'done' : 'missed')}
                describe={(d, s) => `${fmt.short(d)}: ${s === 'done' ? 'treinou' : 'sem treino'}`}
              />
            </div>
          </Card>

          <Card
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
                      </p>
                    </div>
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
        </div>

        <Card title="Histórico" flush className="lg:col-span-3">
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

function Stat({ label, value, suffix, last }: { label: string; value: string; suffix?: string; last?: boolean }) {
  return (
    <div className={cn('border-line px-5 py-4 [&:nth-child(-n+2)]:border-b lg:[&:nth-child(-n+2)]:border-b-0', !last && 'odd:border-r lg:border-r')}>
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-semibold tabular">{value}</span>
        {suffix && <span className="text-xs text-ink-3">{suffix}</span>}
      </p>
    </div>
  );
}
