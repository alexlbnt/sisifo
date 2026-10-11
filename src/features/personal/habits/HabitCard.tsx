import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Flame, Pencil, SkipForward, Trash2, Trophy, Undo2 } from 'lucide-react';
import { Button, CheckCircle, Heatmap, IconButton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { addDaysISO, fmt, todayISO } from '@/lib/dates';
import { useAreaLookup } from '../meta';
import { computeStreak, isScheduled, isSkipped, isWeekly } from '../selectors';
import { usePersonalStore } from '../store';
import type { Habit } from '../types';
import { habitFrequencyLabel, QuantityStepper, SkipDialog, weeklyProgress } from './HabitControls';

const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });

interface HabitCardProps {
  habit: Habit;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
}

export function HabitCard({ habit, onEdit, onDelete }: HabitCardProps) {
  const toggleHabitDay = usePersonalStore((s) => s.toggleHabitDay);
  const setHabitArchived = usePersonalStore((s) => s.setHabitArchived);
  const setHabitSkip = usePersonalStore((s) => s.setHabitSkip);
  const [skipping, setSkipping] = useState(false);
  const today = todayISO();
  const streak = useMemo(() => computeStreak(habit, today), [habit, today]);
  const done = new Set(habit.completions);
  const last7 = Array.from({ length: 7 }, (_, i) => addDaysISO(today, i - 6));
  const areas = useAreaLookup();
  const AreaIcon = areas.icon(habit.area);
  const weekly = isWeekly(habit);
  const quantity = habit.kind === 'quantity';
  const skippedToday = isSkipped(habit, today);
  const canSkipToday = !weekly && !habit.archived && isScheduled(habit, today) && !done.has(today) && !skippedToday;
  const streakUnit = streak.unit === 'weeks' ? (streak.current === 1 ? 'semana' : 'semanas') : '';
  const unitSuffix = habit.unit ? ` ${habit.unit}` : '';

  return (
    <article className={cn('rounded-2xl border border-line bg-surface p-5', habit.archived && 'opacity-70')}>
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">{habit.title}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-3">
            <AreaIcon className="size-3.5 shrink-0" aria-hidden />
            {habitFrequencyLabel(habit)}
          </p>
        </div>
        <div className="-mt-1 -mr-2 flex">
          <IconButton icon={Pencil} label={`Editar ${habit.title}`} size="sm" onClick={() => onEdit(habit)} />
          <IconButton
            icon={habit.archived ? ArchiveRestore : Archive}
            label={habit.archived ? `Reativar ${habit.title}` : `Arquivar ${habit.title}`}
            size="sm"
            onClick={() => setHabitArchived(habit.id, !habit.archived)}
          />
          <IconButton icon={Trash2} label={`Excluir ${habit.title}`} size="sm" onClick={() => onDelete(habit)} />
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs text-ink-3">Sequência</dt>
          <dd className="flex items-center gap-1 font-display text-2xl font-semibold tabular">
            <Flame className={cn('size-5', streak.current > 0 ? 'text-warn' : 'text-ink-3')} aria-hidden />
            {streak.current}
            {streakUnit && <span className="font-sans text-xs font-normal text-ink-3">{streakUnit}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Recorde</dt>
          <dd className="flex items-center gap-1 font-display text-2xl font-semibold tabular">
            <Trophy className="size-4 text-ink-3" aria-hidden />
            {streak.best}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">{weekly ? 'Últimas semanas' : 'Últimos 30 dias'}</dt>
          <dd className="font-display text-2xl font-semibold tabular">
            {streak.rate30 === null ? '—' : pct.format(streak.rate30)}
          </dd>
        </div>
      </dl>

      {!habit.archived && (quantity || weekly || canSkipToday || skippedToday) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2/70 px-3 py-2">
          <span className="text-sm text-ink-2">
            {skippedToday ? `Hoje pulado: ${habit.skips?.[today]}` : weekly ? weeklyProgress(habit, today) : 'Hoje'}
          </span>
          <div className="flex items-center gap-2">
            {quantity && !skippedToday && <QuantityStepper habit={habit} day={today} />}
            {canSkipToday && (
              <Button variant="ghost" size="sm" icon={SkipForward} onClick={() => setSkipping(true)}>
                Pular
              </Button>
            )}
            {skippedToday && (
              <Button variant="ghost" size="sm" icon={Undo2} onClick={() => setHabitSkip(habit.id, today, null)}>
                Desfazer
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-7 gap-1.5" role="group" aria-label="Últimos 7 dias">
        {last7.map((day) => {
          const scheduled = isScheduled(habit, day);
          const checked = done.has(day);
          const skipped = isSkipped(habit, day);
          const amount = habit.amounts?.[day];
          return (
            <div key={day} className="flex flex-col items-center gap-1">
              <span className={cn('text-[11px]', day === today ? 'font-semibold text-ink' : 'text-ink-3')}>
                {fmt.weekdayShort(day)}
              </span>
              {skipped ? (
                <button
                  type="button"
                  className="grid size-6 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
                  title={`Pulado: ${habit.skips?.[day]}. Clique para desfazer.`}
                  aria-label={`${habit.title}, ${fmt.long(day)}: pulado (${habit.skips?.[day]}). Desfazer`}
                  onClick={() => setHabitSkip(habit.id, day, null)}
                >
                  <SkipForward className="size-3.5" aria-hidden />
                </button>
              ) : scheduled || checked ? (
                <span title={quantity && amount !== undefined ? `${amount}${unitSuffix}` : undefined}>
                  <CheckCircle
                    checked={checked}
                    onChange={() => toggleHabitDay(habit.id, day)}
                    label={`${habit.title}, ${fmt.long(day)}`}
                  />
                </span>
              ) : (
                <span className="grid size-6 place-items-center text-xs text-ink-3" title="Fora da agenda">
                  –
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <Heatmap
          weeks={17}
          label={`Histórico de ${habit.title} nas últimas 17 semanas`}
          state={(d) => {
            if (done.has(d)) return 'done';
            // Antes de o hábito existir não há o que cobrar: célula vazia.
            if (d < habit.createdAt.slice(0, 10)) return 'future';
            if (isSkipped(habit, d) || weekly) return 'off';
            return isScheduled(habit, d) && d !== today ? 'missed' : 'off';
          }}
          describe={(d, s) => {
            if (isSkipped(habit, d)) return `${fmt.short(d)}: pulado (${habit.skips?.[d]})`;
            const amount = quantity && habit.amounts?.[d] !== undefined ? ` (${habit.amounts[d]}${unitSuffix})` : '';
            return `${fmt.short(d)}: ${s === 'done' ? 'feito' : s === 'missed' ? 'não feito' : 'fora da agenda'}${amount}`;
          }}
        />
      </div>

      {skipping && <SkipDialog habit={habit} day={today} onClose={() => setSkipping(false)} />}
    </article>
  );
}
