import { useMemo } from 'react';
import { Archive, ArchiveRestore, Flame, Pencil, Trash2, Trophy } from 'lucide-react';
import { CheckCircle, Heatmap, IconButton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { addDaysISO, fmt, todayISO } from '@/lib/dates';
import { AREAS } from '../meta';
import { computeStreak, isScheduled } from '../selectors';
import { usePersonalStore } from '../store';
import type { Habit } from '../types';
import { scheduleLabel } from './scheduleLabel';

const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });

interface HabitCardProps {
  habit: Habit;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
}

export function HabitCard({ habit, onEdit, onDelete }: HabitCardProps) {
  const toggleHabitDay = usePersonalStore((s) => s.toggleHabitDay);
  const setHabitArchived = usePersonalStore((s) => s.setHabitArchived);
  const today = todayISO();
  const streak = useMemo(() => computeStreak(habit, today), [habit, today]);
  const done = new Set(habit.completions);
  const last7 = Array.from({ length: 7 }, (_, i) => addDaysISO(today, i - 6));
  const AreaIcon = AREAS[habit.area].icon;

  return (
    <article className={cn('rounded-2xl border border-line bg-surface p-5', habit.archived && 'opacity-70')}>
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">{habit.title}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-3">
            <AreaIcon className="size-3.5" aria-hidden />
            {scheduleLabel(habit.schedule)}
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
            <Flame
              className={cn('size-5', streak.current > 0 ? 'text-warn' : 'text-ink-3')}
              aria-hidden
            />
            {streak.current}
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
          <dt className="text-xs text-ink-3">Últimos 30 dias</dt>
          <dd className="font-display text-2xl font-semibold tabular">
            {streak.rate30 === null ? '—' : pct.format(streak.rate30)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid grid-cols-7 gap-1.5" role="group" aria-label="Últimos 7 dias">
        {last7.map((day) => {
          const scheduled = isScheduled(habit, day);
          const checked = done.has(day);
          return (
            <div key={day} className="flex flex-col items-center gap-1">
              <span className={cn('text-[11px]', day === today ? 'font-semibold text-ink' : 'text-ink-3')}>
                {fmt.weekdayShort(day)}
              </span>
              {scheduled || checked ? (
                <CheckCircle
                  checked={checked}
                  onChange={() => toggleHabitDay(habit.id, day)}
                  label={`${habit.title}, ${fmt.long(day)}`}
                />
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
            return isScheduled(habit, d) && d !== today ? 'missed' : 'off';
          }}
          describe={(d, s) =>
            `${fmt.short(d)}: ${s === 'done' ? 'feito' : s === 'missed' ? 'não feito' : 'fora da agenda'}`
          }
        />
      </div>
    </article>
  );
}
