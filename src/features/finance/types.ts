import type { ISODate, MonthKey } from '@/lib/dates';

export type TransactionType = 'income' | 'expense';

/** Id de uma categoria. As de fábrica têm ids fixos (`salary`, `food`...); as criadas, um uid. */
export type CategoryId = string;

export interface Category {
  id: CategoryId;
  label: string;
  /** Em quais tipos de lançamento a categoria aparece no formulário. */
  types: TransactionType[];
  /** Chave de `ICONS` (components/ui/icons). */
  icon: string;
  /** Posição na paleta do gráfico (0 a 7). */
  color: number;
  /** Arquivada: some dos formulários, mas continua nos lançamentos antigos. */
  archived: boolean;
}

export type CategoryInput = Omit<Category, 'id' | 'archived'>;

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
  /** Meses cujo lançamento gerado foi excluído: não são gerados de novo. */
  skippedMonths?: MonthKey[];
}

export type RecurringRuleInput = Omit<RecurringRule, 'id'>;

/** Limite mensal de gasto por categoria, em centavos. */
export type Budgets = Partial<Record<CategoryId, number>>;

export interface FinanceState {
  transactions: Transaction[];
  recurring: RecurringRule[];
  categories: Category[];
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
