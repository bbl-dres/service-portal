// Suchprotokoll — der einzige Weg, die Frage «wonach suchen die Leute?»
// dauerhaft zu beantworten. Die Suchüberarbeitung musste sie mit
// Stellvertretern beantworten (Fusszeilen-Kurzwahl der Altplattform,
// Dokumentenmasse im Export, `popular`-Ränge), weil es keinerlei Telemetrie
// gibt (docs/search-review.md §2).
//
// BEWUSST KLEIN GEHALTEN: nur der Suchbegriff und die Trefferzahl, nur im
// localStorage des eigenen Geräts, kein Backend, keine Kennung, keine
// Verknüpfung mit der Anmeldung. Damit ist es kein Tracking, sondern ein
// Notizblock — und für die Priorisierung reicht genau das: nach zwei Wochen
// Pilotbetrieb weiss man, welche Begriffe ins Leere laufen.
//
// Einsehbar unter #/search?log=1.

const KEY = 'bbl.searchlog';
const MAX = 200;

const read = () => {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
};

// Aufeinanderfolgende Tastendrücke auf demselben Begriff sollen nicht 20 Zeilen
// erzeugen: derselbe Begriff direkt nacheinander aktualisiert den letzten
// Eintrag, statt einen neuen anzulegen.
export function record(q, hits) {
  const term = String(q || '').trim();
  if (!term) return;
  try {
    const log = read();
    const last = log[log.length - 1];
    if (last && last.q === term) { last.n = hits; last.at = Date.now(); }
    else log.push({ q: term, n: hits, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(log.slice(-MAX)));
  } catch { /* privater Modus oder volles Kontingent — das Protokoll ist entbehrlich */ }
}

// Ausgewertet: je Begriff die Häufigkeit und die zuletzt gemessene Trefferzahl,
// Nulltreffer zuerst — das ist die Arbeitsliste.
export function summary() {
  const by = new Map();
  for (const e of read()) {
    const k = e.q.toLowerCase();
    const cur = by.get(k) || { q: e.q, count: 0, hits: e.n, at: e.at };
    cur.count++; cur.hits = e.n; cur.at = e.at;
    by.set(k, cur);
  }
  const rows = [...by.values()].sort((a, b) =>
    (a.hits === 0 ? 0 : 1) - (b.hits === 0 ? 0 : 1) || b.count - a.count || b.at - a.at);
  return { rows, total: read().length, zero: rows.filter((r) => r.hits === 0).length };
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* egal */ }
}
