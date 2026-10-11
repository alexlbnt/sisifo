import { useId, useState, type FormEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button, Field, IconButton, Input, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';
import { fmt, type ISODate } from '@/lib/dates';
import { habitTarget, isWeekly, weekCount } from '../selectors';
import { usePersonalStore } from '../store';
import type { Habit } from '../types';
import { scheduleLabel } from './scheduleLabel';

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** "Todos os dias", "3x por semana"... e a meta diária nos hábitos de quantidade. */
export function habitFrequencyLabel(habit: Habit): string {
  const frequency = isWeekly(habit) ? `${habit.timesPerWeek ?? 1}x por semana` : scheduleLabel(habit.schedule);
  if (habit.kind !== 'quantity') return frequency;
  return `${frequency} · meta ${number.format(habitTarget(habit))}${habit.unit ? ` ${habit.unit}` : ''}/dia`;
}

/** Progresso da semana nos hábitos semanais: "2 de 3". */
export function weeklyProgress(habit: Habit, day: ISODate): string {
  return `${weekCount(habit, day)} de ${habit.timesPerWeek ?? 1} nesta semana`;
}

/** − 5/8 copos + : registra a quantidade do dia num hábito de quantidade. */
export function QuantityStepper({ habit, day, compact }: { habit: Habit; day: ISODate; compact?: boolean }) {
  const setHabitAmount = usePersonalStore((s) => s.setHabitAmount);
  const value = habit.amounts?.[day] ?? 0;
  const target = habitTarget(habit);
  const step = target >= 50 ? 5 : 1;
  const done = value >= target;

  return (
    <div className="flex items-center gap-1" role="group" aria-label={`Quantidade de ${habit.title} em ${fmt.short(day)}`}>
      <IconButton
        icon={Minus}
        label="Diminuir"
        size="sm"
        className={cn('border border-line', compact && 'size-7')}
        disabled={value <= 0}
        onClick={() => setHabitAmount(habit.id, day, Math.max(0, value - step))}
      />
      <span className={cn('min-w-14 text-center text-sm tabular', done ? 'font-semibold text-income' : 'text-ink-2')} aria-live="polite">
        {number.format(value)}/{number.format(target)}
        {!compact && habit.unit && <span className="text-xs text-ink-3"> {habit.unit}</span>}
      </span>
      <IconButton
        icon={Plus}
        label="Aumentar"
        size="sm"
        className={cn('border border-line', compact && 'size-7')}
        onClick={() => setHabitAmount(habit.id, day, value + step)}
      />
    </div>
  );
}

/** Pergunta o motivo antes de pular o dia (não conta nem quebra a sequência). */
export function SkipDialog({ habit, day, onClose }: { habit: Habit | null; day: ISODate; onClose: () => void }) {
  if (!habit) return null;
  return <SkipDialogInner habit={habit} day={day} onClose={onClose} />;
}

const QUICK_REASONS = ['Doente', 'Viagem', 'Descanso planejado', 'Imprevisto'];

function SkipDialogInner({ habit, day, onClose }: { habit: Habit; day: ISODate; onClose: () => void }) {
  const id = useId();
  const setHabitSkip = usePersonalStore((s) => s.setHabitSkip);
  const [reason, setReason] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setHabitSkip(habit.id, day, reason);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Pular "${habit.title}"?`}
      description={`${fmt.long(day)}. O dia pulado não conta e não quebra a sequência.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={id}>
            Pular o dia
          </Button>
        </>
      }
    >
      <form id={id} onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Motivo" htmlFor={`${id}-reason`} hint="Fica no histórico do hábito.">
          <Input
            id={`${id}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: Doente"
            maxLength={120}
            autoFocus
          />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className="rounded-md px-2 py-1 text-xs text-accent hover:bg-accent-soft"
            >
              {r}
            </button>
          ))}
        </div>
      </form>
    </Modal>
  );
}
