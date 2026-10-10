import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { todayISO } from '@/lib/dates';
import { uid } from '@/lib/id';
import { persistInitialState } from '@/lib/persistNow';
import { createFinanceMock } from './mock';
import { materializeRecurring } from './selectors';
import type {
  Budgets,
  CategoryId,
  FinanceState,
  RecurringRuleInput,
  TransactionInput,
} from './types';

interface FinanceActions {
  addTransaction: (input: TransactionInput) => void;
  updateTransaction: (id: string, input: TransactionInput) => void;
  deleteTransaction: (id: string) => void;

  addRecurring: (input: RecurringRuleInput) => void;
  updateRecurring: (id: string, input: RecurringRuleInput) => void;
  deleteRecurring: (id: string) => void;
  /** Cria os lançamentos recorrentes pendentes até hoje. */
  syncRecurring: () => void;

  setBudget: (category: CategoryId, cents: number | null) => void;
  setBudgets: (budgets: Budgets) => void;

  replaceAll: (state: FinanceState) => void;
}

export type FinanceStore = FinanceState & FinanceActions;

export const FINANCE_STORAGE_KEY = 'sisifo:finance';

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set, get) => ({
      ...createFinanceMock(),

      addTransaction: (input) =>
        set((s) => ({
          transactions: [
            ...s.transactions,
            { ...input, id: uid(), createdAt: new Date().toISOString() },
          ],
        })),

      updateTransaction: (id, input) =>
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...input } : t)),
        })),

      deleteTransaction: (id) =>
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

      addRecurring: (input) => {
        set((s) => ({ recurring: [...s.recurring, { ...input, id: uid() }] }));
        get().syncRecurring();
      },

      updateRecurring: (id, input) => {
        set((s) => ({ recurring: s.recurring.map((r) => (r.id === id ? { ...input, id } : r)) }));
        get().syncRecurring();
      },

      // Os lançamentos já gerados ficam no histórico; só param de ser criados.
      deleteRecurring: (id) =>
        set((s) => ({
          recurring: s.recurring.filter((r) => r.id !== id),
          transactions: s.transactions.map((t) =>
            t.recurringId === id ? { ...t, recurringId: undefined } : t,
          ),
        })),

      syncRecurring: () => {
        const { recurring, transactions } = get();
        const created = materializeRecurring(recurring, transactions, todayISO());
        if (created.length) set({ transactions: [...transactions, ...created] });
      },

      setBudget: (category, cents) =>
        set((s) => {
          const budgets = { ...s.budgets };
          if (cents && cents > 0) budgets[category] = cents;
          else delete budgets[category];
          return { budgets };
        }),

      setBudgets: (budgets) => set({ budgets }),

      replaceAll: (state) => set(state),
    }),
    {
      name: FINANCE_STORAGE_KEY,
      version: 1,
      partialize: ({ transactions, recurring, budgets }): FinanceState => ({
        transactions,
        recurring,
        budgets,
      }),
      // Ponto único para evoluir o formato salvo sem perder dados.
      migrate: (persisted) => persisted as FinanceState,
    },
  ),
);

persistInitialState(useFinanceStore, FINANCE_STORAGE_KEY);
