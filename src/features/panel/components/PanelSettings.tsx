import { useState, type ReactNode } from 'react';
import { BellRing, Download, ExternalLink, LocateFixed, Maximize, Minus, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { promptInstall, useInstallStore } from '@/features/pwa/installStore';
import { playAlarm, unlockAudio } from '../alarm';
import { usePanelStore, type PanelThemeMode } from '../panelStore';

/* ───────── Controles grandes (mínimo 48px de toque) ───────── */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const btn = 'grid size-12 place-items-center rounded-xl border border-line bg-surface-2 disabled:opacity-40';
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 text-base">{label}</span>
      <button type="button" className={btn} aria-label={`Diminuir ${label}`} disabled={value <= min} onClick={() => onChange(clamp(value - step))}>
        <Minus className="size-5" aria-hidden />
      </button>
      <span className="w-[5ch] text-center text-lg font-semibold tabular">
        {value}
        {unit && <span className="text-sm font-normal text-ink-3"> {unit}</span>}
      </span>
      <button type="button" className={btn} aria-label={`Aumentar ${label}`} disabled={value >= max} onClick={() => onChange(clamp(value + step))}>
        <Plus className="size-5" aria-hidden />
      </button>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-12 items-center gap-3 text-left">
      <span className="flex-1">
        <span className="block text-base">{label}</span>
        {hint && <span className="block text-sm text-ink-3">{hint}</span>}
      </span>
      <span className={cn('relative h-8 w-14 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line')}>
        <span className={cn('absolute top-1 left-1 size-6 rounded-full bg-surface transition-transform', checked && 'translate-x-6')} />
      </span>
    </button>
  );
}

function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn('min-h-12 flex-1 rounded-lg px-2 text-base font-medium', o.value === value ? 'bg-surface text-ink shadow-sm' : 'text-ink-3')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-sm text-ink-3">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-12 rounded-xl border border-line bg-surface-2 px-3 text-lg text-ink tabular"
      />
    </label>
  );
}

const actionBtn = 'flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-base font-medium';

/* ───────── Ajustes ───────── */

function WeatherSettings() {
  const coords = usePanelStore((s) => s.settings.weather);
  const { updateSettings, setWeather } = usePanelStore.getState();
  const [status, setStatus] = useState<string | null>(null);

  const locate = () => {
    if (!('geolocation' in navigator)) return setStatus('Este aparelho não informa a localização.');
    setStatus('Buscando localização…');
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        // Duas casas (~1 km): basta para o clima e não guarda o endereço exato.
        updateSettings({ weather: { lat: Math.round(c.latitude * 100) / 100, lon: Math.round(c.longitude * 100) / 100 } });
        setWeather(null);
        setStatus(null);
      },
      () => setStatus('Não foi possível obter a localização. Verifique a permissão.'),
      { timeout: 15_000, maximumAge: 24 * 60 * 60 * 1000 },
    );
  };

  return (
    <Section title="Clima">
      <p className="text-sm text-ink-3">
        {coords ? `Local: ${coords.lat}, ${coords.lon} (Open-Meteo, a cada 30 min).` : 'Desligado. Use a localização do aparelho para mostrar o clima no relógio.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={actionBtn} onClick={locate}>
          <LocateFixed className="size-5" aria-hidden /> Usar a localização daqui
        </button>
        {coords && (
          <button
            type="button"
            className={actionBtn}
            onClick={() => {
              updateSettings({ weather: null });
              setWeather(null);
            }}
          >
            Desligar clima
          </button>
        )}
      </div>
      {status && <p className="text-sm text-ink-2">{status}</p>}
    </Section>
  );
}

export function PanelSettings({ onClose }: { onClose: () => void }) {
  const settings = usePanelStore((s) => s.settings);
  const { updateSettings, updatePomodoro, clearFocusLog } = usePanelStore.getState();
  const deferredPrompt = useInstallStore((s) => s.deferredPrompt);
  const p = settings.pomodoro;
  const canFullscreen = document.fullscreenEnabled && !matchMedia('(display-mode: fullscreen)').matches;

  return (
    <div className="panel-fade absolute inset-0 z-30 flex flex-col bg-bg" role="dialog" aria-label="Ajustes do painel">
      <header className="flex items-center gap-3 border-b border-line px-3 py-2">
        <h2 className="flex-1 text-2xl font-semibold">Ajustes do painel</h2>
        <button type="button" onClick={onClose} aria-label="Fechar ajustes" className="grid size-12 place-items-center rounded-xl text-ink-2">
          <X className="size-7" aria-hidden />
        </button>
      </header>

      <div className="scroll-y flex-1 p-3">
        <div className="mx-auto grid max-w-5xl gap-3 landscape:grid-cols-2">
          <Section title="Pomodoro">
            <Stepper label="Foco" unit="min" value={p.focusMin} min={1} max={120} onChange={(v) => updatePomodoro({ focusMin: v })} />
            <Stepper label="Pausa curta" unit="min" value={p.shortMin} min={1} max={60} onChange={(v) => updatePomodoro({ shortMin: v })} />
            <Stepper label="Pausa longa" unit="min" value={p.longMin} min={1} max={90} onChange={(v) => updatePomodoro({ longMin: v })} />
            <Stepper label="Pausa longa a cada" unit="focos" value={p.longEvery} min={1} max={12} onChange={(v) => updatePomodoro({ longEvery: v })} />
            <Toggle label="Começar a próxima etapa sozinho" checked={p.autoStart} onChange={(v) => updatePomodoro({ autoStart: v })} />
          </Section>

          <Section title="Alerta">
            <Toggle label="Som" checked={settings.sound} onChange={(v) => updateSettings({ sound: v })} />
            <Toggle label="Vibração" hint="Quando o aparelho permite" checked={settings.vibrate} onChange={(v) => updateSettings({ vibrate: v })} />
            <button
              type="button"
              className={actionBtn}
              onClick={() => {
                unlockAudio();
                playAlarm('focus', settings);
              }}
            >
              <BellRing className="size-5" aria-hidden /> Testar alerta
            </button>
          </Section>

          <Section title="Telas">
            <Toggle
              label="Trocar de aba sozinho"
              hint="Com o Pomodoro rodando, o painel fica nele"
              checked={settings.rotate}
              onChange={(v) => updateSettings({ rotate: v })}
            />
            {settings.rotate && (
              <Stepper label="A cada" unit="s" value={settings.rotateSec} min={5} max={300} step={5} onChange={(v) => updateSettings({ rotateSec: v })} />
            )}
            <Stepper
              label="Relógio após sem toque"
              unit={settings.idleMin ? 'min' : ''}
              value={settings.idleMin}
              min={0}
              max={60}
              onChange={(v) => updateSettings({ idleMin: v })}
            />
            <p className="-mt-2 text-sm text-ink-3">0 desliga. Não entra com o Pomodoro ativo.</p>
          </Section>

          <Section title="Tema">
            <Choice<PanelThemeMode>
              label="Tema"
              value={settings.theme}
              onChange={(v) => updateSettings({ theme: v })}
              options={[
                { value: 'auto', label: 'Automático' },
                { value: 'light', label: 'Claro' },
                { value: 'dark', label: 'Escuro' },
              ]}
            />
            {settings.theme === 'auto' && (
              <div className="flex gap-3">
                <TimeField label="Escuro a partir de" value={settings.darkFrom} onChange={(v) => updateSettings({ darkFrom: v })} />
                <TimeField label="Claro a partir de" value={settings.darkTo} onChange={(v) => updateSettings({ darkTo: v })} />
              </div>
            )}
          </Section>

          <WeatherSettings />

          <Section title="Aparelho">
            {deferredPrompt && (
              <button type="button" className={actionBtn} onClick={() => promptInstall()}>
                <Download className="size-5" aria-hidden /> Instalar o painel
              </button>
            )}
            {canFullscreen && (
              <button type="button" className={actionBtn} onClick={() => void document.documentElement.requestFullscreen().catch(() => {})}>
                <Maximize className="size-5" aria-hidden /> Tela cheia
              </button>
            )}
            <button type="button" className={actionBtn} onClick={clearFocusLog}>
              <Trash2 className="size-5" aria-hidden /> Zerar tempo de foco das tarefas
            </button>
            <a href="/" className={actionBtn}>
              <ExternalLink className="size-5" aria-hidden /> Abrir o Sísifo completo
            </a>
          </Section>
        </div>
      </div>
    </div>
  );
}
