// Gemeinsames Dashboard-Chrome (Superset-Muster) — die Extraktion, die
// estate.js:152-154 lange angekündigt hat («… bis das Dashboard-Chrome in ein
// Modul extrahiert ist»). Vorher trugen dataportal.js und estate.js je eine
// wortgleiche Kopie von Menü, KPI-Kachel, Filterpanel-Hülle, Einklapp-Logik,
// Menü-Handler und Fusszeile (~120 Zeilen) — inklusive derselben DOM-ids in
// beiden Dateien. Hier steht jede davon EINMAL; die Apps behalten nur ihre
// Daten- und Chart-Logik.
//
// Klassennamen bleiben unverändert (.dash-header/.dash-grid/.filter-panel …):
// scripts/test-dashboard.mjs greppt sie, und ein Rename wäre Churn ohne
// Nutzwert (docs/design-review.md, C22).

import { copyText, shareMail } from './export.js';
import { datum } from './format.js';

// Dashboard-Toolbar-Menü. Ganzes-Dashboard-Export (PDF/Bild) bleibt eine
// simulierte Affordanz (bräuchte einen Rasterisierer); Aktualisieren/Teilen sind echt.
export const DASHBOARD_MENU = [
  { action: 'refresh', label: 'Dashboard aktualisieren' },
  { separator: true },
  { heading: 'Herunterladen' },
  { action: 'pdf', label: 'Als PDF' },
  { action: 'img', label: 'Als Bild' },
  { separator: true },
  { heading: 'Teilen' },
  { action: 'copy', label: 'Link kopieren' },
  { action: 'mail', label: 'Per E-Mail' },
];

// KPI-Kachel inkl. Delta-Pfeil + sr-only-Wort (WCAG 1.4.1: Richtung nicht nur
// über Farbe). `deltaGood` undefined = neutral (z. B. ein Zielwert), der dann
// auch nicht wie ein Erfolg aussieht.
//
// Seit dem Datenportal-Ausbau (Aug. 2026, Muster Energiedashboard Bund /
// Covid-Dashboard) zusätzlich: `delta2Label/delta2Good` als zweiter Chip
// (Vormonat UND Vorjahr — Immobilien sind saisonal, erst das Jahresdelta ist
// ehrlich), `spark` als achsenlose 24-Punkte-Miniaturlinie im Kachelfuss und
// `hint` als Stichtags-/Referenznotiz («Stand: 30.06.2026»).
const deltaChip = (C, deltaLabel, deltaGood) => `<div class="kpi__delta${
  deltaGood === true ? ' is-good' : deltaGood === false ? ' is-bad' : ''}">${
  deltaGood === undefined ? ''
    : `<span class="kpi__arrow" aria-hidden="true">${deltaGood ? '▲' : '▼'}</span>`
      + `<span class="sr-only">${deltaGood ? 'positive Entwicklung' : 'negative Entwicklung'}: </span>`
}${C.escape(deltaLabel)}</div>`;

// Achsenlose Miniaturlinie (Sparkline) — nur Verlauf + Endpunkt, bewusst ohne
// Werte/Ticks: die Zahl steht gross darüber, die Linie beantwortet «woher kommt
// sie?». Dekorativ (aria-hidden); die belastbare Reihe steht in den Diagrammen.
function sparkline(values) {
  const v = (values || []).map(Number).filter(Number.isFinite);
  if (v.length < 2) return '';
  const W = 96, H = 26, PAD = 3;
  const min = Math.min(...v), max = Math.max(...v);
  const px = (i) => PAD + (i / (v.length - 1)) * (W - 2 * PAD);
  const py = (x) => max === min ? H / 2 : H - PAD - ((x - min) / (max - min)) * (H - 2 * PAD);
  const d = v.map((x, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(x).toFixed(1)}`).join(' ');
  return `<svg class="kpi__spark" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">
    <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="${px(v.length - 1).toFixed(1)}" cy="${py(v[v.length - 1]).toFixed(1)}" r="2.5" fill="currentColor"/>
  </svg>`;
}

export function kpiTile(C, { label, value, unit = '', deltaLabel = '', deltaGood, delta2Label = '', delta2Good, spark, hint = '' } = {}) {
  return `<div class="kpi">
    <div class="kpi__label">${C.escape(label)}</div>
    <div class="kpi__value">${C.escape(value)}${unit ? `<span class="kpi__unit">${C.escape(unit)}</span>` : ''}</div>
    ${deltaLabel ? deltaChip(C, deltaLabel, deltaGood) : ''}
    ${delta2Label ? deltaChip(C, delta2Label, delta2Good) : ''}
    ${spark ? sparkline(spark) : ''}
    ${hint ? `<div class="kpi__hint">${C.escape(hint)}</div>` : ''}
  </div>`;
}

// Kopfzeile: pageHeader links, Aktionsmenü rechts. `extra` = optionales
// Zusatz-HTML unter dem Lead (z. B. der Inventar-Hinweis des Immobilien-Boards).
export function dashHeader(C, { title, lead = '', leadHtml = '', extra = '' } = {}) {
  return `<div class="dash-header">
      <div class="dash-header__text">${C.pageHeader(leadHtml ? { title, leadHtml } : { title, lead })}${extra}</div>
      ${C.menu({ menuId: 'dashboard', label: 'Dashboard-Aktionen', items: DASHBOARD_MENU })}
    </div>`;
}

// Filterpanel-Hülle (Kopf + Einklapp-Knopf); `body` ist fertiges HTML des Aufrufers.
export function filterPanelShell(C, body) {
  return `<aside class="filter-panel" id="dash-filters" aria-label="Filter">
      <div class="filter-panel__head">
        <h2 class="filter-panel__title">Filter</h2>
        <button type="button" class="filter-panel__toggle btn--bare interactive-control" id="filter-toggle" aria-label="Filter einklappen" aria-expanded="true">${C.icon('ChevronLeft', 'icon--base')}</button>
      </div>
      <div class="filter-panel__body" id="filter-body">${body}</div>
    </aside>`;
}

// Fusszeile. `sourceId` rendert die Quelle als per JS gefülltes <span> (Immobilien-
// Board wechselt sie je Tab); `updated` ist ISO und wird hier — EINMAL für beide
// Boards — über format.datum ausgegeben (vorher stand rohes «Stand: 2026-03-31»
// auf beiden Flächen, Design-Review A13).
export function dashFooter(C, { source = '', sourceId = '', updated = '' } = {}) {
  return `<footer class="dash-footer">
      <span class="meta-info__item">Quelle: ${sourceId ? `<span id="${C.escape(sourceId)}"></span>` : C.escape(source)}</span>
      ${updated ? `<span class="meta-info__item">Stand: ${C.escape(datum(updated))}</span>` : ''}
      <span class="meta-info__item">Demo-Daten</span>
    </footer>`;
}

// Item 6.13: unter lg trägt `.filter-panel--collapsed` das Einklappen (die
// Desktop-Mechanik `.dashboard-layout--collapsed` bleibt unangetastet, damit die
// filterFullHeight-Zusicherung in test-dashboard.mjs grün bleibt). Auf dem Handy
// stand sonst mehr als ein Bildschirm Checkboxen VOR der ersten Kennzahl.
// Meldet seinen matchMedia-Horcher über ctx.onUnmount ab.
export function wireFilterCollapse(ctx, mount) {
  const layout = mount.querySelector('#dashboard');
  const panel = mount.querySelector('#dash-filters');
  const toggle = mount.querySelector('#filter-toggle');
  const isDesktop = () => window.matchMedia('(min-width:1024px)').matches;
  // Unter lg standardmässig zugeklappt — wie CDs Facettenfilter und wie die
  // .catbar__panel-Schublade auf den Katalogseiten.
  if (panel && !isDesktop()) panel.classList.add('filter-panel--collapsed');
  const syncToggle = () => {
    if (!toggle) return;
    const collapsed = isDesktop()
      ? layout.classList.contains('dashboard-layout--collapsed')
      : panel.classList.contains('filter-panel--collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Filter ausklappen' : 'Filter einklappen');
    if (panel) toggle.setAttribute('aria-controls', 'dash-filters');
  };
  syncToggle();
  if (toggle) toggle.addEventListener('click', () => {
    if (isDesktop()) layout.classList.toggle('dashboard-layout--collapsed');
    else panel.classList.toggle('filter-panel--collapsed');
    syncToggle();
  });
  // Beim Verlassen der Route abmelden: der Horcher hängt an window und
  // überlebte den DOM-Tausch sonst — ein weiterer je Besuch (code-review §4).
  const mqAc = new AbortController();
  ctx.onUnmount(() => mqAc.abort());
  window.matchMedia('(min-width:1024px)').addEventListener('change', syncToggle, { signal: mqAc.signal });
}

// Toolbar-Menü-Handler: Aktualisieren (echt) · Herunterladen (Demo) · Teilen
// (echt: Zwischenablage / E-Mail). Der Kopier-Fehlschlag erscheint als ERROR-
// Toast — vorher ritt «Kopieren nicht möglich.» in beiden Boards auf dem
// Erfolgs-Standard (grüner Haken, Design-Review D5).
export function wireDashboardMenu(mount, C, { title, onRefresh } = {}) {
  C.wireMenu(mount.querySelector('.dash-header'), (action) => {
    if (action === 'refresh') { onRefresh(); C.toast('Dashboard aktualisiert.'); }
    else if (action === 'pdf') C.toast('Export als PDF — im Prototyp simuliert.');
    else if (action === 'img') C.toast('Export als Bild — im Prototyp simuliert.');
    else if (action === 'copy') copyText(location.href).then((ok) => (ok
      ? C.toast('Link kopiert.')
      : C.toast('Kopieren nicht möglich.', 'error', 'WarningCircle')));
    else if (action === 'mail') shareMail(`${title} — BBL Datenportal`, location.href);
  });
}
