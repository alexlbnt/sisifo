import { dateInMonth, lastMonths, monthKeyOf, type ISODate, type MonthKey } from '@/lib/dates';
import type {
  Budgets,
  CategoryId,
  MonthSummary,
  RecurringRule,
  Transaction,
  TransactionFilters,
} from './types';

export function signedCents(t: Transaction): number {
  return t.type === 'income' ? t.amountCents : -t.amountCents;
}

/** Saldo acumulado de todos os lançamentos até `upTo` (inclusive). */
export function balanceUpTo(transactions: Transaction[], upTo: ISODate): number {
  return transactions.reduce((sum, t) => (t.date <= upTo ? sum + signedCents(t) : sum), 0);
}

export function summarizeMonth(transactions: Transaction[], month: MonthKey): MonthSummary {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const t of transactions) {
    if (monthKeyOf(t.date) !== month) continue;
    if (t.type === 'income') incomeCents += t.amountCents;
    else expenseCents += t.amountCents;
  }
  const netCents = incomeCents - expenseCents;
  return {
    incomeCents,
    expenseCents,
    netCents,
    savingsRate: incomeCents > 0 ? netCents / incomeCents : null,
  };
}

export interface CategorySlice {
  category: CategoryId;
  cents: number;
  share: number;
}

/** Despesas do mês por categoria, em ordem decrescente de valor. */
export function expensesByCategory(transactions: Transaction[], month: MonthKey): CategorySlice[] {
  const totals = new Map<CategoryId, number>();
  for (const t of transactions) {
    if (t.type !== 'expense' || monthKeyOf(t.date) !== month) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amountCents);
  }
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .map(([category, cents]) => ({ category, cents, share: total ? cents / total : 0 }))
    .sort((a, b) => b.cents - a.cents);
}

export interface MonthlyPoint {
  month: MonthKey;
  incomeCents: number;
  expenseCents: number;
}

export function monthlyEvolution(
  transactions: Transaction[],
  endMonth: MonthKey,
  count: number,
): MonthlyPoint[] {
  return lastMonths(endMonth, count).map((month) => {
    const s = summarizeMonth(transactions, month);
    return { month, incomeCents: s.incomeCents, expenseCents: s.expenseCents };
  });
}

export interface BudgetStatus {
  category: CategoryId;
  limitCents: number;
  spentCents: number;
  ratio: number;
  level: 'ok' | 'warning' | 'over';
}

/**
 * Uso do limite de cada categoria com orçamento no mês. `order` define a ordem
 * de exibição (a das categorias); limites de categorias fora dela vêm no fim.
 */
export function budgetStatus(
  transactions: Transaction[],
  budgets: Budgets,
  month: MonthKey,
  order: readonly CategoryId[] = [],
): BudgetStatus[] {
  const spent = new Map(expensesByCategory(transactions, month).map((s) => [s.category, s.cents]));
  const ids = [...new Set([...order, ...Object.keys(budgets)])];
  return ids.flatMap((category) => {
    const limitCents = budgets[category];
    if (!limitCents) return [];
    const spentCents = spent.get(category) ?? 0;
    const ratio = spentCents / limitCents;
    const level = ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warning' : 'ok';
    return [{ category, limitCents, spentCents, ratio, level }];
  });
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const search = filters.search.trim().toLocaleLowerCase('pt-BR');
  return transactions
    .filter(
      (t) =>
        (filters.month === 'all' || monthKeyOf(t.date) === filters.month) &&
        (filters.category === 'all' || t.category === filters.category) &&
        (filters.type === 'all' || t.type === filters.type) &&
        (!search || t.title.toLocaleLowerCase('pt-BR').includes(search)),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** Meses que têm lançamentos, do mais recente ao mais antigo. */
export function availableMonths(transactions: Transaction[]): MonthKey[] {
  return [...new Set(transactions.map((t) => monthKeyOf(t.date)))].sort().reverse();
}

/** Id determinístico: dois aparelhos gerando o mesmo mês criam o mesmo registro. */
export function recurringTransactionId(ruleId: string, month: MonthKey): string {
  return `rec-${ruleId}-${month}`;
}

/**
 * Mês de competência de um lançamento gerado por regra. Vem do id, então
 * continua certo mesmo se a pessoa mudou a data do lançamento.
 */
export function recurringMonthOf(t: Transaction): MonthKey | null {
  if (!t.recurringId) return null;
  const prefix = `rec-${t.recurringId}-`;
  return t.id.startsWith(prefix) ? t.id.slice(prefix.length) : monthKeyOf(t.date);
}

/**
 * Gera os lançamentos das regras recorrentes que ainda não existem,
 * do mês de início da regra até `today`. Idempotente: rodar duas vezes
 * no mesmo dia não duplica nada. Meses em `skippedMonths` (lançamento
 * excluído pela pessoa) não são gerados de novo.
 */
export function materializeRecurring(
  rules: RecurringRule[],
  transactions: Transaction[],
  today: ISODate,
): Transaction[] {
  const existing = new Set<string>();
  for (const t of transactions) {
    const month = recurringMonthOf(t);
    if (month) existing.add(`${t.recurringId}|${month}`);
  }
  const created: Transaction[] = [];
  const nowStamp = new Date().toISOString();

  for (const rule of rules) {
    if (!rule.active) continue;
    const skipped = new Set(rule.skippedMonths);
    let month = monthKeyOf(rule.startDate);
    const lastMonth = monthKeyOf(today);
    while (month <= lastMonth) {
      const date = dateInMonth(month, rule.dayOfMonth);
      const key = `${rule.id}|${month}`;
      if (date >= rule.startDate && date <= today && !existing.has(key) && !skipped.has(month)) {
        created.push({
          id: recurringTransactionId(rule.id, month),
          title: rule.title,
          amountCents: rule.amountCents,
          type: rule.type,
          category: rule.category,
          date,
          recurringId: rule.id,
          createdAt: nowStamp,
        });
        existing.add(key);
      }
      month = nextMonth(month);
    }
  }
  return created;
}

/**
 * Lançamentos gerados para meses que a pessoa excluiu. Acontece quando outro
 * aparelho, ainda sem saber da exclusão, gerou o mês de novo: assim que a regra
 * atualizada chega, o lançamento é removido outra vez.
 */
export function skippedRecurringIds(rules: RecurringRule[], transactions: Transaction[]): string[] {
  const skipped = new Map(rules.map((r) => [r.id, new Set(r.skippedMonths)]));
  return transactions
    .filter((t) => {
      const month = recurringMonthOf(t);
      return month !== null && skipped.get(t.recurringId!)?.has(month) === true;
    })
    .map((t) => t.id);
}

function nextMonth(key: MonthKey): MonthKey {
  const [y, m] = key.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}
