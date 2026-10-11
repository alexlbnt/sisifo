import type { NotifyPrefs } from '@/shared/digest';

/** Respostas da API de push (mesmo formato de erro das outras rotas). */
interface PushStatus {
  configured: boolean;
  publicKey: string | null;
  subscribed: boolean;
  prefs: NotifyPrefs | null;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('A API do Sísifo não respondeu.');
  }
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Erro no servidor.');
  return body;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Chave pública VAPID (base64url) → bytes, como o pushManager espera. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** O service worker só existe no build de produção; no `npm run dev` ele nunca fica pronto. */
async function registration(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('O app ainda não está pronto para notificações. Recarregue a página e tente de novo.')), 8000),
  );
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function pushStatus(): Promise<PushStatus> {
  const sub = await currentSubscription();
  const query = sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : '';
  return call<PushStatus>(`/api/push${query}`);
}

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

/** Pede permissão, inscreve o aparelho e salva as preferências no servidor. */
export async function enablePush(publicKey: string, prefs: NotifyPrefs): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permissão negada. Libere as notificações do Sísifo nas configurações do navegador.');
  }
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  await call('/api/push', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON(), timeZone: timeZone(), prefs }) });
}

export async function savePushPrefs(prefs: NotifyPrefs): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) throw new Error('Este aparelho não está inscrito.');
  await call('/api/push', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON(), timeZone: timeZone(), prefs }) });
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await call('/api/push', { method: 'DELETE', body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
  await sub.unsubscribe();
}

export async function testPush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) throw new Error('Este aparelho não está inscrito.');
  await call('/api/push-test', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) });
}
