export const PREFERRED_BUILDING = '1080/6650/AA';
export const ROOM_NAMES = ['Aare', 'Aletsch', 'Emme', 'Jura', 'Limmat', 'Reuss', 'Rhone', 'Saane', 'Sense', 'Säntis', 'Thur', 'Zürichsee'];
export const EQUIPMENT_OPTIONS = ['Bildschirm', 'Teams', 'Whiteboard', 'Videokonferenz'];
export const CANCELLED = new Set(['zurueckgezogen', 'storniert']);
// Booking-day bounds make the card's free-from/to range meaningful; without
// them every fully free room would display an unhelpful all-day range.
export const DAY_START = 7 * 60, DAY_END = 19 * 60;
export const PAGE_SIZE = 6;
export const FIELD_LABELS = {
  'booking-date': 'Datum',
  'booking-start': 'Von',
  'booking-end': 'Bis',
  'booking-participants': 'Teilnehmende',
};

export const localDate = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const nextWorkday = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  return localDate(date);
};

export const minuteOfDay = (value) => {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return NaN;
  const hours = Number(match[1]), minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : NaN;
};
export const hhmm = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
// Round down or up to quarter hours because time controls use step=900.
export const floorQuarter = (minutes) => Math.floor(minutes / 15) * 15;

export const rangesOverlap = (startA, endA, startB, endB) => startA < endB && startB < endA;
export const roomHash = (value) => [...String(value || '')].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
export const isRealDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 1000 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
};
export const participantCount = (value) => {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;
  const count = Number(raw);
  return Number.isSafeInteger(count) && count >= 1 && count <= 100 ? count : null;
};
export const slotValidation = ({ date, start, end, participants }, { today, capacity = null } = {}) => {
  const errors = {};
  const from = minuteOfDay(start), to = minuteOfDay(end);
  const count = participantCount(participants);
  if (!String(date || '').trim()) errors['booking-date'] = 'Bitte ein Datum wählen';
  else if (!isRealDate(date)) errors['booking-date'] = 'Bitte ein gültiges Datum wählen';
  else if (today && date < today) errors['booking-date'] = 'Bitte ein heutiges oder zukünftiges Datum wählen';
  if (!Number.isFinite(from)) errors['booking-start'] = 'Bitte eine gültige Startzeit angeben';
  else if (from < DAY_START || from >= DAY_END || from % 15) {
    errors['booking-start'] = 'Bitte eine Startzeit zwischen 07:00 und 18:45 in Viertelstunden angeben';
  }
  if (!Number.isFinite(to)) errors['booking-end'] = 'Bitte eine gültige Endzeit angeben';
  else if (to <= DAY_START || to > DAY_END || to % 15) {
    errors['booking-end'] = 'Bitte eine Endzeit zwischen 07:15 und 19:00 in Viertelstunden angeben';
  } else if (Number.isFinite(from) && to <= from) {
    errors['booking-end'] = 'Die Endzeit muss nach der Startzeit liegen';
  }
  if (count == null) errors['booking-participants'] = 'Bitte 1 bis 100 Teilnehmende angeben';
  else if (Number.isFinite(capacity) && count > capacity) {
    errors['booking-participants'] = `Dieser Raum bietet höchstens ${capacity} Plätze`;
  }
  return { errors, participants: count };
};
export const safeDate = (value, fallback, min = '') => isRealDate(value) && (!min || value >= min) ? String(value) : fallback;
export const safeTime = (value, fallback) => {
  const minutes = minuteOfDay(value);
  return Number.isFinite(minutes) && minutes >= DAY_START && minutes <= DAY_END && minutes % 15 === 0
    ? String(value) : fallback;
};
// Sanitize slash- and dot-bearing inventory IDs before using them as DOM IDs.
export const domId = (prefix, value) => `${prefix}-${String(value).replace(/[^a-z0-9_-]/gi, '-')}`;

export function instanceRange(instance) {
  const data = instance.data || {};
  const stored = String(data['zeit'] || '').split(/\s*[–-]\s*/);
  return { start: minuteOfDay(data.start || stored[0]), end: minuteOfDay(data['ende'] || stored[1]) };
}

export function isUpcoming(instance) {
  if (CANCELLED.has(instance.status)) return false;
  const data = instance.data || {};
  const end = data['ende'] || String(data['zeit'] || '').split(/\s*[–-]\s*/)[1] || '23:59';
  const stamp = new Date(`${data['datum'] || '1900-01-01'}T${end}:00`).getTime();
  return Number.isFinite(stamp) && stamp >= Date.now();
}
