// Excel check report. Seven sheets matching the PDF chapters, so the two formats
// can be compared row by row. SheetJS is loaded on demand through the portal's
// SRI-pinned external-asset loader; the DWG itself never leaves the browser.

import { loadExternalAssets } from '../core/external-assets.js';
import { fileSlug } from '../export.js';
import { planCheckReportModel } from './report-model.js';

const XLSX_VERSION = '0.18.5';

const XLSX_ASSETS = {
  key: 'sheetjs',
  globalName: 'XLSX',
  script: {
    url: `https://unpkg.com/xlsx@${XLSX_VERSION}/dist/xlsx.full.min.js`,
    integrity: 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw',
  },
  messages: {
    timeout: 'Zeitüberschreitung beim Laden des Excel-Moduls',
    script: 'Das Excel-Modul konnte nicht geladen werden',
    global: 'SheetJS fehlt',
  },
};

// Excel treats a leading =, +, - or @ as a formula. Every cell written here
// comes from a parsed CAD file, so each one is neutralised before it lands in a
// workbook — the same rule js/export.js applies to CSV.
function safeCell(value) {
  const text = value == null ? '' : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

const sheetRows = (rows) => rows.map((row) => row.map(safeCell));

export async function loadExcelEngine() {
  const engine = await loadExternalAssets(XLSX_ASSETS);
  if (!engine?.utils?.book_new) throw new Error('SheetJS fehlt');
  return engine;
}

/** Sheet name, header row and body for each workbook sheet, in report order. */
export function planCheckExcelSheets(result, { generatedAt = new Date() } = {}) {
  const model = planCheckReportModel(result, { generatedAt });
  const summary = model.summary;
  return [
    {
      name: 'Info',
      widths: [34, 62],
      rows: [
        ['Merkmal', 'Wert'],
        ...model.info,
        ['', ''],
        ['Erfüllungsgrad', summary.scoreLabel],
        ['Bestandene Regeln', `${summary.passedRules} von ${summary.evaluatedRules}`],
        ['Fehler', String(summary.errorCount)],
        ['Warnungen', String(summary.warningCount)],
        ['Räume', String(summary.rooms)],
        ['Flächen', String(summary.areas)],
        ['Geschossfläche GF', summary.gfLabel],
        ['Nettogeschossfläche NGF', summary.ngfLabel],
        ['Auswertung vollständig', summary.complete ? 'ja' : 'nein'],
        ['', ''],
        ...model.notes.map((note) => ['Hinweis', note]),
        ['', ''],
        ...model.links,
      ],
    },
    {
      name: 'Prüfregeln',
      widths: [14, 14, 52, 12],
      rows: [
        model.rules.head,
        ...model.rules.failed,
        ...model.rules.notEvaluated,
        ...model.rules.passed,
      ],
    },
    { name: 'Fehlermeldungen', widths: [6, 14, 14, 78], rows: [model.errors.head, ...model.errors.rows] },
    { name: 'Layer', widths: [6, 30, 14, 12], rows: [model.layers.head, ...model.layers.rows] },
    { name: 'Räume', widths: [6, 12, 22, 14, 22, 14, 12], rows: [model.rooms.head, ...model.rooms.rows] },
    { name: 'Flächen', widths: [6, 12, 22, 14, 22, 12], rows: [model.areas.head, ...model.areas.rows] },
    {
      name: 'Kennzahlen',
      widths: [16, 44, 18, 14],
      rows: [
        ['Gebäudeflächen', '', '', ''],
        model.kpi.areaHead,
        ...model.kpi.areas,
        ['', '', '', ''],
        ['Gebäudevolumen', '', '', ''],
        model.kpi.volumeHead,
        ...model.kpi.volume,
        ['', '', '', ''],
        ['Flächen nach DIN 277', '', '', ''],
        model.kpi.din277Head,
        ...model.kpi.din277,
        ['', '', '', ''],
        ['Wirtschaftlichkeitskennzahlen', '', '', ''],
        model.kpi.economyHead,
        ...model.kpi.economy,
        ...(model.kpi.entities.length ? [
          ['', '', '', ''],
          ['Entitäten im DWG', '', '', ''],
          model.kpi.entityHead,
          ...model.kpi.entities,
        ] : []),
      ],
    },
  ];
}

export async function buildPlanCheckWorkbook(result, options = {}) {
  const XLSX = await loadExcelEngine();
  const workbook = XLSX.utils.book_new();
  for (const sheet of planCheckExcelSheets(result, options)) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows(sheet.rows));
    worksheet['!cols'] = sheet.widths.map((width) => ({ wch: width }));
    // Sheet names are fixed identifiers, but Excel still rejects >31 characters.
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }
  return { XLSX, workbook };
}

export function planCheckExcelFilename(result) {
  const source = String(result?.file?.name || '').replace(/\.[^.]+$/, '');
  return `${fileSlug(source, 'planpruefung')}-pruefbericht.xlsx`;
}

export async function downloadPlanCheckExcel(result, options = {}) {
  const { XLSX, workbook } = await buildPlanCheckWorkbook(result, options);
  const filename = planCheckExcelFilename(result);
  XLSX.writeFile(workbook, filename);
  return filename;
}
