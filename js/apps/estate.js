// Property dashboard with runtime aggregation, global filters and map output.

import { dashData } from '../core/dashboard-data.js';
import { chart, wireCharts, wireChartMenus, paintCharts } from '../ui/charts.js';
import { initEstateMap } from '../map/buildings-map.js';
import { createMapSlot } from '../map/map-slot.js';
import { kpiTile, dashHeader, filterPanelShell, dashFooter, wireFilterCollapse, wireDashboardMenu } from '../ui/dashboard-chrome.js';
import { DATA } from '../crumbs.js';
import { formatNumber } from '../format.js';
import { businessEntityIdFromBblId } from '../domain.js';

const META = {
  title: 'Immobilienportfolio',
  lead: 'Überblick über die Immobilien-Stammdaten des BBL — Gebäude, Grundstücke und Bodenbedeckung des weltweiten Portfolios.',
  updated: '2026-03-18',
};

const SOURCE = {
  buildings: 'SAP RE-FX (Stammdaten · Golden Record)', parcels: 'SAP RE-FX (Stammdaten · Golden Record)',
  landcover: 'GIS IMMO (amtliche Vermessung)',
  development: 'SAP RE-FX — Jahres- und Monatsstände (Demo-Zeitreihe) · Verträge: SAP RE-FX',
};

const INVENTORY = '#/app/portfolio';
const ESTATE_NEEDS = ['buildings', 'parcels', 'landcovers', 'contracts'];
const REQUIRED_DATA = ESTATE_NEEDS.slice(0, 3);
// German tab/query values remain stable public-link compatibility literals.
const TAB_BY_LEGACY_VALUE = { 'gebaeude': 'buildings', 'grundstuecke': 'parcels', 'bodenbedeckung': 'landcover', 'entwicklung': 'development' };
const LEGACY_VALUE_BY_TAB = Object.fromEntries(Object.entries(TAB_BY_LEGACY_VALUE).map(([legacy, tab]) => [tab, legacy]));
const TABS = [
  { id: 'buildings', label: 'Gebäude' },
  { id: 'parcels', label: 'Grundstücke' },
  { id: 'landcover', label: 'Bodenbedeckung' },

  { id: 'development', label: 'Entwicklung' },
];
const OWNERSHIP_ORDER = ['Im Eigentum', 'Anmieter', 'Sonderfall'];
const STATUS_ORDER = ['Aktiv', 'Abgang', 'Löschvermerk'];
const LANDCOVER_LABEL = { 'Gebaeude': 'Gebäude', 'befestigt': 'Befestigt', 'humusiert': 'Humusiert (grün)', 'Gewaesser': 'Gewässer' };

const FIELD = { country: 'country', region: 'region', buildingType: 'buildingType', ownership: 'ownership', status: 'status' };
const FILTER_KEYS = ['country', 'region', 'buildingType', 'ownership', 'status'];
const FILTER_QUERY_KEYS = { country: 'land', region: 'region', buildingType: 'typ', ownership: 'eigentum', status: 'status' };

const objectAddress = (item) => [item.street, [item.zip, item.city].filter(Boolean).join(' ')]
  .filter(Boolean).join(', ');

// The core owns fetching, validation, caching and failure reporting. This view
// only adapts its canonical records to the compact names used by the charts.
function dashboardRecords(core) {
  const buildings = core.buildings().map((item) => ({
    country: item.country,
    region: item.canton,
    location: item.city,
    ownership: item.ownership,
    portfolio: item.portfolioCategory,
    buildingType: item.buildingType,
    status: item.status,
    gf: Number(item.gf) || 0,
    lat: Number(item.lat),
    lon: Number(item.lng),
    label: item.name,
    sub: objectAddress(item),
    id: item.bbl_id,
  }));
  const parcels = core.parcels().map((item) => ({
    country: item.country,
    region: item.canton,
    ownership: item.ownership,
    portfolio: item.portfolio,
    status: item.status,
    gsf: Number(item.gsf) || 0,
    id: item.bbl_id,
    label: item.name,
    sub: objectAddress(item),
    geom: item.geom,
  }));
  const landcovers = core.landcovers().map((item) => ({
    type: item.type,
    label: LANDCOVER_LABEL[item.type] || item.type,
    area: Number(item.area) || 0,
    parcelId: item.parcelId,
  }));
  const contracts = core.contracts().map((item) => ({
    validUntil: item.validUntil || '',
    type: item.type || '',
    status: item.status || '',
  }));
  return { buildings, parcels, landcovers, contracts };
}

const formatRoundedNumber = (n) => formatNumber(Math.round(n));
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

export default async function render(ctx) {
  const { mount, core, C, setTitle, setCrumbs, query } = ctx;
  setTitle(META.title);
  setCrumbs([...DATA, { label: 'Datenportal', href: '#/app/dataportal' }, { label: META.title }]);

  let data;
  try {
    await core.ensure(ESTATE_NEEDS);
    if (ctx.stale && ctx.stale()) return;
    const unavailable = REQUIRED_DATA.filter((key) => !core.available(key));
    if (unavailable.length) {
      throw new Error(`Nicht verfügbare Datenbestände: ${unavailable.join(', ')}`);
    }
    data = dashboardRecords(core);
    if (!dashData.ok()) await dashData.load();
    if (ctx.stale && ctx.stale()) return;
  } catch (e) {
    if (ctx.stale && ctx.stale()) return;

    mount.innerHTML = `<div class="container section">
      <div class="page-header"><h1 tabindex="-1">${C.escape(META.title)}</h1></div>
      ${C.notificationHtml(
      `<strong>Die Immobilien-Stammdaten konnten nicht geladen werden.</strong><br><span class="small">${C.escape(e.message)}</span>`,
      'error', 'WarningCircle', { live: true })}</div>`;
    return;
  }

  const bp = [...data.buildings, ...data.parcels];
  const FILTER_OPTIONS = {
    country: uniq(bp, 'country').sort(),
    region: uniq(bp, 'region').sort(),
    buildingType: uniq(data.buildings, 'buildingType').sort(),
    ownership: OWNERSHIP_ORDER,
    status: STATUS_ORDER.filter((s) => uniq(bp, 'status').includes(s)),
  };
  const state = {
    tab: TAB_BY_LEGACY_VALUE[query.get('tab')] || 'buildings',
    country: split(query.get('land')), region: split(query.get('region')), buildingType: split(query.get('typ')),
    ownership: split(query.get('eigentum')), status: split(query.get('status')),

    granularity: query.get('gran') === 'monat' ? 'monat' : 'jahr',
  };

  const inSel = (sel, val) => !sel.length || sel.includes(val);
  const passB = (b) => FILTER_KEYS.every((k) => inSel(state[k], b[FIELD[k]]));
  const passP = (p) => ['country', 'region', 'ownership', 'status'].every((k) => inSel(state[k], p[FIELD[k]]));
  const fB = () => data.buildings.filter(passB);
  const fP = () => data.parcels.filter(passP);
  const fL = () => { const ids = new Set(fP().map((p) => p.id)); return data.landcovers.filter((l) => ids.has(l.parcelId)); };

  const chartData = new Map();
  const gchart = (id, title, groups, { x, y, unit = '', form = 'barH' }) => {
    const spec = { id, title, form, unit, x, y };
    const result = { rows: groups.map((g) => ({ [x]: g.k, [y]: g.v })), columns: [x, y] };
    chartData.set(id, { spec, result });
    return chart(spec, result);
  };

  const xchart = (spec, rows, columns) => {
    const result = { rows, columns: columns || Object.keys(rows[0] || {}) };
    chartData.set(spec.id, { spec, result });
    return chart(spec, result);
  };
  const mapFigure = () => `<figure class="chart card card--universal chart--map" id="estate-map">
    <figcaption class="chart__head"><h3 class="chart__title">Standorte weltweit</h3>
      <div class="chart__actions">${C.menu({ menuId: 'estate-map', label: 'Karten-Aktionen', items: [
        { action: 'fullscreen', label: 'Vollbild' },
        { separator: true }, { heading: 'Herunterladen' },
        { action: 'png', label: 'Als Bild (PNG)' },
        { separator: true }, { action: 'link', label: 'Link kopieren' },
      ] })}</div>
    </figcaption>
    <div class="dash-map" id="estate-map-el" role="group" aria-label="Weltkarte der Gebäudestandorte">${C.loading({ label: 'Karte wird geladen…' })}</div>
  </figure>`;

  function tabContent() {
    if (state.tab === 'development') {

      const yearlyRows = dashData.query({ dataset: 'portfolio_jahr', orderBy: 'jahr' }).rows;
      const monthlyRows = dashData.query({ dataset: 'portfolio_monat', orderBy: 'monat' }).rows;
      if (!yearlyRows.length) {
        return { source: SOURCE.development, kpis: [], figures: [
          `<div class="empty">Die Zeitreihen sind nicht verfügbar (data/dashboards.json).</div>`] };
      }
      const current = yearlyRows[yearlyRows.length - 1];
      const previous = yearlyRows[yearlyRows.length - 2] || current;
      const monthLabel = (monthKey) => { const [year, month] = monthKey.split('-'); return `${['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'][Number(month) - 1]} ${year}`; };
      const asOf = monthlyRows.length ? `Stand: ${monthLabel(monthlyRows[monthlyRows.length - 1]['monat'])}` : `Stand: ${current['jahr']}`;
      const buildingDelta = current['gebaeude'] - previous['gebaeude'];
      const floorAreaDelta = current['gf_m2'] - previous['gf_m2'];
      const ownershipDelta = current['eigentumsquote'] - previous['eigentumsquote'];
      const sign = (n) => (n > 0 ? `+${formatRoundedNumber(n)}` : n < 0 ? `−${formatRoundedNumber(Math.abs(n))}` : '±0');

      const yearOf = (iso) => Number(String(iso).slice(0, 4));
      const expiring = (data.contracts || []).filter((c) => yearOf(c.validUntil) >= current['jahr']);
      const expiringByYear = groupCount(expiring.map((c) => ({ year: yearOf(c.validUntil) })), 'year');
      expiringByYear.sort((a, b) => a.k - b.k);
      const expiringSoonCount = expiring.filter((c) => yearOf(c.validUntil) <= current['jahr'] + 2).length;

      const isYearly = state.granularity === 'jahr';
      const periods = isYearly ? yearlyRows.map((r) => ({ ...r, period: r['jahr'] })) : monthlyRows.map((r) => ({ ...r, period: r['monat'] }));
      const periodLabel = isYearly ? 'Jahr' : 'Monat';

      const series = (key) => periods.map((r) => ({ [periodLabel]: r.period, Wert: r[key] })).filter((r) => Number.isFinite(r.Wert));

      const indexBase = yearlyRows[0];
      const indexRows = yearlyRows.flatMap((r) => ([
        { 'Jahr': r['jahr'], 'Index': Math.round((r['gebaeude'] / indexBase['gebaeude']) * 1000) / 10, 'Reihe': 'Gebäude' },
        { 'Jahr': r['jahr'], 'Index': Math.round((r['gf_m2'] / indexBase['gf_m2']) * 1000) / 10, 'Reihe': 'Geschossfläche' },
        { 'Jahr': r['jahr'], 'Index': Math.round((r['gsf_m2'] / indexBase['gsf_m2']) * 1000) / 10, 'Reihe': 'Grundstücksfläche' },
      ]));
      const movementRows = yearlyRows.flatMap((r) => ([
        { 'Jahr': r['jahr'], 'Anzahl': r['zugaenge'], 'Bewegung': 'Zugänge' },
        { 'Jahr': r['jahr'], 'Anzahl': r['abgaenge'], 'Bewegung': 'Abgänge' },
      ]));
      const comparisonYears = yearlyRows.filter((r) => r['jahr'] >= current['jahr'] - 5);
      const metricRows = [
        { metric: 'Gebäude', unit: 'Anzahl', key: 'gebaeude' },
        { metric: 'Geschossfläche (GF)', unit: 'm²', key: 'gf_m2' },
        { metric: 'Hauptnutzfläche (HNF)', unit: 'm²', key: 'hnf_m2' },
        { metric: 'Grundstücke', unit: 'Anzahl', key: 'grundstuecke' },
        { metric: 'Grundstücksfläche (GSF)', unit: 'm²', key: 'gsf_m2' },
        { metric: 'Eigentumsquote', unit: '%', key: 'eigentumsquote' },
        { metric: 'Zugänge', unit: 'Anzahl', key: 'zugaenge' },
        { metric: 'Abgänge', unit: 'Anzahl', key: 'abgaenge' },
      ].map((row) => {
        const out = { metric: row.metric, unit: row.unit };
        for (const r of comparisonYears) out[String(r['jahr'])] = r[row.key];
        return out;
      });
      const metricColumns = ['metric', 'unit', ...comparisonYears.map((r) => String(r['jahr']))];

      return {
        source: SOURCE.development,
        kpis: [
          kpiTile(C, { label: 'Gebäude', value: formatRoundedNumber(current['gebaeude']), deltaLabel: `${sign(buildingDelta)} ggü. Vorjahr`, deltaGood: undefined,
            spark: monthlyRows.map((r) => r['gebaeude']), hint: asOf }),
          kpiTile(C, { label: 'Geschossfläche', value: formatRoundedNumber(current['gf_m2']), unit: 'm²', deltaLabel: `${sign(floorAreaDelta)} m² ggü. Vorjahr`, deltaGood: undefined,
            spark: monthlyRows.map((r) => r['gf_m2']), hint: asOf }),
          kpiTile(C, { label: 'Eigentumsquote', value: String(current['eigentumsquote']), unit: '%', deltaLabel: `${sign(ownershipDelta)} Pp. ggü. Vorjahr`, deltaGood: ownershipDelta > 0 ? true : undefined,
            spark: monthlyRows.map((r) => r['eigentumsquote']), hint: asOf }),
          kpiTile(C, { label: 'Auslaufende Verträge', value: formatRoundedNumber(expiringSoonCount), deltaLabel: `bis Ende ${current['jahr'] + 2}`, deltaGood: undefined,
            hint: `${formatRoundedNumber((data.contracts || []).length)} Verträge im Bestand` }),
        ],
        figures: [
          xchart({ id: 'estate-development-buildings', title: 'Gebäudebestand', form: 'line', unit: '', x: periodLabel, y: 'Wert',
            note: isYearly ? 'Jahresendstände; letzter Wert = aktueller Datenstand.' : 'Monatsstände — Bestandesgrössen verändern sich in Stufen (Zu-/Abgänge).' },
          series('gebaeude'), [periodLabel, 'Wert']),
          xchart({ id: 'estate-development-floor-area', title: 'Geschossfläche', form: 'line', unit: 'm²', x: periodLabel, y: 'Wert' },
            series('gf_m2'), [periodLabel, 'Wert']),
          xchart({ id: 'estate-development-index', title: `Indexierte Entwicklung (Basis ${indexBase['jahr']} = 100)`, form: 'line', unit: '%', x: 'Jahr', y: 'Index', series: 'Reihe',
            note: 'Bestand und Flächen auf einer Achse vergleichbar — Muster Energiedashboard Bund.' },
          indexRows, ['Jahr', 'Index', 'Reihe']),
          xchart({ id: 'estate-development-movements', title: 'Zugänge und Abgänge', form: 'column', unit: '', x: 'Jahr', y: 'Anzahl', series: 'Bewegung',
            note: 'Portfolio-Bewegungen je Jahr (Käufe, Übernahmen, Verkäufe, Rückgaben).' },
          movementRows, ['Jahr', 'Anzahl', 'Bewegung']),
          ...(expiringByYear.length ? [xchart({ id: 'estate-development-expiring-contracts', title: 'Auslaufende Verträge je Jahr', form: 'column', unit: '', x: 'Jahr', y: 'Anzahl',
            note: 'Vertragsende als Planungsdimension — wo Verlängerung, Neuausschreibung oder Rückgabe ansteht.' },
          expiringByYear.map((g) => ({ 'Jahr': g.k, 'Anzahl': g.v })), ['Jahr', 'Anzahl'])] : []),
          xchart({ id: 'estate-development-ownership', title: 'Eigentumsquote', form: 'line', unit: '%', x: periodLabel, y: 'Wert' },
            series('eigentumsquote'), [periodLabel, 'Wert']),
          xchart({ id: 'estate-development-metrics', title: 'Kennzahlen im Mehrjahresvergleich', form: 'table', x: 'metric', xLabel: 'Kennzahl',
            footnotes: [
              'Jahresendstände; das Berichtsjahr zeigt den aktuellen Datenstand (August).',
              'Demo-Zeitreihe — die Werte des Berichtsjahrs entsprechen exakt dem SAP-RE-FX-Golden-Record des Prototyps.',
            ] },
          metricRows, metricColumns),
        ],
      };
    }
    if (state.tab === 'parcels') {
      const P = fP();
      const ownershipGroups = groupCount(P, 'ownership', OWNERSHIP_ORDER);
      return {
        source: SOURCE.parcels,
        kpis: [
          kpiTile(C, { label: 'Grundstücke', value: formatRoundedNumber(P.length) }),
          kpiTile(C, { label: 'Grundstücksfläche', value: formatRoundedNumber(sumBy(P, 'gsf')), unit: 'm²' }),
          kpiTile(C, { label: 'Ø Fläche', value: formatRoundedNumber(P.length ? sumBy(P, 'gsf') / P.length : 0), unit: 'm²' }),
          kpiTile(C, { label: 'Im Eigentum', value: String(pctOf(P.filter((p) => p.ownership === 'Im Eigentum').length, P.length)), unit: '%' }),
        ],
        figures: [
          gchart('estate-parcel-ownership', 'Grundstücke nach Eigentumsverhältnis', ownershipGroups, { x: 'Eigentum', y: 'Anzahl', form: 'pie' }),
          gchart('estate-parcel-portfolio', 'Grundstücksfläche nach Portfolio', groupSum(P, 'portfolio', 'gsf'), { x: 'Portfolio', y: 'Fläche', unit: 'm²' }),
          gchart('estate-parcel-country', 'Grundstücke nach Land', groupCount(P, 'country'), { x: 'Land', y: 'Anzahl' }),
          gchart('estate-parcel-area-distribution', 'Verteilung Grundstücksfläche', histogram(P, 'gsf', GSF_BINS), { x: 'Fläche (m²)', y: 'Anzahl', form: 'column' }),
        ],
      };
    }
    if (state.tab === 'landcover') {
      const L = fL();
      const total = sumBy(L, 'area');
      const areaOf = (t) => sumBy(L.filter((x) => x.type === t), 'area');
      const sealedArea = areaOf('Gebaeude') + areaOf('befestigt');
      const greenArea = areaOf('humusiert') + areaOf('Gewaesser');
      return {
        source: SOURCE.landcover,
        kpis: [
          kpiTile(C, { label: 'Bodenbedeckung', value: formatRoundedNumber(total), unit: 'm²' }),
          kpiTile(C, { label: 'Anteil bebaut', value: String(pctOf(areaOf('Gebaeude'), total)), unit: '%' }),
          kpiTile(C, { label: 'Anteil versiegelt', value: String(pctOf(sealedArea, total)), unit: '%' }),
          kpiTile(C, { label: 'Anteil grün', value: String(pctOf(greenArea, total)), unit: '%' }),
        ],
        figures: [
          gchart('estate-landcover-type', 'Bodenbedeckung nach Typ', groupSum(L, 'label', 'area'), { x: 'Typ', y: 'Fläche', unit: 'm²' }),
          gchart('estate-landcover-surface', 'Versiegelung vs. Grünfläche', [{ k: 'Versiegelt', v: sealedArea }, { k: 'Grünfläche', v: greenArea }], { x: 'Kategorie', y: 'Fläche', unit: 'm²', form: 'column' }),
        ],
      };
    }
    const B = fB();
    return {
      source: SOURCE.buildings,
      kpis: [
        kpiTile(C, { label: 'Gebäude', value: formatRoundedNumber(B.length) }),
        kpiTile(C, { label: 'Geschossfläche', value: formatRoundedNumber(sumBy(B, 'gf')), unit: 'm²' }),
        kpiTile(C, { label: 'Ø Geschossfläche', value: formatRoundedNumber(B.length ? sumBy(B, 'gf') / B.length : 0), unit: 'm²' }),
        kpiTile(C, { label: 'Im Eigentum', value: String(pctOf(B.filter((b) => b.ownership === 'Im Eigentum').length, B.length)), unit: '%' }),
      ],
      figures: [
        mapFigure(),
        gchart('estate-building-ownership', 'Gebäude nach Eigentumsverhältnis', groupCount(B, 'ownership', OWNERSHIP_ORDER), { x: 'Eigentum', y: 'Anzahl', form: 'pie' }),
        gchart('estate-building-portfolio', 'Geschossfläche nach Portfolio', groupSum(B, 'portfolio', 'gf'), { x: 'Portfolio', y: 'Fläche', unit: 'm²' }),
        gchart('estate-building-country', 'Gebäude nach Land', groupCount(B, 'country'), { x: 'Land', y: 'Anzahl' }),
        gchart('estate-building-area-distribution', 'Verteilung Geschossfläche', histogram(B, 'gf', GF_BINS), { x: 'Fläche (m²)', y: 'Anzahl', form: 'column' }),
        gchart('estate-building-type', 'Gebäude nach Gebäudetyp', groupCount(B, 'buildingType'), { x: 'Gebäudetyp', y: 'Anzahl' }),
      ],
    };
  }

  const mapPoints = () => fB().map((b) => ({
    lat: b.lat, lon: b.lon, label: b.label, sub: b.sub, bblId: b.id,
    href: `${INVENTORY}?id=${encodeURIComponent(b.id)}`,
  }));

  const buildingByBusinessEntity = {};
  for (const building of data.buildings) buildingByBusinessEntity[businessEntityIdFromBblId(building.id)] = building.id;
  const parcelFC = () => ({
    type: 'FeatureCollection',
    features: fP().filter((p) => p.geom).map((p) => ({
      type: 'Feature', geometry: p.geom,
      properties: {
        label: p.label || p.id, sub: p.sub || '', id: p.id, area: p.gsf,
        href: buildingByBusinessEntity[businessEntityIdFromBblId(p.id)]
          ? `${INVENTORY}?id=${encodeURIComponent(buildingByBusinessEntity[businessEntityIdFromBblId(p.id)])}` : INVENTORY,
      },
    })),
  });

  const FILTER_MAX = 5;
  const fGroup = (dim, legend) => C.filterGroup({
    dim, legend,
    options: FILTER_OPTIONS[dim].map((o) => ({ value: o, label: o })),
    selected: state[dim], idPrefix: 'estate', max: FILTER_MAX,
  });

  const dimPanelHtml = () => `
          ${fGroup('country', 'Land')}${fGroup('region', 'Region / Kanton')}${fGroup('buildingType', 'Gebäudetyp')}${fGroup('ownership', 'Eigentumsverhältnis')}${fGroup('status', 'Status')}
          ${C.panelReset({ id: 'f-reset', wrap: 'filter-panel__actions' })}`;
  const granPanelHtml = () => `
          <fieldset class="filter-group"><legend class="filter-group__legend">Zeitachse</legend>
            <label class="filter-check"><input type="radio" name="estate-granularity" value="jahr"${state.granularity === 'jahr' ? ' checked' : ''}><span>Jahresstände</span></label>
            <label class="filter-check"><input type="radio" name="estate-granularity" value="monat"${state.granularity === 'monat' ? ' checked' : ''}><span>Monatsstände</span></label>
          </fieldset>
          <p class="small muted">Die Zeitreihen zeigen das Gesamtportfolio — die Dimensionsfilter der Stammdaten-Register wirken hier nicht.</p>`;
  let panelTab = null;
  const syncPanel = () => {
    const want = state.tab === 'development' ? 'development' : 'dimensions';
    if (panelTab === want) return;
    panelTab = want;
    mount.querySelector('#filter-body').innerHTML = want === 'development' ? granPanelHtml() : dimPanelHtml();
  };

  let unpaint = null;
  const mapSlot = createMapSlot();
  const freeGridResources = () => {
    if (unpaint) { unpaint(); unpaint = null; }
    mapSlot.free();
  };
  ctx.onUnmount(freeGridResources);

  const syncHash = () => {
    const qs = new URLSearchParams();
    if (state.tab !== TABS[0].id) qs.set('tab', LEGACY_VALUE_BY_TAB[state.tab]);
    for (const k of FILTER_KEYS) if (state[k].length) qs.set(FILTER_QUERY_KEYS[k], state[k].join(','));
    if (state.tab === 'development' && state.granularity !== 'jahr') qs.set('gran', state.granularity);
    const s = qs.toString();
    history.replaceState(history.state, '', `#/app/dataportal/immobilien${s ? '?' + s : ''}`);
  };

  function update() {
    syncPanel();
    chartData.clear();
    const { kpis, figures, source } = tabContent();
    mount.querySelector('#dash-kpis').innerHTML = kpis.join('');
    freeGridResources();

    const oldGrid = mount.querySelector('#dash-grid');
    const grid = oldGrid.cloneNode(false);
    oldGrid.replaceWith(grid);
    grid.innerHTML = figures.join('');
    mount.querySelector('#dash-source').textContent = source;

    unpaint = paintCharts(grid, (id) => chartData.get(id));
    wireCharts(grid);
    wireChartMenus(grid);
    if (state.tab === 'buildings') {
      const el = grid.querySelector('#estate-map-el');
      if (el) mapSlot.mount(el, (node) => initEstateMap(node, mapPoints(), parcelFC()));
    }
  }

  mount.innerHTML = `
  <div class="container section dash-page">
    ${C.backLink('#/app/dataportal', 'Datenportal')}
    ${dashHeader(C, {
      title: META.title, lead: META.lead,
      extraHtml: `<p class="small muted lead-hint">Detaillierte Objektinformationen und Bewirtschaftung im <a href="${INVENTORY}" target="_blank" rel="noopener noreferrer">Liegenschaften Inventar</a>.</p>`,
    })}
    <div class="dashboard-layout" id="dashboard">
      ${filterPanelShell(C, '')}
      <div class="dashboard-main">
        ${C.tabBar({ items: TABS, active: state.tab, idPrefix: 'estate-tab', panelId: 'dpanel', ariaLabel: 'Stammdaten-Ansichten' })}
        <div class="tab__container" role="tabpanel" id="dpanel" aria-labelledby="estate-tab-${state.tab}" tabindex="0">
          <h2 class="sr-only">Kennzahlen</h2><div class="kpi-row" id="dash-kpis"></div>
          <h2 class="sr-only">Auswertungen</h2><div class="dash-grid" id="dash-grid"></div>
        </div>
      </div>
    </div>
    ${dashFooter(C, { sourceId: 'dash-source', updated: META.updated })}
  </div>`;

  const filterBody = mount.querySelector('#filter-body');
  filterBody.addEventListener('change', (e) => {

    const granularityControl = e.target.closest('input[type="radio"][name="estate-granularity"]');
    if (granularityControl) { state.granularity = granularityControl.value === 'monat' ? 'monat' : 'jahr'; syncHash(); update(); return; }
    const cb = e.target.closest('input[type="checkbox"][data-fdim]');
    if (!cb) return;
    const dim = cb.dataset.fdim, val = cb.value;
    if (cb.checked) { if (!state[dim].includes(val)) state[dim].push(val); }
    else state[dim] = state[dim].filter((x) => x !== val);
    syncHash(); update();
  });

  filterBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-fmore]');
    if (!btn) return;
    const group = btn.closest('.filter-group');
    const more = group.querySelector('.filter-group__more');
    const open = more.hidden;
    more.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.querySelector('.btn__text').textContent = open
      ? 'Weniger anzeigen'
      : `Alle anzeigen (${group.querySelectorAll('input[data-fdim]').length})`;
  });

  filterBody.addEventListener('click', (e) => {
    if (!e.target.closest('#f-reset')) return;
    FILTER_KEYS.forEach((k) => { state[k] = []; });
    filterBody.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = false; });
    syncHash(); update();
  });
  C.wireTabs(mount, { onSelect: (id) => { state.tab = id; syncHash(); update(); } });

  wireFilterCollapse(ctx, mount);
  wireDashboardMenu(mount, C, { title: META.title, onRefresh: update });

  update();
}

function split(v) { return (v || '').split(',').map((s) => s.trim()).filter(Boolean); }
