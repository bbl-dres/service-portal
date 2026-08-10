// One structured model behind every report format. PDF and Excel differ in
// rendering only; the chapters, their order and every value come from here, so a
// figure can never disagree between the two files. Pure and dependency-free, so
// the whole report is assertable in Node without a browser or a PDF library.

import { LIMITS } from './config.js';

export const REPORT_TITLE = 'Prüfbericht Planprüfung';

// Reference documentation the report points at. The platform link is the route
// itself; the rest are the authoritative BBL sources for the CAD contract.
export const REPORT_LINKS = Object.freeze([
  ['Planprüfung im BBL Kundenportal', 'https://bbl-dres.github.io/service-portal/#/app/plan-check'],
  ['Prüfregeln und CAD-Richtlinie', 'https://github.com/bbl-dres/plan-check/blob/main/docs/pruefregeln-de.md'],
  ['Quellcode der Prüfplattform', 'https://github.com/bbl-dres/plan-check'],
  ['BBL Downloads Bauten', 'https://www.bbl.admin.ch/de/downloads-bauten'],
  ['BBL Kontakt', 'https://www.bbl.admin.ch/de/kontakt'],
]);

const AREA_ROWS = Object.freeze([
  ['GF', 'Geschossfläche', 'gf'],
  ['KF', 'Konstruktionsfläche', 'kf'],
  ['NGF', 'Nettogeschossfläche', 'ngf'],
  ['NF', 'Nutzfläche', 'nf'],
  ['HNF', 'Hauptnutzfläche', 'hnf'],
  ['NNF', 'Nebennutzfläche', 'nnf'],
  ['VF', 'Verkehrsfläche', 'vf'],
  ['FF', 'Funktionsfläche', 'ff'],
]);

const DIN_277_ROWS = Object.freeze([
  ['HNF 1', 'Wohnen und Aufenthalt', '1'],
  ['HNF 2', 'Büroarbeit', '2'],
  ['HNF 3', 'Produktion, Hand- und Maschinenarbeit', '3'],
  ['HNF 4', 'Lagern, Verteilen, Verkaufen', '4'],
  ['HNF 5', 'Bildung, Unterricht, Kultur', '5'],
  ['HNF 6', 'Heilen und Pflegen', '6'],
  ['NNF 7', 'Sonstige Nutzungen', '7'],
  ['FF 8', 'Betriebstechnische Anlagen', '8'],
  ['VF 9', 'Verkehrserschliessung und -sicherung', '9'],
  ['BUF 10', 'Verschiedene Nutzungen', '10'],
]);

const ECONOMY_ROWS = Object.freeze([
  ['NGF / GF', 'Nettogeschossfläche / Geschossfläche', 'ngf', 'gf'],
  ['KF / GF', 'Konstruktionsfläche / Geschossfläche', 'kf', 'gf'],
  ['NF / NGF', 'Nutzfläche / Nettogeschossfläche', 'nf', 'ngf'],
  ['HNF / NGF', 'Hauptnutzfläche / Nettogeschossfläche', 'hnf', 'ngf'],
]);

export const DASH = '–';
const list = (value) => Array.isArray(value) ? value : [];
const text = (value) => value == null ? '' : String(value);
const finite = (value) => {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
};

const NUMBER = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });
const DECIMAL_1 = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 1 });
const DECIMAL_2 = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 2 });

export function formatCount(value) {
  const number = finite(value);
  return number === null ? DASH : NUMBER.format(number);
}

export function formatArea(value) {
  const number = finite(value);
  return number === null ? DASH : `${DECIMAL_1.format(number)} m²`;
}

export function formatRatio(value) {
  const number = finite(value);
  return number === null ? DASH : DECIMAL_2.format(number);
}

export function formatShare(value, base) {
  const number = finite(value);
  const total = finite(base);
  if (number === null || total === null || total <= 0) return DASH;
  return `${NUMBER.format((number / total) * 100)} %`;
}

export function formatFileSize(value) {
  const bytes = finite(value);
  if (bytes === null || bytes < 0) return DASH;
  if (bytes < 1024) return `${NUMBER.format(bytes)} Byte`;
  if (bytes < 1024 * 1024) return `${DECIMAL_1.format(bytes / 1024)} KB`;
  return `${DECIMAL_1.format(bytes / (1024 * 1024))} MB`;
}

export function formatTimestamp(date) {
  const value = date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  if (!value) return DASH;
  return new Intl.DateTimeFormat('de-CH', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(value);
}

const STATUS_LABELS = Object.freeze({
  error: 'Fehler', warning: 'Warnung', abort: 'Abgebrochen',
  ok: 'Bestanden', passed: 'Bestanden', 'not-evaluated': 'Nicht geprüft',
});

export function statusLabel(value) {
  const key = String(value || '').toLowerCase();
  return STATUS_LABELS[key] || 'Bestanden';
}

function ruleStatus(rule) {
  if (rule?.status === 'not-evaluated' || rule?.passed === null) return 'not-evaluated';
  if (rule?.status === 'passed' || rule?.passed === true) return 'passed';
  return rule?.sev === 'error' ? 'error' : 'warning';
}

/**
 * Build the report model. `generatedAt` is injected rather than read from the
 * clock so a report is reproducible in a test.
 */
export function planCheckReportModel(result, { generatedAt = new Date() } = {}) {
  const validation = result?.validation && typeof result.validation === 'object' ? result.validation : {};
  const metrics = validation.metrics && typeof validation.metrics === 'object' ? validation.metrics : {};
  const context = result?.checkContext && typeof result.checkContext === 'object' ? result.checkContext : {};
  const rules = list(validation.rules);
  const errors = list(validation.errors);
  const rooms = list(validation.rooms);
  const areas = list(validation.areas);
  const layers = list(result?.layers);
  const entities = list(result?.drawing?.entitySummary);

  const completeness = validation.completeness && typeof validation.completeness === 'object'
    ? validation.completeness : { complete: true, reasons: [] };
  const complete = !(completeness.status === 'incomplete' || completeness.complete === false);

  const errorCount = errors.filter((error) => error?.severity === 'error').length;
  const warningCount = errors.filter((error) => error?.severity === 'warning').length;
  const evaluatedRules = rules.filter((rule) => ruleStatus(rule) !== 'not-evaluated').length;
  const passedRules = rules.filter((rule) => ruleStatus(rule) === 'passed').length;

  const failedRules = rules.filter((rule) => ['error', 'warning'].includes(ruleStatus(rule)));
  const notEvaluatedRules = rules.filter((rule) => ruleStatus(rule) === 'not-evaluated');
  const okRules = rules.filter((rule) => ruleStatus(rule) === 'passed');
  const ruleRow = (rule) => [
    statusLabel(ruleStatus(rule)),
    text(rule?.code),
    text(rule?.description) || text(rule?.code),
    formatCount(rule?.errorCount || 0),
  ];
  failedRules.sort((left, right) => {
    const rank = (rule) => (ruleStatus(rule) === 'error' ? 0 : 1);
    return rank(left) - rank(right) || text(left?.code).localeCompare(text(right?.code));
  });

  const gf = finite(metrics.gf);
  const din277Totals = new Map();
  for (const room of rooms) {
    const key = text(room?.din277);
    if (!key) continue;
    din277Totals.set(key, (din277Totals.get(key) || 0) + (finite(room?.area) || 0));
  }

  const change = context.change && typeof context.change === 'object' ? context.change : {};
  const changeLabel = change.type === 'mutation' ? 'Mutation eines bestehenden Plans' : 'Neuer Plan';

  return {
    title: REPORT_TITLE,
    generatedAt,
    generatedAtLabel: formatTimestamp(generatedAt),
    file: {
      name: text(result?.file?.name) || 'DWG-Datei',
      size: finite(result?.file?.size),
      sizeLabel: formatFileSize(result?.file?.size),
    },
    // Chapter 0 — the cover's fact table.
    info: [
      ['Dateiname', text(result?.file?.name) || DASH],
      ['Dateigrösse', formatFileSize(result?.file?.size)],
      ['DWG-Version', text(result?.database?.version) || DASH],
      ['Layer', formatCount(result?.database?.layerCount ?? layers.length)],
      ['Objekte', formatCount(result?.database?.entityCount)],
      ['Prüfdauer', finite(result?.elapsedMs) === null ? DASH : `${DECIMAL_1.format(finite(result.elapsedMs) / 1000)} s`],
      ['Geprüft am', formatTimestamp(generatedAt)],
      ['Raumpolygon-Layer', 'R_RAUMPOLYGON'],
      ['Geschosspolygon-Layer', 'R_GESCHOSSPOLYGON'],
      ['Objekt', context.building ? `${text(context.building.name)} (${text(context.building.id)})` : 'Nicht zugeordnet'],
      ['Geschoss', context.floor ? text(context.floor.label) : 'Nicht zugeordnet'],
      ['Art der Änderung', changeLabel],
      ...(change.reason ? [['Änderungsgrund', text(change.reason).slice(0, LIMITS.changeReasonLength)]] : []),
      ...(change.effectiveDate ? [['Gültig ab', text(change.effectiveDate)]] : []),
      ...(change.reference ? [['Referenz', text(change.reference)]] : []),
    ],
    summary: {
      score: finite(validation.score),
      scoreLabel: validation.aborted || finite(validation.score) === null
        ? DASH : `${formatCount(validation.score)} %`,
      passedRules,
      evaluatedRules,
      totalRules: rules.length,
      errorCount,
      warningCount,
      rooms: rooms.length,
      areas: areas.length,
      layers: layers.length,
      gfLabel: formatArea(metrics.gf),
      ngfLabel: formatArea(metrics.ngf),
      aborted: Boolean(validation.aborted),
      complete,
      incompleteReasons: list(completeness.reasons).map((reason) => ({
        code: text(reason?.code),
        count: finite(reason?.count) || 0,
        message: text(reason?.message),
      })),
      categorySource: text(metrics.categorySource),
    },
    rules: {
      head: ['Status', 'Regel', 'Beschreibung', 'Verstösse'],
      failed: failedRules.map(ruleRow),
      notEvaluated: notEvaluatedRules.map(ruleRow),
      passed: okRules.map(ruleRow),
    },
    errors: {
      head: ['Nr.', 'Status', 'Regel', 'Meldung'],
      rows: errors.map((error, index) => [
        String(index + 1),
        statusLabel(error?.severity),
        text(error?.ruleCode),
        text(error?.message),
      ]),
    },
    layers: {
      head: ['Nr.', 'Layer', 'Objekte', 'Farbe'],
      rows: layers.map((layer, index) => [
        String(index + 1),
        text(layer?.name),
        formatCount(layer?.count),
        text(layer?.colorHex) || DASH,
      ]),
    },
    rooms: {
      head: ['Nr.', 'Status', 'AOID', 'Fläche', 'Layer', 'Stützpunkte', 'Handle'],
      rows: rooms.map((room, index) => [
        String(index + 1),
        statusLabel(room?.status),
        text(room?.aoid),
        formatArea(room?.area),
        text(room?.layer),
        formatCount(list(room?.vertices).length),
        text(room?.handle) || DASH,
      ]),
    },
    areas: {
      head: ['Nr.', 'Status', 'Bezeichnung', 'Fläche', 'Layer', 'Handle'],
      rows: areas.map((area, index) => [
        String(index + 1),
        statusLabel(area?.status),
        text(area?.aoid),
        formatArea(area?.area),
        text(area?.layer),
        text(area?.handle) || DASH,
      ]),
    },
    kpi: {
      areaHead: ['Kennzahl', 'Bezeichnung', 'Fläche', 'Anteil GF'],
      areas: AREA_ROWS.map(([code, label, key]) => [
        code, label, formatArea(metrics[key]), formatShare(metrics[key], gf),
      ]),
      volumeHead: ['Kennzahl', 'Bezeichnung', 'Volumen', 'Anteil'],
      // Volume cannot be derived from a single floor plan; the row exists so the
      // report has the same shape as the reference, and states the gap.
      volume: [['GV', 'Gebäudevolumen', DASH, DASH]],
      din277Head: ['Kennzahl', 'Bezeichnung', 'Fläche', 'Anteil GF'],
      din277: DIN_277_ROWS.map(([code, label, key]) => {
        const value = din277Totals.get(key) ?? null;
        return [code, label, formatArea(value), formatShare(value, gf)];
      }),
      economyHead: ['Kennzahl', 'Bezeichnung', 'Wert'],
      economy: ECONOMY_ROWS.map(([code, label, numerator, denominator]) => {
        const top = finite(metrics[numerator]);
        const bottom = finite(metrics[denominator]);
        return [code, label, top !== null && bottom ? formatRatio(top / bottom) : DASH];
      }),
      entityHead: ['Objekttyp', 'Anzahl', 'Layer'],
      entities: entities.map((entry) => {
        const entryLayers = list(entry?.layers).map(text).filter(Boolean);
        const shown = entryLayers.slice(0, 3).join(', ');
        return [
          text(entry?.type) || DASH,
          formatCount(entry?.count),
          shown ? `${shown}${entryLayers.length > 3 ? ' …' : ''}` : DASH,
        ];
      }),
    },
    notes: [
      ...(complete ? [] : [
        'Teile der Zeichnung konnten nicht normalisiert werden. Die betroffenen Objekte sind '
        + 'unter «Fehlermeldungen» als INCOMPLETE_001 aufgeführt; alle auswertbaren Regeln wurden geprüft.',
      ]),
      ...(metrics.categorySource === 'convention' ? [
        'Der DWG-Datenvertrag führt keine Nutzungszuordnung nach SIA 416. Nicht klassierte Räume '
        + 'werden konventionsgemäss als Hauptnutzfläche gezählt; NNF, VF und FF bleiben leer. '
        + 'GF und KF sind gemessen, HNF und NGF sind aus dieser Konvention abgeleitet.',
      ] : []),
      'Dieser Bericht wurde lokal im Browser erzeugt. Die Zeichnung wurde nicht an einen Server '
      + 'übertragen. Das Ergebnis ist eine technische Prüfung, keine formelle Planfreigabe.',
    ],
    links: REPORT_LINKS.map(([label, url]) => [label, url]),
    chapters: [
      { key: 'rules', title: 'Prüfregeln', description: `${rules.length} Regeln geprüft` },
      { key: 'errors', title: 'Fehlermeldungen', description: `${errors.length} Feststellungen` },
      { key: 'layers', title: 'Layer', description: `${layers.length} Layer in der Zeichnung` },
      { key: 'rooms', title: 'Räume', description: `${rooms.length} Raumpolygone mit Flächen` },
      { key: 'areas', title: 'Flächen', description: `${areas.length} Geschosspolygone` },
      { key: 'kpi', title: 'Kennzahlen', description: 'Flächenbilanz, Verhältnisse und Objektstatistik' },
    ],
  };
}
