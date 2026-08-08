// Local, dependency-free report formats for the DWG checker. These exports are
// deliberately plain data formats: no PDF or spreadsheet file is advertised
// without a real generator for that format.

import { download, fileSlug, rowsToCsv } from '../export.js';
import { LIMITS } from './config.js';

const REPORT_FORMATS = Object.freeze({
  csv: { extension: 'csv', mime: 'text/csv;charset=utf-8' },
  json: { extension: 'json', mime: 'application/json;charset=utf-8' },
});

const list = (value) => Array.isArray(value) ? value : [];
const AREA_METRIC_KEYS = Object.freeze([
  'roomPolygonArea', 'hnf', 'nnf', 'vf', 'ff', 'nf', 'ngf', 'gf', 'kf',
]);
const finite = (value) => value == null || value === '' || typeof value === 'boolean'
  ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;
const text = (value) => value == null ? '' : String(value);

function validationOf(result) {
  return result && typeof result.validation === 'object' ? result.validation : {};
}

function reportCompleteness(validation) {
  const source = validation?.completeness && typeof validation.completeness === 'object'
    ? validation.completeness : {};
  const incomplete = source.status === 'incomplete' || source.complete === false;
  return {
    status: incomplete ? 'incomplete' : 'complete',
    complete: !incomplete,
    reasons: list(source.reasons).map((reason) => safeProperties(reason, [
      'code', 'count', 'message',
    ])),
  };
}

function safeProperties(source, allowed) {
  const properties = {};
  for (const key of allowed) {
    const value = source?.[key];
    if (value == null) continue;
    if (typeof value === 'string' || typeof value === 'boolean') properties[key] = value;
    else if (Number.isFinite(Number(value))) properties[key] = Number(value);
  }
  return properties;
}

function reportChange(source) {
  const change = safeProperties(source, ['type', 'reason', 'effectiveDate', 'reference']);
  if (Object.hasOwn(change, 'reason')) {
    change.reason = text(change.reason).slice(0, LIMITS.changeReasonLength);
  }
  return change;
}

function spatialProperties(source) {
  return {
    ...safeProperties(source, [
      'id', 'aoid', 'label', 'layer', 'handle', 'status', 'siaCategory', 'et',
    ]),
    area: finite(source?.area),
  };
}

function reportMetrics(source) {
  const metrics = safeProperties(source, [
    'rooms', 'areas', 'errors', 'warnings', 'evaluatedRules', 'unitStatus', 'validationOperations',
  ]);
  for (const key of AREA_METRIC_KEYS) metrics[key] = finite(source?.[key]);
  metrics.categoryTotals = safeProperties(source?.categoryTotals, ['HNF', 'NNF', 'VF', 'FF']);
  return metrics;
}

function reportData(result) {
  const validation = validationOf(result);
  const context = result?.checkContext && typeof result.checkContext === 'object' ? result.checkContext : {};
  return {
    schema: 'bbl-plan-check/1',
    generatedAt: new Date().toISOString(),
    file: safeProperties(result?.file, ['name', 'size']),
    elapsedMs: finite(result?.elapsedMs),
    database: safeProperties(result?.database, [
      'version', 'layerCount', 'entityCount', 'unknownEntityCount',
    ]),
    context: {
      building: context.building ? safeProperties(context.building, ['id', 'name']) : null,
      floor: context.floor ? safeProperties(context.floor, ['id', 'label']) : null,
      change: reportChange(context.change),
    },
    layers: list(result?.layers).map((layer) => safeProperties(layer, [
      'name', 'colorHex', 'colorIndex', 'count',
    ])),
    validation: {
      score: finite(validation.score),
      passedRules: finite(validation.passedRules),
      aborted: Boolean(validation.aborted),
      completeness: reportCompleteness(validation),
      rules: list(validation.rules).map((rule) => safeProperties(rule, [
        'cat', 'code', 'description', 'sev', 'status', 'passed', 'errorCount',
      ])),
      errors: list(validation.errors).map((error) => ({
        ...safeProperties(error, [
          'id', 'severity', 'ruleCode', 'message', 'category', 'handle', 'layer', 'roomId', 'areaId',
          'incompletenessCode', 'count',
        ]),
        handles: list(error?.handles).map(text).filter(Boolean),
      })),
      rooms: list(validation.rooms).map((room) => ({
        ...spatialProperties(room),
        centroid: safeProperties(room?.centroid, ['x', 'y']),
      })),
      areas: list(validation.areas).map((area) => ({
        ...spatialProperties(area),
        centroid: safeProperties(area?.centroid, ['x', 'y']),
      })),
      metrics: reportMetrics(validation.metrics && typeof validation.metrics === 'object'
        ? validation.metrics : {}),
    },
  };
}

export function buildPlanCheckCsv(result) {
  const validation = validationOf(result);
  const completeness = reportCompleteness(validation);
  const context = result?.checkContext && typeof result.checkContext === 'object' ? result.checkContext : {};
  const change = reportChange(context.change);
  const rows = [[
    'Typ', 'ID / Regel', 'Status', 'Kategorie / Layer', 'Bezeichnung / Meldung', 'Fl\u00e4che m\u00b2',
  ]];

  rows.push([
    'Pr\u00fcfung', 'Vollst\u00e4ndigkeit', completeness.complete ? 'vollst\u00e4ndig' : 'unvollst\u00e4ndig',
    'System', completeness.reasons.map((reason) => {
      const label = reason.message || reason.code || 'Unvollst\u00e4ndige Auswertung';
      return reason.count ? label + ' (' + reason.count + '\u00d7)' : label;
    }).join(' '), '',
  ]);
  rows.push([
    'Pr\u00fcfung', 'Erf\u00fcllungsgrad',
    finite(validation.score) === null ? 'nicht ausgewiesen' : String(finite(validation.score)) + ' %',
    'System', validation.aborted ? 'Pr\u00fcfung abgebrochen' : '', '',
  ]);

  if (context.building) rows.push(['Kontext', context.building.id, '', 'Objekt', context.building.name, '']);
  if (context.floor) rows.push(['Kontext', context.floor.id, '', 'Geschoss', context.floor.label, '']);
  if (context.change) {
    rows.push(['Kontext', '', '', '\u00c4nderung', change.type === 'mutation' ? 'Mutation eines bestehenden Plans' : 'Neuer Plan', '']);
    if (change.reason) rows.push(['Kontext', '', '', '\u00c4nderungsgrund', change.reason, '']);
    if (change.effectiveDate) rows.push(['Kontext', '', '', 'G\u00fcltig ab', change.effectiveDate, '']);
    if (change.reference) rows.push(['Kontext', '', '', 'Referenz', change.reference, '']);
  }

  for (const rule of list(validation.rules)) {
    const ruleStatus = rule?.status === 'not-evaluated' || rule?.passed === null
      ? 'nicht gepr\u00fcft'
      : (rule?.status === 'passed' || rule?.passed ? 'bestanden' : (rule?.sev || 'nicht bestanden'));
    rows.push([
      'Pr\u00fcfregel', rule?.code, ruleStatus,
      rule?.cat, rule?.description, '',
    ]);
  }
  for (const error of list(validation.errors)) {
    rows.push([
      'Feststellung', error?.id || error?.ruleCode, error?.severity, error?.category,
      error?.message, '',
    ]);
  }
  for (const room of list(validation.rooms)) {
    rows.push([
      'Raum', room?.aoid || room?.id, room?.status, room?.layer,
      room?.label, finite(room?.area) ?? '',
    ]);
  }
  for (const area of list(validation.areas)) {
    rows.push([
      'Fl\u00e4che', area?.aoid || area?.id, area?.status, area?.layer,
      area?.label, finite(area?.area) ?? '',
    ]);
  }
  return rowsToCsv(rows);
}

export function buildPlanCheckJson(result) {
  return `${JSON.stringify(reportData(result), null, 2)}\n`;
}

export function planCheckReportFilename(result, format) {
  const descriptor = REPORT_FORMATS[format];
  if (!descriptor) throw new TypeError(`Unsupported plan-check report format: ${format}`);
  const sourceName = text(result?.file?.name).replace(/\.[^.]+$/, '');
  return `${fileSlug(sourceName, 'planpruefung')}-pruefergebnis.${descriptor.extension}`;
}

export function downloadPlanCheckReport(result, format) {
  const descriptor = REPORT_FORMATS[format];
  if (!descriptor) throw new TypeError(`Unsupported plan-check report format: ${format}`);
  const builders = {
    csv: buildPlanCheckCsv,
    json: buildPlanCheckJson,
  };
  const filename = planCheckReportFilename(result, format);
  download(builders[format](result), filename, descriptor.mime);
  return filename;
}
