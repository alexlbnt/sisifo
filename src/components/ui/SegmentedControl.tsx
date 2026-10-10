import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  label: string;
  className?: string;
  /** Mostra só os ícones; o texto vira rótulo acessível e tooltip. */
  iconOnly?: boolean;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  iconOnly,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex rounded-lg border border-line bg-surface-2 p-0.5', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={iconOnly ? opt.label : undefined}
            title={iconOnly ? opt.label : undefined}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors',
              active ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink',
            )}
          >
            {Icon && <Icon className="size-3.5" aria-hidden />}
            {!iconOnly && opt.label}
          </button>
        );
      })}
    </div>
  );
}
