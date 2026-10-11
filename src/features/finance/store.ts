import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addMonthsISO, todayISO } from '@/lib/dates';
import { uid } from '@/lib/id';
import { persistInitialState } from '@/lib/persistNow';
import { defaultAccounts, splitInstallments } from './accounts';
import { defaultCategories } from './defaultCategories';
import { createFinanceMock } from './mock';
import { materializeRecurring, recurringMonthOf, skippedRecurringIds } from './selectors';
import type {
  Account,
  AccountInput,
  Budgets,
  Category,
  CategoryId,
  CategoryInput,
  FinanceState,
  RecurringRuleInput,
  Transaction,
  TransactionInput,
} from './types';

interface FinanceActions {
  /** Com `installments` ≥ 2, cria uma parcela por mês a partir da data (o valor é o total da compra). */
  addTransaction: (input: TransactionInput, options?: { installments?: number }) => void;
  /** Exclui todas as parcelas de uma compra parcelada. */
  deleteInstallmentGroup: (groupId: string) => void;
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

  addAccount: (input: AccountInput) => void;
  updateAccount: (id: string, input: AccountInput) => void;
  setAccountArchived: (id: string, archived: boolean) => void;
  /** Só exclui conta sem lançamentos, recorrências ou metas ligadas. Devolve se excluiu. */
  deleteAccount: (id: string, usedByGoals?: boolean) => boolean;

  replaceAll: (state: FinanceState) => void;
}

export type FinanceStore = FinanceState & FinanceActions;

export const FINANCE_STORAGE_KEY = 'sisifo:finance';

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set, get) => ({
      ...createFinanceMock(),

      addTransaction: (input, options) =>
        set((s) => {
          const createdAt = new Date().toISOString();
          const count = Math.floor(options?.installments ?? 1);
          if (count < 2 || input.type === 'transfer') {
            return { transactions: [...s.transactions, { ...input, id: uid(), createdAt }] };
          }
          const groupId = uid();
          const parts: Transaction[] = splitInstallments(input.amountCents, count).map((amountCents, i) => ({
            ...input,
            id: `${groupId}-${i + 1}`,
            amountCents,
            date: addMonthsISO(input.date, i),
            installment: { groupId, index: i + 1, count },
            createdAt,
          }));
          return { transactions: [...s.transactions, ...parts] };
        }),

      deleteInstallmentGroup: (groupId) =>
        set((s) => ({ transactions: s.transactions.filter((t) => t.installment?.groupId !== groupId) })),

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

      addAccount: (input) =>
        set((s) => ({ accounts: [...s.accounts, { ...input, id: uid(), archived: false }] })),

      updateAccount: (id, input) =>
        set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...input } : a)) })),

      setAccountArchived: (id, archived) =>
        set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, archived } : a)) })),

      deleteAccount: (id, usedByGoals = false) => {
        const s = get();
        const uses = (x: { accountId?: string; toAccountId?: string }) =>
          (x.accountId ?? 'main') === id || x.toAccountId === id;
        if (usedByGoals || s.transactions.some(uses) || s.recurring.some(uses)) return false;
        set({ accounts: s.accounts.filter((a) => a.id !== id) });
        return true;
      },

      replaceAll: (state) => set(withDefaults(state)),
    }),
    {
      name: FINANCE_STORAGE_KEY,
      version: 3,
      partialize: ({ transactions, recurring, categories, accounts, budgets }): FinanceState => ({
        transactions,
        recurring,
        categories,
        accounts,
        budgets,
      }),
      // Ponto único para evoluir o formato salvo sem perder dados.
      // v2: categorias editáveis (antes eram fixas no código).
      // v3: contas e cartões; lançamentos antigos ficam na conta principal.
      migrate: (persisted) => withDefaults(persisted as FinanceState),
    },
  ),
);

persistInitialState(useFinanceStore, FINANCE_STORAGE_KEY);

/** Sem nenhuma categoria ou conta (dados antigos ou "começar do zero"), voltam as de fábrica. */
export function withDefaults<T extends Partial<FinanceState>>(
  state: T,
): T & { categories: Category[]; accounts: Account[] } {
  return {
    ...state,
    categories: state.categories?.length ? state.categories : defaultCategories(),
    accounts: state.accounts?.length ? state.accounts : defaultAccounts(),
  };
}
