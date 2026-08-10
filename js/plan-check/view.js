// Pure markup for the Plan Check route. Browser event ownership stays in the
// controller and Canvas ownership stays in the viewer factory.

import { LIMITS } from './config.js';

export const PLAN_CHECK_STEPS = Object.freeze(['Standort und Datei', 'Datenqualität', 'Freigabe']);

// Who reviews a submitted plan, and within what time. These are the platform's
// stated service parameters, not values read from the drawing.
export const PLAN_CHECK_APPROVAL = Object.freeze({
  office: 'Flächenmanagement BBL — Zweitprüfung',
  deadline: '3 Arbeitstage',
  defId: 'planfreigabe',
});

export const PLAN_CHECK_TABS = Object.freeze([
  { id: 'rules', label: 'Prüfregeln' },
  { id: 'errors', label: 'Fehlermeldungen' },
  { id: 'layers', label: 'Layer' },
  { id: 'rooms', label: 'Räume' },
  { id: 'areas', label: 'Flächen' },
  { id: 'metrics', label: 'Kennzahlen' },
]);

// The metrics register reports the whole drawing and owns no plan geometry, so
// it takes the full workbench width instead of leaving an idle Canvas beside it.
export const PLAN_CHECK_WIDE_TABS = Object.freeze(['metrics']);

// Only findings are open on arrival. The passed group is by far the largest and
// says nothing actionable; the not-evaluated group is rarer still. Both stay one
// click away, and the controller keeps whatever the visitor opens.
export const PLAN_CHECK_COLLAPSED_GROUPS = Object.freeze(['not-evaluated', 'passed']);

const CATEGORY_LABELS = Object.freeze({
  LAYER: 'Layerstruktur',
  POLY: 'Raumpolygone',
  GPOLY: 'Geschosspolygone',
  AOID: 'Raumstempel',
  GEOM: 'Geometrie',
  TEXT: 'Textelemente',
  STYLE: 'Linientypen und Farben',
  LAYOUT: 'Planlayout',
  DIM: 'Masselemente',
  HATCH: 'Schraffuren',
});

// Building areas as the check reports them, in the reading order of the area
// balance: measured floor area first, then what is derived from it.
const AREA_METRICS = Object.freeze([
  { key: 'gf', code: 'GF', label: 'Geschossfläche' },
  { key: 'kf', code: 'KF', label: 'Konstruktionsfläche' },
  { key: 'ngf', code: 'NGF', label: 'Nettogeschossfläche' },
  { key: 'nf', code: 'NF', label: 'Nutzfläche' },
  { key: 'hnf', code: 'HNF', label: 'Hauptnutzfläche' },
  { key: 'nnf', code: 'NNF', label: 'Nebennutzfläche' },
  { key: 'vf', code: 'VF', label: 'Verkehrsfläche' },
  { key: 'ff', code: 'FF', label: 'Funktionsfläche' },
]);

const AREA_RATIOS = Object.freeze([
  { code: 'NGF / GF', label: 'Nettogeschossfläche / Geschossfläche', numerator: 'ngf', denominator: 'gf' },
  { code: 'KF / GF', label: 'Konstruktionsfläche / Geschossfläche', numerator: 'kf', denominator: 'gf' },
  { code: 'NF / NGF', label: 'Nutzfläche / Nettogeschossfläche', numerator: 'nf', denominator: 'ngf' },
  { code: 'HNF / NGF', label: 'Hauptnutzfläche / Nettogeschossfläche', numerator: 'hnf', denominator: 'ngf' },
]);

const list = (value) => Array.isArray(value) ? value : [];
const finite = (value) => {
  if (value == null || typeof value === 'boolean') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
};
const scalar = (value) => ['string', 'number'].includes(typeof value) ? String(value) : '';

function validationOf(state) {
  return state.result?.validation && typeof state.result.validation === 'object'
    ? state.result.validation : {};
}

function validationIncomplete(validation) {
  return validation?.completeness?.status === 'incomplete'
    || validation?.completeness?.complete === false;
}

function formatNumber(value, maximumFractionDigits = 0) {
  const number = finite(value);
  return number === null ? '–' : new Intl.NumberFormat('de-CH', { maximumFractionDigits }).format(number);
}

function formatArea(value) {
  const number = finite(value);
  return number === null ? '–' : `${formatNumber(number, 1)} m²`;
}

function formatFileSize(value) {
  const bytes = finite(value);
  if (bytes === null || bytes < 0) return '–';
  if (bytes < 1024) return `${formatNumber(bytes)} Byte`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, 1)} KB`;
  return `${formatNumber(bytes / (1024 * 1024), 1)} MB`;
}

function normalizedSeverity(value) {
  const severity = String(value || '').toLowerCase();
  if (severity === 'error' || severity === 'fehler') return 'error';
  if (severity === 'warning' || severity === 'warn' || severity === 'warnung') return 'warning';
  if (severity === 'abort' || severity === 'aborted') return 'abort';
  if (severity === 'not-evaluated') return 'not-evaluated';
  return 'success';
}

function statusDescriptor(value) {
  const status = normalizedSeverity(value);
  if (status === 'error') return { status, label: 'Fehler', variant: 'error', icon: 'Cancel', tone: 'error' };
  if (status === 'warning') return { status, label: 'Warnung', variant: 'warning', icon: 'WarningCircle', tone: 'warning' };
  if (status === 'abort') return { status, label: 'Abgebrochen', variant: 'error', icon: 'Cancel', tone: 'error' };
  if (status === 'not-evaluated') return { status, label: 'Nicht geprüft', variant: 'gray', icon: 'InfoCircle', tone: 'muted' };
  return { status: 'success', label: 'Bestanden', variant: 'success', icon: 'Checkmark', tone: 'success' };
}

function ruleDescriptor(rule) {
  if (rule?.status === 'not-evaluated' || rule?.passed === null) return statusDescriptor('not-evaluated');
  return rule?.status === 'passed' || rule?.passed
    ? statusDescriptor('success')
    : statusDescriptor(rule?.sev);
}

function categoryLabel(value) {
  const category = String(value || '').toUpperCase();
  return CATEGORY_LABELS[category] || scalar(value) || 'Weitere Prüfung';
}

function searchMatch(values, query) {
  if (!query) return true;
  const haystack = values.map((value) => scalar(value)).join(' ').toLocaleLowerCase('de-CH');
  return haystack.includes(query.toLocaleLowerCase('de-CH'));
}

function passesFilter(status, filter) {
  const normalized = normalizedSeverity(status);
  return filter === 'all' || normalized === filter
    || (filter === 'not-evaluated' && normalized === 'abort');
}

function selected(state, type, id) {
  return state.selection?.type === type && String(state.selection?.id) === String(id);
}

// Status marks are drawn here rather than taken from the CD icon set. Those
// icons are hairline outlines built for 24 px headings; at the 16 px of a dense
// register row they all but disappear, and the outcome of a row is the one thing
// that must never be hard to see. These four are solid shapes with distinct
// silhouettes — circle, triangle, check, dash — so they also stay
// distinguishable without colour.
const STATUS_MARKS = Object.freeze({
  error: '<circle cx="8" cy="8" r="7.25"/>'
    + '<path d="M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2" stroke="var(--plan-check-mark-knockout)"'
    + ' stroke-width="1.9" stroke-linecap="round" fill="none"/>',
  warning: '<path d="M8 .9 15.6 14.4a.9.9 0 0 1-.78 1.35H1.18A.9.9 0 0 1 .4 14.4Z"/>'
    + '<path d="M8 5.6v4.1" stroke="var(--plan-check-mark-knockout)" stroke-width="1.9" stroke-linecap="round"/>'
    + '<circle cx="8" cy="12.5" r="1.05" fill="var(--plan-check-mark-knockout)"/>',
  success: '<path d="M2.6 8.4 6.3 12.1 13.4 4.6" fill="none" stroke="currentColor"'
    + ' stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  muted: '<circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/>'
    + '<path d="M4.9 8h6.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
});

function statusIcon(C, descriptor) {
  const tone = Object.hasOwn(STATUS_MARKS, descriptor.tone) ? descriptor.tone : 'muted';
  return `<span class="plan-check-row__status plan-check-row__status--${tone}" aria-hidden="true">`
    + `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" focusable="false">${STATUS_MARKS[tone]}</svg></span>`;
}

// One dense result row: status symbol, monospace identifier, description and an
// optional right-aligned figure. The accessible name repeats identifier,
// category and status so the meaning never depends on symbol colour alone.
function selectionRow(C, {
  type, id, code = '', label, value = '', meta = '', descriptor, active = false, swatch = '',
}) {
  const name = [code || id, meta, label, descriptor?.label].filter(Boolean).join(' · ');
  return `<button class="plan-check-row${active ? ' plan-check-row--selected' : ''}" type="button"
      data-plan-check-select data-select-type="${C.escape(type)}" data-select-id="${C.escape(id)}"
      aria-pressed="${active}" aria-label="${C.escape(name)}">
    ${descriptor ? statusIcon(C, descriptor) : ''}
    ${swatch ? `<span class="plan-check-row__swatch" style="--plan-check-swatch:${swatch}" aria-hidden="true"></span>` : ''}
    ${code ? `<span class="plan-check-row__code" aria-hidden="true">${C.escape(code)}</span>` : ''}
    <span class="plan-check-row__label">${C.escape(label)}</span>
    ${value ? `<span class="plan-check-row__value">${C.escape(value)}</span>` : ''}
  </button>`;
}

function searchControl(C, state, { label, scope, master = null } = {}) {
  return `<div class="plan-check-panel__tools">
    ${master ? `<span class="plan-check-panel__master">
      <input class="plan-check-check" id="plan-check-${scope}-master" type="checkbox"
        ${master.checked ? 'checked' : ''} ${master.attrs || ''} aria-label="${C.escape(master.label)}">
    </span>` : ''}
    <div class="form__group__input plan-check-panel__search">
      <label class="sr-only" for="plan-check-${scope}-search">${C.escape(label)}</label>
      <div class="plan-check-search-control">
        ${C.icon('Search', 'icon--base plan-check-search-control__icon')}
        <input class="input--outline input--sm" id="plan-check-${scope}-search" type="search"
          placeholder="${C.escape(label)}" value="${C.escape(state.search)}" autocomplete="off" data-plan-check-search>
      </div>
    </div>
  </div>`;
}

// Three states, no icons: the register bar competes with six tab labels for the
// same row, and unevaluated rows are already reachable through their own group
// in the rules register.
export function planCheckStatusFilters() {
  return [
    { id: 'all', label: 'Alle' },
    { id: 'warning', label: 'Warnungen' },
    { id: 'error', label: 'Fehler' },
  ];
}

function statusFilterBar(C, state) {
  return `<div class="plan-check-statusfilter" role="group" aria-label="Ergebnisse nach Status filtern">
    ${planCheckStatusFilters().map((filter) => {
      const active = state.filter === filter.id;
      return `<button class="btn btn--sm ${active ? 'btn--filled' : 'btn--outline'} plan-check-statusfilter__button"
        type="button" data-plan-check-filter="${filter.id}" aria-pressed="${active}">
        <span class="btn__text">${filter.label}</span>
      </button>`;
    }).join('')}
  </div>`;
}

function resultGroup(C, { id, label, count, total, rows, collapsed = false }) {
  return `<details class="plan-check-group" data-plan-check-group="${C.escape(id)}"${collapsed ? '' : ' open'}>
    <summary class="plan-check-group__head">
      ${C.icon('ChevronDown', 'icon--sm plan-check-group__chevron')}
      <span class="plan-check-group__label">${C.escape(label)}</span>
      <span class="plan-check-group__count">${formatNumber(count)}${total == null ? '' : `/${formatNumber(total)}`}</span>
    </summary>
    <ul class="plan-check-rows">${rows.map((row) => `<li>${row}</li>`).join('')}</ul>
  </details>`;
}

function panelSummary(count, unit) {
  return `<p class="small muted plan-check-panel__count plan-check-results__summary">${formatNumber(count)} ${unit} angezeigt.</p>`;
}

function rulesPanel(C, state) {
  const allRules = list(validationOf(state).rules);
  const rules = allRules.filter((rule) => {
    const descriptor = ruleDescriptor(rule);
    return passesFilter(descriptor.status, state.filter)
      && searchMatch([rule?.code, rule?.description, rule?.cat, categoryLabel(rule?.cat)], state.search);
  }).map((rule) => ({ rule, descriptor: ruleDescriptor(rule) }));
  const groups = [
    { id: 'failed', label: 'Nicht bestanden', match: (status) => status === 'error' || status === 'warning' || status === 'abort' },
    { id: 'not-evaluated', label: 'Nicht geprüft', match: (status) => status === 'not-evaluated' },
    { id: 'passed', label: 'Bestanden', match: (status) => status === 'success' },
  ];
  const total = allRules.length;
  const rendered = groups.map((group) => {
    const entries = rules.filter(({ descriptor }) => group.match(descriptor.status));
    if (!entries.length) return '';
    return resultGroup(C, {
      id: group.id, label: group.label, count: entries.length, total,
      collapsed: state.collapsedGroups?.has(group.id) === true,
      rows: entries.map(({ rule, descriptor }) => {
        const id = scalar(rule?.code) || 'Unbekannte Regel';
        const count = finite(rule?.errorCount);
        return selectionRow(C, {
          type: 'rule', id, code: id, meta: categoryLabel(rule?.cat),
          label: scalar(rule?.description) || id,
          value: count ? `${formatNumber(count)}×` : '',
          descriptor, active: selected(state, 'rule', id),
        });
      }),
    });
  }).join('');
  return `${searchControl(C, state, { label: 'Regel suchen', scope: 'rules' })}
    ${panelSummary(rules.length, 'Prüfregeln')}
    ${rendered || C.empty('Keine Prüfregeln entsprechen dem Filter.', {
      hint: 'Passen Sie Suche oder Statusfilter an.',
    })}`;
}

function errorsPanel(C, state) {
  const errors = list(validationOf(state).errors).filter((error) => (
    passesFilter(error?.severity, state.filter)
      && searchMatch([
        error?.ruleCode, error?.message, error?.category, error?.handle, error?.layer,
        ...list(error?.handles),
      ], state.search)
  ));
  return `${searchControl(C, state, { label: 'Feststellung suchen', scope: 'errors' })}
    ${panelSummary(errors.length, 'Feststellungen')}
    ${errors.length ? `<ul class="plan-check-rows plan-check-rows--flat">${errors.map((error, index) => {
      const id = scalar(error?.id) || `${scalar(error?.ruleCode) || 'Feststellung'}-${index + 1}`;
      const handles = [...new Set([error?.handle, ...list(error?.handles)].map(scalar).filter(Boolean))];
      const location = handles.length ? `${formatNumber(handles.length)} ${handles.length === 1 ? 'Objekt' : 'Objekte'}`
        : scalar(error?.layer) ? `Layer ${scalar(error.layer)}` : '';
      return `<li>${selectionRow(C, {
        type: 'error', id, code: scalar(error?.ruleCode),
        label: scalar(error?.message) || scalar(error?.ruleCode) || 'Feststellung',
        value: location, meta: categoryLabel(error?.category),
        descriptor: statusDescriptor(error?.severity), active: selected(state, 'error', id),
      })}</li>`;
    }).join('')}</ul>` : C.empty('Keine Fehlermeldungen entsprechen dem Filter.', {
      hint: list(validationOf(state).errors).length
        ? 'Passen Sie Suche oder Statusfilter an.'
        : 'Die Prüfung hat keine Fehler oder Warnungen gefunden.',
    })}`;
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : 'var(--color-text-muted)';
}

function layersPanel(C, state) {
  const allLayers = list(state.result?.layers);
  const layers = allLayers.filter((layer) => searchMatch([layer?.name, layer?.count], state.search));
  const visibleCount = allLayers.filter((layer) => !state.hiddenLayers.has(scalar(layer?.name))).length;
  return `${searchControl(C, state, {
    label: 'Layer suchen', scope: 'layers',
    master: {
      label: 'Alle Layer im Plan anzeigen',
      checked: allLayers.length > 0 && visibleCount === allLayers.length,
      attrs: 'data-plan-check-layers-all',
    },
  })}
    ${panelSummary(layers.length, 'Layer')}
    ${layers.length ? `<ul class="plan-check-rows plan-check-rows--flat">${layers.map((layer, index) => {
      const name = scalar(layer?.name) || `Layer ${index + 1}`;
      const visible = !state.hiddenLayers.has(name);
      const isSelected = selected(state, 'layer', name);
      const count = finite(layer?.count) || 0;
      return `<li class="plan-check-layer${isSelected ? ' plan-check-layer--selected' : ''}${visible ? '' : ' plan-check-layer--hidden'}">
        <input class="plan-check-check" id="plan-check-layer-${index}" type="checkbox"
          data-plan-check-layer="${C.escape(name)}" aria-label="Layer ${C.escape(name)} im Plan anzeigen"${visible ? ' checked' : ''}>
        ${selectionRow(C, {
          type: 'layer', id: name, code: name, label: '',
          value: `${formatNumber(count)} ${count === 1 ? 'Objekt' : 'Objekte'}`,
          meta: visible ? '' : 'Ausgeblendet', swatch: safeColor(layer?.colorHex),
          descriptor: null, active: isSelected,
        })}
      </li>`;
    }).join('')}</ul>` : C.empty('Keine Layer entsprechen der Suche.', {
      hint: 'Passen Sie den Suchbegriff an.',
    })}`;
}

function spatialPanel(C, state, type) {
  const isRoom = type === 'room';
  const source = list(isRoom ? validationOf(state).rooms : validationOf(state).areas);
  const hidden = (isRoom ? state.hiddenRooms : state.hiddenAreas) || new Set();
  // Identity mirrors the viewer's `spatialIdentity`, so a row and its polygon
  // are the same thing to both sides.
  const identity = (item, index) => scalar(item?.id) || scalar(item?.handle) || `${type}-${index + 1}`;
  const entries = source.map((item, index) => ({ item, id: identity(item, index), index }))
    .filter(({ item }) => passesFilter(item?.status, state.filter)
      && searchMatch([item?.aoid, item?.id, item?.label, item?.layer, item?.status], state.search));
  const singular = isRoom ? 'Raum' : 'Fläche';
  const plural = isRoom ? 'Räume' : 'Flächen';
  const scope = isRoom ? 'rooms' : 'areas';
  return `${searchControl(C, state, {
    label: `${singular} suchen`, scope,
    master: {
      label: `Alle ${plural} im Plan anzeigen`,
      checked: source.length > 0 && hidden.size === 0,
      attrs: `data-plan-check-spatial-all="${type}"`,
    },
  })}
    ${panelSummary(entries.length, plural)}
    ${entries.length ? `<ul class="plan-check-rows plan-check-rows--flat">${entries.map(({ item, id, index }) => {
      const code = scalar(item?.aoid) || scalar(item?.label) || `${singular} ${index + 1}`;
      const visible = !hidden.has(id);
      return `<li class="plan-check-layer${visible ? '' : ' plan-check-layer--hidden'}">
        <input class="plan-check-check" id="plan-check-${scope}-${index}" type="checkbox"
          data-plan-check-spatial="${C.escape(type)}" data-spatial-id="${C.escape(id)}"
          aria-label="${C.escape(`${singular} ${code} im Plan anzeigen`)}"${visible ? ' checked' : ''}>
        ${selectionRow(C, {
          type, id, code, label: scalar(item?.label) !== code ? scalar(item?.label) : '',
          value: formatArea(item?.area), meta: scalar(item?.layer),
          descriptor: statusDescriptor(item?.status), active: selected(state, type, id),
        })}
      </li>`;
    }).join('')}</ul>` : C.empty(`Keine ${plural} entsprechen dem Filter.`, {
      hint: source.length ? 'Passen Sie Suche oder Statusfilter an.' : `In der Zeichnung wurden keine ${plural} erkannt.`,
    })}`;
}

function metricRow(C, { code, label, value, share = '' }) {
  return `<tr><th scope="row" class="plan-check-metric__code">${C.escape(code)}</th>
    <td class="plan-check-metric__label">${C.escape(label)}</td>
    <td class="plan-check-metric__value">${C.escape(value)}</td>
    ${share === null ? '' : `<td class="plan-check-metric__share">${C.escape(share || '–')}</td>`}</tr>`;
}

function metricTable(C, { caption, columns, rows }) {
  return `<div class="plan-check-metric-table"><table class="table table--compact">
    <caption class="sr-only">${C.escape(caption)}</caption>
    <thead><tr>${columns.map((column, index) => (
      `<th scope="col"${index ? ` class="plan-check-metric__${['label', 'value', 'share'][index - 1] || 'share'}"` : ''}>${C.escape(column)}</th>`
    )).join('')}</tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function metricsPanel(C, state) {
  const validation = validationOf(state);
  const metrics = validation.metrics && typeof validation.metrics === 'object' ? validation.metrics : {};
  const entities = list(state.result?.drawing?.entitySummary);
  const base = finite(metrics.gf);
  const share = (value) => {
    const number = finite(value);
    return base && number !== null ? `${formatNumber((number / base) * 100)} %` : '';
  };
  const netArea = planCheckNetArea(metrics, validation.rooms);
  const areaRows = AREA_METRICS.map(({ key, code, label }) => metricRow(C, {
    code, label, value: formatArea(metrics[key]), share: share(metrics[key]),
  })).join('');
  const ratioRows = AREA_RATIOS.map(({ code, label, numerator, denominator }) => {
    const top = finite(metrics[numerator]);
    const bottom = finite(metrics[denominator]);
    return metricRow(C, {
      code, label, share: null,
      value: top !== null && bottom ? formatNumber(top / bottom, 2) : '–',
    });
  }).join('');
  const categoriesKnown = Object.keys(metrics.categoryTotals || {}).length > 0;
  return `<div class="plan-check-metrics">
    <section class="plan-check-metrics__column" aria-labelledby="plan-check-area-metrics">
      <h4 id="plan-check-area-metrics">Flächenbilanz</h4>
      <p class="plan-check-metrics__eyebrow">Gemessene Polygonflächen</p>
      ${metricTable(C, {
        caption: 'Direkt aus der Zeichnung gemessene Flächen',
        columns: ['Kennzahl', 'Bezeichnung', 'Wert', 'Anteil GF'],
        rows: metricRow(C, {
          code: 'RP', label: 'Summe Raumpolygone (unklassifiziert)',
          value: formatArea(netArea), share: share(netArea),
        }),
      })}
      <p class="plan-check-metrics__eyebrow">Gebäudeflächen <span class="muted">— Anteil an der Geschossfläche GF</span></p>
      ${metricTable(C, {
        caption: 'Gebäudeflächen und ihr Anteil an der Geschossfläche',
        columns: ['Kennzahl', 'Bezeichnung', 'Wert', 'Anteil GF'],
        rows: areaRows,
      })}
      ${metrics.categorySource === 'convention' ? `<p class="small muted plan-check-metrics__note">
        Der DWG-Datenvertrag führt keine Nutzungszuordnung nach SIA 416. Nicht klassierte Räume werden
        deshalb konventionsgemäss als Hauptnutzfläche gezählt; NNF, VF und FF bleiben leer, bis die
        Zeichnung eine Nutzungsangabe mitliefert. GF und KF sind gemessen, HNF und NGF sind aus dieser
        Konvention abgeleitet.</p>` : categoriesKnown ? '' : `<p class="small muted plan-check-metrics__note">
        Ohne Raumpolygone lässt sich keine Flächenbilanz bilden. Die Werte bleiben leer – das ist eine
        fehlende Grundlage, kein Messwert von null.</p>`}
    </section>
    <section class="plan-check-metrics__column" aria-labelledby="plan-check-ratio-metrics">
      <h4 id="plan-check-ratio-metrics">Wirtschaftlichkeitskennzahlen</h4>
      ${metricTable(C, {
        caption: 'Verhältnisse zwischen den Flächenkennzahlen',
        columns: ['Kennzahl', 'Bezeichnung', 'Wert'],
        rows: ratioRows,
      })}
      <h4 id="plan-check-entity-metrics">Entitäten im DWG</h4>
      ${entities.length ? `<div class="plan-check-metric-table" data-scroll-region><table class="table table--compact">
        <caption class="sr-only">Objekte nach DWG-Typ und ihren Layern</caption>
        <thead><tr><th scope="col">Objekttyp</th><th scope="col" class="plan-check-metric__value">Anzahl</th><th scope="col" class="plan-check-metric__label">Layer</th></tr></thead>
        <tbody>${entities.map((entry) => {
          const layers = list(entry?.layers).map(scalar).filter(Boolean);
          const shown = layers.slice(0, 3).join(', ');
          return `<tr><th scope="row" class="plan-check-metric__code">${C.escape(entry?.type || entry?.name || '–')}</th>
            <td class="plan-check-metric__value">${formatNumber(entry?.count)}</td>
            <td class="plan-check-metric__layers" title="${C.escape(layers.join(', '))}">${
              shown ? `${C.escape(shown)}${layers.length > 3 ? ' …' : ''}` : '–'}</td></tr>`;
        }).join('')}</tbody>
      </table></div>` : C.empty('Keine Objektstatistik verfügbar.')}
    </section>
  </div>`;
}

export function planCheckNetArea(metrics, rooms) {
  const values = metrics && typeof metrics === 'object' ? metrics : {};
  if (Object.hasOwn(values, 'roomPolygonArea')) return finite(values.roomPolygonArea);
  if (Object.hasOwn(values, 'ngf')) return finite(values.ngf);
  const roomAreas = list(rooms).map((room) => finite(room?.area)).filter((area) => area !== null);
  return roomAreas.length ? roomAreas.reduce((sum, area) => sum + area, 0) : null;
}

export function renderPlanCheckPanel(C, state, tab = state.tab) {
  if (tab === 'rules') return rulesPanel(C, state);
  if (tab === 'errors') return errorsPanel(C, state);
  if (tab === 'layers') return layersPanel(C, state);
  if (tab === 'rooms') return spatialPanel(C, state, 'room');
  if (tab === 'areas') return spatialPanel(C, state, 'area');
  return metricsPanel(C, state);
}

// --- Viewer chrome ----------------------------------------------------------

// Short identity of a selection, used by the inspector and the announcer.
// The full attribute set is produced by the viewer, which owns the geometry.
export function planCheckSelectionSummary(selection, result) {
  const validation = result?.validation || {};
  const type = selection?.type;
  const id = String(selection?.id ?? '');
  if (type === 'rule') {
    const rule = list(validation.rules).find((item) => String(item?.code) === id);
    return {
      title: id,
      subtitle: rule ? `${categoryLabel(rule.cat)} · ${scalar(rule.description)}` : 'Prüfregel',
      status: rule ? ruleDescriptor(rule).status : 'not-evaluated',
    };
  }
  if (type === 'error') {
    const errors = list(validation.errors);
    const index = errors.findIndex((item, position) => (
      String(item?.id ?? `${item?.ruleCode || 'Feststellung'}-${position + 1}`) === id
    ));
    const error = index >= 0 ? errors[index] : null;
    return {
      title: scalar(error?.ruleCode) || id,
      subtitle: scalar(error?.message),
      status: normalizedSeverity(error?.severity),
    };
  }
  if (type === 'room' || type === 'area') {
    const source = list(type === 'room' ? validation.rooms : validation.areas);
    const item = source.find((entry, index) => (
      String(entry?.id ?? entry?.handle ?? `${type}-${index + 1}`) === id
    ));
    const areaText = formatArea(item?.area);
    return {
      title: scalar(item?.aoid) || id,
      subtitle: [type === 'room' ? 'Raumpolygon' : 'Geschosspolygon', areaText !== '–' ? areaText : '']
        .filter(Boolean).join(' · '),
      status: normalizedSeverity(item?.status),
    };
  }
  if (type === 'layer') return { title: id, subtitle: 'Layer', status: 'success' };
  return { title: id || 'Objekt', subtitle: 'CAD-Objekt', status: 'success' };
}

// The attribute card anchored at the selected element. `details` is produced by
// the viewer (planCheckSelectionDetails); this function only renders it.
export function renderPlanCheckInspector(C, details) {
  if (!details) return '';
  const descriptor = statusDescriptor(details.status);
  const rows = list(details.rows).filter((row) => row && row.value != null && row.value !== '');
  return `<div class="plan-check-inspector__head">
      ${statusIcon(C, descriptor)}
      <span class="plan-check-inspector__title">
        <span class="plan-check-inspector__name">${C.escape(details.title || 'Objekt')}</span>
        ${details.subtitle ? `<span class="plan-check-inspector__subtitle">${C.escape(details.subtitle)}</span>` : ''}
      </span>
      <button class="btn btn--bare btn--sm btn--icon-only plan-check-inspector__close" type="button"
        data-plan-check-action="clear-selection" aria-label="Objektdetails schliessen und Auswahl aufheben">
        ${C.icon('Cancel', 'btn__icon')}</button>
    </div>
    ${rows.length ? `<dl class="plan-check-inspector__facts">${rows.map((row) => (
      `<dt>${C.escape(row.label)}</dt><dd${row.mono ? ' class="plan-check-inspector__mono"' : ''}>${
        row.swatch ? `<span class="plan-check-inspector__swatch" style="--plan-check-swatch:${safeColor(row.swatch)}" aria-hidden="true"></span>` : ''
      }${C.escape(row.value)}</dd>`
    )).join('')}</dl>` : ''}
    ${list(details.findings).length ? `<div class="plan-check-inspector__findings">
      <p class="plan-check-inspector__findings-title">${formatNumber(details.findings.length)} ${
        details.findings.length === 1 ? 'Feststellung' : 'Feststellungen'}</p>
      <ul>${details.findings.slice(0, 4).map((finding) => {
        const findingStatus = statusDescriptor(finding.severity);
        return `<li>${statusIcon(C, findingStatus)}<span><span class="plan-check-inspector__mono">${
          C.escape(finding.ruleCode || '')}</span> ${C.escape(finding.message || '')}</span></li>`;
      }).join('')}</ul>
      ${details.findings.length > 4 ? `<p class="small muted">${formatNumber(details.findings.length - 4)} weitere in der Liste «Fehlermeldungen».</p>` : ''}
    </div>` : ''}
    ${details.truncated ? `<p class="small muted plan-check-inspector__note">Nur die ersten hervorgehobenen Objekte werden ausgewiesen.</p>` : ''}`;
}

// --- Upload stage -----------------------------------------------------------

function locationSummary(C, state, context) {
  const building = context.building || null;
  const floor = context.floor || null;
  if (context.selectable && list(context.buildings).length) {
    const buildingOptions = [
      { value: '', label: 'Objekt wählen' },
      ...context.buildings.map((item) => ({
        value: scalar(item?.bbl_id || item?.id),
        label: `${scalar(item?.name || item?.label) || 'Objekt'}${scalar(item?.city) ? ` · ${scalar(item.city)}` : ''}`,
      })),
    ];
    const floorOptions = [
      { value: '', label: state.buildingId ? 'Geschoss wählen' : 'Zuerst Objekt wählen' },
      ...list(context.floors).map((item) => ({
        value: scalar(item?.floorId || item?.id), label: scalar(item?.label || item?.name) || 'Geschoss',
      })),
    ];
    return `<div class="plan-check-location-fields">
      ${C.select({
        id: 'plan-check-building', label: 'Objekt (optional)', value: state.buildingId,
        options: buildingOptions, attrsHtml: 'data-plan-check-building',
      })}
      ${C.select({
        id: 'plan-check-floor', label: 'Geschoss (optional)', value: state.floorId,
        disabled: !state.buildingId || !context.floors.length, options: floorOptions,
        attrsHtml: 'data-plan-check-floor',
      })}
    </div>`;
  }
  if (!building && !floor) {
    return C.notification(
      'Kein Standort ist vorausgewählt. Die Datei wird lokal geprüft und keinem Objekt zugeordnet.',
      'hint', 'InfoCircle',
    );
  }
  const buildingName = scalar(building?.name || building?.label || building?.title) || 'Objekt';
  const buildingId = scalar(building?.bbl_id || building?.id);
  const addressValue = building?.address;
  const address = scalar(addressValue) || [
    scalar(addressValue?.street || building?.street),
    [scalar(addressValue?.zip || building?.zip), scalar(addressValue?.city || building?.city)].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');
  const floorName = scalar(floor?.label || floor?.name) || 'Kein Geschoss vorausgewählt';
  const floorId = scalar(floor?.floorId || floor?.id);
  return `<div class="plan-check-location box">
    <p class="eyebrow">Aus dem Objektregister übernommen</p>
    <h3>${C.escape(buildingName)}</h3>
    <dl class="kv kv--stack">
      ${buildingId ? `<dt>Objekt-ID</dt><dd>${C.escape(buildingId)}</dd>` : ''}
      ${address ? `<dt>Adresse</dt><dd>${C.escape(address)}</dd>` : ''}
      <dt>Geschoss</dt><dd>${C.escape(floorName)}${floorId ? ` <span class="muted">(${C.escape(floorId)})</span>` : ''}</dd>
    </dl>
  </div>`;
}

export function renderPlanCheckUploadState(C, state) {
  if (state.phase === 'loading') {
    const value = Math.round(Math.max(0, Math.min(1, finite(state.progress?.value) ?? 0)) * 100);
    return `<div class="plan-check-file-drop__state">
      ${C.loading({ label: state.progress?.label || 'DWG-Datei wird geprüft…', size: 'xl' })}
      <progress class="plan-check-progress" max="100" value="${value}"
        aria-label="Fortschritt der DWG-Prüfung">${value} %</progress>
      <span class="small muted">${value} %</span>
    </div>`;
  }
  return `<div class="plan-check-file-drop__state">
    ${C.icon('CloudUpload', 'icon--2xl plan-check-file-drop__icon')}
    <strong>DWG-Datei hierher ziehen oder mit dem Dateifeld auswählen</strong>
  </div>`;
}

function uploadStage(C, state, context) {
  const loading = state.phase === 'loading';
  return `<form class="plan-check-form" data-plan-check-form aria-busy="${loading}">
    ${context.contextWarning ? C.notification(context.contextWarning, 'warning', 'WarningCircle') : ''}
    <section class="plan-check-section" aria-labelledby="plan-check-location-heading">
      <h3 id="plan-check-location-heading">Standort</h3>
      ${locationSummary(C, state, context)}
    </section>
    <section class="plan-check-section" aria-labelledby="plan-check-change-heading">
      <h3 id="plan-check-change-heading">Änderung</h3>
      <fieldset class="plan-check-change-type">
        <legend>Art der Änderung</legend>
        <div class="plan-check-radio-row">
          <label><input type="radio" name="plan-change-type" value="new" data-plan-check-change-type${state.changeType !== 'mutation' ? ' checked' : ''}> Neuer Plan</label>
          <label><input type="radio" name="plan-change-type" value="mutation" data-plan-check-change-type${state.changeType === 'mutation' ? ' checked' : ''}> Mutation eines bestehenden Plans</label>
        </div>
      </fieldset>
      <div class="plan-check-change-fields" data-plan-check-change-fields${state.changeType === 'mutation' ? '' : ' hidden'}>
        <div class="form__group__input">
          <label class="text--asterisk" for="plan-check-change-reason">Änderungsgrund<span class="sr-only"> Pflichtfeld</span></label>
          <textarea class="input--outline input--base" id="plan-check-change-reason" name="plan-change-reason" rows="3"
            maxlength="${LIMITS.changeReasonLength}" data-plan-check-change-reason${state.changeType === 'mutation' ? ' required aria-required="true"' : ''}>${C.escape(state.changeReason)}</textarea>
        </div>
        <div class="plan-check-change-fields__row">
          <div class="form__group__input">
            <label for="plan-check-effective-date">Gültig ab <span class="muted">(optional)</span></label>
            <input class="input--outline input--base" id="plan-check-effective-date" name="plan-effective-date" type="date"
              value="${C.escape(state.effectiveDate)}" data-plan-check-effective-date>
          </div>
          <div class="form__group__input">
            <label for="plan-check-reference">Referenz <span class="muted">(optional)</span></label>
            <input class="input--outline input--base" id="plan-check-reference" name="plan-reference" type="text"
              value="${C.escape(state.reference)}" maxlength="120" data-plan-check-reference>
          </div>
        </div>
        <p class="small muted">Diese Angaben werden nur in die lokalen Exporte aufgenommen. Es wird kein Freigabevorgang erstellt.</p>
      </div>
    </section>
    <section class="plan-check-section" aria-labelledby="plan-check-file-heading">
      <h3 id="plan-check-file-heading">Datei</h3>
      <p id="plan-check-file-hint" class="form__group__hint">Zugelassen sind DWG-Dateien bis 50 MiB. Die Zeichnung wird ausschliesslich in Ihrem Browser verarbeitet.</p>
      <div id="plan-check-file-message" data-plan-check-file-message>${state.fileError ? C.notification(state.fileError, 'error', 'WarningCircle') : ''}</div>
      <div class="plan-check-file-drop${state.dragActive ? ' plan-check-file-drop--dragover' : ''}${state.fileError ? ' plan-check-file-drop--error' : ''}${loading ? ' plan-check-file-drop--loading' : ''}"
        data-plan-check-drop-zone>
        ${renderPlanCheckUploadState(C, state)}
        <div class="plan-check-file-field">
          <input class="sr-only plan-check-file-field__input" id="plan-check-file" name="plan-check-file" type="file"
            accept=".dwg"${state.file ? '' : ' required'} aria-required="true"
            aria-describedby="plan-check-file-hint plan-check-file-message plan-check-file-name"
            ${state.fileError ? 'aria-invalid="true"' : ''}${loading ? ' disabled' : ''} data-plan-check-file>
          <label class="btn btn--outline plan-check-file-field__button" for="plan-check-file">
            <span class="btn__text-centered" aria-hidden="true">Datei auswählen</span>
            <span class="sr-only">DWG-Datei auswählen, Pflichtfeld</span>
          </label>
          <span class="small muted plan-check-file-field__name" id="plan-check-file-name" data-plan-check-file-name${state.file ? '' : ' hidden'}>${C.escape(state.file?.name || '')}</span>
        </div>
      </div>
      <ul class="plan-check-requirements">
        <li>DWG-Zeichnung mit Modellbereich und lesbarer Layerstruktur</li>
        <li>Geschlossene Raum- und Geschosspolygone für die Flächenauswertung</li>
        <li>Zeichnungseinheit und Koordinaten werden aus der Datei übernommen</li>
      </ul>
    </section>
    <div class="plan-check-actions">
      <button class="btn btn--outline" type="button" data-plan-check-action="abort"${loading ? '' : ' hidden'}>
        <span class="btn__text">Prüfung abbrechen</span>
      </button>
      ${contextualReturnButton(C, context)}
      <button class="btn btn--filled${loading ? ' btn--loading' : ''}" type="submit"
        ${!state.file || loading ? 'disabled' : ''} aria-busy="${loading}">
        ${loading ? C.icon('Spinner', 'btn__icon icon--spin') : C.icon('Search', 'btn__icon')}
        <span class="btn__text">${loading ? 'Datei wird geprüft…' : 'Prüfen'}</span>
      </button>
    </div>
  </form>`;
}

// --- Quality stage ----------------------------------------------------------

function tabItems(state) {
  const validation = validationOf(state);
  const rules = list(validation.rules);
  const evaluatedRules = rules.filter((rule) => rule?.status !== 'not-evaluated' && rule?.passed !== null).length;
  const passedRules = rules.filter((rule) => rule?.status === 'passed' || rule?.passed === true).length;
  const counts = {
    rules: `${passedRules}/${evaluatedRules}`,
    errors: list(validation.errors).length,
    layers: list(state.result?.layers).length,
    rooms: list(validation.rooms).length,
    areas: list(validation.areas).length,
  };
  return PLAN_CHECK_TABS.map((tab) => ({
    ...tab,
    label: counts[tab.id] == null ? tab.label : `${tab.label} (${counts[tab.id]})`,
  }));
}

// A finished check needs no banner: the score, the readability badge, the
// register counts and the status filter already state the outcome, and a
// full-width coloured block on every result reads as an alarm even when nothing
// is wrong. Only an ABORTED check keeps one, because there the score shows «–»
// and nothing else on the page explains why.
function qualitySummary(C, state) {
  if (!validationOf(state).aborted) return '';
  return C.notification(
    'Die fachliche Prüfung wurde sicher beendet. Zeichnungseinheit oder Grundvoraussetzungen erlauben keine verlässliche Flächenauswertung.',
    'error', 'WarningCircle',
  );
}

// Readability of the source file as the parser found it — a fact about the
// intake, kept apart from the rule score.
function readabilityBadge(C, state) {
  const validation = validationOf(state);
  if (validation.aborted) return C.badge('Nicht auswertbar', 'error', 'sm');
  if (validationIncomplete(validation)) return C.badge('Teilweise lesbar', 'warning', 'sm');
  return C.badge('Lesbar', 'success', 'sm');
}

function fileBar(C, state) {
  const result = state.result || {};
  const change = result.checkContext?.change || { type: state.changeType, reason: state.changeReason };
  const facts = [
    ['Dateigrösse', formatFileSize(result.file?.size ?? state.file?.size)],
    ['DWG-Version', C.escape(result.database?.version || '–')],
    ['Layer', formatNumber(result.database?.layerCount ?? list(result.layers).length)],
    ['Objekte', formatNumber(result.database?.entityCount)],
    ['Prüfdauer', `${formatNumber((finite(result.elapsedMs) || 0) / 1000, 1)} s`],
    ['Änderung', change.type === 'mutation' ? 'Mutation eines bestehenden Plans' : 'Neuer Plan'],
    ...(change.type === 'mutation' && change.reason ? [['Änderungsgrund', C.escape(change.reason)]] : []),
  ];
  return `<section class="plan-check-file-summary" aria-labelledby="plan-check-file-summary-heading">
    ${C.icon('File', 'icon--md plan-check-file-summary__icon')}
    <div class="plan-check-file-summary__body">
      <h2 id="plan-check-file-summary-heading">${C.escape(result.file?.name || state.file?.name || 'DWG-Datei')}</h2>
      <dl class="plan-check-file-summary__facts">
        ${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}
      </dl>
      ${validationIncomplete(validationOf(state)) ? `<p class="plan-check-file-summary__note">
        Teile der Zeichnung konnten nicht normalisiert werden — die betroffenen Objekte stehen
        unter «Fehlermeldungen» als INCOMPLETE_001.</p>` : ''}
    </div>
    ${readabilityBadge(C, state)}
  </section>`;
}

function figuresBand(C, state) {
  const validation = validationOf(state);
  const rules = list(validation.rules);
  const metrics = validation.metrics || {};
  const netArea = planCheckNetArea(metrics, validation.rooms);
  const evaluatedRules = finite(metrics.evaluatedRules)
    ?? rules.filter((rule) => rule?.status !== 'not-evaluated' && rule?.passed !== null).length;
  const score = validation.aborted
    ? `<strong class="plan-check-figure__value">–</strong>
       <small>Nicht ausgewertet · Prüfung abgebrochen</small>`
    : `<strong class="plan-check-figure__value plan-check-figure__value--score">${formatNumber(validation.score)} %</strong>
       <small>${formatNumber(validation.passedRules)} von ${formatNumber(evaluatedRules)} geprüften Regeln</small>`;
  const ngf = finite(metrics.ngf);
  return `<div class="plan-check-figures">
    <div class="plan-check-figure"><p class="plan-check-figure__label">Räume</p>
      <strong class="plan-check-figure__value">${formatNumber(list(validation.rooms).length)}</strong></div>
    <div class="plan-check-figure"><p class="plan-check-figure__label">${ngf === null ? 'Raumpolygonfläche' : 'NGF'}</p>
      <strong class="plan-check-figure__value">${formatArea(ngf === null ? netArea : ngf)}</strong></div>
    <div class="plan-check-figure"><p class="plan-check-figure__label">Erfüllungsgrad</p>${score}</div>
    <div class="plan-check-figure plan-check-figure--actions"><p class="plan-check-figure__label">Prüfbericht</p>
      <div class="plan-check-report-actions">
        <button class="btn btn--outline btn--sm" type="button" data-plan-check-report="pdf"><span class="btn__text">PDF</span></button>
        <button class="btn btn--outline btn--sm" type="button" data-plan-check-report="excel"><span class="btn__text">Excel</span></button>
      </div>
    </div>
  </div>`;
}

// Purpose-built glyphs rather than the design system's icon set. Two reasons:
// the set has no mark for «fit», «zoom to selection», «dark background» or
// «fullscreen», so those buttons previously borrowed a magnifier, an eyedropper
// and a monitor — none of which say what they do; and its hairline weight
// disappears against a drawing, which is exactly what this strip floats over.
const VIEWER_TOOL_SHAPES = Object.freeze({
  // The whole drawing sitting inside the view: two nested frames. Arrowheads
  // were tried first and blob together — at 20 px a head is shorter than the
  // stroke that draws it.
  fit: '<rect x="2" y="3.6" width="16" height="12.8" rx="1"/>'
    + '<rect x="6.8" y="7.6" width="6.4" height="4.8" rx=".6"/>',
  // Magnifier with a plus.
  'zoom-in': '<circle cx="8.6" cy="8.6" r="5.1"/><path d="m12.4 12.4 4.1 4.1"/><path d="M8.6 6.4v4.4M6.4 8.6h4.4"/>',
  'zoom-out': '<circle cx="8.6" cy="8.6" r="5.1"/><path d="m12.4 12.4 4.1 4.1"/><path d="M6.4 8.6h4.4"/>',
  // Crosshair closing on one marked object: this zooms to the selection.
  'focus-selection': '<rect x="7.2" y="7.2" width="5.6" height="5.6" rx=".8"/>'
    + '<path d="M10 1.9v2.6M10 15.5v2.6M1.9 10h2.6M15.5 10h2.6"/>',
  // Half-filled disc: the standard contrast mark, here for the dark plan ground.
  background: '<circle cx="10" cy="10" r="7.1"/>'
    + '<path d="M10 2.9a7.1 7.1 0 0 1 0 14.2Z" fill="currentColor" stroke="none"/>',
  // Corner brackets pointing out.
  fullscreen: '<path d="M3.4 7.6V3.4h4.2M16.6 7.6V3.4h-4.2M3.4 12.4v4.2h4.2M16.6 12.4v4.2h-4.2"/>',
});

function viewerToolIcon(action) {
  const shape = VIEWER_TOOL_SHAPES[action];
  if (!shape) return '';
  return `<svg class="plan-check-viewer__tool-icon" viewBox="0 0 20 20" width="20" height="20"
    fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
    focusable="false" aria-hidden="true">${shape}</svg>`;
}

function viewerTool(C, { action, label, pressed = null }) {
  return `<button class="btn btn--bare btn--sm btn--icon-only plan-check-viewer__tool" type="button"
    data-viewer-action="${action}" aria-label="${C.escape(label)}" title="${C.escape(label)}"${
    pressed === null ? '' : ` aria-pressed="${pressed}"`}>${viewerToolIcon(action)}</button>`;
}

function viewerMarkup(C, state) {
  const drawingEmpty = !list(state.result?.drawing?.renderList).length;
  return `<section class="plan-check-viewer" data-plan-check-viewer aria-labelledby="plan-check-viewer-heading">
    <h3 id="plan-check-viewer-heading" class="sr-only">Planansicht</h3>
    <p class="sr-only" id="plan-check-canvas-help">Pfeiltasten verschieben den Plan. Plus und Minus zoomen. Pos1 oder F passt den Plan ein. Eingabe wählt das Objekt in der Planmitte. Escape hebt die Auswahl auf.</p>
    <div class="plan-check-viewer__canvas-wrap" data-plan-check-canvas-wrap>
      <canvas class="plan-check-viewer__canvas" data-plan-check-canvas tabindex="0"
        aria-label="Interaktive DWG-Planansicht" aria-describedby="plan-check-canvas-help">
        Die interaktive Zeichnung wird von Ihrem Browser nicht unterstützt. Alle Prüfergebnisse stehen zusätzlich als Textlisten bereit.
      </canvas>
      ${drawingEmpty ? `<div class="plan-check-viewer__empty">${C.empty('Keine darstellbaren CAD-Objekte gefunden.', {
        hint: 'Die Textlisten bleiben für die Diagnose verfügbar.',
      })}</div>` : ''}
      <div class="plan-check-viewer__tools" role="group" aria-label="Planansicht steuern">
        ${viewerTool(C, { action: 'fit', label: 'Gesamten Plan einpassen' })}
        ${viewerTool(C, { action: 'zoom-in', label: 'Plan vergrössern' })}
        ${viewerTool(C, { action: 'zoom-out', label: 'Plan verkleinern' })}
        <span class="plan-check-viewer__tools-divider" aria-hidden="true"></span>
        ${viewerTool(C, { action: 'focus-selection', label: 'Auf Auswahl zoomen' })}
        ${viewerTool(C, { action: 'background', label: 'Dunklen Hintergrund umschalten', pressed: state.background === 'dark' })}
        ${viewerTool(C, { action: 'fullscreen', label: 'Plan im Vollbild anzeigen', pressed: false })}
      </div>
      <aside class="plan-check-inspector" data-plan-check-inspector aria-label="Attribute des gewählten Objekts" hidden></aside>
      <ul class="plan-check-viewer__legend" data-plan-check-legend aria-label="Legende"></ul>
      <div class="plan-check-viewer__scale" data-plan-check-scale aria-hidden="true">
        <span data-plan-check-scale-line></span><span data-plan-check-scale-label></span>
      </div>
      <output class="plan-check-viewer__coordinates" data-plan-check-coordinates aria-label="Plan-Koordinaten" aria-live="off">X – · Y –</output>
    </div>
  </section>`;
}

// The legend describes what the current register paints, so it changes with the
// active tab rather than listing three fixed marks in every view.
export function renderPlanCheckLegend(C, state) {
  const marks = [];
  if (state.tab === 'rooms' || state.tab === 'areas') {
    marks.push(['success', 'ohne Befund'], ['warning', 'mit Warnung'], ['error', 'mit Fehler']);
  } else if (state.tab === 'layers') {
    const hidden = [...(state.hiddenLayers || [])];
    marks.push(['selected', 'hervorgehobener Layer']);
    if (hidden.length) marks.push(['hidden', `${hidden.length} ${hidden.length === 1 ? 'Layer' : 'Layer'} ausgeblendet`]);
  } else {
    marks.push(['error', 'Fehler'], ['warning', 'Warnung']);
  }
  if (state.selection) marks.push(['selected', 'Auswahl']);
  const seen = new Set();
  return marks.filter(([tone, label]) => {
    const key = `${tone}|${label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(([tone, label]) => (
    `<li><span class="plan-check-viewer__legend-mark plan-check-viewer__legend-mark--${tone}" aria-hidden="true"></span>${C.escape(label)}</li>`
  )).join('');
}

function qualityStage(C, state, context) {
  const tabs = tabItems(state);
  const activeTab = tabs.find((tab) => tab.id === state.tab) || tabs[0];
  const wide = PLAN_CHECK_WIDE_TABS.includes(activeTab.id);
  return `<div class="plan-check-quality">
    ${qualitySummary(C, state)}
    ${fileBar(C, state)}
    ${figuresBand(C, state)}
    <section class="plan-check-results" aria-labelledby="plan-check-results-heading">
      <h2 id="plan-check-results-heading" class="plan-check-results__heading">Datenqualität im Detail</h2>
      <div class="plan-check-board">
        <div class="plan-check-board__bar">
          ${C.tabBar({
            items: tabs, active: state.tab, idPrefix: 'plan-check-tab', panelId: 'plan-check-tab-panel',
            ariaLabel: 'Prüfergebnis-Ansichten',
          })}
          ${statusFilterBar(C, state)}
        </div>
        <div class="plan-check-workbench${wide ? ' plan-check-workbench--wide' : ''}" data-plan-check-workbench>
          <div class="plan-check-workbench__results">
            <div class="tab__container" role="tabpanel" id="plan-check-tab-panel"
              aria-labelledby="plan-check-tab-${C.escape(activeTab.id)}" tabindex="0" data-plan-check-panel>
              <h3 class="sr-only">${C.escape(activeTab.label)}</h3>
              ${renderPlanCheckPanel(C, state, activeTab.id)}
            </div>
          </div>
          ${viewerMarkup(C, state)}
        </div>
      </div>
    </section>
    <div class="plan-check-footbar">
      <button class="btn btn--bare plan-check-footbar__back" type="button" data-plan-check-action="replace-file">
        ${C.icon('ArrowLeft', 'btn__icon')}<span class="btn__text">Andere Datei prüfen</span></button>
      <div class="plan-check-footbar__actions">
        ${contextualReturnButton(C, context)}
        <button class="btn btn--filled" type="button" data-plan-check-action="continue-approval">
          <span class="btn__text">Weiter zur Freigabe</span></button>
      </div>
    </div>
  </div>`;
}

// --- Step 3: Freigabe -------------------------------------------------------

function formatIsoDate(value) {
  const raw = scalar(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  const [year, month, day] = raw.split('-');
  return `${day}.${month}.${year}`;
}

// The submission summary. Every row restates a value the visitor entered or the
// checker measured; nothing new is introduced on the last step, so there is
// nothing here that could differ from what was checked.
function approvalSummary(C, state, context) {
  const validation = validationOf(state);
  const rules = list(validation.rules);
  const evaluated = rules.filter((rule) => ruleDescriptor(rule).status !== 'not-evaluated').length;
  const passed = rules.filter((rule) => ruleDescriptor(rule).status === 'success').length;
  const errorCount = list(validation.errors).filter((item) => normalizedSeverity(item?.severity) === 'error').length;
  const result = state.result || {};
  const change = result.checkContext?.change || { type: state.changeType, reason: state.changeReason };
  const building = context.building;
  const floor = context.floor;
  const buildingLabel = building
    ? [scalar(building.name || building.label), scalar(building.bbl_id || building.id)].filter(Boolean).join(' · ')
    : 'Keinem Objekt zugeordnet';
  const floorLabel = floor ? [scalar(floor.label || floor.name), scalar(floor.floorId || floor.id)].filter(Boolean).join(' · ')
    : 'Keinem Geschoss zugeordnet';
  const effective = formatIsoDate(change.effectiveDate);
  const rows = [
    ['Objekt', C.escape(buildingLabel)],
    ['Geschoss', C.escape(floorLabel)],
    ['Datei', `<span class="plan-check-approval__file">${C.escape(result.file?.name || state.file?.name || '–')}</span>`
      + ` · ${formatFileSize(result.file?.size ?? state.file?.size)}`],
    ['Art der Änderung', change.type === 'mutation'
      ? 'Mutation eines bestehenden Plans' : 'Neuer Plan'],
    ...(change.reason ? [['Grund', C.escape(change.reason)]] : []),
    ...(effective ? [['Gültig ab', effective]] : []),
    ...(change.reference ? [['Referenz', C.escape(change.reference)]] : []),
    ['Prüfergebnis', `${C.badge(`${formatNumber(passed)} von ${formatNumber(evaluated)} Regeln erfüllt`,
      errorCount ? 'error' : passed === evaluated ? 'success' : 'warning', 'sm')}
      <button class="link plan-check-approval__report" type="button" data-plan-check-action="show-report">Prüfbericht ansehen</button>`],
  ];
  return `<section class="plan-check-approval-card" aria-labelledby="plan-check-approval-heading">
    <h2 class="plan-check-approval-card__title" id="plan-check-approval-heading">Antrag im Überblick</h2>
    <dl class="plan-check-approval__facts">
      ${rows.map(([label, value]) => `<dt>${C.escape(label)}</dt><dd>${value}</dd>`).join('')}
    </dl>
  </section>`;
}

function approvalStage(C, state, context) {
  const validation = validationOf(state);
  const errorCount = list(validation.errors).filter((item) => normalizedSeverity(item?.severity) === 'error').length;
  const requester = scalar(state.requester) || 'Angemeldete Person';
  return `<div class="plan-check-approval">
    ${validation.aborted ? C.notification(
      'Die Prüfung wurde abgebrochen. Ein Antrag auf Freigabe ist ohne verlässliches Prüfergebnis nicht möglich.',
      'error', 'WarningCircle') : ''}
    ${!validation.aborted && errorCount ? C.notification(
      `Der Plan enthält ${formatNumber(errorCount)} Fehler. Sie können den Antrag einreichen; das Flächenmanagement `
      + 'entscheidet über die Freigabe und kann ihn mit Begründung zurückweisen.',
      'warning', 'WarningCircle') : ''}
    ${approvalSummary(C, state, context)}
    <section class="plan-check-approval-card plan-check-approval-card--muted" aria-labelledby="plan-check-office-heading">
      <h2 class="plan-check-approval-card__title" id="plan-check-office-heading">Freigabestelle</h2>
      <dl class="plan-check-approval__facts">
        <dt>Zuständige Stelle</dt><dd>${C.escape(PLAN_CHECK_APPROVAL.office)}</dd>
        <dt>Bearbeitungsfrist</dt><dd>${C.escape(PLAN_CHECK_APPROVAL.deadline)}</dd>
        <dt>Antragstellende Person</dt><dd>${C.escape(requester)}</dd>
      </dl>
      <p class="small muted plan-check-approval__note">Mit dem Einreichen wird ein Vorgang eröffnet und dem
        Flächenmanagement zugewiesen. Der Plan wird erst nach Freigabe durch eine zweite Person übernommen.
        Bis dahin bleibt der bestehende Plan gültig und für die Mietenden sichtbar. Wird der Antrag
        zurückgewiesen, erhalten Sie die Begründung unter «Meine Vorgänge».</p>
      <p class="small muted plan-check-approval__note">In dieser Testumgebung wird der Vorgang lokal im Browser
        angelegt. Es erfolgt keine Übermittlung an das Flächenmanagement und keine formelle Planfreigabe.</p>
    </section>
    <div class="plan-check-footbar">
      <button class="btn btn--bare plan-check-footbar__back" type="button" data-plan-check-action="back-to-quality">
        ${C.icon('ArrowLeft', 'btn__icon')}<span class="btn__text">Zurück zur Datenqualität</span></button>
      <div class="plan-check-footbar__actions">
        ${contextualReturnButton(C, context)}
        <button class="btn btn--filled" type="button" data-plan-check-action="submit-approval"
          ${validation.aborted ? 'disabled' : ''}>
          <span class="btn__text">Zur Freigabe einreichen</span></button>
      </div>
    </div>
  </div>`;
}

// The submitted state. `instance` is a real process instance created by the
// portal's engine, so its reference is the one shown in the personal case list.
function submittedStage(C, state, context) {
  const instance = state.submission;
  // The step list belongs to the definition, not the instance; `state.flow` is
  // resolved by the controller so this stays a pure renderer.
  const steps = list(state.flow);
  return `<div class="plan-check-approval plan-check-approval--done">
    ${C.processDone({
      instance,
      lead: 'Antrag eingereicht.',
      title: 'Der Plan liegt zur Zweitprüfung bereit',
      heading: 'h2',
      text: 'Der Plan wird nicht sofort übernommen. Das Flächenmanagement prüft den Antrag als zweite Instanz '
        + 'und gibt ihn frei oder weist ihn zurück. Den Stand sehen Sie unter «Meine Vorgänge».',
      actions: [
        { label: 'Zu meinen Vorgängen', href: '#/my-cases' },
        { label: 'Weiteren Plan prüfen', id: 'plan-check-restart', variant: 'outline' },
      ],
    })}
    ${steps.length ? `<section class="plan-check-approval-card" aria-labelledby="plan-check-flow-heading">
      <h3 class="plan-check-approval-card__title" id="plan-check-flow-heading">Ablauf</h3>
      ${C.pipeline(steps, 0, { label: 'Stand des Freigabevorgangs' })}
    </section>` : ''}
    <div class="plan-check-footbar">
      <span class="plan-check-footbar__back"></span>
      <div class="plan-check-footbar__actions">${contextualReturnButton(C, context)}</div>
    </div>
  </div>`;
}

function contextualReturnButton(C, context) {
  if (!context?.returnHref) return '';
  const label = context.building ? 'Zurück zum Objekt' : 'Zurück zu Workspace Management';
  return `<button class="btn btn--outline" type="button" data-plan-check-action="cancel">${C.icon('ArrowLeft', 'btn__icon')}<span class="btn__text">${label}</span></button>`;
}

function unavailableStage(C, context) {
  return `<section class="plan-check-section plan-check-unavailable" aria-labelledby="plan-check-unavailable-heading">
    <h2 id="plan-check-unavailable-heading">DWG-Prüfung derzeit nicht verfügbar</h2>
    ${context.contextWarning ? C.notification(context.contextWarning, 'warning', 'WarningCircle') : ''}
    <p>Die lokale DWG-Prüfung ist in dieser Testumgebung momentan nicht aktiviert.</p>
    <div class="plan-check-actions">${contextualReturnButton(C, context)}</div>
  </section>`;
}

function stageMarkup(C, state, context) {
  if (state.step === 3) return state.submission ? submittedStage(C, state, context) : approvalStage(C, state, context);
  if (state.step === 2) return qualityStage(C, state, context);
  return uploadStage(C, state, context);
}

export function renderPlanCheckPage(C, state, context = {}) {
  const intakeAvailable = state.intakeAvailable !== false;
  const step = [1, 2, 3].includes(state.step) ? state.step : 1;
  return `<div class="container section plan-check${step === 2 ? ' plan-check--workbench' : ''}">
    <div class="page-header plan-check__page-header">
      <p class="eyebrow">Planübernahme</p>
      <h1 tabindex="-1">${intakeAvailable ? 'Plan hochladen und prüfen' : 'Planprüfung'}</h1>
      ${step > 1 ? '' : `<p class="lead">${intakeAvailable
        ? 'Prüfen Sie eine DWG-Datei lokal auf Layerstruktur, Geometrie, Raumdaten und Flächenkennzahlen.'
        : 'Die lokale DWG-Prüfung steht vorübergehend nicht zur Verfügung.'}</p>`}
      ${intakeAvailable ? `<p class="plan-check-local-note" data-plan-check-privacy>
        ${C.icon('InfoCircle', 'plan-check-local-note__icon')}
        <span>Diese Testumgebung ist für technische DWG-Tests mit Nicht-Produktivdaten vorgesehen; Ergebnisse sind keine formelle Planfreigabe. Die ausgewählte Datei wird lokal im Browser verarbeitet und nicht an einen Server übertragen.</span>
      </p>` : ''}
    </div>
    ${intakeAvailable ? `<div class="plan-check__wizard">
      ${C.wizardHead(PLAN_CHECK_STEPS, step, {
        headId: 'plan-check-step-heading', label: 'Schritte der Planprüfung', visible: true,
        // Only the first step is a form; the later ones would promise required
        // fields that do not exist there.
        legend: step === 1,
      })}
      <div class="plan-check__status sr-only" data-plan-check-status role="status" aria-live="polite" aria-atomic="true">${C.escape(state.statusMessage || '')}</div>
      ${stageMarkup(C, state, context)}
    </div>` : unavailableStage(C, context)}
  </div>`;
}
