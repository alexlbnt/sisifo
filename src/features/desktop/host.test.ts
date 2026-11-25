import { beforeEach, describe, expect, it } from 'vitest';
import { captureContext } from '@/features/capture/apply';
import { parseCapture } from '@/features/capture/parse';
import { useFinanceStore } from '@/features/finance/store';
import { usePersonalStore } from '@/features/personal/store';
import type { Task } from '@/features/personal/types';
import { useAuthStore } from '@/features/sync/authStore';
import { formatBRL } from '@/lib/money';
import { createHostHandlers } from './host';

let today = '2026-11-24';
const handlers = () => createHostHandlers({ today: () => today });

const task = (id: string, date: string): Task => ({
  id,
  title: id,
  area: 'routine',
  status: 'todo',
  date,
  createdAt: '2026-11-01T00:00:00Z',
});

beforeEach(() => {
  today = '2026-11-24';
  useFinanceStore.setState({ transactions: [] });
  usePersonalStore.setState({ tasks: [], habits: [] });
});

describe('host do desktop', () => {
  it('capture.preview devolve o mesmo que o parser', async () => {
    const reply = await handlers().handle({ type: 'capture.preview', text: 'mercado 152,30' });
    expect(reply).toEqual(parseCapture('mercado 152,30', captureContext(today)));
  });

  it('capture.submit grava e confirma', async () => {
    const reply = await handlers().handle({ type: 'capture.submit', text: 'café 8,50' });
    const txs = useFinanceStore.getState().transactions;
    expect(txs).toHaveLength(1);
    expect(reply).toEqual({ ok: true, message: `Despesa "${txs[0]!.title}" de ${formatBRL(850)} adicionada.` });
  });

  it('o mesmo envio repetido (Enter duplo, nova tentativa) grava uma vez só', async () => {
    const h = handlers();
    const first = await h.handle({ type: 'capture.submit', text: 'café 8,50', submitId: 's1' });
    const again = await h.handle({ type: 'capture.submit', text: 'café 8,50', submitId: 's1' });
    expect(again).toEqual(first);
    expect(useFinanceStore.getState().transactions).toHaveLength(1);
    await h.handle({ type: 'capture.submit', text: 'café 8,50', submitId: 's2' });
    expect(useFinanceStore.getState().transactions).toHaveLength(2);
  });

  it('peso forçado numa frase sem pesagem não grava e explica', async () => {
    const reply = await handlers().handle({ type: 'capture.submit', text: 'café 8,50', force: 'weight' });
    expect(reply).toEqual({ ok: false, message: 'Escreva o peso assim: "peso 68,4".' });
    expect(useFinanceStore.getState().transactions).toHaveLength(0);
  });

  it('pesagem que não fecha ("peso 70 amanhã") explica como escrever', async () => {
    const reply = await handlers().handle({ type: 'capture.submit', text: 'peso 70 amanhã' });
    expect(reply).toEqual({ ok: false, message: 'Escreva o peso assim: "peso 68,4".' });
  });

  it('texto vazio não grava nada', async () => {
    for (const text of ['', '   ']) {
      expect(await handlers().handle({ type: 'capture.submit', text })).toEqual({ ok: false, message: 'Nada para registrar.' });
    }
    expect(useFinanceStore.getState().transactions).toHaveLength(0);
    expect(usePersonalStore.getState().tasks).toHaveLength(0);
  });

  it('lançamento forçado sem valor pede o valor e não grava', async () => {
    const reply = await handlers().handle({ type: 'capture.submit', text: 'mercado', force: 'transaction' });
    expect(reply).toEqual({ ok: false, message: 'Inclua um valor na frase, ex.: "mercado 25,00".' });
    expect(useFinanceStore.getState().transactions).toHaveLength(0);
    expect(usePersonalStore.getState().tasks).toHaveLength(0);
  });

  it('summary conta o que falta hoje e acompanha a virada do dia', () => {
    usePersonalStore.setState({ tasks: [task('a', '2026-11-24'), task('b', '2026-11-25'), task('c', '2026-11-25')] });
    const h = handlers();
    expect(h.summary()).toEqual({ pending: 1, day: '2026-11-24' });
    today = '2026-11-25';
    expect(h.summary()).toEqual({ pending: 2, day: '2026-11-25' });
  });

  it('grava mesmo com o app na tela de login (os dados são locais)', async () => {
    useAuthStore.setState({ phase: 'locked' });
    const reply = (await handlers().handle({ type: 'capture.submit', text: 'café 8,50' })) as { ok: boolean };
    expect(reply.ok).toBe(true);
    expect(useFinanceStore.getState().transactions).toHaveLength(1);
  });
});
