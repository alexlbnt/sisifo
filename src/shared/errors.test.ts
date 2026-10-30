import { describe, expect, it } from 'vitest';
import { cleanReport, deviceLabel, fingerprintOf, scrubMessage, scrubRoute, scrubStack } from './errors';

describe('limpeza: nada de dados pessoais', () => {
  it('tira valores, datas, ids e e-mails da mensagem', () => {
    const msg = scrubMessage('Falha ao salvar R$ 1.234,56 em 2026-10-30 (id 4f9a12345) de alex@exemplo.com');
    expect(msg).not.toMatch(/1\.234|2026|12345|alex|exemplo/);
    expect(msg).toContain('R$ #');
    expect(msg).toContain('[e-mail]');
  });

  it('tira textos longos entre aspas (título de tarefa, nota), mas mantém nomes de propriedade', () => {
    const msg = scrubMessage(`Tarefa "Ligar para o banco sobre o empréstimo" inválida; reading 'title'`);
    expect(msg).not.toContain('banco');
    expect(msg).toContain("reading 'title'");
  });

  it('corta mensagens enormes', () => {
    expect(scrubMessage('x'.repeat(3000))).toHaveLength(500);
  });

  it('pilha fica só com as linhas de código, sem query string', () => {
    const stack = scrubStack(
      'TypeError: Café 8,50\n    at save (https://sisifo.app/assets/store-abc.js?v=1:10:20)\n    lixo sem linha\n    at https://sisifo.app/assets/index.js:5:1',
    );
    expect(stack).toBe('at save (https://sisifo.app/assets/store-abc.js:10:20)\nat https://sisifo.app/assets/index.js:5:1');
  });

  it('rota sem query string (pode ter texto digitado)', () => {
    expect(scrubRoute('/finance/transactions?busca=salário#x')).toBe('/finance/transactions');
  });

  it('relatório completo sai limpo', () => {
    const report = cleanReport({ kind: 'window', message: 'Valor 98765 inválido', route: '/?captura=1', device: 'iOS 18 · Safari' });
    expect(report).toEqual({ kind: 'window', message: 'Valor # inválido', stack: undefined, route: '/', appVersion: undefined, device: 'iOS 18 · Safari' });
  });
});

describe('agrupamento e aparelho', () => {
  it('o mesmo erro em linhas de build diferentes tem a mesma impressão digital', () => {
    const a = fingerprintOf({ kind: 'window', message: 'x is undefined', stack: 'at f (app.js:10:5)' });
    const b = fingerprintOf({ kind: 'window', message: 'x is undefined', stack: 'at f (app.js:12:9)' });
    const c = fingerprintOf({ kind: 'sync', message: 'x is undefined', stack: 'at f (app.js:10:5)' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('resume o user agent', () => {
    const iphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
    expect(deviceLabel(iphone, true)).toBe('iOS 18 · Safari · instalado');
    const windows =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
    expect(deviceLabel(windows)).toBe('Windows · Edge');
  });
});
