/**
 * Resumo do dia em texto, para o Atalho do iPhone ("Como estou hoje?").
 * Calculado no servidor a partir dos registros sincronizados.
 * Também usado pela API: só imports relativos com `.js`.
 */
import { addDays, lastDayOfMonth } from './dates.js';
import { billsOn, pendingHabits, type DigestRecord } from './digest.js';
import { DEFAULT_ACCOUNT_ID } from './schemas.js';

interface TxRec {
  amountCents: number;
  type: 'income' | 'expense' | 'transfer';
  date: string;
  accountId?: string;
  toAccountId?: string;
  recurringId?: string;
}
interface AccountRec {
  id: string;
  kind: string;
  initialBalanceCents: number;
}
interface RuleRec {
  id: string;
  title: string;
  amountCents: number;
  type: string;
  active: boolean;
  dayOfMonth: number;
  startDate: string;
  skippedMonths?: string[];
}

const LIQUID = new Set(['checking', 'savings', 'cash']);
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
/** O Atalho mostra texto puro: troca o espaço inseparável do Intl por espaço comum. */
const money = (cents: number) => brl.format(cents / 100).replace(/ /g, ' ');

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface DaySummary {
  liquidCents: number;
  /** null quando o mês não tem receita. */
  dailyAllowanceCents: number | null;
  pendingTasks: number;
  overdueTasks: number;
  pendingHabits: string[];
  billsToday: string[];
  billsTomorrow: string[];
}

export function daySummary(records: DigestRecord[], today: string): DaySummary {
  const by = <T>(name: string) => records.filter((r) => r.collection === name && r.data).map((r) => r.data as T);
  const transactions = by<TxRec>('transactions');
  const rules = by<RuleRec>('recurring');
  const accounts = by<AccountRec>('accounts');
  const tasks = by<{ status: string; date: string }>('tasks');
  if (!accounts.length) accounts.push({ id: DEFAULT_ACCOUNT_ID, kind: 'checking', initialBalanceCents: 0 });

  // Saldo disponível (conta, reserva e dinheiro).
  const kind = new Map(accounts.map((a) => [a.id, a.kind]));
  const liquid = (id: string | undefined) => LIQUID.has(kind.get(id ?? DEFAULT_ACCOUNT_ID) ?? 'checking');
  let liquidCents = accounts.filter((a) => LIQUID.has(a.kind)).reduce((s, a) => s + a.initialBalanceCents, 0);
  for (const t of transactions) {
    if (t.date > today) continue;
    if (t.type === 'income' && liquid(t.accountId)) liquidCents += t.amountCents;
    if (t.type === 'expense' && liquid(t.accountId)) liquidCents -= t.amountCents;
    if (t.type === 'transfer') {
      if (liquid(t.accountId)) liquidCents -= t.amountCents;
      if (liquid(t.toAccountId)) liquidCents += t.amountCents;
    }
  }

  // Quanto dá para gastar por dia: receitas do mês − despesas do mês − recorrências que ainda vêm.
  const month = today.slice(0, 7);
  let income = 0;
  let expense = 0;
  const generated = new Set(transactions.filter((t) => t.recurringId).map((t) => `${t.recurringId}|${t.date.slice(0, 7)}`));
  for (const t of transactions) {
    if (t.date.slice(0, 7) !== month) continue;
    if (t.type === 'income') income += t.amountCents;
    if (t.type === 'expense') expense += t.amountCents;
  }
  const last = lastDayOfMonth(today);
  for (const r of rules) {
    if (!r.active || r.skippedMonths?.includes(month) || generated.has(`${r.id}|${month}`)) continue;
    const date = `${month}-${String(Math.min(r.dayOfMonth, last)).padStart(2, '0')}`;
    if (date <= today || date < r.startDate) continue;
    if (r.type === 'income') income += r.amountCents;
    if (r.type === 'expense') expense += r.amountCents;
  }
  const daysLeft = last - Number(today.slice(8, 10)) + 1;
  const dailyAllowanceCents = income > 0 ? Math.max(0, Math.floor((income - expense) / daysLeft)) : null;

  return {
    liquidCents,
    dailyAllowanceCents,
    pendingTasks: tasks.filter((t) => t.date === today && t.status !== 'done').length,
    overdueTasks: tasks.filter((t) => t.date < today && t.status !== 'done').length,
    pendingHabits: pendingHabits(by('habits'), by('habitLogs'), today).map((h) => h.title),
    billsToday: billsOn(rules, by('accounts'), today),
    billsTomorrow: billsOn(rules, by('accounts'), addDays(today, 1)),
  };
}

/** O resumo em poucas linhas, do jeito que aparece na notificação do Atalho. */
export function summaryText(s: DaySummary): string {
  const lines = [
    `Disponível: ${money(s.liquidCents)}${s.dailyAllowanceCents !== null ? ` · dá para gastar ${money(s.dailyAllowanceCents)} hoje` : ''}`,
  ];
  const todo = [
    s.pendingTasks && plural(s.pendingTasks, 'tarefa', 'tarefas'),
    s.pendingHabits.length && plural(s.pendingHabits.length, 'hábito', 'hábitos'),
  ].filter(Boolean);
  lines.push(todo.length ? `Falta hoje: ${todo.join(' e ')}` : 'Tudo feito por hoje.');
  if (s.overdueTasks) lines.push(`${plural(s.overdueTasks, 'tarefa atrasada', 'tarefas atrasadas')}`);
  if (s.billsToday.length) lines.push(`Vence hoje: ${s.billsToday.join(', ').replace(/ /g, ' ')}`);
  if (s.billsTomorrow.length) lines.push(`Vence amanhã: ${s.billsTomorrow.join(', ').replace(/ /g, ' ')}`);
  return lines.join('\n');
}

