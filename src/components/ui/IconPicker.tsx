import { cn } from '@/lib/cn';
import { ICONS, ICON_KEYS } from './icons';

interface IconPickerProps {
  value: string;
  onChange: (key: string) => void;
  label: string;
}

/** Grade de ícones para escolher o de uma categoria ou área. */
export function IconPicker({ value, onChange, label }: IconPickerProps) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-8 gap-1.5">
      {ICON_KEYS.map((key) => {
        const Icon = ICONS[key];
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={key}
            onClick={() => onChange(key)}
            className={cn(
              'grid aspect-square place-items-center rounded-lg border transition-colors',
              active
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line text-ink-3 hover:bg-surface-2 hover:text-ink',
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
