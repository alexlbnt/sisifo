import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/* ───────── Senha (hash scrypt guardado em SISIFO_PASSWORD_HASH) ───────── */

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 32 };

/** Formato: scrypt:N:r:p:salt(base64url):hash(base64url) — sem "$", que o dotenv expandiria. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const { N, r, p, keylen } = SCRYPT;
  const hash = await scryptAsync(password, salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return ['scrypt', N, r, p, salt.toString('base64url'), hash.toString('base64url')].join(':');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, hashB64] = stored.split(':');
  if (algo !== 'scrypt' || !n || !r || !p || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64url'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/* ───────── Sessão (cookie assinado com SESSION_SECRET) ───────── */

export const SESSION_COOKIE = 'sisifo_session';
const SESSION_DAYS = 30;

export function isAuthConfigured(): boolean {
  return Boolean(process.env.SISIFO_PASSWORD_HASH && (process.env.SESSION_SECRET?.length ?? 0) >= 32);
}

function sign(payload: string): string {
  return createHmac('sha256', process.env.SESSION_SECRET!).update(payload).digest('base64url');
}

/** Token = payload.assinatura. Trocar SESSION_SECRET derruba todas as sessões. */
export function createSessionToken(now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ v: 1, exp: now + SESSION_DAYS * 86_400_000 }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token || !isAuthConfigured()) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp: number };
    return typeof exp === 'number' && exp > now;
  } catch {
    return false;
  }
}

export function sessionCookie(token: string, secure: boolean): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_DAYS * 86_400}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export function clearSessionCookie(secure: boolean): string {
  return [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0', secure ? 'Secure' : '']
    .filter(Boolean)
    .join('; ');
}
