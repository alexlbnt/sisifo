import type { ISODate } from '@/lib/dates';
import { CATEGORY_IDS } from '@/shared/schemas';

export { CATEGORY_IDS };

export type TransactionType = 'income' | 'expense';

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  /** Em quais tipos de lançamento a categoria aparece no formulário. */
  types: readonly TransactionType[];
}

export interface Transaction {
  id: string;
  title: string;
  /** Sempre positivo, em centavos. O sinal vem de `type`. */
  amountCents: number;
  type: TransactionType;
  category: CategoryId;
  date: ISODate;
  /** Preenchido quando o lançamento foi gerado por uma regra recorrente. */
  recurringId?: string;
  createdAt: string;
}

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'recurringId'>;

export interface RecurringRule {
  id: string;
  title: string;
  amountCents: number;
  type: TransactionType;
  category: CategoryId;
  /** Dia do mês (1–31). Em meses mais curtos, cai no último dia. */
  dayOfMonth: number;
  /** Primeiro dia em que a regra vale. */
  startDate: ISODate;
  active: boolean;
}

export type RecurringRuleInput = Omit<RecurringRule, 'id'>;

/** Limite mensal de gasto por categoria, em centavos. */
export type Budgets = Partial<Record<CategoryId, number>>;

export interface FinanceState {
  transactions: Transaction[];
  recurring: RecurringRule[];
  budgets: Budgets;
}

export interface MonthSummary {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  /** Fração de 0 a 1, ou null quando não houve receita no mês. */
  savingsRate: number | null;
}

export interface TransactionFilters {
  /** YYYY-MM ou 'all' */
  month: string;
  category: CategoryId | 'all';
  type: TransactionType | 'all';
  search: string;
}
