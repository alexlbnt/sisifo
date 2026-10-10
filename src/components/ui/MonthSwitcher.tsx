import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonthsKey, currentMonthKey, fmt, type MonthKey } from '@/lib/dates';
import { IconButton } from './Button';

interface MonthSwitcherProps {
  value: MonthKey;
  onChange: (month: MonthKey) => void;
}

export function MonthSwitcher({ value, onChange }: MonthSwitcherProps) {
  const isCurrent = value >= currentMonthKey();
  return (
    <div className="inline-flex items-center rounded-lg border border-line bg-surface">
      <IconButton
        icon={ChevronLeft}
        label="Mês anterior"
        size="sm"
        onClick={() => onChange(addMonthsKey(value, -1))}
      />
      <span className="min-w-36 text-center text-sm font-medium" aria-live="polite">
        {fmt.month(value)}
      </span>
      <IconButton
        icon={ChevronRight}
        label="Próximo mês"
        size="sm"
        disabled={isCurrent}
        onClick={() => onChange(addMonthsKey(value, 1))}
      />
    </div>
  );
}
