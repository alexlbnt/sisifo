import { describe, expect, it } from 'vitest';
import { createFinanceMock } from '@/features/finance/mock';
import { createPersonalMock } from '@/features/personal/mock';
import { toRecords } from '@/features/sync/collections';
import { COLLECTION_SCHEMAS } from './sync';
import { taskSchema } from './schemas';

const task = { id: 't', title: 'Dentista', area: 'routine', status: 'todo', date: '2026-10-12', createdAt: '2026-10-11T10:00:00Z' };

describe('schemas da sincronização', () => {
  it('aceita horário HH:MM e recusa horário inválido', () => {
    expect(taskSchema.safeParse({ ...task, time: '14:00' }).success).toBe(true);
    expect(taskSchema.safeParse({ ...task, time: '09:30' }).success).toBe(true);
    expect(taskSchema.safeParse({ ...task, time: '25:00' }).success).toBe(false);
    expect(taskSchema.safeParse({ ...task, time: '9h' }).success).toBe(false);
  });

  // O servidor valida cada registro que chega; um item recusado trava o lote inteiro.
  it('todos os registros dos dados de exemplo passam na validação do servidor', () => {
    const records = toRecords(createFinanceMock(), createPersonalMock());
    const invalid = [...records.values()]
      .map((r) => ({ key: `${r.collection}|${r.id}`, result: COLLECTION_SCHEMAS[r.collection].safeParse(r.data) }))
      .filter((r) => !r.result.success)
      .map((r) => `${r.key}: ${r.result.error?.issues[0]?.path.join('.')} ${r.result.error?.issues[0]?.message}`);
    expect(invalid).toEqual([]);
  });
});
