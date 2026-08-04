// Grundriss als SVG — Räume einfärben, auswählen, Legende mit Σ m².
//
// WARUM SVG UND NICHT MAPLIBRE: der Referenzprototyp (tenant-portal) zeichnet
// Räume als GeoJSON-Polygone in MapLibre. Das erkauft man mit WebGL, einer
// CDN-Abhängigkeit und Weltkoordinaten für etwas, das keine Geografie ist —
// und der Kartendienst kann im Bundesnetz gesperrt sein (docs/code-review.md).
// Ein Grundriss ist eine lokale Zeichnung. Als Inline-SVG ist er
// abhängigkeitsfrei, in jeder Zoomstufe scharf, druckbar, und jeder Raum ist
// ein einzeln fokussierbares Element mit eigenem Namen für Screenreader.
//
// Das Modul ist rein: es bekommt Räume und einen Einfärbemodus und gibt HTML
// zurück. Ereignisse verdrahtet der Aufrufer (js/apps/tenancies.js).

import { escape as esc } from './components.js';
import { m2 } from './format.js';

// Einfärbemodi. `none` zeigt die reine Zeichnung — die Voreinstellung, weil ein
// Grundriss zuerst ein Plan ist und erst auf Verlangen eine Auswertung.
export const COLOR_MODES = [
  { value: 'none', label: 'Keine' },
  { value: 'use', label: 'Nutzung' },
  { value: 'sia', label: 'SIA 416' },
  { value: 've', label: 'Verwaltungseinheit' },
  { value: 'capacity', label: 'Belegung' },
];

// Die Farben liegen als CSS-Variablen im Stylesheet (--fp-*), damit Legende und
// Zeichnung dieselbe Quelle haben und ein Palettenwechsel eine Datei berührt.
// Hier stehen nur die Schlüssel; `fill` setzt `var(--fp-…)`.
const GROUP_KEY = { arbeit: 'work', zusammen: 'collab', infra: 'infra', sonder: 'special' };
const SIA_KEY = { HNF: 'hnf', NNF: 'nnf', VF: 'vf', FF: 'ff', TF: 'tf' };
// Sechs unterscheidbare Töne; mehr VE je Geschoss kommen praktisch nicht vor.
const VE_SLOTS = ['a', 'b', 'c', 'd', 'e', 'f'];
// Belegung: leer / normal / dicht — bewusst eine Ampel, weil die Aussage
// «zu dicht belegt» eine Bewertung ist und nicht bloss eine Kategorie.
const CAP_KEY = (s) => {
  if (!s.capacity) return 'none';
  const proPlatz = s.area / s.capacity;
  return proPlatz >= 12 ? 'low' : proPlatz >= 8 ? 'ok' : 'high';
};
const CAP_LABEL = { none: 'Ohne Arbeitsplätze', low: 'Grosszügig (ab 12 m²/AP)', ok: 'Standard (8–12 m²/AP)', high: 'Dicht (unter 8 m²/AP)' };

// Reihenfolge der VE-Farbzuteilung: alphabetisch, damit dieselbe VE auf jedem
// Geschoss dieselbe Farbe bekommt, solange die Menge gleich bleibt.
export function veSlots(spaces) {
  const ves = [...new Set(spaces.map((s) => s.occupierVe).filter(Boolean))].sort();
  const map = new Map();
  ves.forEach((ve, i) => map.set(ve, VE_SLOTS[i % VE_SLOTS.length]));
  return map;
}

// Füllschlüssel eines Raums im gewählten Modus — `null` = neutrale Fläche.
function fillKey(s, mode, slots) {
  if (mode === 'use') return `use-${GROUP_KEY[s.group] || 'infra'}`;
  if (mode === 'sia') return `sia-${SIA_KEY[s.sia] || 'nnf'}`;
  if (mode === 've') return s.occupierVe ? `ve-${slots.get(s.occupierVe)}` : 'unassigned';
  if (mode === 'capacity') return `cap-${CAP_KEY(s)}`;
  return null;
}

// Kategorie eines Raums im gewählten Modus: [Schlüssel, Beschriftung].
function bucket(s, mode, slots) {
  if (mode === 'use') return [s.group, s.groupLabel];
  if (mode === 'sia') return [s.sia, `${s.siaLabel} (${s.sia})`];
  if (mode === 've') return [s.occupierVe || '—', s.occupierVe || 'Nicht zugeteilt'];
  if (mode === 'capacity') { const k = CAP_KEY(s); return [k, CAP_LABEL[k]]; }
  return [null, null];
}

/* ------------------------------------------------------------- Zeichnung ---- */
// `extent` ist das Zeichnungsmass des Geschosses ([Breite, Höhe] in Einheiten
// zu 1 cm). Das SVG skaliert über die viewBox — es gibt keine Pixelmasse im
// Markup, damit der Plan auf jeder Breite und im Druck stimmt.
// Beschriftungsschwellen in ZEICHNUNGSEINHEITEN (100 = 1 m). Ein Regelbüro ist
// 360–540 Einheiten breit; bei der üblichen Darstellungsbreite entspricht das
// rund 70–110 Bildpunkten. Deshalb drei Stufen statt alles oder nichts: die
// Raumnummer passt immer, die Nutzung erst ab ~100 px, die Fläche dazwischen.
// Ohne Stufen standen entweder gar keine Beschriftungen (Schwelle zu hoch) oder
// sie überlagerten sich in den schmalen Nebenräumen.
const NR_AB = 200, FLAECHE_AB = 330, NUTZUNG_AB = 500;

export function floorplanSvg({ floor, spaces, mode = 'none', selectedId = '' }) {
  const [w, h] = floor.extent || [4000, 1440];
  const slots = veSlots(spaces);
  const pad = 40;

  const raum = (s) => {
    const [x, y, bw, bh] = s.rect;
    const key = fillKey(s, mode, slots);
    const cls = ['fp__room', `fp__room--${s.group}`, key ? `fp__room--fill` : '', selectedId === s.spaceId ? 'is-selected' : ''].filter(Boolean).join(' ');
    const cx = x + bw / 2, cy = y + bh / 2;
    const nr = s.roomNumber.replace(/^.*\s/, '');
    // Der Korridor ist flach (240 Einheiten) und trotzdem beschriftbar —
    // deshalb greift die Höhenschwelle für die Nummer tiefer als für die
    // gestapelten Zeilen darunter.
    const zeigNr = bw >= NR_AB && bh >= 200;
    const zeigFl = bw >= FLAECHE_AB && bh >= 400;
    const zeigNu = bw >= NUTZUNG_AB && bh >= 400;
    // Zeilen mittig stapeln: je nach Anzahl sichtbarer Zeilen verschiebt sich
    // der Block, damit er nicht aus dem Raum kippt.
    const zeilen = [zeigNr && ['fp__nr', nr], zeigNu && ['fp__use', s.useLabel], zeigFl && ['fp__area', m2(s.area)]].filter(Boolean);
    const dy = 78;
    const y0 = cy - ((zeilen.length - 1) * dy) / 2 + 22;
    return `<g class="${cls}" data-space="${esc(s.spaceId)}" role="listitem">
      <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="6"
        ${key ? `style="fill:var(--fp-${key})"` : ''}
        tabindex="0" role="button"
        aria-label="${esc(`${s.roomNumber}, ${s.useLabel}, ${s.area} Quadratmeter${s.occupierVe ? ', ' + s.occupierVe : ''}`)}"
        aria-pressed="${selectedId === s.spaceId ? 'true' : 'false'}"></rect>
      ${zeilen.map(([c, txt], i) => `<text class="${c}" x="${cx}" y="${y0 + i * dy}">${esc(txt)}</text>`).join('')}
    </g>`;
  };

  return `<svg class="fp" viewBox="${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}"
      role="list" aria-label="Grundriss ${esc(floor.label)} — ${spaces.length} Räume"
      preserveAspectRatio="xMidYMid meet">
    <rect class="fp__shell" x="-8" y="-8" width="${w + 16}" height="${h + 16}" rx="10"></rect>
    ${spaces.map(raum).join('')}
  </svg>`;
}

/* --------------------------------------------------------------- Legende ---- */
// Σ m² je Kategorie — die Legende ist zugleich die Auswertung des Geschosses.
// Ohne Summen wäre sie nur eine Farbtabelle; mit ihnen beantwortet sie
// «wie viel Fläche geht für Verkehr drauf?» ohne eine zweite Ansicht.
export function floorplanLegend(spaces, mode) {
  if (mode === 'none') return '';
  const slots = veSlots(spaces);
  const agg = new Map();
  for (const s of spaces) {
    const [key, label] = bucket(s, mode, slots);
    const cur = agg.get(key) || { label, area: 0, n: 0, fill: fillKey(s, mode, slots) };
    cur.area += s.area; cur.n++;
    agg.set(key, cur);
  }
  const total = [...agg.values()].reduce((n, x) => n + x.area, 0) || 1;
  const rows = [...agg.values()].sort((a, b) => b.area - a.area);
  return `<ul class="fp-legend" aria-label="Legende mit Flächenanteilen">
    ${rows.map((r) => `<li class="fp-legend__item">
      <span class="fp-legend__swatch" style="background:var(--fp-${r.fill})" aria-hidden="true"></span>
      <span class="fp-legend__label">${esc(r.label)}</span>
      <span class="fp-legend__val">${m2(Math.round(r.area))}<span class="fp-legend__pct">${Math.round(r.area / total * 100)} %</span></span>
    </li>`).join('')}
  </ul>`;
}

/* ------------------------------------------------------------ Verdrahten ---- */
// Klick und Tastatur auf den Räumen. Gibt eine Aufräumfunktion zurück; der
// Aufrufer hängt sie an ctx.onUnmount.
export function wireFloorplan(root, onSelect) {
  const ctrl = new AbortController();
  const { signal } = ctrl;
  const pick = (el) => { const g = el.closest('[data-space]'); if (g) onSelect(g.dataset.space); };
  root.addEventListener('click', (e) => pick(e.target), { signal });
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!e.target.closest('[data-space]')) return;
    e.preventDefault();
    pick(e.target);
  }, { signal });
  return () => ctrl.abort();
}

export default { COLOR_MODES, floorplanSvg, floorplanLegend, wireFloorplan, veSlots };
