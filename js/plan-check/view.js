// Pure markup for the Plan Check route. Browser event ownership stays in the
// controller and Canvas ownership stays in the viewer factory.

import { LIMITS } from './config.js';

export const PLAN_CHECK_STEPS = Object.freeze(['Standort und Datei', 'Datenqualit\u00e4t']);

export const PLAN_CHECK_TABS = Object.freeze([
  { id: 'rules', label: 'Pr\u00fcfregeln' },
  { id: 'errors', label: 'Fehlermeldungen' },
  { id: 'layers', label: 'Layer' },
  { id: 'rooms', label: 'R\u00e4ume' },
  { id: 'areas', label: 'Fl\u00e4chen' },
  { id: 'metrics', label: 'Kennzahlen' },
]);

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

const METRIC_LABELS = Object.freeze({
  roomPolygonArea: 'Summe Raumpolygone (unklassifiziert)',
  hnf: 'Hauptnutzfl\u00e4che (HNF)',
  nnf: 'Nebennutzfl\u00e4che (NNF)',
  vf: 'Verkehrsfl\u00e4che (VF)',
  ff: 'Funktionsfl\u00e4che (FF)',
  nf: 'Nutzfl\u00e4che (NF)',
  ngf: 'Nettogeschossfl\u00e4che (NGF)',
  gf: 'Geschossfl\u00e4che (GF)',
  kf: 'Konstruktionsfl\u00e4che (KF)',
});

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
  return number === null ? '\u2013' : new Intl.NumberFormat('de-CH', { maximumFractionDigits }).format(number);
}

function formatArea(value) {
  const number = finite(value);
  return number === null ? '\u2013' : `${formatNumber(number, 1)} m\u00b2`;
}

function formatFileSize(value) {
  const bytes = finite(value);
  if (bytes === null || bytes < 0) return '\u2013';
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
  if (status === 'error') return { status, label: 'Fehler', variant: 'error' };
  if (status === 'warning') return { status, label: 'Warnung', variant: 'warning' };
  if (status === 'abort') return { status, label: 'Abgebrochen', variant: 'error' };
  if (status === 'not-evaluated') return { status, label: 'Nicht gepr\u00fcft', variant: 'gray' };
  return { status: 'success', label: 'Bestanden', variant: 'success' };
}

function ruleDescriptor(rule) {
  if (rule?.status === 'not-evaluated' || rule?.passed === null) return statusDescriptor('not-evaluated');
  return rule?.status === 'passed' || rule?.passed
    ? statusDescriptor('success')
    : statusDescriptor(rule?.sev);
}

function categoryLabel(value) {
  const category = String(value || '').toUpperCase();
  return CATEGORY_LABELS[category] || scalar(value) || 'Weitere Pr\u00fcfung';
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

function selectionButton(C, { type, id, title, meta, descriptor, active = false }) {
  return `<button class="plan-check-result${active ? ' plan-check-result--selected' : ''}" type="button"
      data-plan-check-select data-select-type="${C.escape(type)}" data-select-id="${C.escape(id)}"
      aria-pressed="${active}">
    <span class="plan-check-result__content">
      <span class="plan-check-result__title">${C.escape(title)}</span>
      ${meta ? `<span class="plan-check-result__meta">${C.escape(meta)}</span>` : ''}
    </span>
    ${C.badge(descriptor.label, descriptor.variant, 'sm')}
  </button>`;
}

function filterControls(C, state, { searchLabel, statuses = true, scope = 'results' } = {}) {
  const filters = [
    ['all', 'Alle'], ['error', 'Fehler'], ['warning', 'Warnungen'], ['success', 'Bestanden'],
  ];
  if (list(validationOf(state).rules).some((rule) => (
    rule?.status === 'not-evaluated' || rule?.passed === null
  ))) filters.push(['not-evaluated', 'Nicht gepr\u00fcft']);
  return `<div class="plan-check-results__tools">
    <div class="form__group__input plan-check-results__search">
      <label for="plan-check-${scope}-search">${C.escape(searchLabel || 'Ergebnisse durchsuchen')}</label>
      <div class="plan-check-search-control">
        ${C.icon('Search', 'icon--base plan-check-search-control__icon')}
        <input class="input--outline input--base" id="plan-check-${scope}-search" type="search"
          value="${C.escape(state.search)}" autocomplete="off" data-plan-check-search>
      </div>
    </div>
    ${statuses ? `<div class="plan-check-filter" role="group" aria-label="Nach Status filtern">${filters.map(([id, label]) => (
      `<button class="btn btn--outline btn--sm plan-check-filter__button${state.filter === id ? ' plan-check-filter__button--active' : ''}" id="plan-check-${scope}-filter-${id}"
        type="button" data-plan-check-filter="${id}" aria-pressed="${state.filter === id}">
        <span class="btn__text">${label}</span></button>`
    )).join('')}</div>` : ''}
  </div>`;
}

function rulesPanel(C, state) {
  const statusRank = Object.freeze({ error: 0, warning: 1, abort: 2, 'not-evaluated': 2, success: 3 });
  const rules = list(validationOf(state).rules).filter((rule) => {
    const descriptor = ruleDescriptor(rule);
    return passesFilter(descriptor.status, state.filter)
      && searchMatch([rule?.code, rule?.description, rule?.cat, categoryLabel(rule?.cat)], state.search);
  }).map((rule, index) => ({ rule, index, descriptor: ruleDescriptor(rule) }))
    .sort((left, right) => (statusRank[left.descriptor.status] ?? 4) - (statusRank[right.descriptor.status] ?? 4)
      || left.index - right.index);
  return `${filterControls(C, state, { searchLabel: 'Pr\u00fcfregeln durchsuchen', scope: 'rules' })}
    <p class="small muted plan-check-results__summary">${rules.length} Pr\u00fcfregeln angezeigt.</p>
    ${rules.length ? `<ul class="plan-check-result-list">${rules.map(({ rule, descriptor }) => {
      const id = scalar(rule?.code) || 'Unbekannte Regel';
      const count = finite(rule?.errorCount);
      const title = scalar(rule?.description) || id;
      const meta = `${id} \u00b7 ${categoryLabel(rule?.cat)}${count ? ` \u00b7 ${formatNumber(count)} Feststellungen` : ''}`;
      return `<li>${selectionButton(C, {
        type: 'rule', id, title, meta, descriptor, active: selected(state, 'rule', id),
      })}</li>`;
    }).join('')}</ul>` : C.empty('Keine Pr\u00fcfregeln entsprechen dem Filter.', {
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
  return `${filterControls(C, state, { searchLabel: 'Fehlermeldungen durchsuchen', scope: 'errors' })}
    <p class="small muted plan-check-results__summary">${errors.length} Feststellungen angezeigt.</p>
    ${errors.length ? `<ul class="plan-check-result-list">${errors.map((error, index) => {
      const id = scalar(error?.id) || `${scalar(error?.ruleCode) || 'Feststellung'}-${index + 1}`;
      const title = scalar(error?.message) || scalar(error?.ruleCode) || 'Feststellung';
      const handles = [...new Set([error?.handle, ...list(error?.handles)].map(scalar).filter(Boolean))];
      const location = handles.length ? `${formatNumber(handles.length)} ${handles.length === 1 ? 'Objekt' : 'Objekte'}`
        : scalar(error?.layer) ? `Layer ${scalar(error.layer)}` : '';
      const meta = [error?.ruleCode, categoryLabel(error?.category), location].filter(Boolean).join(' \u00b7 ');
      return `<li>${selectionButton(C, {
        type: 'error', id, title, meta, descriptor: statusDescriptor(error?.severity),
        active: selected(state, 'error', id),
      })}</li>`;
    }).join('')}</ul>` : C.empty('Keine Fehlermeldungen entsprechen dem Filter.', {
      hint: list(validationOf(state).errors).length
        ? 'Passen Sie Suche oder Statusfilter an.'
        : 'Die Pr\u00fcfung hat keine Fehler oder Warnungen gefunden.',
    })}`;
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : 'var(--color-text-muted)';
}

function layersPanel(C, state) {
  const layers = list(state.result?.layers).filter((layer) => (
    searchMatch([layer?.name, layer?.count], state.search)
  ));
  return `${filterControls(C, state, { searchLabel: 'Layer durchsuchen', statuses: false, scope: 'layers' })}
    <div class="plan-check-layer-actions">
      <button class="btn btn--outline btn--sm" type="button" data-plan-check-layers="show-all"><span class="btn__text">Alle einblenden</span></button>
      <button class="btn btn--outline btn--sm" type="button" data-plan-check-layers="hide-all"><span class="btn__text">Alle ausblenden</span></button>
    </div>
    <p class="small muted plan-check-results__summary">${layers.length} Layer angezeigt.</p>
    ${layers.length ? `<ul class="plan-check-layer-list">${layers.map((layer, index) => {
      const name = scalar(layer?.name) || `Layer ${index + 1}`;
      const visible = !state.hiddenLayers.has(name);
      const isSelected = selected(state, 'layer', name);
      return `<li class="plan-check-layer${isSelected ? ' plan-check-layer--selected' : ''}">
        <label class="plan-check-layer__toggle">
          <input id="plan-check-layer-${index}" type="checkbox" data-plan-check-layer="${C.escape(name)}"
            aria-label="Layer ${C.escape(name)} einblenden"${visible ? ' checked' : ''}>
        </label>
        <label for="plan-check-layer-${index}">
          <span class="plan-check-layer__swatch" style="--plan-check-swatch:${safeColor(layer?.colorHex)}" aria-hidden="true"></span>
          <span class="plan-check-layer__name">${C.escape(name)}</span>
          <span class="plan-check-layer__count">${formatNumber(layer?.count)} Darstellungselemente</span>
        </label>
        <button class="plan-check-layer__locate interactive-control" type="button" data-plan-check-select
          data-select-type="layer" data-select-id="${C.escape(name)}" aria-pressed="${isSelected}"
          aria-label="Layer ${C.escape(name)} im Plan hervorheben">${C.icon('Search', 'icon--base')}</button>
      </li>`;
    }).join('')}</ul>` : C.empty('Keine Layer entsprechen der Suche.', {
      hint: 'Passen Sie den Suchbegriff an.',
    })}`;
}

function spatialPanel(C, state, type) {
  const isRoom = type === 'room';
  const source = list(isRoom ? validationOf(state).rooms : validationOf(state).areas);
  const entries = source.filter((item) => passesFilter(item?.status, state.filter)
    && searchMatch([item?.aoid, item?.id, item?.label, item?.layer, item?.status], state.search));
  const singular = isRoom ? 'Raum' : 'Fl\u00e4che';
  const plural = isRoom ? 'R\u00e4ume' : 'Fl\u00e4chen';
  return `${filterControls(C, state, { searchLabel: `${plural} durchsuchen`, scope: isRoom ? 'rooms' : 'areas' })}
    <p class="small muted plan-check-results__summary">${entries.length} ${plural} angezeigt.</p>
    ${entries.length ? `<ul class="plan-check-result-list">${entries.map((item, index) => {
      const id = scalar(item?.id) || scalar(item?.handle) || `${type}-${index + 1}`;
      const title = scalar(item?.aoid) || scalar(item?.label) || `${singular} ${index + 1}`;
      const meta = [scalar(item?.label) !== title ? item?.label : '', formatArea(item?.area), item?.layer]
        .filter(Boolean).join(' \u00b7 ');
      return `<li>${selectionButton(C, {
        type, id, title, meta, descriptor: statusDescriptor(item?.status), active: selected(state, type, id),
      })}</li>`;
    }).join('')}</ul>` : C.empty(`Keine ${plural} entsprechen dem Filter.`, {
      hint: source.length ? 'Passen Sie Suche oder Statusfilter an.' : `In der Zeichnung wurden keine ${plural} erkannt.`,
    })}`;
}

function metricsPanel(C, state) {
  const metrics = validationOf(state).metrics && typeof validationOf(state).metrics === 'object'
    ? validationOf(state).metrics : {};
  const rows = Object.entries(METRIC_LABELS);
  const entities = list(state.result?.drawing?.entitySummary);
  return `<div class="plan-check-metrics">
    <section aria-labelledby="plan-check-area-metrics">
      <h4 id="plan-check-area-metrics">Fl\u00e4chenkennzahlen</h4>
      ${rows.length ? `<dl class="kv kv--ruled">${rows.map(([key, label]) => (
        `<dt>${C.escape(label)}</dt><dd>${formatArea(metrics[key])}</dd>`
      )).join('')}</dl>` : C.empty('Keine Fl\u00e4chenkennzahlen verf\u00fcgbar.', {
        hint: 'Die Zeichnung enth\u00e4lt keine auswertbaren Raum- oder Geschosspolygone.',
      })}
    </section>
    <section aria-labelledby="plan-check-entity-metrics">
      <h4 id="plan-check-entity-metrics">Objekt\u00fcbersicht</h4>
      ${entities.length ? `<div class="table-wrapper" data-scroll-region><table class="table table--compact">
        <caption class="sr-only">Objekte nach DWG-Typ</caption><thead><tr><th scope="col">Objekttyp</th><th scope="col" class="table__number">Anzahl</th></tr></thead>
        <tbody>${entities.map((entry) => `<tr><th scope="row">${C.escape(entry?.type || entry?.name || '\u2013')}</th><td class="table__number">${formatNumber(entry?.count)}</td></tr>`).join('')}</tbody>
      </table></div>` : C.empty('Keine Objektstatistik verf\u00fcgbar.')}
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

function locationSummary(C, state, context) {
  const building = context.building || null;
  const floor = context.floor || null;
  if (context.selectable && list(context.buildings).length) {
    const buildingOptions = [
      { value: '', label: 'Objekt w\u00e4hlen' },
      ...context.buildings.map((item) => ({
        value: scalar(item?.bbl_id || item?.id),
        label: `${scalar(item?.name || item?.label) || 'Objekt'}${scalar(item?.city) ? ` \u00b7 ${scalar(item.city)}` : ''}`,
      })),
    ];
    const floorOptions = [
      { value: '', label: state.buildingId ? 'Geschoss w\u00e4hlen' : 'Zuerst Objekt w\u00e4hlen' },
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
      'Kein Standort ist vorausgew\u00e4hlt. Die Datei wird lokal gepr\u00fcft und keinem Objekt zugeordnet.',
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
  const floorName = scalar(floor?.label || floor?.name) || 'Kein Geschoss vorausgew\u00e4hlt';
  const floorId = scalar(floor?.floorId || floor?.id);
  return `<div class="plan-check-location box">
    <p class="eyebrow">Aus dem Objektregister \u00fcbernommen</p>
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
      ${C.loading({ label: state.progress?.label || 'DWG-Datei wird gepr\u00fcft\u2026', size: 'xl' })}
      <progress class="plan-check-progress" max="100" value="${value}"
        aria-label="Fortschritt der DWG-Pr\u00fcfung">${value} %</progress>
      <span class="small muted">${value} %</span>
    </div>`;
  }
  return `<div class="plan-check-file-drop__state">
    ${C.icon('CloudUpload', 'icon--2xl plan-check-file-drop__icon')}
    <strong>DWG-Datei hierher ziehen oder mit dem Dateifeld ausw\u00e4hlen</strong>
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
      <h3 id="plan-check-change-heading">\u00c4nderung</h3>
      <fieldset class="plan-check-change-type">
        <legend>Art der \u00c4nderung</legend>
        <div class="plan-check-radio-row">
          <label><input type="radio" name="plan-change-type" value="new" data-plan-check-change-type${state.changeType !== 'mutation' ? ' checked' : ''}> Neuer Plan</label>
          <label><input type="radio" name="plan-change-type" value="mutation" data-plan-check-change-type${state.changeType === 'mutation' ? ' checked' : ''}> Mutation eines bestehenden Plans</label>
        </div>
      </fieldset>
      <div class="plan-check-change-fields" data-plan-check-change-fields${state.changeType === 'mutation' ? '' : ' hidden'}>
        <div class="form__group__input">
          <label class="text--asterisk" for="plan-check-change-reason">\u00c4nderungsgrund<span class="sr-only"> Pflichtfeld</span></label>
          <textarea class="input--outline input--base" id="plan-check-change-reason" name="plan-change-reason" rows="3"
            maxlength="${LIMITS.changeReasonLength}" data-plan-check-change-reason${state.changeType === 'mutation' ? ' required aria-required="true"' : ''}>${C.escape(state.changeReason)}</textarea>
        </div>
        <div class="plan-check-change-fields__row">
          <div class="form__group__input">
            <label for="plan-check-effective-date">G\u00fcltig ab <span class="muted">(optional)</span></label>
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
            <span class="btn__text-centered" aria-hidden="true">Datei ausw\u00e4hlen</span>
            <span class="sr-only">DWG-Datei ausw\u00e4hlen, Pflichtfeld</span>
          </label>
          <span class="small muted plan-check-file-field__name" id="plan-check-file-name" data-plan-check-file-name${state.file ? '' : ' hidden'}>${C.escape(state.file?.name || '')}</span>
        </div>
      </div>
      <ul class="plan-check-requirements">
        <li>DWG-Zeichnung mit Modellbereich und lesbarer Layerstruktur</li>
        <li>Geschlossene Raum- und Geschosspolygone f\u00fcr die Fl\u00e4chenauswertung</li>
        <li>Zeichnungseinheit und Koordinaten werden aus der Datei \u00fcbernommen</li>
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
        <span class="btn__text">${loading ? 'Datei wird gepr\u00fcft\u2026' : 'Pr\u00fcfen'}</span>
      </button>
    </div>
  </form>`;
}

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

function qualitySummary(C, state) {
  const validation = validationOf(state);
  const errors = list(validation.errors);
  const errorCount = errors.filter((item) => normalizedSeverity(item?.severity) === 'error').length;
  const warningCount = errors.filter((item) => normalizedSeverity(item?.severity) === 'warning').length;
  if (validation.aborted) return C.notification(
    'Die fachliche Pr\u00fcfung wurde sicher beendet. Zeichnungseinheit oder Grundvoraussetzungen erlauben keine verl\u00e4ssliche Fl\u00e4chenauswertung.',
    'error', 'WarningCircle',
  );
  if (validationIncomplete(validation)) return C.notification(
    'Die Pr\u00fcfung ist unvollst\u00e4ndig, weil Teile der Zeichnung nicht ausgewertet werden konnten. Feststellungen bleiben sichtbar; ein Erf\u00fcllungsgrad wird nicht ausgewiesen.',
    'error', 'WarningCircle',
  );
  if (errorCount) return C.notification(
    `${errorCount} Fehler und ${warningCount} Warnungen gefunden. Die Listen und der Plan zeigen dieselben Feststellungen.`,
    'error', 'WarningCircle',
  );
  if (warningCount) return C.notification(
    `Keine Fehler und ${warningCount} Warnungen gefunden. Pr\u00fcfen Sie die Hinweise vor einer weiteren Verwendung.`,
    'warning', 'WarningCircle',
  );
  return C.notification('Alle Pr\u00fcfregeln sind bestanden.', 'success', 'CheckmarkCircle');
}

function viewerMarkup(C, state) {
  const drawingEmpty = !list(state.result?.drawing?.renderList).length;
  return `<section class="plan-check-viewer" data-plan-check-viewer aria-labelledby="plan-check-viewer-heading">
    <div class="plan-check-viewer__header">
      <h3 id="plan-check-viewer-heading">Planansicht</h3>
      <div class="plan-check-viewer__toolbar" role="group" aria-label="Planansicht steuern">
        <button class="btn btn--bare-negative btn--icon-only interactive-control interactive-control--negative" type="button"
          data-viewer-action="fit" aria-label="Gesamten Plan einpassen" title="Plan einpassen">
          ${C.icon('Expand', 'btn__icon')}
        </button>
        <button class="btn btn--bare-negative btn--icon-only interactive-control interactive-control--negative" type="button"
          data-viewer-action="zoom-in" aria-label="Plan vergr\u00f6ssern" title="Vergr\u00f6ssern">
          ${C.icon('Plus', 'btn__icon')}
        </button>
        <button class="btn btn--bare-negative btn--icon-only interactive-control interactive-control--negative" type="button"
          data-viewer-action="zoom-out" aria-label="Plan verkleinern" title="Verkleinern">
          ${C.icon('Minus', 'btn__icon')}
        </button>
        <button class="btn btn--bare-negative btn--icon-only interactive-control interactive-control--negative" type="button"
          data-viewer-action="background" aria-label="Dunklen Hintergrund umschalten" aria-pressed="${state.background === 'dark'}" title="Hintergrund wechseln">
          ${C.icon('Eyedropper', 'btn__icon')}
        </button>
        <button class="btn btn--bare-negative btn--icon-only interactive-control interactive-control--negative" type="button"
          data-viewer-action="fullscreen" aria-label="Plan im Vollbild anzeigen" aria-pressed="false" title="Vollbild">
          ${C.icon('Expand', 'btn__icon')}
        </button>
      </div>
    </div>
    <p class="sr-only" id="plan-check-canvas-help">Pfeiltasten verschieben den Plan. Plus und Minus zoomen. Pos1 oder F passt den Plan ein. Eingabe w\u00e4hlt das Objekt in der Planmitte.</p>
    <div class="plan-check-viewer__canvas-wrap" data-plan-check-canvas-wrap>
      <canvas class="plan-check-viewer__canvas" data-plan-check-canvas tabindex="0"
        aria-label="Interaktive DWG-Planansicht" aria-describedby="plan-check-canvas-help">
        Die interaktive Zeichnung wird von Ihrem Browser nicht unterst\u00fctzt. Alle Pr\u00fcfergebnisse stehen zus\u00e4tzlich als Textlisten bereit.
      </canvas>
      ${drawingEmpty ? `<div class="plan-check-viewer__empty">${C.empty('Keine darstellbaren CAD-Objekte gefunden.', {
        hint: 'Die Textlisten bleiben f\u00fcr die Diagnose verf\u00fcgbar.',
      })}</div>` : ''}
      <output class="plan-check-viewer__coordinates" data-plan-check-coordinates aria-label="Plan-Koordinaten" aria-live="off">x \u2013 \u00b7 y \u2013</output>
      <div class="plan-check-viewer__scale" data-plan-check-scale aria-hidden="true">
        <span data-plan-check-scale-line></span><span data-plan-check-scale-label></span>
      </div>
    </div>
    <ul class="plan-check-viewer__legend" aria-label="Legende">
      <li><span class="plan-check-viewer__legend-mark plan-check-viewer__legend-mark--error" aria-hidden="true"></span>Fehler</li>
      <li><span class="plan-check-viewer__legend-mark plan-check-viewer__legend-mark--warning" aria-hidden="true"></span>Warnung</li>
      <li><span class="plan-check-viewer__legend-mark plan-check-viewer__legend-mark--selected" aria-hidden="true"></span>Auswahl</li>
    </ul>
  </section>`;
}

function qualityStage(C, state, context) {
  const result = state.result || {};
  const validation = validationOf(state);
  const rules = list(validation.rules);
  const rooms = list(validation.rooms);
  const metrics = validation.metrics || {};
  const netArea = planCheckNetArea(metrics, rooms);
  const tabs = tabItems(state);
  const activeTab = tabs.find((tab) => tab.id === state.tab) || tabs[0];
  const checkedChange = result.checkContext?.change || {
    type: state.changeType,
    reason: state.changeReason,
  };
  const evaluatedRules = finite(metrics.evaluatedRules)
    ?? rules.filter((rule) => rule?.status !== 'not-evaluated' && rule?.passed !== null).length;
  const evaluationKpi = validation.aborted || validationIncomplete(validation)
    ? `<strong class="kpi-strip__value">\u2013</strong><small>${validation.aborted
      ? 'Nicht ausgewertet \u00b7 Pr\u00fcfung abgebrochen'
      : 'Nicht ausgewertet \u00b7 Pr\u00fcfung unvollst\u00e4ndig'}</small>`
    : `<strong class="kpi-strip__value">${formatNumber(validation.score)} %</strong><small>${formatNumber(validation.passedRules)} von ${formatNumber(evaluatedRules)} gepr\u00fcften Regeln</small>`;
  return `<div class="plan-check-quality">
    ${qualitySummary(C, state)}
    <section class="plan-check-file-summary" aria-labelledby="plan-check-file-summary-heading">
      <div>
        <p class="eyebrow">Gepr\u00fcfte Datei</p>
        <h2 id="plan-check-file-summary-heading">${C.escape(result.file?.name || state.file?.name || 'DWG-Datei')}</h2>
      </div>
      <dl class="plan-check-file-summary__facts">
        <div><dt>Dateigr\u00f6sse</dt><dd>${formatFileSize(result.file?.size ?? state.file?.size)}</dd></div>
        <div><dt>DWG-Version</dt><dd>${C.escape(result.database?.version || '\u2013')}</dd></div>
        <div><dt>Layer</dt><dd>${formatNumber(result.database?.layerCount ?? list(result.layers).length)}</dd></div>
        <div><dt>Objekte</dt><dd>${formatNumber(result.database?.entityCount)}</dd></div>
        <div><dt>Pr\u00fcfdauer</dt><dd>${formatNumber((finite(result.elapsedMs) || 0) / 1000, 1)} s</dd></div>
        <div><dt>\u00c4nderung</dt><dd>${checkedChange.type === 'mutation' ? 'Mutation eines bestehenden Plans' : 'Neuer Plan'}</dd></div>
        ${checkedChange.type === 'mutation' && checkedChange.reason ? `<div><dt>\u00c4nderungsgrund</dt><dd>${C.escape(checkedChange.reason)}</dd></div>` : ''}
      </dl>
    </section>
    <div class="kpi-strip plan-check-kpis">
      <div class="kpi-strip__item"><span class="kpi-strip__label">R\u00e4ume</span><strong class="kpi-strip__value">${formatNumber(rooms.length)}</strong></div>
      <div class="kpi-strip__item"><span class="kpi-strip__label">Raumpolygonfläche</span><strong class="kpi-strip__value">${formatArea(netArea)}</strong></div>
      <div class="kpi-strip__item"><span class="kpi-strip__label">Erf\u00fcllungsgrad</span>${evaluationKpi}</div>
      <div class="kpi-strip__item plan-check-kpis__reports"><span class="kpi-strip__label">Lokale Exporte</span>
        <div class="plan-check-report-actions">
          <button class="btn btn--outline btn--sm" type="button" data-plan-check-report="print">${C.icon('Printer', 'btn__icon')}<span class="btn__text">Drucken / PDF</span></button>
          <button class="btn btn--outline btn--sm" type="button" data-plan-check-report="csv">${C.icon('Download', 'btn__icon')}<span class="btn__text">CSV</span></button>
          <button class="btn btn--outline btn--sm" type="button" data-plan-check-report="json">${C.icon('FileJSON', 'btn__icon')}<span class="btn__text">JSON</span></button>
        </div>
      </div>
    </div>
    <section class="plan-check-results" aria-labelledby="plan-check-results-heading">
      <div class="plan-check-results__heading">
        <div><p class="eyebrow">Pr\u00fcfergebnis</p><h2 id="plan-check-results-heading">Datenqualit\u00e4t im Detail</h2></div>
        <button class="btn btn--outline" type="button" data-plan-check-action="replace-file">
          ${C.icon('FileRefresh', 'btn__icon')}<span class="btn__text">Andere Datei pr\u00fcfen</span></button>
      </div>
      ${C.tabBar({
        items: tabs, active: state.tab, idPrefix: 'plan-check-tab', panelId: 'plan-check-tab-panel',
        ariaLabel: 'Pr\u00fcfergebnis-Ansichten',
      })}
      <div class="plan-check-workbench">
        <div class="plan-check-workbench__results">
          <div class="tab__container" role="tabpanel" id="plan-check-tab-panel"
            aria-labelledby="plan-check-tab-${C.escape(activeTab.id)}" tabindex="0" data-plan-check-panel>
            <h3 class="sr-only">${C.escape(activeTab.label)}</h3>
            ${renderPlanCheckPanel(C, state, activeTab.id)}
          </div>
        </div>
        ${viewerMarkup(C, state)}
      </div>
    </section>
    <div class="plan-check-actions plan-check-actions--quality">
      ${contextualReturnButton(C, context)}
    </div>
  </div>`;
}

function contextualReturnButton(C, context) {
  if (!context?.returnHref) return '';
  const label = context.building ? 'Zur\u00fcck zum Objekt' : 'Zur\u00fcck zu Workspace Management';
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

export function renderPlanCheckPage(C, state, context = {}) {
  const intakeAvailable = state.intakeAvailable !== false;
  const step = state.step === 2 ? 2 : 1;
  return `<div class="container section plan-check">
    <div class="page-header plan-check__page-header">
      <p class="eyebrow">Plan\u00fcbernahme</p>
      <h1 tabindex="-1">${intakeAvailable ? 'Plan hochladen und pr\u00fcfen' : 'Planpr\u00fcfung'}</h1>
      <p class="lead">${intakeAvailable
        ? 'Pr\u00fcfen Sie eine DWG-Datei lokal auf Layerstruktur, Geometrie, Raumdaten und Fl\u00e4chenkennzahlen.'
        : 'Die lokale DWG-Pr\u00fcfung steht vor\u00fcbergehend nicht zur Verf\u00fcgung.'}</p>
      ${intakeAvailable ? `<p class="plan-check-local-note" data-plan-check-privacy>
        ${C.icon('InfoCircle', 'plan-check-local-note__icon')}
        <span>Diese Testumgebung ist f\u00fcr technische DWG-Tests mit Nicht-Produktivdaten vorgesehen; Ergebnisse sind keine formelle Planfreigabe. Die ausgew\u00e4hlte Datei wird lokal im Browser verarbeitet und nicht an einen Server \u00fcbertragen.</span>
      </p>` : ''}
    </div>
    ${intakeAvailable ? `<div class="plan-check__wizard">
      ${C.wizardHead(PLAN_CHECK_STEPS, step, {
        headId: 'plan-check-step-heading', label: 'Schritte der Planpr\u00fcfung', visible: true,
      })}
      <div class="plan-check__status sr-only" data-plan-check-status role="status" aria-live="polite" aria-atomic="true">${C.escape(state.statusMessage || '')}</div>
      ${step === 1 ? uploadStage(C, state, context) : qualityStage(C, state, context)}
    </div>` : unavailableStage(C, context)}
  </div>`;
}
