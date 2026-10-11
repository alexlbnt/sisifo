import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { todayISO } from '@/lib/dates';
import { uid } from '@/lib/id';
import { persistInitialState } from '@/lib/persistNow';
import { defaultCategories } from './defaultCategories';
import { createFinanceMock } from './mock';
import { materializeRecurring, recurringMonthOf, skippedRecurringIds } from './selectors';
import type {
  Budgets,
  Category,
  CategoryId,
  CategoryInput,
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

  addCategory: (input: CategoryInput) => void;
  updateCategory: (id: CategoryId, input: CategoryInput) => void;
  setCategoryArchived: (id: CategoryId, archived: boolean) => void;
  /** Só exclui categoria sem uso (lançamentos, recorrências ou limite). Devolve se excluiu. */
  deleteCategory: (id: CategoryId) => boolean;

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

      // Excluir um lançamento gerado por regra marca o mês como pulado; sem isso,
      // a regra o criaria de novo na próxima abertura do app.
      deleteTransaction: (id) =>
        set((s) => {
          const target = s.transactions.find((t) => t.id === id);
          const month = target ? recurringMonthOf(target) : null;
          return {
            transactions: s.transactions.filter((t) => t.id !== id),
            recurring:
              month === null
                ? s.recurring
                : s.recurring.map((r) =>
                    r.id === target!.recurringId && !r.skippedMonths?.includes(month)
                      ? { ...r, skippedMonths: [...(r.skippedMonths ?? []), month].sort() }
                      : r,
                  ),
          };
        }),

      addRecurring: (input) => {
        set((s) => ({ recurring: [...s.recurring, { ...input, id: uid() }] }));
        get().syncRecurring();
      },

      updateRecurring: (id, input) => {
        // Mantém os meses pulados, que o formulário não conhece.
        set((s) => ({
          recurring: s.recurring.map((r) =>
            r.id === id ? { ...input, skippedMonths: input.skippedMonths ?? r.skippedMonths, id } : r,
          ),
        }));
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
        const stale = new Set(skippedRecurringIds(recurring, transactions));
        const kept = stale.size ? transactions.filter((t) => !stale.has(t.id)) : transactions;
        const created = materializeRecurring(recurring, kept, todayISO());
        if (created.length || stale.size) set({ transactions: [...kept, ...created] });
      },

      setBudget: (category, cents) =>
        set((s) => {
          const budgets = { ...s.budgets };
          if (cents && cents > 0) budgets[category] = cents;
          else delete budgets[category];
          return { budgets };
        }),

      setBudgets: (budgets) => set({ budgets }),

      addCategory: (input) =>
        set((s) => ({ categories: [...s.categories, { ...input, id: uid(), archived: false }] })),

      updateCategory: (id, input) =>
        set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, ...input } : c)) })),

      setCategoryArchived: (id, archived) =>
        set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, archived } : c)) })),

      deleteCategory: (id) => {
        const s = get();
        const inUse =
          s.transactions.some((t) => t.category === id) ||
          s.recurring.some((r) => r.category === id) ||
          s.budgets[id] !== undefined;
        if (inUse) return false;
        set({ categories: s.categories.filter((c) => c.id !== id) });
        return true;
      },

      replaceAll: (state) => set(withDefaults(state)),
    }),
    {
      name: FINANCE_STORAGE_KEY,
      version: 2,
      partialize: ({ transactions, recurring, categories, budgets }): FinanceState => ({
        transactions,
        recurring,
        categories,
        budgets,
      }),
      // Ponto único para evoluir o formato salvo sem perder dados.
      // v2: categorias editáveis (antes eram fixas no código).
      migrate: (persisted) => withDefaults(persisted as FinanceState),
    },
  ),
);

persistInitialState(useFinanceStore, FINANCE_STORAGE_KEY);

/** Sem nenhuma categoria (dados antigos ou "começar do zero"), volta a lista de fábrica. */
export function withDefaults<T extends Partial<FinanceState>>(state: T): T & { categories: Category[] } {
  return { ...state, categories: state.categories?.length ? state.categories : defaultCategories() };
}
