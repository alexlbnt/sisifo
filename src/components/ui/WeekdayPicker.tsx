import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '@/lib/dates';
import { cn } from '@/lib/cn';

interface WeekdayPickerProps {
  value: number[];
  onChange: (days: number[]) => void;
  id?: string;
}

export function WeekdayPicker({ value, onChange, id }: WeekdayPickerProps) {
  const toggle = (day: number) =>
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort());

  return (
    <div id={id} className="flex gap-1.5" role="group" aria-label="Dias da semana">
      {WEEKDAY_ORDER.map((day) => {
        const active = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(day)}
            className={cn(
              'h-9 flex-1 rounded-lg border text-[13px] font-medium transition-colors',
              active
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
            )}
          >
            {WEEKDAY_LABELS[day]}
          </button>
        );
      })}
    </div>
  );
}
