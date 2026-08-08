// Route-scoped Plan Check controller: file validation, parser lifecycle, view
// state and synchronization between accessible result lists and the Canvas.

import { createPlanCheckParser } from './parser-client.js';
import { LIMITS, MAX_FILE_SIZE, PLAN_CHECK_INTAKE_ENABLED } from './config.js';
import { createPlanCheckViewer } from './viewer.js';
import {
  PLAN_CHECK_STEPS, PLAN_CHECK_TABS, renderPlanCheckPage, renderPlanCheckPanel, renderPlanCheckUploadState,
} from './view.js';
import { downloadPlanCheckReport } from './report.js';

const PROGRESS_LABELS = Object.freeze({
  reading: 'Datei wird gelesen\u2026',
  'loading-engine': 'DWG-Lesemodul wird geladen\u2026',
  parsing: 'DWG-Struktur wird ausgewertet\u2026',
  normalizing: 'Zeichnungsdaten werden aufbereitet\u2026',
  validating: 'Pr\u00fcfregeln werden ausgef\u00fchrt\u2026',
  complete: 'Pr\u00fcfung wird abgeschlossen\u2026',
});

const PARSER_ERROR_MESSAGES = Object.freeze({
  INVALID_FILE_TYPE: 'Bitte w\u00e4hlen Sie eine Datei mit der Endung .dwg.',
  FILE_TOO_LARGE: 'Die DWG-Datei ist gr\u00f6sser als 50 MiB.',
  INVALID_DWG_HEADER: 'Die Datei besitzt keinen lesbaren DWG-Dateikopf.',
  ENGINE_LOAD_FAILED: 'Das lokale DWG-Lesemodul konnte nicht geladen werden.',
  DWG_READ_FAILED: 'Die DWG-Datei konnte nicht gelesen werden. M\u00f6glicherweise ist sie besch\u00e4digt oder nicht unterst\u00fctzt.',
  RESOURCE_LIMIT: 'Die Zeichnung \u00fcberschreitet die sichere Verarbeitungsgrenze des Browsers.',
  PARSE_TIMEOUT: 'Die DWG-Pr\u00fcfung hat zu lange gedauert und wurde zum Schutz des Browsers beendet. Versuchen Sie eine kleinere Datei.',
  DISPOSED: 'Die laufende Pr\u00fcfung wurde beendet.',
});

const list = (value) => Array.isArray(value) ? value : [];
const scalar = (value) => ['string', 'number'].includes(typeof value) ? String(value) : '';

function buildingId(building) {
  return scalar(building?.bbl_id || building?.id);
}

function floorId(floor) {
  return scalar(floor?.floorId || floor?.id);
}

function safeReturnHref(value) {
  const href = String(value || '');
  return /^#\/[^\s]*$/.test(href) ? href : '';
}

function validateFile(file) {
  if (!(file instanceof File)) return 'Bitte w\u00e4hlen Sie eine DWG-Datei aus.';
  if (!/\.dwg$/i.test(file.name)) return PARSER_ERROR_MESSAGES.INVALID_FILE_TYPE;
  if (!file.size) return 'Die ausgew\u00e4hlte Datei ist leer.';
  if (file.size > MAX_FILE_SIZE) return PARSER_ERROR_MESSAGES.FILE_TOO_LARGE;
  return '';
}

function parserMessage(error) {
  const code = scalar(error?.code);
  if (PARSER_ERROR_MESSAGES[code]) return PARSER_ERROR_MESSAGES[code];
  return 'Die DWG-Datei konnte nicht vollst\u00e4ndig gepr\u00fcft werden. W\u00e4hlen Sie eine andere Datei oder versuchen Sie es erneut.';
}

function parseProgress(progress) {
  if (typeof progress === 'string') return { stage: progress, value: 0, label: PROGRESS_LABELS[progress] || progress };
  const stage = scalar(progress?.stage || progress?.phase);
  const rawValue = Number(progress?.value);
  return {
    stage,
    value: Number.isFinite(rawValue) ? Math.max(0, Math.min(1, rawValue)) : 0,
    label: PROGRESS_LABELS[stage] || scalar(progress?.message) || 'DWG-Datei wird gepr\u00fcft\u2026',
  };
}

export function createPlanCheckController(ctx, options = {}) {
  const { mount, C, core, signal: routeSignal } = ctx;
  if (!mount || !C) throw new TypeError('Plan Check requires a route mount and component API');

  // The adapter is lightweight; file reads and the disposable parser Worker
  // begin only after the visitor submits a locally selected DWG.
  const parser = PLAN_CHECK_INTAKE_ENABLED ? createPlanCheckParser() : null;
  const eventAbort = new AbortController();
  const { signal } = eventAbort;
  let parseAbort = null;
  let parseSequence = 0;
  let viewer = null;
  let printPanels = null;
  let printBackground = null;
  let disposed = false;
  let lastProgressStage = '';
  let dragDepth = 0;

  const suppliedBuilding = options.building || null;
  const suppliedFloor = options.floor || null;
  const returnHref = safeReturnHref(options.returnHref);

  let buildings = [];
  try {
    buildings = typeof core?.buildings === 'function' ? list(core.buildings()) : [];
  } catch { buildings = []; }
  if (suppliedBuilding && !buildings.some((item) => buildingId(item) === buildingId(suppliedBuilding))) {
    buildings.unshift(suppliedBuilding);
  }
  if (typeof core?.floorsForBuilding === 'function') {
    buildings = buildings.filter((item) => list(core.floorsForBuilding(buildingId(item))).length > 0
      || buildingId(item) === buildingId(suppliedBuilding));
  }

  const state = {
    intakeAvailable: PLAN_CHECK_INTAKE_ENABLED,
    step: 1,
    phase: 'empty',
    file: null,
    fileError: '',
    statusMessage: '',
    progress: { stage: '', value: 0, label: '' },
    result: null,
    tab: 'rules',
    filter: 'all',
    search: '',
    selection: null,
    hiddenLayers: new Set(),
    background: 'light',
    dragActive: false,
    buildingId: buildingId(suppliedBuilding),
    floorId: floorId(suppliedFloor),
    changeType: 'new',
    changeReason: '',
    effectiveDate: '',
    reference: '',
  };

  function floorsForBuilding(id) {
    if (!id) return [];
    if (typeof core?.floorsForBuilding === 'function') {
      try { return list(core.floorsForBuilding(id)); } catch { return []; }
    }
    return suppliedFloor && buildingId(suppliedBuilding) === id ? [suppliedFloor] : [];
  }

  function currentLocation() {
    const selectable = !(suppliedBuilding && suppliedFloor) && buildings.length > 0;
    const building = buildings.find((item) => buildingId(item) === state.buildingId)
      || (!selectable ? suppliedBuilding : null);
    const floors = floorsForBuilding(state.buildingId || buildingId(building));
    const floor = floors.find((item) => floorId(item) === state.floorId)
      || (!selectable ? suppliedFloor : null);
    return {
      building, floor, buildings, floors, selectable, returnHref,
      contextWarning: scalar(options.contextWarning),
    };
  }

  function reportContext() {
    const location = currentLocation();
    const building = location.building ? Object.freeze({
        id: buildingId(location.building), name: scalar(location.building.name || location.building.label),
      }) : null;
    const floor = location.floor ? Object.freeze({
        id: floorId(location.floor), label: scalar(location.floor.label || location.floor.name),
      }) : null;
    const change = Object.freeze({
        type: state.changeType,
        reason: state.changeType === 'mutation'
          ? state.changeReason.trim().slice(0, LIMITS.changeReasonLength) : '',
        effectiveDate: state.changeType === 'mutation' ? state.effectiveDate : '',
        reference: state.changeType === 'mutation' ? state.reference.trim() : '',
      });
    return Object.freeze({ building, floor, change });
  }

  function setStatus(message) {
    state.statusMessage = message;
    const status = mount.querySelector('[data-plan-check-status]');
    if (status) status.textContent = message;
  }

  function disposeViewer() {
    viewer?.dispose();
    viewer = null;
  }

  function clearPrintPanels() {
    printPanels?.remove();
    printPanels = null;
    if (printBackground) {
      viewer?.setBackground(printBackground, false, true);
      printBackground = null;
    }
  }

  function preparePrintPanels() {
    if (printPanels || !state.result || state.step !== 2) return printPanels;
    const target = mount.querySelector('.plan-check-results');
    if (!target) return null;
    printBackground = state.background;
    viewer?.setBackground('light', false, true);
    const printState = { ...state, filter: 'all', search: '', selection: null };
    const container = document.createElement('div');
    container.className = 'plan-check-print-panels';
    container.setAttribute('data-plan-check-print-panels', '');
    for (const tab of PLAN_CHECK_TABS) {
      const section = document.createElement('section');
      section.className = 'plan-check-print-panel';
      const headingId = `plan-check-print-${tab.id}-heading`;
      section.setAttribute('aria-labelledby', headingId);
      section.innerHTML = `<h3 id="${headingId}">${C.escape(tab.label)}</h3>${renderPlanCheckPanel(C, printState, tab.id)}`;

      // Panel renderers use stable form-control IDs. Namespace each temporary
      // print copy so the live active panel keeps a unique accessible graph.
      const idMap = new Map();
      section.querySelectorAll('[id]').forEach((node, index) => {
        const previous = node.id;
        const next = `plan-check-print-${tab.id}-${index}-${previous}`;
        idMap.set(previous, next);
        node.id = next;
      });
      for (const attribute of ['for', 'aria-labelledby', 'aria-describedby', 'aria-controls']) {
        [section, ...section.querySelectorAll(`[${attribute}]`)].forEach((node) => {
          if (!node.hasAttribute(attribute)) return;
          const tokens = (node.getAttribute(attribute) || '').split(/\s+/).filter(Boolean);
          node.setAttribute(attribute, tokens.map((token) => idMap.get(token) || token).join(' '));
        });
      }
      container.append(section);
    }
    target.append(container);
    printPanels = container;
    return container;
  }

  function syncSelectionMarkup() {
    mount.querySelectorAll('[data-plan-check-select]').forEach((button) => {
      const active = state.selection?.type === button.dataset.selectType
        && String(state.selection?.id) === String(button.dataset.selectId);
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('plan-check-result--selected', active && button.classList.contains('plan-check-result'));
      button.closest('.plan-check-layer')?.classList.toggle('plan-check-layer--selected', active);
    });
  }

  function createViewer() {
    disposeViewer();
    const root = mount.querySelector('[data-plan-check-viewer]');
    if (!root || !state.result) return;
    try {
      viewer = createPlanCheckViewer({
        root,
        result: state.result,
        mode: state.tab,
        hiddenLayers: state.hiddenLayers,
        selection: state.selection,
        filter: state.filter,
        background: state.background,
        onSelect: (selection) => {
          state.selection = selection;
          syncSelectionMarkup();
        },
        onAnnounce: C.announce,
        onBackgroundChange: (background) => { state.background = background; },
      });
    } catch {
      root.classList.add('plan-check-viewer--error');
      const wrap = root.querySelector('[data-plan-check-canvas-wrap]');
      if (wrap) wrap.insertAdjacentHTML('beforeend', `<div class="plan-check-viewer__empty">${C.empty(
        'Die grafische Planansicht ist in diesem Browser nicht verf\u00fcgbar.',
        { hint: 'Alle Pr\u00fcfergebnisse bleiben in den Textlisten zug\u00e4nglich.', available: false },
      )}</div>`);
      C.announce('Die grafische Planansicht ist nicht verf\u00fcgbar. Die Textlisten bleiben zug\u00e4nglich.');
    }
  }

  function wireQualityView() {
    C.wireTabs(mount, {
      onSelect: (tab) => {
        state.tab = tab;
        refreshActivePanel({ preserveFocus: false });
        viewer?.setMode(tab);
        viewer?.setFilter(state.filter);
      },
    });
    createViewer();
  }

  function draw({ preserveFocus = false } = {}) {
    const restoreFocus = preserveFocus && C.preserveFocus ? C.preserveFocus(mount) : () => false;
    disposeViewer();
    mount.innerHTML = renderPlanCheckPage(C, state, currentLocation());
    if (state.step === 2) wireQualityView();
    restoreFocus();
  }

  function refreshActivePanel({ preserveFocus = true } = {}) {
    const panel = mount.querySelector('[data-plan-check-panel]');
    if (!panel) return;
    const restoreFocus = preserveFocus && C.preserveFocus ? C.preserveFocus(mount) : () => false;
    const label = PLAN_CHECK_TABS.find((tab) => tab.id === state.tab)?.label || PLAN_CHECK_STEPS[1];
    panel.innerHTML = `<h3 class="sr-only">${C.escape(label)}</h3>${renderPlanCheckPanel(C, state, state.tab)}`;
    restoreFocus();
    viewer?.setFilter(state.filter);
    viewer?.setHiddenLayers(state.hiddenLayers);
    syncSelectionMarkup();
  }

  function updateUploadDom() {
    const form = mount.querySelector('[data-plan-check-form]');
    const dropZone = mount.querySelector('[data-plan-check-drop-zone]');
    if (!form || !dropZone) return;
    const currentState = dropZone.querySelector('.plan-check-file-drop__state');
    if (currentState) currentState.outerHTML = renderPlanCheckUploadState(C, state);
    dropZone.classList.toggle('plan-check-file-drop--dragover', state.dragActive);
    dropZone.classList.toggle('plan-check-file-drop--error', Boolean(state.fileError));
    dropZone.classList.toggle('plan-check-file-drop--loading', state.phase === 'loading');
    form.setAttribute('aria-busy', String(state.phase === 'loading'));

    const message = mount.querySelector('[data-plan-check-file-message]');
    if (message) message.innerHTML = state.fileError ? C.notification(state.fileError, 'error', 'WarningCircle') : '';
    const input = mount.querySelector('[data-plan-check-file]');
    if (input) {
      input.disabled = state.phase === 'loading';
      input.required = !state.file;
      input.setAttribute('aria-invalid', String(Boolean(state.fileError)));
    }
    const fileName = mount.querySelector('[data-plan-check-file-name]');
    if (fileName) {
      fileName.textContent = state.file?.name || '';
      fileName.hidden = !state.file;
    }
    const loading = state.phase === 'loading';
    const abortButton = mount.querySelector('[data-plan-check-action="abort"]');
    if (abortButton) abortButton.hidden = !loading;
    const buildingSelect = mount.querySelector('[data-plan-check-building]');
    const floorSelect = mount.querySelector('[data-plan-check-floor]');
    if (buildingSelect) buildingSelect.disabled = loading;
    if (floorSelect) floorSelect.disabled = loading || !state.buildingId || !currentLocation().floors.length;
    mount.querySelectorAll('[data-plan-check-change-type], [data-plan-check-change-reason], '
      + '[data-plan-check-effective-date], [data-plan-check-reference]')
      .forEach((control) => { control.disabled = loading; });
    const submit = form.querySelector('[type="submit"]');
    if (submit) {
      submit.disabled = !state.file || loading;
      submit.setAttribute('aria-busy', String(loading));
      submit.classList.toggle('btn--loading', loading);
      submit.innerHTML = `${loading ? C.icon('Spinner', 'btn__icon icon--spin') : C.icon('Search', 'btn__icon')}`
        + `<span class="btn__text">${loading ? 'Datei wird gepr\u00fcft\u2026' : 'Pr\u00fcfen'}</span>`;
    }
  }

  function chooseFile(file) {
    const error = validateFile(file);
    state.file = error ? null : file;
    state.fileError = error;
    state.phase = error ? 'error' : 'default';
    state.progress = { stage: '', value: 0, label: '' };
    updateUploadDom();
    if (error) setStatus(error);
    else setStatus(`${file.name} ist zur Pr\u00fcfung bereit.`);
  }

  function updateProgress(progress) {
    state.progress = parseProgress(progress);
    const label = state.progress.label;
    const value = Math.round(state.progress.value * 100);
    const loadingLabel = mount.querySelector('.loading__label');
    const progressElement = mount.querySelector('.plan-check-progress');
    if (loadingLabel) loadingLabel.textContent = label;
    if (progressElement) {
      progressElement.value = value;
      progressElement.textContent = `${value} %`;
      if (progressElement.nextElementSibling) progressElement.nextElementSibling.textContent = `${value} %`;
    }
    if (state.progress.stage !== lastProgressStage) {
      lastProgressStage = state.progress.stage;
      setStatus(label);
    }
  }

  async function parseSelectedFile() {
    if (!state.intakeAvailable || !parser) return;
    const error = validateFile(state.file);
    if (error) { state.fileError = error; state.phase = 'error'; updateUploadDom(); setStatus(error); return; }
    // Location/change metadata belongs to this submission. Capture immutable
    // scalar values before file reads or worker startup can yield to UI events.
    const checkContext = reportContext();
    parseAbort?.abort();
    parseAbort = new AbortController();
    const sequence = ++parseSequence;
    lastProgressStage = '';
    state.phase = 'loading';
    state.fileError = '';
    state.progress = { stage: 'reading', value: 0, label: PROGRESS_LABELS.reading };
    updateUploadDom();
    setStatus('DWG-Pr\u00fcfung gestartet.');
    mount.querySelector('[data-plan-check-action="abort"]')?.focus({ preventScroll: true });
    try {
      const parsed = await parser.parse(state.file, {
        signal: parseAbort.signal,
        onProgress: (progress) => {
          if (!disposed && sequence === parseSequence) updateProgress(progress);
        },
      });
      if (disposed || sequence !== parseSequence || routeSignal?.aborted) return;
      state.result = { ...parsed, checkContext };
      state.phase = 'ready';
      state.step = 2;
      state.tab = 'rules';
      state.filter = 'all';
      state.search = '';
      state.selection = null;
      state.hiddenLayers = new Set();
      draw();
      C.focusWizardStep(mount, PLAN_CHECK_STEPS, 2, { headId: 'plan-check-step-heading' });
      setStatus('DWG-Pr\u00fcfung abgeschlossen. Die Ergebnisse sind verf\u00fcgbar.');
    } catch (parseError) {
      if (parseError?.name === 'AbortError' || disposed || sequence !== parseSequence) return;
      state.phase = 'error';
      state.fileError = parserMessage(parseError);
      updateUploadDom();
      setStatus(state.fileError);
      mount.querySelector('[data-plan-check-file]')?.focus({ preventScroll: false });
    }
  }

  function resetFile() {
    parseAbort?.abort();
    parseSequence += 1;
    state.step = 1;
    state.phase = 'empty';
    state.file = null;
    state.fileError = '';
    state.result = null;
    state.selection = null;
    state.hiddenLayers = new Set();
    state.search = '';
    state.filter = 'all';
    state.progress = { stage: '', value: 0, label: '' };
    draw();
    C.focusWizardStep(mount, PLAN_CHECK_STEPS, 1, { headId: 'plan-check-step-heading' });
  }

  function abortParse() {
    if (state.phase !== 'loading') return;
    parseAbort?.abort();
    parseAbort = null;
    parseSequence += 1;
    lastProgressStage = '';
    state.phase = state.file ? 'default' : 'empty';
    state.progress = { stage: '', value: 0, label: '' };
    updateUploadDom();
    setStatus('DWG-Pr\u00fcfung abgebrochen. Die ausgew\u00e4hlte Datei bleibt bereit.');
    mount.querySelector('[type="submit"]')?.focus({ preventScroll: true });
  }

  function navigateBack() {
    if (!returnHref) return;
    parseAbort?.abort();
    if (typeof ctx.navigate === 'function') ctx.navigate(returnHref);
    else location.hash = returnHref;
  }

  function handleClick(event) {
    const action = event.target.closest?.('[data-plan-check-action]');
    if (action) {
      if (action.dataset.planCheckAction === 'replace-file') resetFile();
      else if (action.dataset.planCheckAction === 'abort') abortParse();
      else if (action.dataset.planCheckAction === 'cancel') navigateBack();
      return;
    }
    const filterButton = event.target.closest?.('[data-plan-check-filter]');
    if (filterButton) {
      state.filter = filterButton.dataset.planCheckFilter || 'all';
      refreshActivePanel();
      return;
    }
    const selectionButton = event.target.closest?.('[data-plan-check-select]');
    if (selectionButton) {
      state.selection = {
        type: selectionButton.dataset.selectType,
        id: selectionButton.dataset.selectId,
      };
      syncSelectionMarkup();
      const outcome = viewer?.setSelection(state.selection, { focus: true });
      if (!outcome?.count) C.announce('Auswahl übernommen. Im Plan ist kein zugehöriges Objekt lokalisierbar.');
      else if (outcome.truncated) C.announce(`Die ersten ${outcome.count} zugehörigen Objekte sind im Plan hervorgehoben.`);
      else if (outcome.count === 1) C.announce('Ein zugehöriges Objekt ist im Plan hervorgehoben.');
      else C.announce(`${outcome.count} zugehörige Objekte sind im Plan hervorgehoben.`);
      return;
    }
    const layerAction = event.target.closest?.('[data-plan-check-layers]');
    if (layerAction) {
      const hideAll = layerAction.dataset.planCheckLayers === 'hide-all';
      state.hiddenLayers = hideAll
        ? new Set(list(state.result?.layers).map((layer) => scalar(layer?.name)).filter(Boolean))
        : new Set();
      mount.querySelectorAll('[data-plan-check-layer]').forEach((input) => { input.checked = !hideAll; });
      viewer?.setHiddenLayers(state.hiddenLayers);
      C.announce(hideAll ? 'Alle Layer ausgeblendet.' : 'Alle Layer eingeblendet.');
      return;
    }
    const reportButton = event.target.closest?.('[data-plan-check-report]');
    if (reportButton && state.result) {
      const format = reportButton.dataset.planCheckReport;
      if (format === 'print') {
        preparePrintPanels();
        C.announce('Druckdialog ge\u00f6ffnet. Dort kann die Pr\u00fcfung als PDF gesichert werden.');
        try { window.print(); } finally { setTimeout(clearPrintPanels, 0); }
      } else {
        const filename = downloadPlanCheckReport(state.result, format);
        C.announce(`${filename} wurde erstellt.`);
      }
    }
  }

  function handleInput(event) {
    const target = event.target;
    if (target.matches('[data-plan-check-search]')) {
      state.search = target.value;
      refreshActivePanel();
    } else if (target.matches('[data-plan-check-change-reason]')) {
      state.changeReason = target.value.slice(0, LIMITS.changeReasonLength);
      if (target.value !== state.changeReason) target.value = state.changeReason;
      target.setCustomValidity('');
    }
    else if (target.matches('[data-plan-check-effective-date]')) state.effectiveDate = target.value;
    else if (target.matches('[data-plan-check-reference]')) state.reference = target.value;
  }

  function handleChange(event) {
    const target = event.target;
    if (target.matches('[data-plan-check-file]')) {
      if (target.files?.[0]) chooseFile(target.files[0]);
    } else if (target.matches('[data-plan-check-building]')) {
      state.buildingId = target.value;
      state.floorId = '';
      draw({ preserveFocus: true });
    } else if (target.matches('[data-plan-check-floor]')) state.floorId = target.value;
    else if (target.matches('[data-plan-check-change-type]')) {
      state.changeType = target.value === 'mutation' ? 'mutation' : 'new';
      const fields = mount.querySelector('[data-plan-check-change-fields]');
      if (fields) fields.hidden = state.changeType !== 'mutation';
      const reason = mount.querySelector('[data-plan-check-change-reason]');
      if (reason) {
        reason.required = state.changeType === 'mutation';
        reason.setAttribute('aria-required', String(state.changeType === 'mutation'));
        if (state.changeType !== 'mutation') reason.setCustomValidity('');
      }
    } else if (target.matches('[data-plan-check-layer]')) {
      const name = target.dataset.planCheckLayer;
      if (target.checked) state.hiddenLayers.delete(name); else state.hiddenLayers.add(name);
      viewer?.setHiddenLayers(state.hiddenLayers);
      C.announce(`Layer ${name} ${target.checked ? 'eingeblendet' : 'ausgeblendet'}.`);
    }
  }

  function handleSubmit(event) {
    if (!event.target.matches('[data-plan-check-form]')) return;
    event.preventDefault();
    if (state.changeType === 'mutation' && !state.changeReason.trim()) {
      const reason = mount.querySelector('[data-plan-check-change-reason]');
      reason?.setCustomValidity('Bitte geben Sie den \u00c4nderungsgrund an.');
      reason?.reportValidity();
      reason?.focus({ preventScroll: false });
      C.announce('Bitte geben Sie den \u00c4nderungsgrund an.');
      return;
    }
    parseSelectedFile();
  }

  function fileDrag(event) {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    // Suppress the browser's file-navigation default. Intake is normally
    // enabled; the flag remains a graceful operational fallback.
    if (!state.intakeAvailable) return;
    if (state.phase === 'loading') return;
    if (event.type === 'dragenter') dragDepth += 1;
    if (event.type === 'dragleave') dragDepth = Math.max(0, dragDepth - 1);
    state.dragActive = event.type !== 'dragleave' || dragDepth > 0;
    mount.querySelector('[data-plan-check-drop-zone]')?.classList.toggle('plan-check-file-drop--dragover', state.dragActive);
    if (event.type === 'drop') {
      dragDepth = 0;
      state.dragActive = false;
      chooseFile(event.dataTransfer.files?.[0]);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    parseSequence += 1;
    parseAbort?.abort();
    clearPrintPanels();
    disposeViewer();
    eventAbort.abort();
    parser?.dispose();
  }

  mount.addEventListener('click', handleClick, { signal });
  mount.addEventListener('input', handleInput, { signal });
  mount.addEventListener('change', handleChange, { signal });
  mount.addEventListener('submit', handleSubmit, { signal });
  mount.addEventListener('dragenter', fileDrag, { signal });
  mount.addEventListener('dragover', fileDrag, { signal });
  mount.addEventListener('dragleave', fileDrag, { signal });
  mount.addEventListener('drop', fileDrag, { signal });
  window.addEventListener('beforeprint', preparePrintPanels, { signal });
  window.addEventListener('afterprint', clearPrintPanels, { signal });
  routeSignal?.addEventListener('abort', dispose, { once: true, signal });
  ctx.onUnmount?.(dispose);
  ctx.setTitle?.(state.intakeAvailable ? 'Plan hochladen und pr\u00fcfen' : 'Planpr\u00fcfung');
  draw();

  return { dispose, getState: () => state };
}

export default function renderPlanCheck(ctx, options = {}) {
  return createPlanCheckController(ctx, options);
}
