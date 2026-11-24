import { beforeEach, describe, expect, it } from 'vitest';
import { useFinanceStore } from '@/features/finance/store';
import { usePersonalStore } from '@/features/personal/store';
import { formatBRL } from '@/lib/money';
import { applyCapture, captureContext } from './apply';
import { parseCapture } from './parse';

const TODAY = '2026-11-24';

beforeEach(() => {
  useFinanceStore.setState({ transactions: [] });
  usePersonalStore.setState({ tasks: [] });
});

describe('applyCapture', () => {
  it('despesa: grava o lançamento e devolve a confirmação', () => {
    const guess = parseCapture('café 8,50', captureContext(TODAY))!;
    expect(guess.kind).toBe('transaction');
    const message = applyCapture(guess, { today: TODAY });

    const [t] = useFinanceStore.getState().transactions;
    expect(t).toMatchObject({ amountCents: 850, type: 'expense', date: TODAY });
    expect(message).toBe(`Despesa "${t!.title}" de ${formatBRL(850)} adicionada.`);
  });

  it('tarefa para amanhã: grava e diz "para amanhã."', () => {
    const guess = parseCapture('ligar pro banco amanhã às 14h', captureContext(TODAY))!;
    expect(guess.kind).toBe('task');
    const message = applyCapture(guess, { today: TODAY });

    const [task] = usePersonalStore.getState().tasks;
    expect(task).toMatchObject({ date: '2026-11-25', time: '14:00' });
    expect(message).toBe(`Tarefa "${task!.title}" adicionada para amanhã.`);
  });

  it('a categoria escolhida substitui a adivinhada', () => {
    const guess = parseCapture('café 8,50', captureContext(TODAY))!;
    applyCapture(guess, { today: TODAY, category: 'transport' });
    expect(useFinanceStore.getState().transactions[0]!.category).toBe('transport');
  });
});
