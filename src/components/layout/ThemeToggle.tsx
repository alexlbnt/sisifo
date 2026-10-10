import { Monitor, Moon, Sun } from 'lucide-react';
import { IconButton, SegmentedControl } from '@/components/ui';
import { useThemeStore, type ThemePreference } from '@/features/settings/themeStore';

const OPTIONS = [
  { value: 'light' as const, label: 'Claro', icon: Sun },
  { value: 'dark' as const, label: 'Escuro', icon: Moon },
  { value: 'system' as const, label: 'Sistema', icon: Monitor },
];

export function ThemeSelector({ className, iconOnly }: { className?: string; iconOnly?: boolean }) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return (
    <SegmentedControl<ThemePreference>
      label="Tema"
      value={theme}
      onChange={setTheme}
      options={OPTIONS}
      className={className}
      iconOnly={iconOnly}
    />
  );
}

/** Versão compacta para o cabeçalho do celular: alterna claro → escuro → sistema. */
export function ThemeCycleButton() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const index = OPTIONS.findIndex((o) => o.value === theme);
  const current = OPTIONS[index] ?? OPTIONS[2]!;
  const next = OPTIONS[(index + 1) % OPTIONS.length]!;
  return (
    <IconButton
      icon={current.icon}
      label={`Tema: ${current.label}. Mudar para ${next.label.toLowerCase()}`}
      onClick={() => setTheme(next.value)}
    />
  );
}
