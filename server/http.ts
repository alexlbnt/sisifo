import { SESSION_COOKIE, verifySessionToken } from './auth.js';

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  // Dados pessoais: nunca em cache de navegador, CDN ou service worker.
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function errorResponse(status: number, message: string): Response {
  return json({ error: message }, { status });
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

export function isAuthenticated(request: Request): boolean {
  return verifySessionToken(readCookie(request, SESSION_COOKIE));
}

/** Cookies `Secure` só fazem sentido em HTTPS (localhost em HTTP fica sem). */
export function isSecure(request: Request): boolean {
  const proto = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '');
  return proto === 'https';
}

/**
 * Defesa contra CSRF nas rotas que alteram dados: exige JSON e a mesma origem.
 * (O cookie já é SameSite=Strict; isto é a segunda camada.)
 */
export function checkMutation(request: Request): Response | null {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (origin && host && new URL(origin).host !== host) {
    return errorResponse(403, 'Origem não permitida.');
  }
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return errorResponse(415, 'Envie os dados como JSON.');
  }
  return null;
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'desconhecido'
  );
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
