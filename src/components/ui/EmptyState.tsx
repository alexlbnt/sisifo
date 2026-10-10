import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, text, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-10 text-center', className)}>
      <Icon className="mb-3 size-6 text-ink-3" aria-hidden />
      <p className="font-medium text-ink">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-ink-3">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
