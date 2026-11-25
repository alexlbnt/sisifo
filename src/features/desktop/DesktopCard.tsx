import { useEffect, useState } from 'react';
import { Keyboard } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { native, type DesktopSettings } from './native';
import { formatShortcut, isSafeShortcut, shortcutFromEvent } from './shortcuts';

/** Configurações → Desktop (só aparece dentro do executável). */
export function DesktopCard() {
  const [settings, setSettings] = useState<DesktopSettings | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void native.getDesktopSettings().then(setSettings).catch(() => setError('Não deu para ler as configurações do desktop.'));
  }, []);

  const IN_USE = 'Esse atalho já está em uso por outro programa.';

  const save = async (next: DesktopSettings) => {
    try {
      const result = await native.setDesktopSettings(next);
      if (result.ok) setError(null);
      else setError(result.error === 'shortcut-in-use' ? IN_USE : 'Esse atalho não é válido. Tente outra combinação.');
      // Relê o estado real (atalho ativo, início com o Windows mudado pela bandeja...).
      setSettings(await native.getDesktopSettings());
    } catch {
      setError('Não deu para salvar as configurações do desktop.');
    }
  };

  // Gravando: a próxima combinação de teclas vira o atalho.
  useEffect(() => {
    if (!recording || !settings) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        setRecording(false);
        return;
      }
      const shortcut = shortcutFromEvent(e);
      if (!shortcut) return;
      setRecording(false);
      const safe = isSafeShortcut(shortcut);
      if (!safe.ok) return setError(safe.reason);
      void save({ ...settings, captureShortcut: shortcut });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording, settings]);

  return (
    <Card title="Desktop" description="Atalhos e início do Sísifo neste computador">
      {settings ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Captura rápida</p>
              <p className="text-sm text-ink-2">
                {recording ? 'Pressione o novo atalho… (Esc cancela)' : (
                  <kbd className="rounded border border-line px-1.5 py-0.5 text-xs">{formatShortcut(settings.captureShortcut)}</kbd>
                )}
              </p>
            </div>
            <Button
              variant="secondary"
              icon={Keyboard}
              onClick={() => {
                setError(null);
                setRecording((r) => !r);
              }}
            >
              {recording ? 'Cancelar' : 'Trocar'}
            </Button>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={settings.autostart}
              onChange={(e) => void save({ ...settings, autostart: e.target.checked })}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />
            <span>
              Iniciar com o Windows
              <span className="block text-xs text-ink-3">Abre escondido na bandeja, perto do relógio.</span>
            </span>
          </label>
        </div>
      ) : null}
      {settings && !settings.shortcutActive && !error && (
        <p className="mt-3 text-sm text-expense">
          {IN_USE} Escolha outro em "Trocar", ou feche o programa e clique em "Trocar" e aperte o mesmo atalho.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-expense">{error}</p>}
    </Card>
  );
}
