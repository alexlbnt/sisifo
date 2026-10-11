import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import {
  CalendarCheck,
  ClipboardCheck,
  Dumbbell,
  Flame,
  Landmark,
  LayoutGrid,
  ListTodo,
  type LucideIcon,
  Plus,
  Settings,
  Target,
  Wallet,
  Zap,
} from 'lucide-react';
import { Modal } from '@/components/ui';
import { QuickExpense } from '@/features/capture/QuickExpense';
import { useCaptureStore } from '@/features/capture/QuickCapture';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';
import { MOBILE_NAV, type NavItem } from './nav';

/** Telas que ficam no "Mais" do celular. */
const MORE: NavItem[] = [
  { to: '/personal/habits', label: 'Hábitos', icon: Flame },
  { to: '/personal/goals', label: 'Metas', icon: Target },
  { to: '/personal/training', label: 'Treino', icon: Dumbbell },
  { to: '/review', label: 'Revisão semanal', icon: ClipboardCheck },
  { to: '/finance/transactions', label: 'Lançamentos', icon: CalendarCheck },
  { to: '/finance/accounts', label: 'Contas', icon: Landmark },
  { to: '/settings', label: 'Configurações', icon: Settings },
];

function Tab({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-accent' : 'text-ink-3')
      }
    >
      <Icon className="size-5" aria-hidden />
      {item.label}
    </NavLink>
  );
}

function SheetOption({ icon: Icon, title, text, onClick }: { icon: LucideIcon; title: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-line px-4 py-3 text-left active:bg-surface-2"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="text-xs text-ink-3">{text}</span>
      </span>
    </button>
  );
}

/**
 * Barra inferior do celular: quatro telas, o botão + no centro (ao alcance do
 * polegar) e "Mais" para o resto. No iPhone os atalhos do ícone não existem,
 * então o acesso rápido mora aqui.
 */
export function BottomNav() {
  const [sheet, setSheet] = useState<'actions' | 'more' | 'expense' | null>(null);
  const openCapture = useCaptureStore((s) => s.setOpen);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [first, second, third] = MOBILE_NAV;
  const moreActive = MORE.some((m) => pathname.startsWith(m.to));

  const go = (to: string) => {
    setSheet(null);
    navigate(to);
  };

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-end border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {first && <Tab item={first} />}
        {second && <Tab item={second} />}
        <div className="flex justify-center">
          <button
            type="button"
            aria-label="Adicionar"
            onClick={() => {
              haptic();
              setSheet('actions');
            }}
            className="-mt-5 mb-1 grid size-14 place-items-center rounded-full bg-accent text-accent-ink shadow-lg ring-4 ring-bg active:scale-95"
          >
            <Plus className="size-6" aria-hidden />
          </button>
        </div>
        {third && <Tab item={third} />}
        <button
          type="button"
          onClick={() => setSheet('more')}
          className={cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', moreActive ? 'text-accent' : 'text-ink-3')}
        >
          <LayoutGrid className="size-5" aria-hidden />
          Mais
        </button>
      </nav>

      <Modal open={sheet === 'actions'} onClose={() => setSheet(null)} title="Adicionar">
        <div className="flex flex-col gap-2">
          <SheetOption icon={Wallet} title="Gasto rápido" text="Valor, categoria e pronto" onClick={() => setSheet('expense')} />
          <SheetOption
            icon={Zap}
            title="Escrever ou ditar"
            text={'"café 8,50", "dentista amanhã às 9h"'}
            onClick={() => {
              setSheet(null);
              openCapture(true);
            }}
          />
          <SheetOption icon={ListTodo} title="Nova tarefa" text="Com dia, horário e repetição" onClick={() => go('/personal/tasks?nova=1')} />
        </div>
      </Modal>

      <Modal open={sheet === 'more'} onClose={() => setSheet(null)} title="Mais">
        <nav aria-label="Outras telas" className="grid grid-cols-3 gap-2">
          {MORE.map(({ to, label, icon: Icon }) => (
            <button
              key={to}
              type="button"
              onClick={() => go(to)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium active:bg-surface-2',
                pathname.startsWith(to) ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2',
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </button>
          ))}
        </nav>
      </Modal>

      <QuickExpense open={sheet === 'expense'} onClose={() => setSheet(null)} />
    </>
  );
}
