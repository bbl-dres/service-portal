// Numbers, amounts, areas, dates and file sizes — one source for the entire
// portal.
//
// These five formats used to be scattered: `formatCurrency()` appeared
// identically in two apps, the date formatter existed twice with DIFFERENT
// guards (`isNaN(d)` versus `isNaN(d.getTime())`), and
// `toLocaleString('de-CH') + ' m²'` was written out by hand nine times.
//
// The inconsistency was visible in file sizes: the property inventory showed
// «4,7 MB», while the building-document archive showed «4.7 MB» for THE SAME
// file. The inventory version actively replaced the decimal point with a comma,
// producing German notation in a Swiss product; `de-CH` uses the decimal point
// and apostrophe as the thousands separator. From here on,
// `toLocaleString('de-CH')` is authoritative throughout.

const LOC = 'de-CH';

/** 1234567 → «1'234'567» */
export const formatNumber = (x) => Number(x || 0).toLocaleString(LOC);

/** 1920000 → «CHF 1'920'000» */
export const formatCurrency = (x, currency = 'CHF') => `${currency} ${formatNumber(x)}`;

/** 1180 → «1'180 m²» */
export const formatArea = (x) => `${formatNumber(x)} m²`;

/**
 * ISO date → «31.3.2034». Empty values become an em dash; unreadable values
 * pass through unchanged — a broken raw value is more useful as such than as
 * «Invalid Date».
 */
export const formatDate = (iso) => {
  if (!iso) return '—';
  const calendar = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (calendar) {
    const [, yearText, monthText, dayText] = calendar;
    const year = Number(yearText), month = Number(monthText), day = Number(dayText);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
      return String(iso);
    }
    // A date-only value is a calendar date, not a UTC instant. Formatting its
    // numeric parts directly prevents western time zones from showing yesterday.
    return `${day}.${month}.${year}`;
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString(LOC);
};

/** 4820 → «4.7 MB», 512 → «512 KB» */
export const formatFileSize = (kb) => {
  if (kb == null) return '';
  const n = Number(kb) || 0;
  return n >= 1024
    ? `${(n / 1024).toLocaleString(LOC, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`
    : `${formatNumber(n)} KB`;
};

export default { formatNumber, formatCurrency, formatArea, formatDate, formatFileSize };
