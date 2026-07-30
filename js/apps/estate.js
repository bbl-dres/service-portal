// Immobilienportfolio — record-based Stammdaten dashboard (Gebäude · Grundstücke ·
// Bodenbedeckung). Loads the three GeoJSON master-data files, applies the global
// multi-select dimension filters (Land · Region · Gebäudetyp · Eigentum · Status)
// and aggregates the charts at runtime, reusing the shared dashboard chrome and SVG
// chart renderer. The map is worldwide CARTO grey with clustering; its popups link
// into the Liegenschaften-Inventar app by bbl_id. Filter changes update only the
// content (KPIs · charts · map · source) so the filter panel keeps focus/scroll.

import { fetchJSON } from '../fetch-json.js';
import { chart, wireCharts, wireChartMenus, paintCharts } from '../charts.js';
import { initEstateMap } from '../buildings-map.js';
import { createMapSlot } from '../map-slot.js';
import { copyText, shareMail } from '../export.js';

const CRUMB_BASE = [
  { label: 'Startseite', href: '#/' },
  { label: 'Daten und Digitalisierung', href: '#/data' },
  { label: 'Datenportal', href: '#/app/dataportal' },
];
const META = {
  title: 'Immobilienportfolio',
  lead: 'Überblick über die Immobilien-Stammdaten des BBL — Gebäude, Grundstücke und Bodenbedeckung des weltweiten Portfolios.',
  updated: '2026-03-18',
};
// Quelle je nach angezeigten Daten (SAP RE-FX = Golden Record der Stammdaten,
// GIS IMMO = amtliche Vermessung / Bodenbedeckung).
const SOURCE = { gebaeude: 'SAP RE-FX (Stammdaten · Golden Record)', grundstuecke: 'SAP RE-FX (Stammdaten · Golden Record)', bodenbedeckung: 'GIS IMMO (amtliche Vermessung)' };
// Deeplink-Ziel für die Karte und den Lead-Hinweis: die App selbst (nicht die
// Anwendungs-Landingpage), damit ?id=<bbl_id> direkt das Objekt öffnet.
const INVENTORY = '#/app/portfolio';
const TABS = [
  { id: 'gebaeude', label: 'Gebäude' },
  { id: 'grundstuecke', label: 'Grundstücke' },
  { id: 'bodenbedeckung', label: 'Bodenbedeckung' },
];
const DASHBOARD_MENU = [
  { action: 'refresh', label: 'Dashboard aktualisieren' },
  { separator: true }, { heading: 'Herunterladen' },
  { action: 'pdf', label: 'Als PDF' }, { action: 'img', label: 'Als Bild' },
  { separator: true }, { heading: 'Teilen' },
  { action: 'copy', label: 'Link kopieren' }, { action: 'mail', label: 'Per E-Mail' },
];
const ownership = (v) => (v === 'Eigentum Bund' ? 'Im Eigentum' : v === 'Miete' ? 'Anmieter' : 'Sonderfall');
const EIGEN_ORDER = ['Im Eigentum', 'Anmieter', 'Sonderfall'];
const STATUS_ORDER = ['Aktiv', 'Abgang', 'Löschvermerk'];
const LC_LABEL = { Gebaeude: 'Gebäude', befestigt: 'Befestigt', humusiert: 'Humusiert (grün)', Gewaesser: 'Gewässer' };
// filter dimension → record field
const FIELD = { land: 'land', region: 'region', typ: 'typ', eigentum: 'ownership', status: 'status' };
const FILTER_KEYS = ['land', 'region', 'typ', 'eigentum', 'status'];

let CACHE = null;
async function loadData() {
  if (CACHE) return CACHE;
  const [b, p, l] = await Promise.all([
    fetchJSON('data/buildings.geojson', { shape: 'object' }),
    fetchJSON('data/parcels.geojson', { shape: 'object' }),
    fetchJSON('data/landcovers.geojson', { shape: 'object' }),
  ]);
  const props = (g) => (g.features || []).map((f) => f.properties || {});
  const buildings = props(b).map((x) => ({
    land: x.adr_land, region: x.adr_reg, ort: x.adr_ort, ownership: ownership(x.bbl_eigen),
    portfolio: x.bbl_port, typ: x.bbl_gbda1, status: x.bbl_stat, gf: Number(x.garea_gf) || 0,
    lat: Number(x.wgs84_lat), lon: Number(x.wgs84_lon), label: x.bbl_bez, sub: x.adr_conct, id: x.bbl_id,
  }));
  const parcels = (p.features || []).map((f) => { const x = f.properties || {}; return {
    land: x.adr_land, region: x.adr_reg, ownership: ownership(x.bbl_eigen), portfolio: x.bbl_port,
    status: x.bbl_stat, gsf: Number(x.larea_gsf) || 0, id: x.bbl_id, label: x.bbl_bez,
    sub: x.adr_conct, geom: f.geometry,   // Polygon-Geometrie für die Kartenanzeige behalten
  }; });
  const landcovers = props(l).map((x) => ({
    type: x.av_type, label: LC_LABEL[x.av_type] || x.av_type, area: Number(x.lc_area) || 0, parcelId: x.bbl_id,
  }));
  CACHE = { buildings, parcels, landcovers };
  return CACHE;
}

// --- aggregation helpers ---------------------------------------------------
const CH = (n) => Math.round(n).toLocaleString('de-CH');
const uniq = (arr, k) => [...new Set(arr.map((x) => x[k]).filter(Boolean))];
const sumBy = (arr, k) => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);
const pctOf = (n, d) => (d ? Math.round((n / d) * 100) : 0);
function groupSum(recs, key, valKey, order) {
  const m = new Map();
  for (const r of recs) m.set(r[key], (m.get(r[key]) || 0) + (Number(r[valKey]) || 0));
  const a = [...m].map(([k, v]) => ({ k, v }));
  return order ? a.sort((x, y) => order.indexOf(x.k) - order.indexOf(y.k)) : a.sort((x, y) => y.v - x.v);
}
function groupCount(recs, key, order) {
  const m = new Map();
  for (const r of recs) m.set(r[key], (m.get(r[key]) || 0) + 1);
  const a = [...m].map(([k, v]) => ({ k, v }));
  return order ? a.sort((x, y) => order.indexOf(x.k) - order.indexOf(y.k)) : a.sort((x, y) => y.v - x.v);
}
const histogram = (recs, valKey, bins) => bins.map((bn) => ({ k: bn.label, v: recs.filter((r) => { const v = Number(r[valKey]) || 0; return v >= bn.lo && v < bn.hi; }).length }));
const GF_BINS = [{ label: '< 2 500', lo: 0, hi: 2500 }, { label: '2 500–5 000', lo: 2500, hi: 5000 }, { label: '5 000–10 000', lo: 5000, hi: 10000 }, { label: '10 000–20 000', lo: 10000, hi: 20000 }, { label: '≥ 20 000', lo: 20000, hi: Infinity }];
const GSF_BINS = [{ label: '< 1 000', lo: 0, hi: 1000 }, { label: '1 000–3 000', lo: 1000, hi: 3000 }, { label: '3 000–5 000', lo: 3000, hi: 5000 }, { label: '≥ 5 000', lo: 5000, hi: Infinity }];

// Kein `needs`: diese Ansicht holt buildings/parcels/landcovers selbst (siehe
// CACHE weiter oben) und liest sie nicht über die core-Accessoren.

export default async function render(ctx) {
  const { mount, C, setTitle, setCrumbs, query } = ctx;
  setTitle(META.title);
  setCrumbs([...CRUMB_BASE, { label: META.title }]);

  let data;
  try {
    data = await loadData();
    if (ctx.stale && ctx.stale()) return;
  } catch (e) {
    // Über C.notification statt von Hand: die handgebaute Fassung hatte kein
    // `.notification__content`, also weder die Textbreitenbegrenzung noch die
    // Live-Region, die eine erst nach dem Laden eintreffende Meldung braucht.
    mount.innerHTML = `<div class="container section">${C.notification(
      `<strong>Die Immobilien-Stammdaten konnten nicht geladen werden.</strong><br><span class="small">${C.escape(e.message)}</span>`,
      'error', 'WarningCircle', { live: true })}</div>`;
    return;
  }

  const bp = [...data.buildings, ...data.parcels];
  const OPTS = {
    land: uniq(bp, 'land').sort(),
    region: uniq(bp, 'region').sort(),
    typ: uniq(data.buildings, 'typ').sort(),
    eigentum: EIGEN_ORDER,
    status: STATUS_ORDER.filter((s) => uniq(bp, 'status').includes(s)),
  };
  const state = {
    tab: TABS.some((t) => t.id === query.get('tab')) ? query.get('tab') : 'gebaeude',
    land: split(query.get('land')), region: split(query.get('region')), typ: split(query.get('typ')),
    eigentum: split(query.get('eigentum')), status: split(query.get('status')),
  };

  // --- filtering (each dimension: empty selection = all) ---
  const inSel = (sel, val) => !sel.length || sel.includes(val);
  const passB = (b) => FILTER_KEYS.every((k) => inSel(state[k], b[FIELD[k]]));
  const passP = (p) => ['land', 'region', 'eigentum', 'status'].every((k) => inSel(state[k], p[FIELD[k]]));
  const fB = () => data.buildings.filter(passB);
  const fP = () => data.parcels.filter(passP);
  const fL = () => { const ids = new Set(fP().map((p) => p.id)); return data.landcovers.filter((l) => ids.has(l.parcelId)); };

  // `chart()` gibt das Feld leer aus; die Breite ist erst nach dem Einsetzen
  // bekannt. Spec + Ergebnis hier mitschreiben, damit paintCharts sie im zweiten,
  // synchronen Durchgang nachschlagen kann (Item 6.1).
  const chartData = new Map();
  const gchart = (id, title, groups, { x, y, unit = '', form = 'barH' }) => {
    const spec = { id, title, form, unit, x, y };
    const result = { rows: groups.map((g) => ({ [x]: g.k, [y]: g.v })), columns: [x, y] };
    chartData.set(id, { spec, result });
    return chart(spec, result);
  };
  const kpi = (label, value, unit, delta) => `<div class="kpi">
    <div class="kpi__label">${C.escape(label)}</div>
    <div class="kpi__value">${C.escape(value)}${unit ? `<span class="kpi__unit">${C.escape(unit)}</span>` : ''}</div>
    ${delta ? `<div class="kpi__delta">${C.escape(delta)}</div>` : ''}</div>`;
  const mapFigure = () => `<figure class="chart card card--universal chart--map" id="estate-map">
    <figcaption class="chart__head"><h3 class="chart__title">Standorte weltweit</h3>
      <div class="chart__actions">${C.menu({ menuId: 'estate-map', label: 'Karten-Aktionen', items: [
        { action: 'fullscreen', label: 'Vollbild' },
        { separator: true }, { heading: 'Herunterladen' },
        { action: 'png', label: 'Als Bild (PNG)' },
        { separator: true }, { action: 'link', label: 'Link kopieren' },
      ] })}</div>
    </figcaption>
    <div class="dash-map" id="estate-map-el" role="group" aria-label="Weltkarte der Gebäudestandorte"><p class="dash-map__loading" role="status">Karte wird geladen …</p></div>
  </figure>`;

  // --- per-tab content: { kpis[], figures[] (HTML), source } ---
  function tabContent() {
    if (state.tab === 'grundstuecke') {
      const P = fP();
      const eigen = groupCount(P, 'ownership', EIGEN_ORDER);
      return {
        source: SOURCE.grundstuecke,
        kpis: [
          kpi('Grundstücke', CH(P.length)),
          kpi('Grundstücksfläche', CH(sumBy(P, 'gsf')), 'm²'),
          kpi('Ø Fläche', CH(P.length ? sumBy(P, 'gsf') / P.length : 0), 'm²'),
          kpi('Im Eigentum', String(pctOf(P.filter((p) => p.ownership === 'Im Eigentum').length, P.length)), '%'),
        ],
        figures: [
          gchart('p-eigen', 'Grundstücke nach Eigentumsverhältnis', eigen, { x: 'Eigentum', y: 'Anzahl', form: 'pie' }),
          gchart('p-port', 'Grundstücksfläche nach Portfolio', groupSum(P, 'portfolio', 'gsf'), { x: 'Portfolio', y: 'Fläche', unit: 'm²' }),
          gchart('p-land', 'Grundstücke nach Land', groupCount(P, 'land'), { x: 'Land', y: 'Anzahl' }),
          gchart('p-dist', 'Verteilung Grundstücksfläche', histogram(P, 'gsf', GSF_BINS), { x: 'Fläche (m²)', y: 'Anzahl', form: 'column' }),
        ],
      };
    }
    if (state.tab === 'bodenbedeckung') {
      const L = fL();
      const total = sumBy(L, 'area');
      const areaOf = (t) => sumBy(L.filter((x) => x.type === t), 'area');
      const versiegelt = areaOf('Gebaeude') + areaOf('befestigt');
      const gruen = areaOf('humusiert') + areaOf('Gewaesser');
      return {
        source: SOURCE.bodenbedeckung,
        kpis: [
          kpi('Bodenbedeckung', CH(total), 'm²'),
          kpi('Anteil bebaut', String(pctOf(areaOf('Gebaeude'), total)), '%'),
          kpi('Anteil versiegelt', String(pctOf(versiegelt, total)), '%'),
          kpi('Anteil grün', String(pctOf(gruen, total)), '%'),
        ],
        figures: [
          gchart('l-typ', 'Bodenbedeckung nach Typ', groupSum(L, 'label', 'area'), { x: 'Typ', y: 'Fläche', unit: 'm²' }),
          gchart('l-vers', 'Versiegelung vs. Grünfläche', [{ k: 'Versiegelt', v: versiegelt }, { k: 'Grünfläche', v: gruen }], { x: 'Kategorie', y: 'Fläche', unit: 'm²', form: 'column' }),
        ],
      };
    }
    const B = fB();
    return {
      source: SOURCE.gebaeude,
      kpis: [
        kpi('Gebäude', CH(B.length)),
        kpi('Geschossfläche', CH(sumBy(B, 'gf')), 'm²'),
        kpi('Ø Geschossfläche', CH(B.length ? sumBy(B, 'gf') / B.length : 0), 'm²'),
        kpi('Im Eigentum', String(pctOf(B.filter((b) => b.ownership === 'Im Eigentum').length, B.length)), '%'),
      ],
      figures: [
        mapFigure(),
        gchart('b-eigen', 'Gebäude nach Eigentumsverhältnis', groupCount(B, 'ownership', EIGEN_ORDER), { x: 'Eigentum', y: 'Anzahl', form: 'pie' }),
        gchart('b-port', 'Geschossfläche nach Portfolio', groupSum(B, 'portfolio', 'gf'), { x: 'Portfolio', y: 'Fläche', unit: 'm²' }),
        gchart('b-land', 'Gebäude nach Land', groupCount(B, 'land'), { x: 'Land', y: 'Anzahl' }),
        gchart('b-dist', 'Verteilung Geschossfläche', histogram(B, 'gf', GF_BINS), { x: 'Fläche (m²)', y: 'Anzahl', form: 'column' }),
        gchart('b-typ', 'Gebäude nach Gebäudetyp', groupCount(B, 'typ'), { x: 'Gebäudetyp', y: 'Anzahl' }),
      ],
    };
  }

  const mapPoints = () => fB().map((b) => ({
    lat: b.lat, lon: b.lon, label: b.label, sub: b.sub, bblId: b.id,
    href: `${INVENTORY}?id=${encodeURIComponent(b.id)}`,
  }));

  // Parcel polygons for the map (shown only at close zoom). Matched to their
  // building via the WE segment of the bbl_id (1080/4840/01 ↔ 1080/4840/AF) so the
  // popup deep-links to the object in the Liegenschaften Inventar.
  const weOf = (id) => String(id || '').split('/')[1] || '';
  const bldByWe = {};
  for (const b of data.buildings) bldByWe[weOf(b.id)] = b.id;
  const parcelFC = () => ({
    type: 'FeatureCollection',
    features: fP().filter((p) => p.geom).map((p) => ({
      type: 'Feature', geometry: p.geom,
      properties: {
        label: p.label || p.id, sub: p.sub || '', id: p.id, area: p.gsf,
        href: bldByWe[weOf(p.id)] ? `${INVENTORY}?id=${encodeURIComponent(bldByWe[weOf(p.id)])}` : INVENTORY,
      },
    })),
  });

  // Long option lists stay compact: show the first 5, the rest behind «Alle
  // anzeigen». Overflow rows carry .filter-check--more (hidden until expanded).
  const FILTER_MAX = 5;
  const fGroup = (key, label) => {
    const opts = OPTS[key];
    const many = opts.length > FILTER_MAX;
    const rows = opts.map((o, i) => `<label class="filter-check${many && i >= FILTER_MAX ? ' filter-check--more' : ''}"><input type="checkbox" data-dim="${key}" value="${C.escape(o)}"${state[key].includes(o) ? ' checked' : ''}><span>${C.escape(o)}</span></label>`).join('');
    return `<fieldset class="filter-group">
      <legend class="filter-group__legend">${C.escape(label)}</legend>
      ${rows}
      ${many ? `<button type="button" class="filter-group__more" data-more data-count="${opts.length}" aria-expanded="false">Alle anzeigen (${opts.length})</button>` : ''}
    </fieldset>`;
  };

  let unpaint = null;   // Aufräumer des ResizeObserver aus paintCharts
  const mapSlot = createMapSlot();   // Besitz/Abbau: js/map-slot.js
  ctx.onUnmount(mapSlot.free);

  const syncHash = () => {
    const qs = new URLSearchParams();
    if (state.tab !== TABS[0].id) qs.set('tab', state.tab);
    for (const k of FILTER_KEYS) if (state[k].length) qs.set(k, state[k].join(','));
    const s = qs.toString();
    history.replaceState(null, '', `#/app/dataportal/immobilien${s ? '?' + s : ''}`);
  };

  // --- content update (KPIs · charts · map · source); filter panel persists ---
  function update() {
    chartData.clear();                 // Specs des vorigen Durchgangs verwerfen
    const { kpis, figures, source } = tabContent();
    mount.querySelector('#dash-kpis').innerHTML = kpis.join('');
    const grid = mount.querySelector('#dash-grid');
    grid.innerHTML = figures.join('');
    mount.querySelector('#dash-source').textContent = source;
    // Zweiter, synchroner Durchgang mit gemessener Breite (Item 6.1).
    if (unpaint) unpaint();
    unpaint = paintCharts(grid, (id) => chartData.get(id));
    wireCharts(grid);
    wireChartMenus(grid);
    mapSlot.free();
    if (state.tab === 'gebaeude') {
      const el = grid.querySelector('#estate-map-el');
      if (el) mapSlot.mount(el, (node) => initEstateMap(node, mapPoints(), parcelFC()));
    }
  }

  // --- full chrome, rendered once ---
  mount.innerHTML = `
  <div class="container section dash-page">
    ${C.backLink('#/app/dataportal', 'Datenportal')}
    <div class="dash-header">
      <div class="dash-header__text">
        ${C.pageHeader({ title: META.title, lead: META.lead })}
        <p class="small muted lead-hint">Detaillierte Objektinformationen und Bewirtschaftung im <a href="${INVENTORY}" target="_blank" rel="noopener">Liegenschaften Inventar</a>.</p>
      </div>
      ${C.menu({ menuId: 'dashboard', label: 'Dashboard-Aktionen', items: DASHBOARD_MENU })}
    </div>
    <div class="dashboard-layout" id="dashboard">
      <aside class="filter-panel" id="dash-filters" aria-label="Filter">
        <div class="filter-panel__head"><h2 class="filter-panel__title">Filter</h2>
          <button type="button" class="filter-panel__toggle btn--bare" id="filter-toggle" aria-label="Filter einklappen" aria-expanded="true">${C.icon('ChevronLeft', 'icon--base')}</button></div>
        <div class="filter-panel__body" id="filter-body">
          ${fGroup('land', 'Land')}${fGroup('region', 'Region / Kanton')}${fGroup('typ', 'Gebäudetyp')}${fGroup('eigentum', 'Eigentumsverhältnis')}${fGroup('status', 'Status')}
          <div class="filter-panel__actions"><button type="button" class="btn btn--bare btn--sm mt-2" id="f-reset">${C.icon('Refresh', 'icon--base')}<span class="btn__text">Zurücksetzen</span></button></div>
        </div>
      </aside>
      <div class="dashboard-main">
        ${C.tabBar({ items: TABS, active: state.tab, idPrefix: 'estate-tab', panelId: 'dpanel', ariaLabel: 'Stammdaten-Ansichten' })}
        <div class="tab__container" role="tabpanel" id="dpanel" aria-labelledby="estate-tab-${state.tab}" tabindex="0">
          <h2 class="sr-only">Kennzahlen</h2><div class="kpi-row" id="dash-kpis"></div>
          <h2 class="sr-only">Auswertungen</h2><div class="dash-grid" id="dash-grid"></div>
        </div>
      </div>
    </div>
    <footer class="dash-footer">
      <span class="meta-info__item">Quelle: <span id="dash-source"></span></span>
      <span class="meta-info__item">Stand: ${C.escape(META.updated)}</span>
      <span class="meta-info__item">Demo-Daten</span>
    </footer>
  </div>`;

  // --- wiring (once) ---
  const filterBody = mount.querySelector('#filter-body');
  filterBody.addEventListener('change', (e) => {
    const cb = e.target.closest('input[type="checkbox"][data-dim]');
    if (!cb) return;
    const dim = cb.dataset.dim, val = cb.value;
    if (cb.checked) { if (!state[dim].includes(val)) state[dim].push(val); }
    else state[dim] = state[dim].filter((x) => x !== val);
    syncHash(); update();
  });
  // «Alle anzeigen / Weniger anzeigen» — expand a capped option list in place.
  filterBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-more]');
    if (!btn) return;
    const open = btn.closest('.filter-group').classList.toggle('filter-group--expanded');
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Weniger anzeigen' : `Alle anzeigen (${btn.dataset.count})`;
  });
  mount.querySelector('#f-reset').addEventListener('click', () => {
    FILTER_KEYS.forEach((k) => { state[k] = []; });
    filterBody.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = false; });
    syncHash(); update();
  });
  C.wireTabs(mount, { onSelect: (id) => { state.tab = id; syncHash(); update(); } });
  // Item 6.13 — identisch zu dataportal.js: unter lg klappt das PANEL, ab lg die
  // Layoutspalte. Fünf Facettengruppen sind auf dem Handy sonst eine Wand.
  const layout = mount.querySelector('#dashboard');
  const panel = mount.querySelector('#dash-filters');
  const toggle = mount.querySelector('#filter-toggle');
  const isDesktop = () => window.matchMedia('(min-width:1024px)').matches;
  if (panel && !isDesktop()) panel.classList.add('filter-panel--collapsed');
  const syncToggle = () => {
    if (!toggle) return;
    const collapsed = isDesktop()
      ? layout.classList.contains('dashboard-layout--collapsed')
      : panel.classList.contains('filter-panel--collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Filter ausklappen' : 'Filter einklappen');
    if (panel) toggle.setAttribute('aria-controls', panel.id || 'dash-filters');
  };
  syncToggle();
  toggle.addEventListener('click', () => {
    if (isDesktop()) layout.classList.toggle('dashboard-layout--collapsed');
    else panel.classList.toggle('filter-panel--collapsed');
    syncToggle();
  });
  // Beim Verlassen der Route abmelden: der Horcher hängt an window und
  // überlebte den DOM-Tausch sonst — ein weiterer je Besuch (code-review §4).
  const mqAc = new AbortController();
  ctx.onUnmount(() => mqAc.abort());
  window.matchMedia('(min-width:1024px)').addEventListener('change', syncToggle, { signal: mqAc.signal });
  C.wireMenu(mount.querySelector('.dash-header'), (action) => {
    if (action === 'refresh') { update(); C.toast('Dashboard aktualisiert.'); }
    else if (action === 'pdf') C.toast('Export als PDF — im Prototyp simuliert.');
    else if (action === 'img') C.toast('Export als Bild — im Prototyp simuliert.');
    else if (action === 'copy') copyText(location.href).then((ok) => C.toast(ok ? 'Link kopiert.' : 'Kopieren nicht möglich.'));
    else if (action === 'mail') shareMail(`${META.title} — BBL Datenportal`, location.href);
  });

  update();
}

function split(v) { return (v || '').split(',').map((s) => s.trim()).filter(Boolean); }
