import { cn } from '@/lib/cn';

type Tone = 'accent' | 'good' | 'warn' | 'danger';

const tones: Record<Tone, string> = {
  accent: 'bg-accent',
  good: 'bg-income',
  warn: 'bg-warn',
  danger: 'bg-expense',
};

interface ProgressBarProps {
  /** De 0 a 1. Valores acima de 1 enchem a barra. */
  value: number;
  tone?: Tone;
  label: string;
  className?: string;
}

export function ProgressBar({ value, tone = 'accent', label, className }: ProgressBarProps) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', tones[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
