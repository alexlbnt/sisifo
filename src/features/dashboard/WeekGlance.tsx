import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Check, Dumbbell } from 'lucide-react';
import { cn } from '@/lib/cn';
import { addDaysISO, fmt, startOfWeekISO, type ISODate } from '@/lib/dates';
import { busyHours, eventsOnLocalDay, useAgendaWeek } from '@/features/agenda/agendaStore';
import { plansForDay, tasksForDay } from '@/features/personal/selectors';
import { usePersonalStore } from '@/features/personal/store';
import { dayLoad, HEAVY_SCORE, loadScore, type DayLoad } from '@/features/personal/tasks/weekPlan';
import type { AgendaEvent } from '@/shared/agenda';
import { dayItems, ridgeLevels, ridgePath, type GlanceItem } from './weekRidge';

/** Dias abertos no celular com o bloco recolhido: só hoje. */
const MOBILE_DAYS = 1;
/** Itens visíveis por dia antes do "+N". */
const MAX_ITEMS = { column: 4, row: 5 } as const;
/** Geometria da serra (viewBox); esticada na largura, a altura fica fixa. */
const RIDGE = { width: 700, height: 56, floor: 4, top: 6 } as const;

interface GlanceDay {
  date: ISODate;
  items: GlanceItem[];
  untimedTasks: number;
  load: DayLoad;
  level: number;
}

const weekdayLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });

function dayWord(date: ISODate, today: ISODate): string {
  if (date === today) return 'hoje';
  if (date === addDaysISO(today, 1)) return 'amanhã';
  return weekdayLong.format(new Date(`${date}T12:00:00`)).replace('-feira', '');
}

/** "segunda, quarta e sexta" */
function joinPt(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} e ${words.at(-1)}`;
}

function useGlanceDays(today: ISODate): GlanceDay[] {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(today, i)), [today]);
  // Sete dias a partir de hoje podem cruzar duas semanas da agenda.
  const thisWeek = useAgendaWeek(startOfWeekISO(days[0]!));
  const nextWeek = useAgendaWeek(startOfWeekISO(days[6]!));
  const tasks = usePersonalStore((s) => s.tasks);
  const plans = usePersonalStore((s) => s.workoutPlans);
  const sessions = usePersonalStore((s) => s.workoutSessions);

  return useMemo(() => {
    const byId = new Map<string, AgendaEvent>();
    for (const e of [...(thisWeek?.events ?? []), ...(nextWeek?.events ?? [])]) byId.set(e.id, e);
    const events = [...byId.values()];
    const raw = days.map((date) => {
      const dayEvents = eventsOnLocalDay(events, date);
      const dayTasks = tasksForDay(tasks, date);
      const dayPlans = plansForDay(plans, date).map((plan) => ({
        plan,
        done: sessions.some((s) => s.date === date && s.planId === plan.id),
      }));
      const { items, untimedTasks } = dayItems(dayEvents, dayTasks, dayPlans);
      const load = dayLoad(
        dayTasks.filter((t) => t.status !== 'done').length,
        busyHours(dayEvents, date),
        dayPlans.filter((p) => !p.done).length,
      );
      return { date, items, untimedTasks, load };
    });
    const levels = ridgeLevels(raw.map((d) => loadScore(d.load)), HEAVY_SCORE);
    return raw.map((d, i) => ({ ...d, level: levels[i]! }));
  }, [days, thisWeek, nextWeek, tasks, plans, sessions]);
}

/* ───────── Peças ───────── */

/** A serra da semana: a altura de cada pico é o quanto o dia está ocupado. */
function Ridge({ days, className }: { days: GlanceDay[]; className?: string }) {
  const { width, height, floor, top } = RIDGE;
  const path = ridgePath(
    days.map((d) => d.level),
    width,
    height,
    floor,
  );
  return (
    <div className={cn('relative', className)} aria-hidden>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block h-14 w-full">
        <path d={path} className="fill-slope/70" />
        <path d={path} fill="none" className="stroke-ink-3/50" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Dia cheio: um marco no pico (HTML, para não esticar com o SVG). */}
      {days.map((d, i) =>
        d.load.heavy ? (
          <span
            key={d.date}
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-warn ring-2 ring-surface"
            style={{
              left: `${((i + 0.5) / days.length) * 100}%`,
              top: `${((height - floor - Math.min(1, d.level) * (height - floor - top)) / height) * 100}%`,
            }}
          />
        ) : null,
      )}
    </div>
  );
}

function ItemLine({ item, compact }: { item: GlanceItem; compact?: boolean }) {
  return (
    <li className={cn('flex min-w-0 gap-1.5 leading-snug', compact ? 'text-xs' : 'text-sm', item.done && 'text-ink-3 line-through')}>
      {item.kind === 'training' ? (
        item.done ? (
          <Check className="mt-0.5 size-3 shrink-0 text-income" aria-label="Treino feito" />
        ) : (
          <Dumbbell className="mt-0.5 size-3 shrink-0 text-ink-3" aria-label="Treino" />
        )
      ) : (
        item.time && <span className={cn('shrink-0 text-ink-3 tabular', compact ? 'text-[11px] leading-[1.35rem]' : 'w-14 text-xs leading-5')}>{item.time}</span>
      )}
      <span className={cn('min-w-0', compact ? 'line-clamp-2' : 'truncate')}>{item.title}</span>
    </li>
  );
}

function Extras({ day, limit, className }: { day: GlanceDay; limit: number; className?: string }) {
  const hidden = Math.max(0, day.items.length - limit);
  const parts = [
    hidden ? `+${hidden} ${hidden === 1 ? 'item' : 'itens'}` : null,
    day.untimedTasks ? `${day.untimedTasks} ${day.untimedTasks === 1 ? 'tarefa' : 'tarefas'} sem horário` : null,
  ].filter(Boolean);
  if (!parts.length) return null;
  return <p className={cn('text-xs text-ink-3', className)}>{parts.join(', ')}</p>;
}

/* ───────── Cartão ───────── */

/**
 * Os próximos 7 dias de relance, na tela Hoje: a serra mostra quais dias pesam,
 * e embaixo de cada pico vêm os compromissos, tarefas com horário e treinos.
 */
export function WeekGlance({ today, className }: { today: ISODate; className?: string }) {
  const days = useGlanceDays(today);
  const [allDays, setAllDays] = useState(false);
  const heavy = days.filter((d) => d.load.heavy).map((d) => dayWord(d.date, today));
  const events = days.reduce((n, d) => n + d.items.filter((i) => i.kind === 'event').length, 0);
  const trainings = days.reduce((n, d) => n + d.items.filter((i) => i.kind === 'training' && !i.done).length, 0);

  const summary = [
    events ? `${events} ${events === 1 ? 'compromisso' : 'compromissos'}` : null,
    trainings ? `${trainings} ${trainings === 1 ? 'treino' : 'treinos'}` : null,
  ].filter(Boolean);

  return (
    <section aria-label="Próximos 7 dias" className={cn('overflow-hidden rounded-2xl border border-line bg-surface', className)}>
      <header className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Próximos 7 dias</h2>
          <p className="text-[13px] text-ink-3">
            {summary.length ? `${joinPt(summary as string[])} pela frente.` : 'Nada marcado pela frente.'}{' '}
            {heavy.length ? (
              <span className="text-warn">Dia cheio: {joinPt(heavy)}.</span>
            ) : (
              'Nenhum dia cheio.'
            )}
          </p>
        </div>
        <Link to="/personal/week" className="shrink-0 text-sm font-medium text-accent hover:underline">
          Planejar semana
        </Link>
      </header>

      {/* Computador: serra em cima, uma coluna por dia embaixo de cada pico. */}
      <div className="relative mt-3 hidden lg:block">
        <span
          aria-hidden
          className="absolute inset-y-0 w-[calc(100%/7)] bg-accent-soft/50"
          style={{ left: 0 }}
        />
        <Ridge days={days} />
        <ol className="relative grid grid-cols-7">
          {days.map((day) => {
            const isToday = day.date === today;
            return (
              <li key={day.date} className="min-w-0 border-l border-line/60 first:border-l-0">
                <Link to="/personal/week" className="flex h-full flex-col gap-2 px-3 pt-2 pb-4 hover:bg-surface-2/60">
                  <p className="flex items-baseline gap-1.5">
                    <span className={cn('font-display text-2xl leading-none font-semibold tabular', isToday ? 'text-accent' : 'text-ink')}>
                      {day.date.slice(8, 10)}
                    </span>
                    <span className={cn('text-xs', isToday ? 'font-semibold text-accent' : 'text-ink-3')}>
                      {isToday ? 'hoje' : fmt.weekdayShort(day.date).toLowerCase()}
                    </span>
                  </p>
                  {day.items.length ? (
                    <ul className="flex flex-col gap-1">
                      {day.items.slice(0, MAX_ITEMS.column).map((item) => (
                        <ItemLine key={item.key} item={item} compact />
                      ))}
                    </ul>
                  ) : (
                    !day.untimedTasks && <p className="text-xs text-ink-3">Livre</p>
                  )}
                  <Extras day={day} limit={MAX_ITEMS.column} />
                </Link>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Celular: serra em miniatura com as iniciais, e os dias em lista. */}
      <div className="mt-3 lg:hidden">
        <Ridge days={days} />
        <ol className="grid grid-cols-7 border-b border-line pb-2 text-center text-xs" aria-hidden>
          {days.map((day) => (
            <li key={day.date} className={cn('tabular', day.date === today ? 'font-semibold text-accent' : 'text-ink-3')}>
              {fmt.weekdayShort(day.date).charAt(0)}
              <span className="block">{day.date.slice(8, 10)}</span>
            </li>
          ))}
        </ol>
        <ol className="divide-y divide-line">
          {(allDays ? days : days.slice(0, MOBILE_DAYS)).map((day) => {
            const isToday = day.date === today;
            const empty = !day.items.length && !day.untimedTasks;
            return (
              <li key={day.date}>
                <Link to="/personal/week" className="flex gap-3 px-5 py-2.5">
                  <span className="w-16 shrink-0">
                    <span className={cn('block text-sm font-semibold first-letter:uppercase', isToday && 'text-accent')}>
                      {dayWord(day.date, today)}
                    </span>
                    <span className="block text-xs text-ink-3">{fmt.short(day.date)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    {empty ? (
                      <span className="text-sm text-ink-3">Livre</span>
                    ) : (
                      <>
                        <ul className="flex flex-col gap-0.5">
                          {day.items.slice(0, MAX_ITEMS.row).map((item) => (
                            <ItemLine key={item.key} item={item} />
                          ))}
                        </ul>
                        <Extras day={day} limit={MAX_ITEMS.row} className="mt-0.5" />
                      </>
                    )}
                  </span>
                  {day.load.heavy && <span className="mt-0.5 shrink-0 text-[11px] font-semibold text-warn">Dia cheio</span>}
                </Link>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={() => setAllDays((v) => !v)}
          aria-expanded={allDays}
          className="min-h-12 w-full border-t border-line text-sm font-medium text-accent"
        >
          {allDays ? 'Mostrar só hoje' : 'Mostrar os 7 dias'}
        </button>
      </div>
    </section>
  );
}
