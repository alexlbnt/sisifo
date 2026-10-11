/**
 * Conteúdo das notificações push, calculado no servidor a partir dos registros
 * sincronizados. Também usado pela API: só pacotes e imports relativos `.js`.
 */

export type NotifySlot = 'morning' | 'evening';

export interface NotifyPrefs {
  /** Manhã: resumo do dia (tarefas, hábitos, contas que vencem). */
  morning: boolean;
  /** Noite: hábitos que ainda faltam. */
  evening: boolean;
  /** Contas e faturas que vencem hoje ou amanhã. */
  bills: boolean;
  /** Domingo à noite: lembrete da revisão semanal. */
  review: boolean;
}

export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = { morning: true, evening: true, bills: true, review: true };

export interface DigestRecord {
  collection: string;
  data: unknown;
}

export interface Notification {
  title: string;
  body: string;
  /** Tela que abre ao tocar na notificação. */
  url: string;
  /** Notificações com a mesma tag substituem a anterior. */
  tag: string;
}

/* ───────── Datas (sem date-fns: a conta é simples e roda no servidor) ───────── */

/** "Hoje" no fuso do aparelho, como YYYY-MM-DD. */
export function localDate(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

const toUTC = (iso: string) => new Date(`${iso}T12:00:00Z`);
const fromUTC = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, days: number) => fromUTC(new Date(toUTC(iso).getTime() + days * 86_400_000));
export const weekday = (iso: string) => toUTC(iso).getUTCDay();

function lastDayOfMonth(iso: string): number {
  const d = toUTC(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** O dia `day` cai em `iso`? (dia 31 em mês de 30 dias cai no dia 30). */
function isMonthDay(iso: string, day: number): boolean {
  return Number(iso.slice(8, 10)) === Math.min(day, lastDayOfMonth(iso));
}

function mondayOf(iso: string): string {
  return addDays(iso, -((weekday(iso) + 6) % 7));
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (cents: number) => brl.format(cents / 100);

/* ───────── Leitura dos registros ───────── */

interface TaskRec {
  title: string;
  status: string;
  date: string;
  time?: string;
}
interface HabitRec {
  id: string;
  title: string;
  archived: boolean;
  kind?: string;
  target?: number;
  frequency?: string;
  timesPerWeek?: number;
  schedule: number[];
}
interface LogRec {
  habitId: string;
  date: string;
  value?: number;
  skip?: string;
}
interface RuleRec {
  title: string;
  amountCents: number;
  type: string;
  active: boolean;
  dayOfMonth: number;
  startDate: string;
  skippedMonths?: string[];
}
interface AccountRec {
  name: string;
  kind: string;
  dueDay?: number;
  archived: boolean;
}
interface ReviewRec {
  id: string;
}

function group(records: DigestRecord[]) {
  const by = <T>(name: string) => records.filter((r) => r.collection === name && r.data).map((r) => r.data as T);
  return {
    tasks: by<TaskRec>('tasks'),
    habits: by<HabitRec>('habits'),
    logs: by<LogRec>('habitLogs'),
    rules: by<RuleRec>('recurring'),
    accounts: by<AccountRec>('accounts'),
    reviews: by<ReviewRec>('reviews'),
  };
}

/** Hábitos que ainda faltam hoje (mesma regra da tela Hoje). */
export function pendingHabits(habits: HabitRec[], logs: LogRec[], today: string): HabitRec[] {
  const logsOf = new Map<string, LogRec[]>();
  for (const log of logs) logsOf.set(log.habitId, [...(logsOf.get(log.habitId) ?? []), log]);
  const monday = mondayOf(today);
  return habits.filter((h) => {
    if (h.archived) return false;
    const mine = logsOf.get(h.id) ?? [];
    const target = h.kind === 'quantity' ? (h.target ?? 1) : 1;
    const doneOn = (d: string) =>
      mine.some((l) => l.date === d && !l.skip && (h.kind === 'quantity' ? (l.value ?? target) >= target : true));
    if (mine.some((l) => l.date === today && l.skip)) return false;
    if (doneOn(today)) return false;
    if (h.frequency === 'weekly') {
      let count = 0;
      for (let i = 0; i < 7; i++) if (doneOn(addDays(monday, i))) count++;
      return count < (h.timesPerWeek ?? 1);
    }
    return h.schedule.includes(weekday(today));
  });
}

/** Contas que vencem em `day`: recorrências de despesa e faturas de cartão. */
export function billsOn(rules: RuleRec[], accounts: AccountRec[], day: string): string[] {
  const month = day.slice(0, 7);
  const bills = rules
    .filter(
      (r) =>
        r.active &&
        r.type === 'expense' &&
        r.startDate <= day &&
        !r.skippedMonths?.includes(month) &&
        isMonthDay(day, r.dayOfMonth),
    )
    .map((r) => `${r.title} (${money(r.amountCents)})`);
  const invoices = accounts
    .filter((a) => a.kind === 'credit' && !a.archived && a.dueDay && isMonthDay(day, a.dueDay))
    .map((a) => `Fatura ${a.name}`);
  return [...bills, ...invoices];
}

const list = (items: string[], max = 3) =>
  items.length <= max ? items.join(', ') : `${items.slice(0, max).join(', ')} e mais ${items.length - max}`;

/** As notificações de um aparelho num horário. Lista vazia: nada a dizer. */
export function buildNotifications(
  records: DigestRecord[],
  today: string,
  slot: NotifySlot,
  prefs: NotifyPrefs,
): Notification[] {
  const data = group(records);
  const out: Notification[] = [];

  if (slot === 'morning') {
    const tasks = data.tasks.filter((t) => t.date === today && t.status !== 'done');
    const overdue = data.tasks.filter((t) => t.date < today && t.status !== 'done');
    const habits = pendingHabits(data.habits, data.logs, today);
    const billsToday = prefs.bills ? billsOn(data.rules, data.accounts, today) : [];
    const billsTomorrow = prefs.bills ? billsOn(data.rules, data.accounts, addDays(today, 1)) : [];

    if (prefs.morning && (tasks.length || habits.length || overdue.length)) {
      const parts = [
        tasks.length && `${tasks.length} ${tasks.length === 1 ? 'tarefa' : 'tarefas'}`,
        habits.length && `${habits.length} ${habits.length === 1 ? 'hábito' : 'hábitos'}`,
        overdue.length && `${overdue.length} ${overdue.length === 1 ? 'atrasada' : 'atrasadas'}`,
      ].filter(Boolean);
      const timed = tasks.filter((t) => t.time).sort((a, b) => a.time!.localeCompare(b.time!))[0];
      out.push({
        title: 'Bom dia! A pedra está no pé do morro',
        body: `Hoje: ${parts.join(' · ')}.${timed ? ` Primeiro compromisso: ${timed.title} às ${timed.time}.` : ''}`,
        url: '/',
        tag: 'sisifo-morning',
      });
    }
    if (billsToday.length || billsTomorrow.length) {
      const body = [
        billsToday.length && `Hoje: ${list(billsToday)}.`,
        billsTomorrow.length && `Amanhã: ${list(billsTomorrow)}.`,
      ]
        .filter(Boolean)
        .join(' ');
      out.push({ title: 'Contas a vencer', body, url: '/finance', tag: 'sisifo-bills' });
    }
  }

  if (slot === 'evening') {
    const habits = pendingHabits(data.habits, data.logs, today);
    if (prefs.evening && habits.length) {
      out.push({
        title: habits.length === 1 ? 'Falta 1 hábito hoje' : `Faltam ${habits.length} hábitos hoje`,
        body: `${list(habits.map((h) => h.title))}. Ainda dá tempo.`,
        url: '/personal/habits',
        tag: 'sisifo-evening',
      });
    }
    // Domingo: revisão da semana que termina hoje.
    if (prefs.review && weekday(today) === 0 && !data.reviews.some((r) => r.id === mondayOf(today))) {
      out.push({
        title: 'Revisão semanal',
        body: '5 minutos para fechar a semana e escolher o foco da próxima.',
        url: '/review',
        tag: 'sisifo-review',
      });
    }
  }
  return out;
}
