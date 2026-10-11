import {
  addDays,
  addMonths,
  format,
  parseISO,
  startOfWeek,
  differenceInCalendarDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Datas são sempre strings locais no formato YYYY-MM-DD. */
export type ISODate = string;
/** Mês no formato YYYY-MM. */
export type MonthKey = string;

export function toISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd');
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function fromISODate(iso: ISODate): Date {
  return parseISO(iso);
}

export function addDaysISO(iso: ISODate, days: number): ISODate {
  return toISODate(addDays(parseISO(iso), days));
}

/** Soma meses a uma data; dia 31 em mês curto vira o último dia. */
export function addMonthsISO(iso: ISODate, months: number): ISODate {
  return toISODate(addMonths(parseISO(iso), months));
}

export function monthKeyOf(iso: ISODate): MonthKey {
  return iso.slice(0, 7);
}

export function currentMonthKey(): MonthKey {
  return monthKeyOf(todayISO());
}

export function addMonthsKey(key: MonthKey, months: number): MonthKey {
  return format(addMonths(parseISO(`${key}-01`), months), 'yyyy-MM');
}

/** Lista de meses terminando em `end` (inclusive), do mais antigo ao mais novo. */
export function lastMonths(end: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, i) => addMonthsKey(end, i - count + 1));
}

/** 0 = domingo ... 6 = sábado */
export function weekdayOf(iso: ISODate): number {
  return parseISO(iso).getDay();
}

/** Segunda-feira da semana que contém `iso`. */
export function startOfWeekISO(iso: ISODate): ISODate {
  return toISODate(startOfWeek(parseISO(iso), { weekStartsOn: 1 }));
}

export function weekDaysFrom(mondayISO: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(mondayISO, i));
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return differenceInCalendarDays(parseISO(b), parseISO(a));
}

/** Clamp do dia do mês: dia 31 em fevereiro vira o último dia de fevereiro. */
export function dateInMonth(key: MonthKey, day: number): ISODate {
  const [y, m] = key.split('-').map(Number) as [number, number];
  const lastDay = new Date(y, m, 0).getDate();
  return `${key}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const fmt = {
  /** "9 de out." */
  short: (iso: ISODate) => format(parseISO(iso), "d 'de' MMM", { locale: ptBR }),
  /** "09/10/2026" */
  numeric: (iso: ISODate) => format(parseISO(iso), 'dd/MM/yyyy'),
  /** "quinta-feira, 9 de outubro" */
  long: (iso: ISODate) => format(parseISO(iso), "EEEE, d 'de' MMMM", { locale: ptBR }),
  /** "Outubro de 2026" */
  month: (key: MonthKey) =>
    capitalize(format(parseISO(`${key}-01`), "MMMM 'de' yyyy", { locale: ptBR })),
  /** "out/26" */
  monthShort: (key: MonthKey) => format(parseISO(`${key}-01`), 'MMM/yy', { locale: ptBR }),
  /** "Seg" */
  weekdayShort: (iso: ISODate) =>
    capitalize(format(parseISO(iso), 'EEEEEE', { locale: ptBR })),
};

export const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
/** Ordem de exibição começando na segunda. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Rótulo relativo: "Hoje", "Ontem", "Amanhã" ou a data curta. */
export function relativeDay(iso: ISODate, today: ISODate = todayISO()): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Hoje';
  if (diff === -1) return 'Ontem';
  if (diff === 1) return 'Amanhã';
  return fmt.short(iso);
}
