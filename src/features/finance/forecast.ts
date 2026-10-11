import { addDaysISO, daysBetween, dateInMonth, monthKeyOf, type ISODate } from '@/lib/dates';
import { accountOf, cardInvoices, isLiquid, liquidBalance } from './accounts';
import { recurringMonthOf } from './selectors';
import type { Account, RecurringRule, Transaction, TransactionType } from './types';

/** Algo que ainda vai acontecer: recorrência do mês, lançamento agendado ou fatura. */
export interface UpcomingItem {
  key: string;
  date: ISODate;
  title: string;
  amountCents: number;
  type: TransactionType;
  source: 'recurring' | 'scheduled' | 'invoice';
  accountId?: string;
  toAccountId?: string;
}

/** Recorrências ativas que ainda vão gerar lançamento entre `from` (exclusive) e `to` (inclusive). */
function upcomingRecurring(rules: RecurringRule[], transactions: Transaction[], from: ISODate, to: ISODate): UpcomingItem[] {
  const existing = new Set<string>();
  for (const t of transactions) {
    const month = recurringMonthOf(t);
    if (month) existing.add(`${t.recurringId}|${month}`);
  }
  const items: UpcomingItem[] = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    for (const month of new Set([monthKeyOf(from), monthKeyOf(to)])) {
      const date = dateInMonth(month, rule.dayOfMonth);
      if (date <= from || date > to || date < rule.startDate) continue;
      if (rule.skippedMonths?.includes(month) || existing.has(`${rule.id}|${month}`)) continue;
      items.push({
        key: `rec-${rule.id}-${month}`,
        date,
        title: rule.title,
        amountCents: rule.amountCents,
        type: rule.type,
        source: 'recurring',
        accountId: rule.accountId,
        toAccountId: rule.toAccountId,
      });
    }
  }
  return items;
}

/**
 * Tudo o que vence entre amanhã e `to`: recorrências que ainda não foram
 * lançadas, lançamentos com data futura (fora do cartão) e faturas em aberto.
 */
export function upcomingItems(
  accounts: Account[],
  transactions: Transaction[],
  rules: RecurringRule[],
  today: ISODate,
  to: ISODate,
): UpcomingItem[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const items = upcomingRecurring(rules, transactions, today, to);

  for (const t of transactions) {
    if (t.date <= today || t.date > to) continue;
    if (byId.get(accountOf(t))?.kind === 'credit') continue; // entra pela fatura
    items.push({
      key: t.id,
      date: t.date,
      title: t.title,
      amountCents: t.amountCents,
      type: t.type,
      source: 'scheduled',
      accountId: t.accountId,
      toAccountId: t.toAccountId,
    });
  }

  for (const card of accounts) {
    if (card.kind !== 'credit' || card.archived) continue;
    for (const inv of cardInvoices(card, transactions, today)) {
      if (inv.remainingCents <= 0 || inv.dueDate < today || inv.dueDate > to) continue;
      items.push({
        key: `inv-${card.id}-${inv.month}`,
        date: inv.dueDate,
        title: `Fatura ${card.name}`,
        amountCents: inv.remainingCents,
        type: 'expense',
        source: 'invoice',
      });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

/** Quanto um item vai mexer no saldo disponível (faturas saem do disponível). */
function liquidEffect(item: UpcomingItem, byId: Map<string, Account>): number {
  const from = byId.get(item.accountId ?? '');
  if (item.source === 'invoice') return -item.amountCents;
  if (item.type === 'income') return from?.kind === 'credit' ? 0 : item.amountCents;
  if (item.type === 'expense') return from?.kind === 'credit' ? 0 : -item.amountCents;
  const to = byId.get(item.toAccountId ?? '');
  return (isLiquid(to) ? item.amountCents : 0) - (isLiquid(from) ? item.amountCents : 0);
}

export interface MonthForecast {
  /** Saldo disponível hoje. */
  liquidNowCents: number;
  /** Saldo disponível previsto no último dia do mês, sem gastos variáveis novos. */
  projectedEndCents: number;
  /** O que ainda vem no mês (recorrências, agendados, faturas). */
  upcoming: UpcomingItem[];
  /** Dias até o fim do mês, contando hoje. */
  daysLeft: number;
  /**
   * Quanto dá para gastar por dia até o fim do mês: receitas do mês menos
   * despesas fixas (recorrências e parcelas), gastos variáveis já feitos e a
   * meta de poupança do mês. null quando o mês não tem receita.
   */
  dailyAllowanceCents: number | null;
  /** Detalhe do cálculo do valor diário. */
  budget: { incomeCents: number; fixedCents: number; variableSpentCents: number; savingsCents: number };
}

export function monthForecast(
  accounts: Account[],
  transactions: Transaction[],
  rules: RecurringRule[],
  today: ISODate,
  savingsTargetCents = 0,
): MonthForecast {
  const month = monthKeyOf(today);
  const monthEnd = dateInMonth(month, 31);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const upcoming = upcomingItems(accounts, transactions, rules, today, monthEnd);
  const liquidNowCents = liquidBalance(accounts, transactions, today);
  const projectedEndCents = upcoming.reduce((sum, item) => sum + liquidEffect(item, byId), liquidNowCents);

  // Orçamento do mês por competência (data do lançamento, em qualquer conta).
  let incomeCents = 0;
  let fixedCents = 0;
  let variableSpentCents = 0;
  for (const t of transactions) {
    if (monthKeyOf(t.date) !== month) continue;
    if (t.type === 'income') incomeCents += t.amountCents;
    else if (t.type === 'expense') {
      const fixed = Boolean(t.recurringId || t.installment);
      if (fixed) fixedCents += t.amountCents;
      else if (t.date <= today) variableSpentCents += t.amountCents;
      else fixedCents += t.amountCents; // agendado para depois: já está comprometido
    }
  }
  for (const item of upcoming) {
    if (item.source !== 'recurring') continue;
    if (item.type === 'income') incomeCents += item.amountCents;
    else if (item.type === 'expense') fixedCents += item.amountCents;
  }

  const daysLeft = daysBetween(today, monthEnd) + 1;
  const free = incomeCents - fixedCents - variableSpentCents - savingsTargetCents;
  return {
    liquidNowCents,
    projectedEndCents,
    upcoming,
    daysLeft,
    dailyAllowanceCents: incomeCents > 0 ? Math.max(0, Math.floor(free / daysLeft)) : null,
    budget: { incomeCents, fixedCents, variableSpentCents, savingsCents: savingsTargetCents },
  };
}

/** Atalho: o que vence nos próximos `days` dias. */
export function dueSoon(
  accounts: Account[],
  transactions: Transaction[],
  rules: RecurringRule[],
  today: ISODate,
  days = 7,
): UpcomingItem[] {
  return upcomingItems(accounts, transactions, rules, today, addDaysISO(today, days));
}
