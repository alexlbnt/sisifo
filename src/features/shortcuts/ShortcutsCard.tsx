import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Check, Copy, KeyRound, Smartphone, Trash2 } from 'lucide-react';
import widgetScript from '../../../scripts/widget/sisifo-widget.js?raw';
import { Button, Card, ConfirmDialog, IconButton, Input } from '@/components/ui';
import { useAuthStore } from '@/features/sync/authStore';
import { fmt } from '@/lib/dates';

interface TokenRow {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('A API do Sísifo não respondeu.');
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Erro no servidor.');
  return body;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      icon={copied ? Check : Copy}
      label={copied ? 'Copiado' : `Copiar ${label}`}
      size="sm"
      className="border border-line"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    />
  );
}

/** Valor copiável numa linha: URL, cabeçalho, chave. */
function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-ink-3">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-surface-2 px-2 py-1.5 text-xs" title={secret ? undefined : value}>
          {value}
        </code>
        <CopyButton value={value} label={label.toLowerCase()} />
      </div>
    </div>
  );
}

/** Copia o script do widget com o endereço deste Sísifo já preenchido (a chave nunca vai junto). */
function CopyScriptButton({ origin }: { origin: string }) {
  const [copied, setCopied] = useState(false);
  const script = widgetScript.replace("const SISIFO_URL = '';", `const SISIFO_URL = '${origin}';`);
  return (
    <Button
      variant="secondary"
      icon={copied ? Check : Copy}
      onClick={() => {
        void navigator.clipboard?.writeText(script).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? 'Script copiado' : 'Copiar script'}
    </Button>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">{n}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

export function ShortcutsCard() {
  const synced = useAuthStore((s) => s.phase === 'ready');
  const [tokens, setTokens] = useState<TokenRow[] | null>(null);
  const [name, setName] = useState('iPhone');
  const [created, setCreated] = useState<string | null>(null);
  const [toRevoke, setToRevoke] = useState<TokenRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  const captureUrl = `${origin}/api/capture?format=text&tz=${encodeURIComponent(tz)}`;
  const summaryUrl = `${origin}/api/summary?format=text&tz=${encodeURIComponent(tz)}`;
  const keyText = created ?? 'sis_… (crie uma chave acima)';

  const load = useCallback(() => {
    call<{ tokens: TokenRow[] }>('/api/tokens')
      .then((r) => setTokens(r.tokens))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (synced) load();
  }, [synced, load]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await call<{ token: string }>('/api/tokens', { method: 'POST', body: JSON.stringify({ name: name.trim() || 'iPhone' }) });
      setCreated(r.token);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar a chave.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Atalhos do iPhone"
      description="Registre gastos e tarefas ou veja o resumo do dia sem abrir o app: com dois toques nas costas do celular, pela Siri ou num widget na tela inicial e de bloqueio."
    >
      {!synced ? (
        <p className="flex items-start gap-2 text-sm text-ink-3">
          <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden />
          Os Atalhos falam com o servidor: entre com a sua senha para configurar.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">1. Chave de acesso</h3>
            {created ? (
              <div className="flex flex-col gap-2 rounded-lg border border-warn/40 bg-warn-soft/50 p-3">
                <p className="text-xs text-warn">Copie agora: a chave não aparece de novo. Ela dá acesso para registrar e ler o resumo.</p>
                <CopyField label="Chave" value={created} secret />
              </div>
            ) : (
              <div className="flex gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome da chave" maxLength={40} className="max-w-48" />
                <Button icon={KeyRound} onClick={create} disabled={busy}>
                  Criar chave
                </Button>
              </div>
            )}
            {tokens && tokens.length > 0 && (
              <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
                {tokens.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <KeyRound className="size-4 shrink-0 text-ink-3" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{t.name}</span>
                      <span className="text-xs text-ink-3">
                        criada {fmt.short(t.createdAt.slice(0, 10))}
                        {t.lastUsedAt ? ` · usada ${fmt.short(t.lastUsedAt.slice(0, 10))}` : ' · nunca usada'}
                      </span>
                    </span>
                    <IconButton icon={Trash2} label={`Revogar ${t.name}`} size="sm" onClick={() => setToRevoke(t)} />
                  </li>
                ))}
              </ul>
            )}
            {error && (
              <p className="text-sm text-expense" role="alert">
                {error}
              </p>
            )}
          </section>

          <details className="group rounded-lg border border-line" open={Boolean(created)}>
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">2. Atalho "Registrar no Sísifo"</summary>
            <ol className="flex flex-col gap-3 px-3 pt-1 pb-3 text-sm text-ink-2">
              <Step n={1}>No app <b>Atalhos</b>, toque em <b>+</b> e dê o nome <b>Registrar no Sísifo</b>.</Step>
              <Step n={2}>
                Adicione <b>Pedir Entrada</b> (tipo Texto). Pergunta: <i>O que registrar?</i> No teclado, o microfone permite ditar.
              </Step>
              <Step n={3}>
                Adicione <b>Obter Conteúdo do URL</b> com este endereço:
                <div className="mt-2">
                  <CopyField label="URL" value={captureUrl} />
                </div>
              </Step>
              <Step n={4}>
                Toque na seta da ação para ver mais opções. <b>Método:</b> POST. Em <b>Cabeçalhos</b>, adicione:
                <div className="mt-2 flex flex-col gap-2">
                  <CopyField label="Chave do cabeçalho" value="Authorization" />
                  <CopyField label="Valor do cabeçalho" value={`Bearer ${keyText}`} secret />
                </div>
              </Step>
              <Step n={5}>
                Em <b>Corpo da Solicitação</b>, escolha <b>JSON</b>, adicione um campo <b>Texto</b> com a chave <code>text</code> e, como
                valor, a variável <b>Entrada Fornecida</b>.
              </Step>
              <Step n={6}>
                Adicione <b>Mostrar Notificação</b> com o <b>Conteúdo do URL</b>. A resposta confirma o que foi registrado, ex.:{' '}
                <i>Despesa registrada: Café, R$ 8,50 (Alimentação)</i>.
              </Step>
            </ol>
          </details>

          <details className="rounded-lg border border-line">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">3. Atalho "Resumo do Sísifo" (opcional)</summary>
            <ol className="flex flex-col gap-3 px-3 pt-1 pb-3 text-sm text-ink-2">
              <Step n={1}>Crie outro atalho chamado <b>Resumo do Sísifo</b>.</Step>
              <Step n={2}>
                Adicione <b>Obter Conteúdo do URL</b> com o endereço abaixo (método GET) e o mesmo cabeçalho <b>Authorization</b>:
                <div className="mt-2">
                  <CopyField label="URL" value={summaryUrl} />
                </div>
              </Step>
              <Step n={3}>
                Adicione <b>Mostrar Notificação</b> com o <b>Conteúdo do URL</b>: saldo disponível, quanto dá para gastar hoje, o que falta e
                o que vence.
              </Step>
            </ol>
          </details>

          <details className="rounded-lg border border-line">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">4. Widget do dia na tela inicial e de bloqueio (opcional)</summary>
            <ol className="flex flex-col gap-3 px-3 pt-1 pb-3 text-sm text-ink-2">
              <Step n={1}>
                Instale o app <b>Scriptable</b> (gratuito, na App Store). O widget do app Atalhos só executa atalhos; para ver os números
                sem tocar, é o Scriptable que desenha o widget.
              </Step>
              <Step n={2}>
                Copie o script. No Scriptable, toque em <b>+</b>, cole e dê o nome <b>Sísifo</b>. O endereço deste Sísifo já vai junto; a
                chave, não.
                <div className="mt-2">
                  <CopyScriptButton origin={origin} />
                </div>
              </Step>
              <Step n={3}>
                Toque em <b>▶︎</b> e cole a chave do passo 1: ela fica no Keychain do iPhone, nunca no script. Depois, <b>Ver médio</b> mostra
                como vai ficar.
              </Step>
              <Step n={4}>
                <b>Tela inicial:</b> segure um espaço vazio → <b>+</b> → <b>Scriptable</b> → escolha o tamanho → <b>Adicionar</b>. Segure o
                widget → <b>Editar widget</b> → <b>Script: Sísifo</b>.
              </Step>
              <Step n={5}>
                <b>Tela de bloqueio:</b> segure a tela bloqueada → <b>Personalizar</b> → <b>Tela Bloqueada</b> → toque na área dos widgets →{' '}
                <b>Scriptable</b> → escolha o formato → toque nele → <b>Script: Sísifo</b>.
              </Step>
            </ol>
            <p className="px-3 pb-3 text-xs text-ink-3">
              Mostra as tarefas e hábitos que faltam, quanto dá para gastar hoje e o próximo compromisso. Quem decide quando atualizar é o
              iOS (em geral, de 15 a 60 minutos). Sem internet, aparece a última leitura com ⚠︎ e a hora. Revogar a chave também desliga o
              widget.
            </p>
          </details>

          <details className="rounded-lg border border-line" open={Boolean(created)}>
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">5. Dois toques nas costas do iPhone</summary>
            <ol className="flex flex-col gap-3 px-3 pt-1 pb-3 text-sm text-ink-2">
              <Step n={1}>
                Abra <b>Ajustes → Acessibilidade → Toque → Tocar Atrás</b>.
              </Step>
              <Step n={2}>
                Em <b>Toque Duplo</b>, escolha o atalho <b>Registrar no Sísifo</b>.
              </Step>
              <Step n={3}>
                Se quiser, em <b>Toque Triplo</b>, escolha <b>Resumo do Sísifo</b>.
              </Step>
              <Step n={4}>
                Teste: dois toques nas costas, diga ou digite <i>mercado 152,30</i> e confirme. O lançamento aparece no app na próxima
                sincronização.
              </Step>
            </ol>
            <p className="px-3 pb-3 text-xs text-ink-3">
              Funciona do iPhone 8 em diante e precisa de internet. Os mesmos atalhos funcionam pela Siri ("E aí Siri, registrar no Sísifo") e
              como botões no widget do app Atalhos (ele executa o atalho e mostra a resposta numa notificação).
            </p>
          </details>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toRevoke)}
        title="Revogar chave?"
        message={`Os atalhos que usam "${toRevoke?.name}" param de funcionar na hora.`}
        confirmLabel="Revogar"
        onConfirm={() => {
          if (!toRevoke) return;
          void call('/api/tokens', { method: 'DELETE', body: JSON.stringify({ id: toRevoke.id }) }).then(load);
        }}
        onClose={() => setToRevoke(null)}
      />
    </Card>
  );
}
