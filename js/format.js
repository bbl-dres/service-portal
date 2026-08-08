// Zahlen, Beträge, Flächen, Daten und Dateigrössen — eine Quelle fürs ganze
// Portal.
//
// Vorher lagen diese fünf Formate verstreut: `chf()` stand zeichengleich in
// zwei Apps, der Datumsformatierer zweimal mit UNTERSCHIEDLICHER Wache
// (`isNaN(d)` gegen `isNaN(d.getTime())`), und `toLocaleString('de-CH') + ' m²'`
// war neunmal von Hand ausgeschrieben.
//
// Sichtbar wurde die Streuung bei den Dateigrössen: das Liegenschafteninventar
// schrieb «4,7 MB», das Bauwerksdokumenten-Archiv «4.7 MB» — für DIESELBE
// Datei. Die Inventar-Fassung ersetzte den Punkt aktiv durch ein Komma und
// erzeugte damit eine deutsche Schreibweise in einem Schweizer Produkt; `de-CH`
// setzt den Dezimalpunkt und das Apostroph als Tausendertrennung.
// Massgebend ist ab hier durchgängig `toLocaleString('de-CH')`.

const LOC = 'de-CH';

/** 1234567 → «1'234'567» */
export const num = (x) => Number(x || 0).toLocaleString(LOC);

/** 1920000 → «CHF 1'920'000» */
export const chf = (x, currency = 'CHF') => `${currency} ${num(x)}`;

/** 1180 → «1'180 m²» */
export const m2 = (x) => `${num(x)} m²`;

/**
 * ISO-Datum → «31.3.2034». Leere Werte werden zum Gedankenstrich, unlesbare
 * Werte unverändert durchgereicht — eine kaputte Rohangabe ist als solche
 * nützlicher denn als «Invalid Date».
 */
export const datum = (iso) => {
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
export const dateiGroesse = (kb) => {
  if (kb == null) return '';
  const n = Number(kb) || 0;
  return n >= 1024
    ? `${(n / 1024).toLocaleString(LOC, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`
    : `${num(n)} KB`;
};

export default { num, chf, m2, datum, dateiGroesse };
