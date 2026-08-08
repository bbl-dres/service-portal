// swisstopo SearchServer documents `attrs.label` as text with optional <b>
// highlighting. Decode that tiny contract without asking an HTML parser to
// build arbitrary elements (which could initiate resource requests).
const ENTITIES = Object.freeze({ amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' });

function decodeEntity(match, body) {
  if (body[0] !== '#') return Object.hasOwn(ENTITIES, body) ? ENTITIES[body] : match;
  const hex = body[1] && body[1].toLowerCase() === 'x';
  const number = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
  if (!Number.isInteger(number) || number < 0 || number > 0x10ffff || (number >= 0xd800 && number <= 0xdfff)) return '\ufffd';
  return String.fromCodePoint(number);
}

export function swisstopoLabelText(value) {
  return String(value == null ? '' : value)
    .replace(/<\/?b\s*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#(?:x[0-9a-f]+|[0-9]+)|amp|apos|gt|lt|nbsp|quot);/gi, decodeEntity)
    .replace(/\s+/g, ' ')
    .trim();
}
