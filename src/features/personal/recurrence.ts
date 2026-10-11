import { addDaysISO, addMonthsKey, dateInMonth, monthKeyOf, weekdayOf, WEEKDAY_LABELS, WEEKDAY_ORDER, type ISODate, type MonthKey } from '@/lib/dates';
import type { TaskRepeat } from './types';

const NTH_FEM: Record<number, string> = { 1: 'primeira', 2: 'segunda', 3: 'terceira', 4: 'quarta', [-1]: 'última' };
const NTH_MASC: Record<number, string> = { 1: 'primeiro', 2: 'segundo', 3: 'terceiro', 4: 'quarto', [-1]: 'último' };
/** Domingo e sábado são masculinos: "todo domingo", "toda segunda". */
const masculine = (weekday: number) => weekday === 0 || weekday === 6;
const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const;

/** Data do n-ésimo dia da semana do mês (nth = -1: o último). */
export function nthWeekdayOfMonth(month: MonthKey, nth: number, weekday: number): ISODate {
  if (nth === -1) {
    let day = dateInMonth(month, 31);
    while (weekdayOf(day) !== weekday) day = addDaysISO(day, -1);
    return day;
  }
  let day = `${month}-01`;
  while (weekdayOf(day) !== weekday) day = addDaysISO(day, 1);
  return addDaysISO(day, (nth - 1) * 7);
}

/** Próxima data da repetição estritamente depois de `after`. */
export function nextOccurrence(repeat: TaskRepeat, after: ISODate): ISODate {
  switch (repeat.freq) {
    case 'daily':
      return addDaysISO(after, 1);
    case 'weekdays': {
      let day = addDaysISO(after, 1);
      while ([0, 6].includes(weekdayOf(day))) day = addDaysISO(day, 1);
      return day;
    }
    case 'weekly': {
      const days = repeat.weekdays.length ? repeat.weekdays : [weekdayOf(after)];
      let day = addDaysISO(after, 1);
      while (!days.includes(weekdayOf(day))) day = addDaysISO(day, 1);
      return day;
    }
    case 'monthly': {
      const same = dateInMonth(monthKeyOf(after), repeat.day);
      return same > after ? same : dateInMonth(addMonthsKey(monthKeyOf(after), 1), repeat.day);
    }
    case 'monthlyNth': {
      const same = nthWeekdayOfMonth(monthKeyOf(after), repeat.nth, repeat.weekday);
      if (same > after && monthKeyOf(same) === monthKeyOf(after)) return same;
      return nthWeekdayOfMonth(addMonthsKey(monthKeyOf(after), 1), repeat.nth, repeat.weekday);
    }
  }
}

export function repeatLabel(repeat: TaskRepeat): string {
  switch (repeat.freq) {
    case 'daily':
      return 'Todo dia';
    case 'weekdays':
      return 'Dias úteis';
    case 'weekly':
      return repeat.weekdays.length === 1
        ? `${masculine(repeat.weekdays[0]!) ? 'Todo' : 'Toda'} ${WEEKDAY_NAMES[repeat.weekdays[0]!]}`
        : `Toda semana: ${WEEKDAY_ORDER.filter((d) => repeat.weekdays.includes(d))
            .map((d) => WEEKDAY_LABELS[d])
            .join(', ')}`;
    case 'monthly':
      return `Todo dia ${repeat.day}`;
    case 'monthlyNth':
      return masculine(repeat.weekday)
        ? `Todo ${NTH_MASC[repeat.nth]} ${WEEKDAY_NAMES[repeat.weekday]} do mês`
        : `Toda ${NTH_FEM[repeat.nth]} ${WEEKDAY_NAMES[repeat.weekday]} do mês`;
  }
}
