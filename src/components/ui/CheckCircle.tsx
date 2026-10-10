import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

interface CheckCircleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  size?: 'sm' | 'md';
}

/** Marcador redondo usado em tarefas e hábitos. */
export function CheckCircle({ checked, onChange, label, size = 'md' }: CheckCircleProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        'grid shrink-0 place-items-center rounded-full border-2 transition-colors',
        size === 'sm' ? 'size-5' : 'size-6',
        checked
          ? 'border-accent bg-accent text-accent-ink'
          : 'border-ink-3/60 text-transparent hover:border-accent',
      )}
    >
      <Check className={size === 'sm' ? 'size-3' : 'size-3.5'} strokeWidth={3} aria-hidden />
    </button>
  );
}
