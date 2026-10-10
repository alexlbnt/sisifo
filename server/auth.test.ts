import { beforeEach, describe, expect, it } from 'vitest';
import { createSessionToken, hashPassword, verifyPassword, verifySessionToken } from './auth';

beforeEach(() => {
  process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres!!';
  process.env.SISIFO_PASSWORD_HASH = 'scrypt:placeholder';
});

describe('senha', () => {
  it('confere a senha certa e recusa a errada', async () => {
    const stored = await hashPassword('minha senha forte');
    expect(stored).not.toContain('$');
    expect(await verifyPassword('minha senha forte', stored)).toBe(true);
    expect(await verifyPassword('minha senha fraca', stored)).toBe(false);
  });

  it('recusa hash em formato desconhecido', async () => {
    expect(await verifyPassword('x', 'md5:abc')).toBe(false);
  });
});

describe('sessão', () => {
  it('token válido passa', () => {
    expect(verifySessionToken(createSessionToken())).toBe(true);
  });

  it('token adulterado é recusado', () => {
    const [payload, signature] = createSessionToken().split('.');
    const forged = Buffer.from(JSON.stringify({ v: 1, exp: Date.now() + 1e12 })).toString('base64url');
    expect(verifySessionToken(`${forged}.${signature}`)).toBe(false);
    expect(verifySessionToken(`${payload}.assinatura-falsa`)).toBe(false);
  });

  it('token expirado é recusado', () => {
    const old = createSessionToken(Date.now() - 31 * 86_400_000);
    expect(verifySessionToken(old)).toBe(false);
  });

  it('trocar o SESSION_SECRET derruba as sessões', () => {
    const token = createSessionToken();
    process.env.SESSION_SECRET = 'outro-segredo-totalmente-diferente-1234567';
    expect(verifySessionToken(token)).toBe(false);
  });
});
