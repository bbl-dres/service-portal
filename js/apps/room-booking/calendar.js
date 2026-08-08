import { download, fileSlug } from '../../export.js';

export const DIRECTORY = [
  { name: 'Anna Keller', email: 'anna.keller@bafu.admin.ch' },
  { name: 'Marco Rossi', email: 'marco.rossi@bafu.admin.ch' },
  { name: 'Sophie Dubois', email: 'sophie.dubois@bag.admin.ch' },
  { name: 'Luca Bernasconi', email: 'luca.bernasconi@blv.admin.ch' },
  { name: 'Nina Meier', email: 'nina.meier@bbl.admin.ch' },
];

// RFC 5545 TEXT values escape every physical line break. Treat CRLF as one
// logical break and lone CR/LF the same way so form or storage data cannot add
// a new calendar property.
function escapeCalendarText(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;');
}

// Parameter values use RFC 6868 caret encoding inside a quoted value. Email
// addresses stay deliberately narrow because they are emitted after mailto:.
function calendarParameter(value) {
  return `"${String(value ?? '')
    .replaceAll('^', '^^')
    .replaceAll('"', "^'")
    .replace(/\r\n|\r|\n/g, '^n')}"`;
}

const calendarEmail = (value) => {
  const email = String(value ?? '').trim();
  return /^[a-z0-9.!#$%&\x27*+/=?^_\x60{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email) ? email : '';
};

const compactDateTime = (date, time) => {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ''));
  const clock = /^(\d{2}):(\d{2})$/.exec(String(time ?? ''));
  if (!day || !clock) return '';
  const year = Number(day[1]), month = Number(day[2]), dateOfMonth = Number(day[3]);
  const hour = Number(clock[1]), minute = Number(clock[2]);
  const instant = new Date(Date.UTC(year, month - 1, dateOfMonth));
  if (instant.getUTCFullYear() !== year || instant.getUTCMonth() !== month - 1
    || instant.getUTCDate() !== dateOfMonth || hour > 23 || minute > 59) return '';
  return `${day[1]}${day[2]}${day[3]}T${clock[1]}${clock[2]}00`;
};

export function calendarFile(instance) {
  const data = instance.data || {};
  const invitees = (Array.isArray(data['eingeladene']) ? data['eingeladene'] : []).map((value) => {
    const match = /^([\s\S]*?)\s*<([^>]+)>$/.exec(String(value));
    const email = match && calendarEmail(match[2]);
    return email ? `ATTENDEE;CN=${calendarParameter(match[1].trim() || email)}:mailto:${email}` : '';
  }).filter(Boolean);
  const location = `${data['gebaeude'] || ''}, ${data['raum'] || ''}`;
  const bookingDate = data['datum'];
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const content = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BBL//Raumbuchung Prototype//DE', 'BEGIN:VEVENT',
    `UID:${escapeCalendarText(instance.reference)}@bbl.demo`, `DTSTAMP:${now}`,
    `DTSTART;TZID=Europe/Zurich:${compactDateTime(bookingDate, data.start)}`,
    `DTEND;TZID=Europe/Zurich:${compactDateTime(bookingDate, data['ende'])}`,
    `SUMMARY:${escapeCalendarText(data['zweck'] || instance.title)}`,
    `LOCATION:${escapeCalendarText(location)}`,
    `DESCRIPTION:${escapeCalendarText(`${data['teilnehmende'] || ''} Teilnehmende`)}`, ...invitees,
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
