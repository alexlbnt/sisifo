import { useId, useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { Button, Input, Ruins } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';
import { useAuthStore } from './authStore';

/** Faixa do meio da tela (texto e senha): as colunas quase somem ali. */
const behindForm = (_x: number, y: number) => (y > 0.3 && y < 0.78 ? 0.4 : 1);

export function LoginScreen() {
  const id = useId();
  const login = useAuthStore((s) => s.login);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Digite a senha.');
      return;
    }
    setBusy(true);
    const message = await login(password);
    setBusy(false);
    if (message) {
      setError(message);
      setPassword('');
    }
  };

  return (
    <main className="relative isolate grid min-h-dvh bg-bg lg:grid-cols-2">
      {/* Celular: ruínas atrás do formulário, mais apagadas na faixa do campo de senha. */}
      <Ruins kind="login" mask={behindForm} className="fixed inset-0 -z-10 h-dvh w-full lg:hidden" />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 pt-[max(env(safe-area-inset-top),2rem)] pb-[max(env(safe-area-inset-bottom),2rem)]">
        <Logo className="mb-10" />
        <h1 className="text-[28px] leading-tight font-semibold">Entre para continuar</h1>
        <p className="mt-1.5 text-sm text-ink-2">
          Seus dados ficam neste aparelho e são sincronizados com segurança entre os seus dispositivos.
        </p>

        <form onSubmit={submit} className="mt-8 flex flex-col gap-3" noValidate>
          <label htmlFor={`${id}-password`} className="text-[13px] font-medium text-ink-2">
            Senha
          </label>
          <div className="relative">
            <LockKeyhole
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
              aria-hidden
            />
            <Input
              id={`${id}-password`}
              type={visible ? 'text' : 'password'}
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : undefined}
              className="h-12 pr-11 pl-9"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Esconder senha' : 'Mostrar senha'}
              className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:text-ink"
            >
              {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
          {error && (
            <p id={`${id}-error`} role="alert" className="text-sm text-expense">
              {error}
            </p>
          )}
          <Button type="submit" className="mt-2 h-12 w-full" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </div>
      {/* Computador: formulário à esquerda, ruínas à direita, como na referência. */}
      <aside aria-hidden className="relative hidden border-l border-line lg:block">
        <Ruins kind="login" className="absolute inset-0 h-full w-full" />
      </aside>
    </main>
  );
}
