import type { ISODate, MonthKey } from '@/lib/dates';

/** Entrada ou saída de dinheiro: o que as categorias classificam. */
export type CashType = 'income' | 'expense';

/** Transferência move dinheiro entre contas: não é receita nem despesa. */
export type TransactionType = CashType | 'transfer';

/** Id de uma categoria. As de fábrica têm ids fixos (`salary`, `food`...); as criadas, um uid. */
export type CategoryId = string;

export interface Category {
  id: CategoryId;
  label: string;
  /** Em quais tipos de lançamento a categoria aparece no formulário. */
  types: CashType[];
  /** Chave de `ICONS` (components/ui/icons). */
  icon: string;
  /** Posição na paleta do gráfico (0 a 7). */
  color: number;
  /** Arquivada: some dos formulários, mas continua nos lançamentos antigos. */
  archived: boolean;
}

export type CategoryInput = Omit<Category, 'id' | 'archived'>;

/* ───────── Contas ───────── */

export type AccountKind = 'checking' | 'savings' | 'investment' | 'cash' | 'credit';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  /** Saldo antes do primeiro lançamento, em centavos (pode ser negativo). */
  initialBalanceCents: number;
  /** Cartão de crédito: dia em que a fatura fecha (1–31). */
  closingDay?: number;
  /** Cartão de crédito: dia em que a fatura vence (1–31). */
  dueDay?: number;
  /** Cartão de crédito: limite, em centavos. */
  limitCents?: number;
  archived: boolean;
}

export type AccountInput = Omit<Account, 'id' | 'archived'>;

/* ───────── Lançamentos ───────── */

export interface Installment {
  /** Mesmo valor em todas as parcelas da compra. */
  groupId: string;
  /** 1, 2, ... `count`. */
  index: number;
  count: number;
}

export interface Transaction {
  id: string;
  title: string;
  /** Sempre positivo, em centavos. O sinal vem de `type`. */
  amountCents: number;
  type: TransactionType;
  /** Em transferências, a categoria fixa `transfer`. */
  category: CategoryId;
  date: ISODate;
  /** Conta de origem (ou única). Sem valor: a conta principal. */
  accountId?: string;
  /** Transferência: conta de destino. */
  toAccountId?: string;
  /** Compra parcelada: qual parcela é esta. */
  installment?: Installment;
  /** Preenchido quando o lançamento foi gerado por uma regra recorrente. */
  recurringId?: string;
  createdAt: string;
}

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'recurringId' | 'installment'>;

export interface RecurringRule {
  id: string;
  title: string;
  amountCents: number;
  type: TransactionType;
  category: CategoryId;
  accountId?: string;
  toAccountId?: string;
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
  accounts: Account[];
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
  /** Id da conta ou 'all'. */
  account: string;
  search: string;
}
