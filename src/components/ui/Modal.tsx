import { useEffect, useId, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  /** false: escolha obrigatória (sem X, Esc ou clique fora para fechar). */
  dismissible?: boolean;
  /** false: não foca o primeiro campo ao abrir (evita abrir o teclado do celular). */
  focusFirstField?: boolean;
}

/** Distância (px) arrastando para baixo que fecha a janela no celular. */
const DISMISS_DRAG = 110;

/**
 * Altura ocupada pelo teclado do celular. O iPhone não encolhe a tela quando o
 * teclado abre; sem isto, o botão "Salvar" fica escondido atrás dele.
 */
function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);
  return inset;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  focusFirstField = true,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  const keyboard = useKeyboardInset(open);
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<number | null>(null);

  // Arrastar a alça (ou o título) para baixo fecha a janela, como nos apps do iPhone.
  const onTouchStart = (e: TouchEvent) => {
    if (!dismissible) return;
    dragStart.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (dragStart.current === null) return;
    setDrag(Math.max(0, (e.touches[0]?.clientY ?? 0) - dragStart.current));
  };
  const onTouchEnd = () => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    if (drag > DISMISS_DRAG) onCloseRef.current();
    setDrag(0);
  };

  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const firstField = focusFirstField ? panel?.querySelector<HTMLElement>('input, select, textarea') : null;
    (firstField ?? panel?.querySelector<HTMLElement>(FOCUSABLE))?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissibleRef.current) onCloseRef.current();
      if (e.key !== 'Tab' || !panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      style={keyboard ? { paddingBottom: keyboard } : undefined}
    >
      <div className="absolute inset-0 bg-black/45" onClick={dismissible ? onClose : undefined} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'sheet-in relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-xl sm:rounded-2xl',
          size === 'md' ? 'sm:max-w-md' : 'sm:max-w-2xl',
          drag === 0 && 'transition-transform duration-200',
        )}
        style={{
          ...(drag ? { transform: `translateY(${drag}px)` } : null),
          ...(keyboard ? { maxHeight: `calc(100dvh - ${keyboard}px - 0.5rem)` } : null),
        }}
      >
        {dismissible && (
          <div
            className="flex touch-none justify-center pt-2 sm:hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            aria-hidden
          >
            <span className="h-1 w-10 rounded-full bg-line" />
          </div>
        )}
        <header
          className="flex items-start justify-between gap-3 px-5 pt-3 pb-3 sm:pt-5"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
          </div>
          {dismissible && <IconButton icon={X} label="Fechar" size="sm" onClick={onClose} />}
        </header>
        <div className={cn('overflow-y-auto overscroll-contain px-5 pb-5', !footer && 'pb-[calc(1.25rem+env(safe-area-inset-bottom))]')}>
          {children}
        </div>
        {footer && (
          <footer
            className={cn(
              'flex justify-end gap-2 border-t border-line px-5 pt-3 sm:pb-3 [&>button:last-child]:flex-1 sm:[&>button:last-child]:flex-none',
              keyboard ? 'pb-3' : 'pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
            )}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
