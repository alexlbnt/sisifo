import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Remove o padding interno do corpo (útil para listas que vão até a borda). */
  flush?: boolean;
}

export function Card({ title, description, action, flush, className, children, ...props }: CardProps) {
  return (
    <section className={cn('rounded-2xl border border-line bg-surface', className)} {...props}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-1">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="text-[13px] text-ink-3">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn(!flush && 'px-5 pt-3 pb-5')}>{children}</div>
    </section>
  );
}
