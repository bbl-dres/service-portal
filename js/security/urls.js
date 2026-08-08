// Context-aware URL validation for values that cross a data/markup boundary.
// HTML escaping protects attribute syntax; this module separately decides
// whether the browser may interpret a value as a navigation or resource URL.

const VALID_PERCENT = /%(?![0-9a-f]{2})/i;
const ENCODED_CONTROL = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;
const FORBIDDEN_RAW = /[\u0000-\u001f\u007f-\u009f<>"'`\\]/u;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const FRAGMENT = /^#[A-Za-z0-9][A-Za-z0-9_.:~-]*$/;

function candidate(value) {
  if (typeof value !== 'string' || !value || value === '#') return '';
  if (value.trim() !== value) return '';
  if (FORBIDDEN_RAW.test(value) || VALID_PERCENT.test(value) || ENCODED_CONTROL.test(value)) return '';
  return value;
}

function currentOrigin() {
  try {
    const origin = globalThis.location && globalThis.location.origin;
    return origin && origin !== 'null' ? origin : '';
  } catch {
    return '';
  }
}

function parsed(value, base = 'https://portal.invalid/') {
  try { return new URL(value, base); } catch { return null; }
}

// Returns a stable kind rather than relying on startsWith() at every sink.
// `relative` includes root-relative URLs and an absolute URL matching the
// current origin (useful on the HTTP development server). External navigation
// is HTTPS-only; maintained intranet catalogue targets are stored as HTTPS.
export function classifyUrl(value, { mailto = false, tel = false, relative = true } = {}) {
  const raw = candidate(value);
  if (!raw) return '';

  if (raw.startsWith('#/')) return 'route';
  if (FRAGMENT.test(raw)) return 'fragment';
  if (/^\/\//.test(raw)) return ''; // Never inherit a protocol for an untrusted host.

  if (/^mailto:/i.test(raw)) {
    if (!mailto || !/^mailto:[^?]+(?:\?.*)?$/i.test(raw)) return '';
    return parsed(raw)?.protocol === 'mailto:' ? 'mailto' : '';
  }
  if (/^tel:/i.test(raw)) {
    if (!tel || !/^tel:[+0-9().-]+$/i.test(raw)) return '';
    return parsed(raw)?.protocol === 'tel:' ? 'tel' : '';
  }

  if (SCHEME.test(raw)) {
    const url = parsed(raw);
    if (!url || url.username || url.password) return '';
    const origin = currentOrigin();
    if (relative && origin && url.origin === origin && (url.protocol === 'http:' || url.protocol === 'https:')) return 'relative';
    if (url.protocol === 'https:' && url.hostname) return 'external';
    return '';
  }

  if (!relative) return '';
  const base = currentOrigin() || 'https://portal.invalid';
  const url = parsed(raw, `${base}/`);
  return url && url.origin === base ? 'relative' : '';
}

export function safeLinkUrl(value, options) {
  return classifyUrl(value, options) ? value : '';
}

// Images and downloads may be local files or HTTPS resources, but never route
// fragments or contact schemes. The value is preserved verbatim after
// validation so existing relative deployment paths do not change.
export function safeResourceUrl(value) {
  const kind = classifyUrl(value);
  return kind === 'relative' || kind === 'external' ? value : '';
}

// Local UI assets use repository-relative paths. Keep them inside the declared
// prefix and reject traversal segments while allowing the one maintained asset
// whose filename contains an ordinary internal space.
export function safeAssetUrl(value, prefix = 'assets/') {
  const raw = candidate(value);
  if (!raw || !raw.startsWith(prefix) || !prefix.startsWith('assets/')) return '';
  const segments = raw.split('/');
  if (segments.some((part) => !part || part === '.' || part === '..'
    || !/^[A-Za-z0-9][A-Za-z0-9._ -]*$/.test(part) || part.endsWith(' '))) return '';
  return raw;
}

export function safeMailto(email) {
  const value = String(email == null ? '' : email);
  return safeLinkUrl(value.toLowerCase().startsWith('mailto:') ? value : `mailto:${value}`, { mailto: true });
}

export function safeTel(phone) {
  const value = String(phone == null ? '' : phone).replace(/[\s/]/g, '');
  return safeLinkUrl(value.toLowerCase().startsWith('tel:') ? value : `tel:${value}`, { tel: true });
}

export function newWindowAttrs(value, { external = false } = {}) {
  if (!safeLinkUrl(value)) return '';
  return ` target="_blank" rel="noopener noreferrer${external ? ' external' : ''}"`;
}
