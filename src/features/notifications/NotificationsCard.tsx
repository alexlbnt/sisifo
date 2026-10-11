import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Send } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { isStandalone } from '@/features/pwa/installStore';
import { useAuthStore } from '@/features/sync/authStore';
import { DEFAULT_NOTIFY_PREFS, type NotifyPrefs } from '@/shared/digest';
import { disablePush, enablePush, pushStatus, pushSupported, savePushPrefs, testPush } from './pushClient';

const OPTIONS: Array<{ key: keyof NotifyPrefs; label: string; hint: string }> = [
  { key: 'morning', label: 'Resumo da manhã', hint: '8h: tarefas, hábitos e compromissos do dia' },
  { key: 'bills', label: 'Contas a vencer', hint: '8h: contas e faturas que vencem hoje ou amanhã' },
  { key: 'evening', label: 'Hábitos pendentes', hint: '20h: o que ainda falta marcar no dia' },
  { key: 'review', label: 'Revisão semanal', hint: 'Domingo, 20h, se a revisão ainda não foi feita' },
];

type State =
  | { phase: 'loading' }
  | { phase: 'unavailable'; reason: string }
  | { phase: 'off'; publicKey: string }
  | { phase: 'on'; publicKey: string; prefs: NotifyPrefs };

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function NotificationsCard() {
  const synced = useAuthStore((s) => s.phase === 'ready');
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'good' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    if (!synced) return setState({ phase: 'unavailable', reason: 'As notificações usam o servidor: entre com a sua senha para ativar.' });
    if (!pushSupported()) return setState({ phase: 'unavailable', reason: 'Este navegador não suporta notificações push.' });
    if (isIOS() && !isStandalone()) {
      return setState({ phase: 'unavailable', reason: 'No iPhone, instale o Sísifo na tela de início e abra por lá para ativar.' });
    }
    let alive = true;
    pushStatus()
      .then((s) => {
        if (!alive) return;
        if (!s.configured || !s.publicKey) {
          setState({ phase: 'unavailable', reason: 'O servidor ainda não tem as chaves de notificação (VAPID). Veja o README.' });
        } else if (s.subscribed) {
          setState({ phase: 'on', publicKey: s.publicKey, prefs: { ...DEFAULT_NOTIFY_PREFS, ...s.prefs } });
        } else {
          setState({ phase: 'off', publicKey: s.publicKey });
        }
      })
      .catch((e: Error) => alive && setState({ phase: 'unavailable', reason: e.message }));
    return () => {
      alive = false;
    };
  }, [synced]);

  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (success) setMessage({ tone: 'good', text: success });
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'Algo deu errado.' });
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key: keyof NotifyPrefs) => {
    if (state.phase !== 'on') return;
    const prefs = { ...state.prefs, [key]: !state.prefs[key] };
    setState({ ...state, prefs });
    void run(() => savePushPrefs(prefs));
  };

  return (
    <Card title="Notificações" description="Lembretes no celular ou no computador, mesmo com o app fechado">
      {state.phase === 'loading' && <p className="text-sm text-ink-3">Verificando…</p>}
      {state.phase === 'unavailable' && (
        <p className="flex items-start gap-2 text-sm text-ink-3">
          <BellOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.reason}
        </p>
      )}
      {state.phase === 'off' && (
        <Button
          icon={Bell}
          disabled={busy}
          onClick={() =>
            run(async () => {
              await enablePush(state.publicKey, DEFAULT_NOTIFY_PREFS);
              setState({ phase: 'on', publicKey: state.publicKey, prefs: DEFAULT_NOTIFY_PREFS });
            }, 'Notificações ativadas neste aparelho.')
          }
        >
          Ativar neste aparelho
        </Button>
      )}
      {state.phase === 'on' && (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {OPTIONS.map((o) => (
              <li key={o.key}>
                <label className="flex items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={state.prefs[o.key]}
                    onChange={() => toggle(o.key)}
                    disabled={busy}
                    className="mt-0.5 size-4 accent-[var(--accent)]"
                  />
                  <span>
                    {o.label}
                    <span className="block text-xs text-ink-3">{o.hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={Send} disabled={busy} onClick={() => run(testPush, 'Notificação de teste enviada.')}>
              Enviar teste
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={BellOff}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await disablePush();
                  setState({ phase: 'off', publicKey: state.publicKey });
                }, 'Notificações desativadas neste aparelho.')
              }
            >
              Desativar
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-ink-3">
            <BellRing className="size-3.5" aria-hidden />
            Horários de Brasília. Cada aparelho ativa as suas.
          </p>
        </div>
      )}
      {message && (
        <p role="status" className={`mt-3 text-sm ${message.tone === 'good' ? 'text-income' : 'text-expense'}`}>
          {message.text}
        </p>
      )}
    </Card>
  );
}
