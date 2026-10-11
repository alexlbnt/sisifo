import { useRef, useState, type ReactNode, type TouchEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';

export interface SwipeAction {
  label: string;
  icon: LucideIcon;
  tone: 'good' | 'warn' | 'danger' | 'accent';
  onAction: () => void;
}

interface SwipeRowProps {
  children: ReactNode;
  /** Deslizar para a direita (ex.: concluir). */
  right?: SwipeAction;
  /** Deslizar para a esquerda (ex.: adiar). */
  left?: SwipeAction;
  className?: string;
}

/** Distância para a ação valer ao soltar. */
const THRESHOLD = 76;
const MAX = 120;

const TONE = {
  good: 'bg-income text-white',
  warn: 'bg-warn text-white',
  danger: 'bg-expense text-white',
  accent: 'bg-accent text-accent-ink',
} as const;

/**
 * Linha de lista com gestos de deslizar, como no app Lembretes do iPhone.
 * Só reage ao toque; no computador continua uma linha comum. `touch-action:
 * pan-y` deixa a rolagem vertical com o navegador e o gesto lateral com a linha.
 */
export function SwipeRow({ children, right, left, className }: SwipeRowProps) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const armed = useRef(false);

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (t) start.current = { x: t.clientX, y: t.clientY, horizontal: null };
  };

  const onTouchMove = (e: TouchEvent) => {
    const s = start.current;
    const t = e.touches[0];
    if (!s || !t) return;
    const moveX = t.clientX - s.x;
    const moveY = t.clientY - s.y;
    if (s.horizontal === null && Math.abs(moveX) + Math.abs(moveY) > 10) s.horizontal = Math.abs(moveX) > Math.abs(moveY) * 1.2;
    if (!s.horizontal) return;
    const allowed = (moveX > 0 && right) || (moveX < 0 && left) ? moveX : 0;
    const next = Math.max(-MAX, Math.min(MAX, allowed));
    // Vibra ao passar do ponto em que a ação vale.
    const over = Math.abs(next) >= THRESHOLD;
    if (over !== armed.current) {
      armed.current = over;
      if (over) haptic();
    }
    setDx(next);
  };

  const onTouchEnd = () => {
    if (dx >= THRESHOLD) right?.onAction();
    else if (dx <= -THRESHOLD) left?.onAction();
    start.current = null;
    armed.current = false;
    setDx(0);
  };

  const action = dx > 0 ? right : dx < 0 ? left : undefined;
  const Icon = action?.icon;

  return (
    <li className={cn('relative overflow-hidden', className)}>
      {action && Icon && (
        <div
          className={cn(
            'absolute inset-0 flex items-center px-5 text-sm font-medium',
            TONE[action.tone],
            dx > 0 ? 'justify-start' : 'justify-end',
            Math.abs(dx) < THRESHOLD && 'opacity-60',
          )}
          aria-hidden
        >
          <span className="flex items-center gap-2">
            <Icon className="size-4" />
            {action.label}
          </span>
        </div>
      )}
      <div
        className={cn('relative bg-surface touch-pan-y', dx === 0 && 'transition-transform duration-200')}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </li>
  );
}
