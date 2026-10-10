import { Suspense } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { Settings } from 'lucide-react';
import { InstallBanner } from '@/features/pwa/InstallBanner';
import { UpdateToast } from '@/features/pwa/UpdateToast';
import { FirstLinkDialog } from '@/features/sync/FirstLinkDialog';
import { SyncStatusIcon, SyncStatusLine } from '@/features/sync/SyncIndicator';
import { cn } from '@/lib/cn';
import { Logo } from './Logo';
import { MOBILE_NAV, NAV_GROUPS, SETTINGS_ITEM, type NavItem } from './nav';
import { ThemeCycleButton, ThemeSelector } from './ThemeToggle';

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        )
      }
    >
      <Icon className="size-4" aria-hidden />
      {item.label}
    </NavLink>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
      <Link to="/" className="mb-7 px-2">
        <Logo />
      </Link>
      <nav className="flex flex-1 flex-col gap-5" aria-label="Principal">
        {NAV_GROUPS.map((group, i) => (
          <div key={group.label ?? i} className="flex flex-col gap-0.5">
            {group.label && (
              <p className="mb-1 px-3 text-xs font-medium text-ink-3">{group.label}</p>
            )}
            {group.items.map((item) => (
              <SidebarLink key={item.to} item={item} />
            ))}
          </div>
        ))}
      </nav>
      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <SyncStatusLine />
        <SidebarLink item={SETTINGS_ITEM} />
        <ThemeSelector iconOnly className="w-full" />
      </div>
    </aside>
  );
}

function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between border-b border-line bg-surface/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
      <Link to="/">
        <Logo />
      </Link>
      <div className="flex items-center">
        <SyncStatusIcon />
        <ThemeCycleButton />
        <Link
          to="/settings"
          aria-label="Configurações"
          className="inline-flex size-10 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <Settings className="size-4" aria-hidden />
        </Link>
      </div>
    </header>
  );
}

function BottomNav() {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {MOBILE_NAV.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                isActive ? 'text-accent' : 'text-ink-3',
              )
            }
          >
            <Icon className="size-5" aria-hidden />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function AppLayout() {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
          <Suspense
            fallback={<div className="h-40 animate-pulse rounded-2xl bg-surface-2" aria-label="Carregando" />}
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNav />
      <InstallBanner />
      <UpdateToast />
      <FirstLinkDialog />
    </div>
  );
}
