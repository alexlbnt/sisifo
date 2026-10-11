import { addMonthsKey, dateInMonth, lastMonths, monthKeyOf, type ISODate, type MonthKey } from '@/lib/dates';
import { DEFAULT_ACCOUNT_ID } from '@/shared/schemas';
import type { Account, AccountKind, Transaction } from './types';

export { DEFAULT_ACCOUNT_ID };

export const ACCOUNT_KINDS: Record<AccountKind, { label: string; icon: string }> = {
  checking: { label: 'Conta corrente', icon: 'bank' },
  savings: { label: 'Poupança / reserva', icon: 'piggy' },
  investment: { label: 'Investimentos', icon: 'sparkles' },
  cash: { label: 'Dinheiro', icon: 'wallet' },
  credit: { label: 'Cartão de crédito', icon: 'receipt' },
};

export const ACCOUNT_KIND_ORDER: readonly AccountKind[] = ['checking', 'savings', 'investment', 'cash', 'credit'];

/** Contas cujo saldo está disponível para gastar no dia a dia. */
const LIQUID: ReadonlySet<AccountKind> = new Set(['checking', 'savings', 'cash']);

export function isLiquid(account: Account | undefined): boolean {
  return !account || LIQUID.has(account.kind);
}

export function defaultAccounts(): Account[] {
  return [{ id: DEFAULT_ACCOUNT_ID, name: 'Conta principal', kind: 'checking', initialBalanceCents: 0, archived: false }];
}

/** Conta de um lançamento (lançamentos antigos, sem conta, são da principal). */
export const accountOf = (t: Pick<Transaction, 'accountId'>): string => t.accountId ?? DEFAULT_ACCOUNT_ID;

/** Efeito de um lançamento no saldo de cada conta, em centavos. */
export function effects(t: Transaction): Array<[string, number]> {
  if (t.type === 'income') return [[accountOf(t), t.amountCents]];
  if (t.type === 'expense') return [[accountOf(t), -t.amountCents]];
  return [
    [accountOf(t), -t.amountCents],
    [t.toAccountId ?? DEFAULT_ACCOUNT_ID, t.amountCents],
  ];
}

/** Saldo de cada conta até `upTo` (inclusive), com o saldo inicial. */
export function accountBalances(accounts: Account[], transactions: Transaction[], upTo: ISODate): Map<string, number> {
  const balances = new Map(accounts.map((a) => [a.id, a.initialBalanceCents]));
  for (const t of transactions) {
    if (t.date > upTo) continue;
    for (const [id, delta] of effects(t)) balances.set(id, (balances.get(id) ?? 0) + delta);
  }
  return balances;
}

/** Saldo disponível: contas corrente, poupança e dinheiro (sem investimentos e cartões). */
export function liquidBalance(accounts: Account[], transactions: Transaction[], upTo: ISODate): number {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  let total = 0;
  for (const [id, cents] of accountBalances(accounts, transactions, upTo)) {
    if (isLiquid(byId.get(id))) total += cents;
  }
  return total;
}

/** Patrimônio líquido: tudo o que você tem menos o que deve (cartões entram negativos). */
export function netWorth(accounts: Account[], transactions: Transaction[], upTo: ISODate): number {
  let total = 0;
  for (const cents of accountBalances(accounts, transactions, upTo).values()) total += cents;
  return total;
}

export interface NetWorthPoint {
  month: MonthKey;
  netWorthCents: number;
  liquidCents: number;
}

/** Patrimônio no fim de cada mês (o mês atual vai até `today`). */
export function netWorthEvolution(
  accounts: Account[],
  transactions: Transaction[],
  today: ISODate,
  count: number,
): NetWorthPoint[] {
  return lastMonths(monthKeyOf(today), count).map((month) => {
    const end = month === monthKeyOf(today) ? today : dateInMonth(month, 31);
    return {
      month,
      netWorthCents: netWorth(accounts, transactions, end),
      liquidCents: liquidBalance(accounts, transactions, end),
    };
  });
}

/* ───────── Cartão de crédito ───────── */

/**
 * Fatura (mês de fechamento) em que cai uma compra: até o dia de fechamento,
 * a deste mês; depois dele, a do mês seguinte.
 */
export function invoiceMonthOf(date: ISODate, closingDay: number): MonthKey {
  const month = monthKeyOf(date);
  return date <= dateInMonth(month, closingDay) ? month : addMonthsKey(month, 1);
}

/** Vencimento da fatura que fecha em `month`. Se o vencimento é antes do fechamento, cai no mês seguinte. */
export function invoiceDueDate(month: MonthKey, closingDay: number, dueDay: number): ISODate {
  return dueDay > closingDay ? dateInMonth(month, dueDay) : dateInMonth(addMonthsKey(month, 1), dueDay);
}

export type InvoiceStatus = 'open' | 'closed' | 'paid' | 'overdue';

export interface Invoice {
  month: MonthKey;
  closeDate: ISODate;
  dueDate: ISODate;
  /** Compras menos estornos da fatura. */
  totalCents: number;
  /** Quanto dos pagamentos foi para esta fatura (os pagamentos quitam as mais antigas primeiro). */
  paidCents: number;
  remainingCents: number;
  status: InvoiceStatus;
}

/** Faturas de um cartão, da mais antiga à mais nova. Pagamentos são transferências para o cartão. */
export function cardInvoices(card: Account, transactions: Transaction[], today: ISODate): Invoice[] {
  const closingDay = card.closingDay ?? 1;
  const dueDay = card.dueDay ?? 10;
  const totals = new Map<MonthKey, number>();
  let payments = 0;
  for (const t of transactions) {
    if (t.type === 'transfer') {
      if (t.toAccountId === card.id && t.date <= today) payments += t.amountCents;
      if (accountOf(t) === card.id) payments -= t.amountCents; // saque/transferência do cartão
      continue;
    }
    if (accountOf(t) !== card.id) continue;
    const month = invoiceMonthOf(t.date, closingDay);
    totals.set(month, (totals.get(month) ?? 0) + (t.type === 'expense' ? t.amountCents : -t.amountCents));
  }
  // Saldo inicial negativo = dívida anterior ao app; entra como pagamento a menos.
  payments += card.initialBalanceCents;

  return [...totals.keys()].sort().map((month) => {
    const totalCents = totals.get(month)!;
    const paidCents = Math.max(0, Math.min(totalCents, payments));
    payments -= paidCents;
    const remainingCents = totalCents - paidCents;
    const closeDate = dateInMonth(month, closingDay);
    const dueDate = invoiceDueDate(month, closingDay, dueDay);
    const status: InvoiceStatus =
      remainingCents <= 0 ? 'paid' : today <= closeDate ? 'open' : today > dueDate ? 'overdue' : 'closed';
    return { month, closeDate, dueDate, totalCents, paidCents, remainingCents, status };
  });
}

/** Valor de cada parcela: divide sem perder centavos (a primeira fica com o resto). */
export function splitInstallments(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  return Array.from({ length: count }, (_, i) => base + (i === 0 ? totalCents - base * count : 0));
}
