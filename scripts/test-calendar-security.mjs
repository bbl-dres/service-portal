// iCalendar is a line-oriented format: escaping HTML or a filename does not
// prevent CR/LF data from becoming a second calendar property. Exercise the
// real download boundary with a tiny DOM-shaped harness and inspect the Blob.

let failures = 0;
const check = (condition, label, actual = '') => {
  console.log(`${condition ? '✓' : '✗'} ${label}${actual ? ` (${actual})` : ''}`);
  if (!condition) failures++;
};

const downloads = [];
let currentAnchor = null;
const originalDocument = globalThis.document;
const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;
const originalSetTimeout = globalThis.setTimeout;

globalThis.document = {
  createElement(tag) {
    if (tag !== 'a') throw new Error(`Unexpected element: ${tag}`);
    currentAnchor = {
      click() { this.clicked = true; },
      remove() { this.removed = true; },
    };
    downloads.at(-1).anchor = currentAnchor;
    return currentAnchor;
  },
  body: { appendChild() {} },
};
URL.createObjectURL = (blob) => {
  downloads.push({ blob, anchor: null });
  return `blob:test-${downloads.length}`;
};
URL.revokeObjectURL = () => {};
globalThis.setTimeout = (callback) => { callback(); return 0; };

try {
  const { calendarFile } = await import('../js/apps/room-booking/calendar.js');

  calendarFile({
    reference: 'BK-7\r\nX-REFERENCE:injected',
    title: 'Fallback title',
    data: {
      'zweck': 'Plan\\Review,\r\nATTACH:https://evil.invalid;tail',
      'gebaeude': 'Campus\rLOCATION:Injected',
      'raum': 'A;1,\nX-ALT-DESC:Injected',
      'teilnehmende': '4\r\nORGANIZER:mailto:attacker.invalid',
      'datum': '2026-08-09',
      start: '09:30',
      'ende': '10:45',
      'eingeladene': [
        'Jane "Lead"; Team <jane@example.com>',
        'Eve\r\nORGANIZER:mailto:attacker.invalid <eve@example.com>',
        'Mallory <mallory@example.com\r\nORGANIZER:mailto:attacker.invalid>',
      ],
    },
  });

  const first = downloads[0];
  const calendar = await first.blob.text();
  const lines = calendar.split('\r\n');
  check(first.blob.type === 'text/calendar;charset=utf-8', 'download keeps the calendar MIME type');
  check(first.anchor.clicked && first.anchor.removed, 'download uses and removes a temporary anchor');
  check(/^[\p{L}\p{N}-]+\.ics$/u.test(first.anchor.download), 'data-derived filename is slugged', first.anchor.download);
  check(lines.includes('DTSTART;TZID=Europe/Zurich:20260809T093000')
    && lines.includes('DTEND;TZID=Europe/Zurich:20260809T104500'),
  'valid local date and time values retain the expected compact form');
  check(lines.includes('SUMMARY:Plan\\\\Review\\,\\nATTACH:https://evil.invalid\\;tail'),
    'summary escapes backslash, comma, semicolon and CRLF as text');
  check(lines.includes('LOCATION:Campus\\nLOCATION:Injected\\, A\\;1\\,\\nX-ALT-DESC:Injected'),
    'location normalises lone CR and LF without creating properties');
  check(lines.includes('DESCRIPTION:4\\nORGANIZER:mailto:attacker.invalid Teilnehmende'),
    'description line breaks remain inside the property value');
  check(lines.includes('UID:BK-7\\nX-REFERENCE:injected@bbl.demo'),
    'reference line breaks remain inside the UID value');
  check(lines.includes('ATTENDEE;CN="Jane ^\'Lead^\'; Team":mailto:jane@example.com'),
    'attendee names use quoted caret-encoded parameter values');
  check(lines.includes('ATTENDEE;CN="Eve^nORGANIZER:mailto:attacker.invalid":mailto:eve@example.com'),
    'attendee-name line breaks stay inside the quoted parameter');
  check(lines.filter((line) => line.startsWith('ATTENDEE')).length === 2,
    'valid attendees remain while invalid attendee email data is omitted');
  check(!lines.some((line) => /^(ATTACH|ORGANIZER|X-(?:ALT-DESC|REFERENCE)):/.test(line)),
    'CR/LF payloads cannot inject physical calendar properties');
  check(!calendar.replaceAll('\r\n', '').match(/[\r\n]/),
    'calendar contains no raw line break outside canonical CRLF separators');

  calendarFile({
    reference: 'BK-8',
    data: {
      'zweck': 'Invalid date probe',
      'datum': '2026-08-09\r\nX-DATE:injected',
      start: '09:30',
      'ende': '10:45\nX-END:injected',
    },
  });
  const invalidCalendar = await downloads[1].blob.text();
  check(invalidCalendar.includes('DTSTART;TZID=Europe/Zurich:\r\n')
    && invalidCalendar.includes('DTEND;TZID=Europe/Zurich:\r\n'),
  'nonconforming date/time values fail closed');
  check(!invalidCalendar.split('\r\n').some((line) => /^X-(?:DATE|END):/.test(line)),
    'date/time fields cannot inject calendar properties');

  calendarFile({
    reference: 'BK-9',
    data: { 'zweck': 'Invalid calendar values', 'datum': '2026-02-30', start: '24:00', 'ende': '10:60' },
  });
  const impossibleCalendar = await downloads[2].blob.text();
  check(impossibleCalendar.includes('DTSTART;TZID=Europe/Zurich:\r\n')
    && impossibleCalendar.includes('DTEND;TZID=Europe/Zurich:\r\n'),
  'impossible calendar dates and out-of-range times fail closed');
} finally {
  globalThis.document = originalDocument;
  URL.createObjectURL = originalCreateObjectUrl;
  URL.revokeObjectURL = originalRevokeObjectUrl;
  globalThis.setTimeout = originalSetTimeout;
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
