import { NavLink } from 'react-router';
import { cn } from '@/lib/cn';

interface SectionTabsProps {
  tabs: { to: string; label: string; end?: boolean }[];
}

/** Abas de navegação dentro de uma seção (ex.: Visão geral / Lançamentos). */
export function SectionTabs({ tabs }: SectionTabsProps) {
  return (
    <nav className="mb-5 flex gap-5 border-b border-line" aria-label="Seções">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              '-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors',
              isActive ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
