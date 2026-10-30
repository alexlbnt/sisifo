import { describe, expect, it } from 'vitest';
import type { SyncChange } from '@/shared/sync';
import type { LocalRecord } from './collections';
import { detectChanges, hashValue, selectRemoteToApply, stableStringify } from './diff';

const rec = (id: string, data: unknown): [string, LocalRecord] => [
  `tasks|${id}`,
  { collection: 'tasks', id, data },
];

describe('stableStringify / hashValue', () => {
  it('ignora a ordem das chaves (o jsonb do Postgres reordena)', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
    expect(hashValue({ x: 1, y: [1, 2] })).toBe(hashValue({ y: [1, 2], x: 1 }));
  });

  it('trata chave com undefined como ausente', () => {
    expect(hashValue({ a: 1, b: undefined })).toBe(hashValue({ a: 1 }));
  });

  it('muda quando o conteúdo muda', () => {
    expect(hashValue({ a: 1 })).not.toBe(hashValue({ a: 2 }));
  });
});

describe('detectChanges', () => {
  const now = '2026-10-09T12:00:00.000Z';

  it('aponta itens novos e alterados', () => {
    const first = detectChanges(new Map([rec('1', { t: 'a' })]), {}, now);
    expect(first.changes).toHaveLength(1);

    const second = detectChanges(new Map([rec('1', { t: 'a' }), rec('2', { t: 'b' })]), first.shadow, now);
    expect(second.changes.map((c) => c.id)).toEqual(['2']);

    const third = detectChanges(new Map([rec('1', { t: 'mudou' }), rec('2', { t: 'b' })]), second.shadow, now);
    expect(third.changes.map((c) => c.id)).toEqual(['1']);
  });

  it('item removido vira exclusão (data null)', () => {
    const { shadow } = detectChanges(new Map([rec('1', { t: 'a' })]), {}, now);
    const { changes } = detectChanges(new Map(), shadow, now);
    expect(changes).toEqual([{ collection: 'tasks', id: '1', data: null, updatedAt: now }]);
  });

  it('nada muda, nada sai', () => {
    const map = new Map([rec('1', { t: 'a' })]);
    const { shadow } = detectChanges(map, {}, now);
    expect(detectChanges(map, shadow, now).changes).toHaveLength(0);
  });
});

describe('detectChanges com escopo (só as coleções que mudaram)', () => {
  const now = '2026-10-30T12:00:00.000Z';
  const tx = (id: string, data: unknown): [string, LocalRecord] => [`transactions|${id}`, { collection: 'transactions', id, data }];
  const base = new Map([rec('1', { t: 'a' }), rec('2', { t: 'b' }), tx('9', { v: 1 })]);
  const { shadow } = detectChanges(base, {}, now);

  it('coleção fora do escopo não vira exclusão e o shadow dela passa adiante', () => {
    const onlyTx = new Map([tx('9', { v: 2 })]);
    const result = detectChanges(onlyTx, shadow, now, new Set(['transactions']));
    expect(result.changes).toEqual([{ collection: 'transactions', id: '9', data: { v: 2 }, updatedAt: now }]);
    expect(result.shadow['tasks|1']).toBe(shadow['tasks|1']);
    expect(result.shadow['tasks|2']).toBe(shadow['tasks|2']);
  });

  it('exclusão dentro do escopo continua sendo detectada', () => {
    const result = detectChanges(new Map([rec('1', { t: 'a' })]), shadow, now, new Set(['tasks']));
    expect(result.changes).toEqual([{ collection: 'tasks', id: '2', data: null, updatedAt: now }]);
    expect(result.shadow).not.toHaveProperty('tasks|2');
    expect(result.shadow['transactions|9']).toBe(shadow['transactions|9']);
  });

  it('a varredura completa encontra o que o escopo não viu', () => {
    // Uma tarefa mudou "por fora" (sem marcar a coleção como suja).
    const changed = new Map([rec('1', { t: 'mudou' }), rec('2', { t: 'b' }), tx('9', { v: 1 })]);
    expect(detectChanges(new Map([tx('9', { v: 1 })]), shadow, now, new Set(['transactions'])).changes).toHaveLength(0);
    expect(detectChanges(changed, shadow, now).changes.map((c) => c.id)).toEqual(['1']);
  });
});

describe('selectRemoteToApply', () => {
  const change = (id: string, data: unknown, updatedAt: string): SyncChange => ({
    collection: 'tasks',
    id,
    data,
    updatedAt,
  });

  it('alteração local mais nova vence a do servidor', () => {
    const remote = [change('1', { t: 'servidor' }, '2026-10-09T10:00:00.000Z')];
    const outbox = { 'tasks|1': change('1', { t: 'local' }, '2026-10-09T11:00:00.000Z') };
    expect(selectRemoteToApply(remote, {}, outbox)).toHaveLength(0);
  });

  it('alteração do servidor mais nova é aplicada', () => {
    const remote = [change('1', { t: 'servidor' }, '2026-10-09T12:00:00.000Z')];
    const outbox = { 'tasks|1': change('1', { t: 'local' }, '2026-10-09T11:00:00.000Z') };
    expect(selectRemoteToApply(remote, {}, outbox)).toHaveLength(1);
  });

  it('ignora o eco do que já temos igual', () => {
    const data = { t: 'igual' };
    const remote = [change('1', data, '2026-10-09T12:00:00.000Z')];
    expect(selectRemoteToApply(remote, { 'tasks|1': hashValue(data) }, {})).toHaveLength(0);
  });

  it('exclusão remota de item que existe localmente é aplicada', () => {
    const remote = [change('1', null, '2026-10-09T12:00:00.000Z')];
    expect(selectRemoteToApply(remote, { 'tasks|1': hashValue({ t: 'a' }) }, {})).toHaveLength(1);
  });
});
