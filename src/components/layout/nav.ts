import {
  CalendarCheck,
  Dumbbell,
  Flame,
  ListTodo,
  type LucideIcon,
  Mountain,
  Settings,
  Target,
  Wallet,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { items: [{ to: '/', label: 'Hoje', icon: Mountain, end: true }] },
  {
    label: 'Finanças',
    items: [
      { to: '/finance', label: 'Visão geral', icon: Wallet, end: true },
      { to: '/finance/transactions', label: 'Lançamentos', icon: CalendarCheck },
    ],
  },
  {
    label: 'Pessoal',
    items: [
      { to: '/personal/tasks', label: 'Tarefas', icon: ListTodo },
      { to: '/personal/goals', label: 'Metas', icon: Target },
      { to: '/personal/habits', label: 'Hábitos', icon: Flame },
      { to: '/personal/training', label: 'Treino', icon: Dumbbell },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { to: '/settings', label: 'Configurações', icon: Settings };

/** Barra inferior do celular: as 5 telas de uso diário. */
export const MOBILE_NAV: NavItem[] = [
  { to: '/', label: 'Hoje', icon: Mountain, end: true },
  { to: '/finance', label: 'Finanças', icon: Wallet },
  { to: '/personal/tasks', label: 'Tarefas', icon: ListTodo },
  { to: '/personal/habits', label: 'Hábitos', icon: Flame },
  { to: '/personal/training', label: 'Treino', icon: Dumbbell },
];
