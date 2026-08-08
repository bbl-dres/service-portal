import { download, fileSlug } from '../../export.js';

export const DIRECTORY = [
  { name: 'Anna Keller', email: 'anna.keller@bafu.admin.ch' },
  { name: 'Marco Rossi', email: 'marco.rossi@bafu.admin.ch' },
  { name: 'Sophie Dubois', email: 'sophie.dubois@bag.admin.ch' },
  { name: 'Luca Bernasconi', email: 'luca.bernasconi@blv.admin.ch' },
  { name: 'Nina Meier', email: 'nina.meier@bbl.admin.ch' },
];

export function calendarFile(instance) {
  const data = instance.data || {};
  const compact = (date, time) => `${String(date || '').replaceAll('-', '')}T${String(time || '').replace(':', '')}00`;
  const escIcs = (value) => String(value || '').replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;');
  const invitees = (Array.isArray(data['eingeladene']) ? data['eingeladene'] : []).map((value) => {
    const match = /^(.*?)\s*<([^>]+)>$/.exec(String(value));
    return match ? `ATTENDEE;CN=${escIcs(match[1])}:mailto:${match[2]}` : '';
  }).filter(Boolean);
  const location = `${data['gebaeude'] || ''}, ${data['raum'] || ''}`;
  const bookingDate = data['datum'];
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const content = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BBL//Raumbuchung Prototype//DE', 'BEGIN:VEVENT',
    `UID:${escIcs(instance.reference)}@bbl.demo`, `DTSTAMP:${now}`, `DTSTART;TZID=Europe/Zurich:${compact(bookingDate, data.start)}`,
    `DTEND;TZID=Europe/Zurich:${compact(bookingDate, data['ende'])}`, `SUMMARY:${escIcs(data['zweck'] || instance.title)}`,
    `LOCATION:${escIcs(location)}`, `DESCRIPTION:${escIcs(`${data['teilnehmende'] || ''} Teilnehmende`)}`, ...invitees,
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  download(content, `${fileSlug(data['zweck'] || 'raumbuchung')}.ics`, 'text/calendar;charset=utf-8');
}

export function parseInvitee(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const found = DIRECTORY.find((person) => person.name.toLocaleLowerCase('de-CH') === raw.toLocaleLowerCase('de-CH')
    || person.email.toLocaleLowerCase('de-CH') === raw.toLocaleLowerCase('de-CH'));
  if (found) return found;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return { name: raw.split('@')[0], email: raw };
  if (raw.length >= 3) return { name: raw, email: '' };
  return null;
}
