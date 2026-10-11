import { beforeEach, describe, expect, it } from 'vitest';
import { currentMonthKey } from '@/lib/dates';
import { defaultCategories } from './defaultCategories';
import { recurringTransactionId } from './selectors';
import { useFinanceStore } from './store';

const month = currentMonthKey();
const genId = recurringTransactionId('r1', month);

describe('excluir lançamento gerado por recorrência', () => {
  beforeEach(() => {
    useFinanceStore.setState({
      transactions: [],
      categories: defaultCategories(),
      budgets: {},
      recurring: [
        {
          id: 'r1',
          title: 'Aluguel',
          amountCents: 100000,
          type: 'expense',
          category: 'housing',
          dayOfMonth: 1,
          startDate: `${month}-01`,
          active: true,
        },
      ],
    });
    useFinanceStore.getState().syncRecurring();
  });

  it('não volta na próxima abertura do app', () => {
    expect(useFinanceStore.getState().transactions.map((t) => t.id)).toEqual([genId]);

    useFinanceStore.getState().deleteTransaction(genId);
    useFinanceStore.getState().syncRecurring(); // o que o App faz ao abrir

    const state = useFinanceStore.getState();
    expect(state.transactions).toHaveLength(0);
    expect(state.recurring[0]?.skippedMonths).toEqual([month]);
  });

  it('editar a regra mantém os meses pulados', () => {
    useFinanceStore.getState().deleteTransaction(genId);
    const { skippedMonths: _, id: __, ...input } = useFinanceStore.getState().recurring[0]!;
    useFinanceStore.getState().updateRecurring('r1', { ...input, amountCents: 120000 });
    expect(useFinanceStore.getState().recurring[0]?.skippedMonths).toEqual([month]);
    expect(useFinanceStore.getState().transactions).toHaveLength(0);
  });

  it('remove o mês recriado por outro aparelho quando a regra atualizada chega', () => {
    const generated = useFinanceStore.getState().transactions;
    useFinanceStore.setState((s) => ({
      recurring: s.recurring.map((r) => ({ ...r, skippedMonths: [month] })),
      transactions: generated,
    }));
    useFinanceStore.getState().syncRecurring();
    expect(useFinanceStore.getState().transactions).toHaveLength(0);
  });
});
