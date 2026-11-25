import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CircleCheck, ListTodo, Wallet, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';
import { relativeDay, todayISO } from '@/lib/dates';
import { uid } from '@/lib/id';
import { formatBRL } from '@/lib/money';
import type { CaptureGuess } from '@/shared/capture';
import type { TaskPriority } from '@/features/personal/types';
import { BridgeTimeout, createBridgeClient, WINDOW_FOCUSED, type Transport } from './bridge';
import { native } from './native';
import { tauriTransport } from './tauriTransport';

/**
 * Barra de captura do executável (Ctrl+Alt+Espaço). Janela leve: só manda o
 * texto para a janela principal, que interpreta e grava.
 */

const PREVIEW_DEBOUNCE_MS = 150;
const SAVED_MS = 900;
const RETRY_MS = 1000;
const RETRIES = 10;

type Client = ReturnType<typeof createBridgeClient>;
type Status = { tone: 'good' | 'bad' | 'wait'; text: string } | null;

const PRIORITY: Record<TaskPriority, string> = { high: 'Prioridade alta', medium: 'Prioridade média', low: 'Prioridade baixa' };

/** Tenta de novo enquanto a janela principal ainda está abrindo. */
async function withRetry<T>(run: () => Promise<T>, onWait: () => void): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (e) {
      if (!(e instanceof BridgeTimeout) || attempt >= RETRIES) throw e;
      onWait();
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  }
}

export function CaptureBar() {
  const input = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState<{ client: Client; transport: Transport } | null>(null);
  const [text, setText] = useState('');
  const [force, setForce] = useState<CaptureGuess['kind'] | undefined>();
  const [guess, setGuess] = useState<CaptureGuess | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const waiting = () => setStatus({ tone: 'wait', text: 'Sísifo ainda está abrindo…' });

  useEffect(() => {
    let client: Client | undefined;
    void tauriTransport().then((transport) => {
      client = createBridgeClient(transport);
      setLink({ client, transport });
    });
    return () => client?.dispose();
  }, []);

  // Ao aparecer: texto selecionado (para sobrescrever) e a principal sincroniza.
  useEffect(() => {
    if (!link) return;
    const onFocus = () => {
      input.current?.focus();
      input.current?.select();
      void link.transport.send(WINDOW_FOCUSED, null);
    };
    const onBlur = () => void native.hideCapture();
    onFocus();
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [link]);

  // Pré-visualização enquanto digita.
  useEffect(() => {
    if (!link || !text.trim()) {
      setGuess(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void withRetry(() => link.client.request({ type: 'capture.preview', text, force }), waiting)
        .then((g) => {
          if (cancelled) return;
          setGuess(g);
          setStatus((s) => (s?.tone === 'wait' ? null : s));
        })
        .catch(() => undefined);
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [link, text, force]);

  // Um envio por vez; o mesmo id em todas as tentativas (o host ignora repetições).
  const sending = useRef(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!link) return waiting();
    if (sending.current) return;
    sending.current = true;
    const submitId = uid();
    try {
      const reply = await withRetry(() => link.client.request({ type: 'capture.submit', text, force, submitId }), waiting);
      if (!reply.ok) {
        sending.current = false;
        return setStatus({ tone: 'bad', text: reply.message });
      }
      setStatus({ tone: 'good', text: reply.message });
      setTimeout(() => {
        setText('');
        setForce(undefined);
        setGuess(null);
        setStatus(null);
        sending.current = false;
        void native.hideCapture();
      }, SAVED_MS);
    } catch {
      sending.current = false;
      setStatus({ tone: 'bad', text: 'Não deu para falar com o Sísifo. Tente abrir a janela principal.' });
    }
  };

  const today = todayISO();
  const kind = force ?? guess?.kind;

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') void native.hideCapture();
      }}
      className="m-2 overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-2xl"
    >
      <div className="flex items-center gap-3 px-4">
        <Zap className="size-5 shrink-0 text-accent" aria-hidden />
        <input
          ref={input}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setStatus(null);
          }}
          placeholder="Ex.: mercado 152,30 · estudar grafos amanhã 19h"
          aria-label="O que você quer registrar"
          className="h-14 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-ink-3"
        />
      </div>

      {(guess || status) && (
        <div className="flex items-center gap-3 border-t border-line px-4 py-2.5 text-sm">
          {status ? (
            <p
              role="status"
              className={cn(
                'flex items-center gap-1.5',
                status.tone === 'good' && 'text-income',
                status.tone === 'bad' && 'text-expense',
                status.tone === 'wait' && 'text-ink-2',
              )}
            >
              {status.tone === 'good' && <CircleCheck className="size-4 shrink-0" aria-hidden />}
              {status.text}
            </p>
          ) : guess ? (
            <>
              <div className="flex rounded-lg bg-surface-2 p-0.5" role="group" aria-label="Tipo">
                {(
                  [
                    { value: 'transaction', label: 'Lançamento', icon: Wallet },
                    { value: 'task', label: 'Tarefa', icon: ListTodo },
                  ] as const
                ).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForce(value)}
                    aria-pressed={kind === value}
                    className={cn(
                      'flex items-center gap-1 rounded-md px-2 py-1 text-xs',
                      kind === value ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink',
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
              <p className="min-w-0 truncate text-ink-2">
                {force === 'transaction' && guess.kind === 'task' ? (
                  <span className="text-expense">Inclua um valor na frase, ex.: "{text.trim()} 25,00".</span>
                ) : guess.kind === 'transaction' ? (
                  <>
                    <b className="text-ink">{guess.title}</b> ·{' '}
                    <span className={guess.type === 'income' ? 'text-income' : undefined}>
                      {guess.type === 'income' ? 'Receita' : 'Despesa'} {formatBRL(guess.amountCents)}
                    </span>{' '}
                    · {relativeDay(guess.date, today)}
                  </>
                ) : (
                  <>
                    <b className="text-ink">{guess.title}</b> · {relativeDay(guess.date, today)}
                    {guess.time ? ` às ${guess.time}` : ''}
                    {guess.priority ? ` · ${PRIORITY[guess.priority]}` : ''}
                  </>
                )}
              </p>
              <span className="ml-auto shrink-0 text-xs text-ink-3">Enter salva · Esc fecha</span>
            </>
          ) : null}
        </div>
      )}
    </form>
  );
}
