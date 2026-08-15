// Eine Tabelle mitnehmen: als CSV, als Excel-Datei, oder auf Papier.
//
// Das stand im Metadaten-Katalog, obwohl nichts daran katalogspezifisch ist —
// herein geht `{ name, head, rows }`, heraus kommt eine Datei. Die
// Prozessdokumentation braucht dasselbe, und zwei Abschriften desselben
// CSV-Escapings laufen zuverlaessig auseinander.
import { escape as esc } from '../components.js';

// BOM, weil Excel UTF-8 sonst als lokale Codepage liest und jeder Umlaut falsch
// herauskommt.
const csvCell = (v) => {
  const t = String(v == null ? '' : v);
  return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};

export const toCsv = (t) => '﻿' + [t.head, ...t.rows]
  .map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';

// Excel bekommt eine HTML-Tabelle statt einer Kommadatei. Ein .csv erzwingt eine
// Annahme ueber das Trennzeichen — deutsches Excel erwartet «;», das
// Austauschformat sagt «,» — und welche man auch trifft, sie ist irgendwo
// falsch. Eine Tabelle hat kein Trennzeichen, ueber das man raten muesste.
export const toXls = (t) => '<html xmlns:x="urn:schemas-microsoft-com:office:excel">'
  + '<head><meta charset="utf-8"></head><body><table border="1"><thead><tr>'
  + t.head.map((h) => `<th>${esc(h)}</th>`).join('') + '</tr></thead><tbody>'
  + t.rows.map((row) => '<tr>' + row.map((c) => `<td>${esc(c)}</td>`).join('') + '</tr>').join('')
  + '</tbody></table></body></html>';

export const slug = (x, fallback = 'export') => String(x).toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || fallback;

export function download(name, mime, text) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Erst im naechsten Zug freigeben: synchron abgeraeumt bricht der Download in
  // manchen Browsern ab, bevor sie den Blob gelesen haben.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Die drei Wege, eine Tabelle mitzunehmen. Drucken ist Sache des Browsers, und
// sein Dialog ist auch der Ort, an dem «Als PDF sichern» wohnt — es gibt also
// keinen zweiten PDF-Pfad zu bauen und am Leben zu halten.
export function runTableExport(action, table, basename) {
  if (action === 'pdf') { window.print(); return true; }
  if (action === 'csv') {
    download(`${basename}.csv`, 'text/csv;charset=utf-8', toCsv(table));
    return true;
  }
  if (action === 'excel') {
    download(`${basename}.xls`, 'application/vnd.ms-excel;charset=utf-8', toXls(table));
    return true;
  }
  return false;
}
