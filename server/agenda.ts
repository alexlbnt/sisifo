import ICAL from 'ical.js';
import type { AgendaEvent } from '../src/shared/agenda.js';
import { addDays } from '../src/shared/dates.js';

/**
 * Lê o endereço secreto iCal do Google Calendar e devolve os eventos de um dia.
 *
 * O endereço fica só no servidor (GOOGLE_ICAL_URL): ele dá leitura da agenda
 * para quem o tiver, então nunca vai para o navegador nem aparece em erros.
 * Vários calendários: separe os endereços por vírgula ou espaço.
 */

const CACHE_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
/** Teto de ocorrências percorridas por evento recorrente (diário há 10 anos ≈ 3650). */
const MAX_ITERATIONS = 20_000;

export function icalUrls(): string[] {
  return (process.env.GOOGLE_ICAL_URL ?? '')
    .split(/[\s,]+/)
    .filter((url) => url.startsWith('https://'));
}

const cache = new Map<string, { at: number; text: string }>();

async function fetchCalendar(url: string, now = Date.now()): Promise<string> {
  const hit = cache.get(url);
  if (hit && now - hit.at < CACHE_MS) return hit.text;
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`calendário respondeu ${response.status}`);
  const text = await response.text();
  cache.set(url, { at: now, text });
  return text;
}

/* ───────── Fuso ───────── */

/** Diferença (ms) entre o horário de parede no fuso e o UTC, num instante. */
function zoneOffset(timeZone: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wall - Math.floor(at / 1000) * 1000;
}

/** Meia-noite de `iso` no fuso, em epoch ms (considera horário de verão). */
export function zonedMidnight(iso: string, timeZone: string): number {
  const guess = Date.parse(`${iso}T00:00:00Z`);
  const first = guess - zoneOffset(timeZone, guess);
  return guess - zoneOffset(timeZone, first);
}

/* ───────── Eventos ───────── */

type Occurrence = { start: ICAL.Time; end: ICAL.Time; item: ICAL.Event };

function occurrencesOn(event: ICAL.Event, dayStart: number, dayEnd: number, day: string): Occurrence[] {
  const fits = (start: ICAL.Time, end: ICAL.Time) =>
    start.isDate
      ? start.toString() <= day && day < (end.compare(start) > 0 ? end.toString() : addDays(start.toString(), 1))
      : start.toJSDate().getTime() < dayEnd && end.toJSDate().getTime() > dayStart;

  if (!event.isRecurring()) {
    const end = event.endDate ?? event.startDate;
    return fits(event.startDate, end) ? [{ start: event.startDate, end, item: event }] : [];
  }

  const found: Occurrence[] = [];
  const iterator = event.iterator();
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const next = iterator.next();
    if (!next) break;
    // Ocorrências vêm em ordem; um dia de folga cobre o dia inteiro lido no fuso do servidor.
    if (next.toJSDate().getTime() > dayEnd + 86_400_000) break;
    const details = event.getOccurrenceDetails(next);
    if (fits(details.startDate, details.endDate)) {
      found.push({ start: details.startDate, end: details.endDate, item: details.item });
    }
  }
  return found;
}

/** Eventos de `day` (YYYY-MM-DD, no fuso) em um ou mais arquivos .ics. Função pura sobre o texto. */
export function eventsOnDay(icsTexts: string[], day: string, timeZone: string): AgendaEvent[] {
  const dayStart = zonedMidnight(day, timeZone);
  const dayEnd = zonedMidnight(addDays(day, 1), timeZone);
  const result: AgendaEvent[] = [];

  for (const text of icsTexts) {
    const calendar = new ICAL.Component(ICAL.parse(text));
    for (const tz of calendar.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz);

    // Ocorrências alteradas (RECURRENCE-ID) são ligadas ao evento principal de mesmo UID.
    const masters = new Map<string, ICAL.Event>();
    const exceptions: ICAL.Event[] = [];
    for (const component of calendar.getAllSubcomponents('vevent')) {
      const event = new ICAL.Event(component);
      if (event.isRecurrenceException()) exceptions.push(event);
      else masters.set(event.uid, event);
    }
    for (const ex of exceptions) {
      const master = masters.get(ex.uid);
      if (master) master.relateException(ex);
      else masters.set(`${ex.uid}#${ex.recurrenceId}`, ex);
    }

    for (const event of masters.values()) {
      for (const { start, end, item } of occurrencesOn(event, dayStart, dayEnd, day)) {
        if (item.component.getFirstPropertyValue('status') === 'CANCELLED') continue;
        const allDay = start.isDate;
        const startMs = allDay ? dayStart : start.toJSDate().getTime();
        const endMs = allDay ? dayEnd : end.toJSDate().getTime();
        result.push({
          id: `${event.uid}@${start.toString()}`,
          title: item.summary || '(sem título)',
          start: startMs,
          end: Math.max(endMs, startMs),
          allDay,
          ...(item.location && { location: item.location }),
        });
      }
    }
  }

  return result.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start || a.title.localeCompare(b.title));
}

/**
 * Eventos de `days` dias a partir de `day`. Um evento com horário que cruza a
 * meia-noite aparece uma vez; um de dia inteiro, uma vez por dia.
 */
export function eventsOnDays(icsTexts: string[], day: string, days: number, timeZone: string): AgendaEvent[] {
  const seen = new Set<string>();
  const result: AgendaEvent[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(day, i);
    for (const event of eventsOnDay(icsTexts, date, timeZone)) {
      const id = event.allDay ? `${event.id}#${date}` : event.id;
      if (seen.has(id)) continue;
      seen.add(id);
      result.push({ ...event, id });
    }
  }
  return result.sort((a, b) => a.start - b.start || Number(b.allDay) - Number(a.allDay));
}

export async function loadAgenda(day: string, timeZone: string, days = 1): Promise<AgendaEvent[]> {
  const texts = await Promise.all(icalUrls().map((url) => fetchCalendar(url)));
  return eventsOnDays(texts, day, days, timeZone);
}
