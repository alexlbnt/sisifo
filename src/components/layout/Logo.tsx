import { cn } from '@/lib/cn';

/** Marca: a pedra de Sísifo sobre a encosta. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-accent" />
        <path d="M5 25 L27 9" className="stroke-accent-ink" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="14.6" cy="10.6" r="5" className="fill-accent-ink" />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight text-ink">Sísifo</span>
    </span>
  );
}
