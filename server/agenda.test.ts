import { describe, expect, it } from 'vitest';
import { eventsOnDay, zonedMidnight } from './agenda';

const TZ = 'America/Sao_Paulo';

const ics = (body: string) =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
    'BEGIN:VTIMEZONE',
    'TZID:America/Sao_Paulo',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0300',
    'TZOFFSETTO:-0300',
    'TZNAME:-03',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE',
    body.trim(),
    'END:VCALENDAR',
  ].join('\r\n');

const at = (iso: string) => Date.parse(iso);

describe('eventsOnDay', () => {
  it('lê evento com fuso, dia inteiro e ignora outros dias', () => {
    const text = ics(`
BEGIN:VEVENT
UID:a
DTSTART;TZID=America/Sao_Paulo:20261026T093000
DTEND;TZID=America/Sao_Paulo:20261026T103000
SUMMARY:Reunião
LOCATION:Sala 2
END:VEVENT
BEGIN:VEVENT
UID:b
DTSTART;VALUE=DATE:20261026
DTEND;VALUE=DATE:20261027
SUMMARY:Feriado
END:VEVENT
BEGIN:VEVENT
UID:c
DTSTART:20261027T120000Z
DTEND:20261027T130000Z
SUMMARY:Amanhã
END:VEVENT`);
    const events = eventsOnDay([text], '2026-10-26', TZ);
    expect(events.map((e) => e.title)).toEqual(['Feriado', 'Reunião']);
    const meeting = events[1]!;
    expect(meeting.start).toBe(at('2026-10-26T12:30:00Z'));
    expect(meeting.end).toBe(at('2026-10-26T13:30:00Z'));
    expect(meeting.location).toBe('Sala 2');
    expect(events[0]!.allDay).toBe(true);
  });

  it('expande recorrência, respeita EXDATE, exceção movida e cancelada', () => {
    const text = ics(`
BEGIN:VEVENT
UID:daily
DTSTART;TZID=America/Sao_Paulo:20260101T080000
DTEND;TZID=America/Sao_Paulo:20260101T081500
RRULE:FREQ=DAILY
EXDATE;TZID=America/Sao_Paulo:20261027T080000
SUMMARY:Standup
END:VEVENT
BEGIN:VEVENT
UID:daily
RECURRENCE-ID;TZID=America/Sao_Paulo:20261026T080000
DTSTART;TZID=America/Sao_Paulo:20261026T090000
DTEND;TZID=America/Sao_Paulo:20261026T091500
SUMMARY:Standup (atrasado)
END:VEVENT
BEGIN:VEVENT
UID:daily
RECURRENCE-ID;TZID=America/Sao_Paulo:20261028T080000
DTSTART;TZID=America/Sao_Paulo:20261028T080000
DTEND;TZID=America/Sao_Paulo:20261028T081500
STATUS:CANCELLED
SUMMARY:Standup
END:VEVENT`);
    const monday = eventsOnDay([text], '2026-10-26', TZ);
    expect(monday).toHaveLength(1);
    expect(monday[0]!.title).toBe('Standup (atrasado)');
    expect(monday[0]!.start).toBe(at('2026-10-26T12:00:00Z'));

    expect(eventsOnDay([text], '2026-10-27', TZ)).toEqual([]);
    expect(eventsOnDay([text], '2026-10-28', TZ)).toEqual([]);
    expect(eventsOnDay([text], '2026-10-29', TZ)).toHaveLength(1);
  });

  it('inclui evento que atravessa a meia-noite', () => {
    const text = ics(`
BEGIN:VEVENT
UID:late
DTSTART;TZID=America/Sao_Paulo:20261025T230000
DTEND;TZID=America/Sao_Paulo:20261026T010000
SUMMARY:Plantão
END:VEVENT`);
    expect(eventsOnDay([text], '2026-10-26', TZ)).toHaveLength(1);
  });
});

describe('zonedMidnight', () => {
  it('considera o fuso e o horário de verão', () => {
    expect(zonedMidnight('2026-10-26', TZ)).toBe(at('2026-10-26T03:00:00Z'));
    expect(zonedMidnight('2026-07-01', 'Europe/Lisbon')).toBe(at('2026-06-30T23:00:00Z'));
    expect(zonedMidnight('2026-01-15', 'Europe/Lisbon')).toBe(at('2026-01-15T00:00:00Z'));
  });
});
