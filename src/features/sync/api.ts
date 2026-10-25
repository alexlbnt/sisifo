import type { AgendaResponse } from '@/shared/agenda';
import type { SessionStatus, SyncRequest, SyncResponse } from '@/shared/sync';

/** Falha de rede (offline, servidor fora) ou resposta que não é da nossa API. */
export class NetworkError extends Error {}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 10_000;

async function request<T>(path: string, init: RequestInit = {}, timeout = TIMEOUT_MS): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw new NetworkError('Sem conexão com o servidor.');
  }

  // Sem API (ex.: preview estático), o servidor devolve o index.html.
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new NetworkError('A API do Sísifo não respondeu.');
  }
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new HttpError(response.status, body.error ?? 'Erro no servidor.');
  return body;
}

export const api = {
  session: () => request<SessionStatus>('/api/session', {}, 4000),
  login: (password: string) =>
    request<SessionStatus>('/api/session', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request<SessionStatus>('/api/session', { method: 'DELETE' }),
  sync: (payload: SyncRequest) =>
    request<SyncResponse>('/api/sync', { method: 'POST', body: JSON.stringify(payload) }),
  agenda: (date: string, timeZone: string, days = 1) =>
    request<AgendaResponse>(`/api/agenda?date=${date}&days=${days}&tz=${encodeURIComponent(timeZone)}`),
};
