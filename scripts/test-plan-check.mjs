// Local DWG Plan Check route: login gate, picker/drop validation, abort and
// Worker cleanup, real fixture parsing, privacy, results, both skins, reduced
// motion, 320 px reflow and the contextual return path.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

import { APP_BASE, launch, openPage, sleep } from './lib/cdp.mjs';

const BUILDING = '1080/6650/AA';
const FLOOR = '1080-6650-AA-2og';
const FIXTURE = resolve('assets', 'plan-check', 'CAD.V01-CAFM-Plan-DE.dwg');
const route = `/app/plan-check?building=${encodeURIComponent(BUILDING)}&floor=${encodeURIComponent(FLOOR)}`;
const appUrl = (path = '') => `${APP_BASE}${path}`;
const browser = await launch();
let gatePage;
let page;

try {
  gatePage = await openPage(browser, appUrl(route), { login: false });
  assert.equal(await gatePage.waitFor(`document.querySelector('#main-content h1')?.textContent.trim() === 'Planprüfung'`), true);
  const gate = await gatePage.evaluate(`(() => {
    const resources = performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname);
    return {
      app: Boolean(document.querySelector('.plan-check')),
      login: /AGOV|FedLogin/.test(document.querySelector('#main-content')?.textContent || ''),
      lazyCss: Boolean(document.querySelector('link[data-app-style="plan-check"]')),
      parserAssets: resources.filter((path) => /parser-worker|libredwg|\\.wasm$/i.test(path)),
    };
  })()`);
  assert.equal(gate.app, false);
  assert.equal(gate.login, true);
  assert.equal(gate.lazyCss, false);
  assert.deepEqual(gate.parserAssets, []);
  assert.deepEqual(await gatePage.problems(), []);
  await gatePage.closeTarget();
  gatePage = null;

  page = await openPage(browser, appUrl('/'), { login: true });
  await page.evaluate(`(() => {
    const NativeWorker = window.Worker;
    window.__planCheckWorkerCount = 0;
    window.__planCheckActiveWorkerCount = 0;
    function ObservedWorker(...args) {
      window.__planCheckWorkerCount += 1;
      window.__planCheckActiveWorkerCount += 1;
      const worker = new NativeWorker(...args);
      const terminate = worker.terminate.bind(worker);
      let terminated = false;
      worker.terminate = () => {
        if (!terminated) {
          terminated = true;
          window.__planCheckActiveWorkerCount -= 1;
        }
        return terminate();
      };
      return worker;
    }
    ObservedWorker.prototype = NativeWorker.prototype;
    window.Worker = ObservedWorker;
    window.__planCheckNetworkWrites = [];
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const method = String(init.method || input?.method || 'GET').toUpperCase();
      if (!['GET', 'HEAD'].includes(method) || init.body != null) {
        window.__planCheckNetworkWrites.push({ kind: 'fetch', method, url: String(input?.url || input) });
      }
      return nativeFetch(input, init);
    };
    const nativeOpen = XMLHttpRequest.prototype.open;
    const nativeSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this.__planCheckRequest = { method: String(method).toUpperCase(), url: String(url) };
      return nativeOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(body) {
      if (body != null || !['GET', 'HEAD'].includes(this.__planCheckRequest?.method)) {
        window.__planCheckNetworkWrites.push({ kind: 'xhr', ...this.__planCheckRequest });
      }
      return nativeSend.call(this, body);
    };
    window.__planCheckFouc = [];
    const inspect = () => {
      if (!document.querySelector('.plan-check')) return;
      const style = document.querySelector('link[data-app-style="plan-check"]');
      if (!style || style.dataset.loaded !== 'true' || !style.sheet) window.__planCheckFouc.push('plan-check');
    };
    new MutationObserver(inspect).observe(document.getElementById('main-content'), { childList: true, subtree: true });
    location.hash = ${JSON.stringify(`#${route}`)};
  })()`);
  assert.equal(await page.waitFor(`Boolean(document.querySelector('[data-plan-check-file]'))`), true);
  await sleep(200);

  const ready = await page.evaluate(`(() => {
    const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
    const input = document.querySelector('[data-plan-check-file]');
    const field = document.querySelector('.plan-check-file-field');
    const selectorButton = document.querySelector('.plan-check-file-field__button');
    const fileName = document.querySelector('[data-plan-check-file-name]');
    const fieldBounds = field?.getBoundingClientRect();
    const buttonBounds = selectorButton?.getBoundingClientRect();
    const describedBy = (input?.getAttribute('aria-describedby') || '').split(/\\s+/).filter(Boolean);
    const ids = [...document.querySelectorAll('.plan-check [id]')].map((node) => node.id);
    return {
      h1: document.querySelector('.plan-check h1')?.textContent.trim(),
      privacy: document.querySelector('[data-plan-check-privacy]')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      vulnerabilityCopy: /CVE-|Sicherheitslücke|verwundbar/i.test(document.querySelector('.plan-check')?.textContent || ''),
      controls: {
        file: Boolean(input),
        drop: Boolean(document.querySelector('[data-plan-check-drop-zone]')),
        form: Boolean(document.querySelector('[data-plan-check-form]')),
        submit: Boolean(document.querySelector('.plan-check button[type="submit"]')),
        canvas: Boolean(document.querySelector('[data-plan-check-canvas]')),
      },
      input: {
        accept: input?.getAttribute('accept') || '',
        required: Boolean(input?.required),
        labelled: document.querySelector('label[for="plan-check-file"]')?.control === input,
        described: describedBy.length === 3 && describedBy.every((id) => document.getElementById(id)),
      },
      fileLayout: {
        instruction: document.querySelector('.plan-check-file-drop__state strong')?.textContent.trim(),
        buttonText: selectorButton?.querySelector('[aria-hidden="true"]')?.textContent.trim(),
        fileName: fileName?.textContent.trim(),
        fileNameHidden: Boolean(fileName?.hidden),
        nativeInputHidden: input?.classList.contains('sr-only'),
        buttonCentered: Boolean(fieldBounds && buttonBounds
          && Math.abs((fieldBounds.left + fieldBounds.right - buttonBounds.left - buttonBounds.right) / 2) < 1),
      },
      scrolling: {
        documentScroller: document.scrollingElement === document.documentElement,
        rootOverflowY: getComputedStyle(document.documentElement).overflowY,
        rootScrollbarWidth: innerWidth - document.documentElement.clientWidth,
        extraGutterWidth: document.documentElement.clientWidth - document.body.clientWidth,
        rootScrollable: document.documentElement.scrollHeight > document.documentElement.clientHeight,
        appOverflowY: getComputedStyle(document.querySelector('.plan-check')).overflowY,
        appScrollable: document.querySelector('.plan-check').scrollHeight > document.querySelector('.plan-check').clientHeight,
        appFillsViewport: document.querySelector('.plan-check').clientHeight >= innerHeight,
      },
      submitDisabled: Boolean(document.querySelector('.plan-check button[type="submit"]')?.disabled),
      back: document.querySelector('[data-plan-check-action="cancel"]')?.textContent.trim() || '',
      standalone: document.body.classList.contains('body--standalone-app'),
      cssLoaded: Boolean(document.querySelector('link[data-app-style="plan-check"]')?.sheet),
      fouc: window.__planCheckFouc,
      workers: window.__planCheckWorkerCount,
      activeWorkers: window.__planCheckActiveWorkerCount,
      parserAssets: resources.filter((url) => /parser-worker|vendor\\/libredwg|libredwg-web|\\.wasm(?:$|[?#])/i.test(url)),
      dwgRequests: resources.filter((url) => /\\.dwg(?:$|[?#])/i.test(url)),
      duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
    };
  })()`);
  assert.equal(ready.h1, 'Plan hochladen und prüfen');
  assert.match(ready.privacy, /lokal im Browser verarbeitet/);
  assert.match(ready.privacy, /nicht an einen Server übertragen/);
  assert.match(ready.privacy, /Nicht-Produktivdaten/);
  assert.equal(ready.vulnerabilityCopy, false);
  assert.deepEqual(ready.controls, { file: true, drop: true, form: true, submit: true, canvas: false });
  assert.deepEqual(ready.input, { accept: '.dwg', required: true, labelled: true, described: true });
  assert.deepEqual(ready.fileLayout, {
    instruction: 'DWG-Datei hierher ziehen oder mit dem Dateifeld ausw\u00e4hlen',
    buttonText: 'Datei ausw\u00e4hlen',
    fileName: '',
    fileNameHidden: true,
    nativeInputHidden: true,
    buttonCentered: true,
  });
  assert.equal(ready.scrolling.documentScroller, true);
  assert.equal(ready.scrolling.rootOverflowY, 'auto');
  assert.ok(ready.scrolling.rootScrollbarWidth >= 0);
  assert.equal(ready.scrolling.extraGutterWidth, 0);
  assert.equal(ready.scrolling.rootScrollable, true);
  assert.equal(ready.scrolling.appOverflowY, 'visible');
  assert.equal(ready.scrolling.appScrollable, false);
  assert.equal(ready.scrolling.appFillsViewport, true);
  assert.equal(ready.submitDisabled, true);
  assert.match(ready.back, /Zurück zum Objekt/);
  assert.equal(ready.standalone, true);
  assert.equal(ready.cssLoaded, true);
  assert.deepEqual(ready.fouc, []);
  assert.equal(ready.workers, 0);
  assert.equal(ready.activeWorkers, 0);
  assert.deepEqual(ready.parserAssets, []);
  assert.deepEqual(ready.dwgRequests, []);
  assert.deepEqual(ready.duplicateIds, []);
  const contextCases = [
    {
      hash: '#/app/plan-check?building=missing-building',
      warning: 'Das angeforderte Objekt wurde nicht gefunden.',
      back: 'Zurück zu Workspace Management',
    },
    {
      hash: `#/app/plan-check?floor=${encodeURIComponent(FLOOR)}`,
      warning: 'Das angeforderte Geschoss konnte ohne gültigen Objektbezug nicht vorbelegt werden.',
      back: 'Zurück zu Workspace Management',
    },
    {
      hash: `#/app/plan-check?building=${encodeURIComponent(BUILDING)}&floor=1080-4850-AG-2og`,
      warning: 'Das angeforderte Geschoss gehört nicht zum gewählten Objekt',
      back: 'Zurück zum Objekt',
    },
  ];
  for (const contextCase of contextCases) {
    await page.evaluate(`location.hash = ${JSON.stringify(contextCase.hash)}`);
    assert.equal(await page.waitFor(`document.querySelector('[data-plan-check-form]')?.textContent.includes(${JSON.stringify(contextCase.warning)})`), true);
    const rendered = await page.evaluate(`({
      warning: document.querySelector('[data-plan-check-form]')?.textContent || '',
      back: document.querySelector('[data-plan-check-action="cancel"]')?.textContent.trim() || '',
    })`);
    assert.match(rendered.warning, new RegExp(contextCase.warning));
    assert.match(rendered.back, new RegExp(contextCase.back));
  }
  await page.evaluate(`location.hash = ${JSON.stringify(`#${route}`)}`);
  assert.equal(await page.waitFor(`document.querySelector('[data-plan-check-file]') && document.querySelector('[data-plan-check-action="cancel"]')?.textContent.includes('Zurück zum Objekt')`), true);

  const dropped = await page.evaluate(`(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['AC1032-drop'], 'abgelegt.dwg', { type: 'application/octet-stream' }));
    const zone = document.querySelector('[data-plan-check-drop-zone]');
    const enter = new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: transfer });
    zone.dispatchEvent(enter);
    const activeDuringDrag = zone.classList.contains('plan-check-file-drop--dragover');
    const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer });
    const dispatchResult = zone.dispatchEvent(drop);
    return {
      enterPrevented: enter.defaultPrevented,
      dropPrevented: drop.defaultPrevented,
      dispatchResult,
      activeDuringDrag,
      activeAfterDrop: zone.classList.contains('plan-check-file-drop--dragover'),
      instruction: zone.querySelector('strong')?.textContent.trim() || '',
      fileFieldName: document.querySelector('[data-plan-check-file-name]')?.textContent.trim() || '',
      fileFieldHidden: document.querySelector('[data-plan-check-file-name]')?.hidden,
      submitDisabled: document.querySelector('[data-plan-check-form] button[type="submit"]')?.disabled,
      status: document.querySelector('[data-plan-check-status]')?.textContent.trim() || '',
    };
  })()`);
  assert.deepEqual(dropped, {
    enterPrevented: true,
    dropPrevented: true,
    dispatchResult: false,
    activeDuringDrag: true,
    activeAfterDrop: false,
    instruction: 'DWG-Datei hierher ziehen oder mit dem Dateifeld ausw\u00e4hlen',
    fileFieldName: 'abgelegt.dwg',
    fileFieldHidden: false,
    submitDisabled: false,
    status: 'abgelegt.dwg ist zur Prüfung bereit.',
  });

  const validation = await page.evaluate(`(() => {
    const choose = (file) => {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector('[data-plan-check-file]');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return {
        message: document.querySelector('[data-plan-check-file-message]')?.textContent.replace(/\\s+/g, ' ').trim() || '',
        invalid: input.getAttribute('aria-invalid'),
        submitDisabled: document.querySelector('[data-plan-check-form] button[type="submit"]')?.disabled,
      };
    };
    const wrongType = choose(new File(['AC1032'], 'grundriss.txt', { type: 'text/plain' }));
    const empty = choose(new File([], 'leer.dwg', { type: 'application/octet-stream' }));
    const large = new File(['AC1032'], 'zu-gross.dwg', { type: 'application/octet-stream' });
    Object.defineProperty(large, 'size', { value: 50 * 1024 * 1024 + 1 });
    const oversize = choose(large);
    return { wrongType, empty, oversize, workers: window.__planCheckWorkerCount };
  })()`);
  assert.match(validation.wrongType.message, /Endung \.dwg/);
  assert.match(validation.empty.message, new RegExp('Datei ist leer'));
  assert.match(validation.oversize.message, /grösser als 50 MiB/);
  for (const outcome of [validation.wrongType, validation.empty, validation.oversize]) {
    assert.equal(outcome.invalid, 'true');
    assert.equal(outcome.submitDisabled, true);
  }
  assert.equal(validation.workers, 0);

  await page.evaluate(`(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['kein-dwg'], 'falscher-dateikopf.dwg', { type: 'application/octet-stream' }));
    const input = document.querySelector('[data-plan-check-file]');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[data-plan-check-form]').requestSubmit();
  })()`);
  assert.equal(await page.waitFor(`document.querySelector('[data-plan-check-file-message]')?.textContent.includes('DWG-Dateikopf')`), true);
  const badHeader = await page.evaluate(`({
    message: document.querySelector('[data-plan-check-file-message]')?.textContent.replace(/\\s+/g, ' ').trim() || '',
    inputFocused: document.activeElement === document.querySelector('[data-plan-check-file]'),
    workers: window.__planCheckWorkerCount,
    activeWorkers: window.__planCheckActiveWorkerCount,
  })`);
  assert.match(badHeader.message, /keinen lesbaren DWG-Dateikopf/);
  assert.equal(badHeader.inputFocused, true);
  assert.equal(badHeader.workers, 0);
  assert.equal(badHeader.activeWorkers, 0);

  await browser.send('DOM.enable', {}, page.sessionId);
  const { root } = await browser.send('DOM.getDocument', { depth: 1 }, page.sessionId);
  const { nodeId: fileInputNodeId } = await browser.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: '[data-plan-check-file]',
  }, page.sessionId);
  assert.ok(fileInputNodeId, 'the DWG file input is addressable through CDP');
  await browser.send('DOM.setFileInputFiles', { files: [FIXTURE], nodeId: fileInputNodeId }, page.sessionId);
  assert.equal(await page.waitFor(`document.querySelector('[data-plan-check-drop-zone]')?.textContent.includes('CAD.V01-CAFM-Plan-DE.dwg')`), true);

  await page.evaluate(`document.querySelector('[data-plan-check-form]').requestSubmit()`);
  assert.equal(await page.waitFor(`window.__planCheckActiveWorkerCount === 1`, { timeout: 30_000, interval: 10 }), true);
  const aborted = await page.evaluate(`(() => {
    const abort = document.querySelector('[data-plan-check-action="abort"]');
    const focusedBefore = document.activeElement === abort;
    abort.click();
    return { focusedBefore };
  })()`);
  assert.equal(aborted.focusedBefore, true);
  assert.equal(await page.waitFor(`window.__planCheckActiveWorkerCount === 0 && !document.querySelector('[data-plan-check-form] button[type="submit"]')?.disabled`), true);
  const afterAbort = await page.evaluate(`({
    selected: document.querySelector('[data-plan-check-file-name]')?.textContent.trim() || '',
    status: document.querySelector('[data-plan-check-status]')?.textContent.trim() || '',
    submitFocused: document.activeElement === document.querySelector('[data-plan-check-form] button[type="submit"]'),
  })`);
  assert.equal(afterAbort.selected, 'CAD.V01-CAFM-Plan-DE.dwg');
  assert.match(afterAbort.status, /abgebrochen/);
  assert.equal(afterAbort.submitFocused, true);

  await page.evaluate(`document.querySelector('[data-plan-check-form]').requestSubmit()`);
  assert.equal(await page.waitFor(`Boolean(document.querySelector('.plan-check-quality'))`, { timeout: 120_000 }), true);
  const parsed = await page.evaluate(`(() => {
    const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
    return {
      filename: document.querySelector('#plan-check-file-summary-heading')?.textContent.trim() || '',
      resultHeading: document.querySelector('#plan-check-results-heading')?.textContent.trim() || '',
      retry: document.querySelector('[data-plan-check-action="replace-file"]')?.textContent.trim() || '',
      facts: document.querySelector('.plan-check-file-summary__facts')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      canvas: Boolean(document.querySelector('[data-plan-check-canvas]')),
      emptyViewer: Boolean(document.querySelector('.plan-check-viewer__empty')),
      tabs: document.querySelectorAll('[role="tab"]').length,
      reports: [...document.querySelectorAll('[data-plan-check-report]')].map((button) => button.dataset.planCheckReport),
      figures: document.querySelector('.plan-check-figures')?.textContent.replace(/[\\n\\t ]+/g, ' ').trim() || '',
      rulesTab: document.querySelector('#plan-check-tab-rules')?.textContent.trim() || '',
      workers: window.__planCheckWorkerCount,
      activeWorkers: window.__planCheckActiveWorkerCount,
      networkWrites: window.__planCheckNetworkWrites,
      dwgRequests: resources.filter((url) => /\\.dwg(?:$|[?#])/i.test(url)),
      externalRequests: resources.filter((url) => new URL(url, location.href).origin !== location.origin),
      layout: {
        documentScroller: document.scrollingElement === document.documentElement,
        rootScrollable: document.documentElement.scrollHeight > document.documentElement.clientHeight,
        appOverflowY: getComputedStyle(document.querySelector('.plan-check')).overflowY,
        appOwnScrollable: document.querySelector('.plan-check').scrollHeight > document.querySelector('.plan-check').clientHeight,
        appFillsViewport: document.querySelector('.plan-check').clientHeight >= innerHeight,
      },
      vulnerabilityCopy: /CVE-|Sicherheitslücke|verwundbar/i.test(document.querySelector('.plan-check')?.textContent || ''),
      duplicateIds: [...document.querySelectorAll('.plan-check [id]')].map((node) => node.id)
        .filter((id, index, ids) => ids.indexOf(id) !== index),
    };
  })()`);
  assert.equal(parsed.filename, 'CAD.V01-CAFM-Plan-DE.dwg');
  assert.equal(parsed.resultHeading, 'Datenqualität im Detail');
  assert.match(parsed.retry, /Andere Datei prüfen/);
  assert.match(parsed.facts, /DWG-Version\s*AC1032/);
  assert.match(parsed.facts, /Objekte\s*3.?504/);
  assert.equal(parsed.canvas, true);
  assert.equal(parsed.emptyViewer, false);
  assert.equal(parsed.tabs, 6);
  assert.deepEqual(parsed.reports, ['pdf', 'excel', 'csv', 'json']);
  // The engine must produce a real result: a drawing with a handful of
  // unsupported entities is scored, not withheld.
  assert.match(parsed.figures, /Erfüllungsgrad\s*9?\d %/);
  assert.match(parsed.figures, /Räume\s*30/);
  assert.match(parsed.figures, /NGF\s*[\d’'.]+ m²/);
  assert.equal(parsed.rulesTab, 'Prüfregeln (35/39)');
  assert.ok(parsed.workers >= 2);
  assert.equal(parsed.activeWorkers, 0);
  assert.deepEqual(parsed.networkWrites, []);
  assert.deepEqual(parsed.dwgRequests, []);
  assert.deepEqual(parsed.externalRequests, []);
  assert.deepEqual(parsed.layout, {
    documentScroller: true, rootScrollable: true, appOverflowY: 'visible', appOwnScrollable: false, appFillsViewport: true,
  });
  assert.equal(parsed.vulnerabilityCopy, false);
  assert.deepEqual(parsed.duplicateIds, []);

  const reportLifecycle = await page.evaluate(`(async () => {
    const downloads = [];
    const nativeClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      downloads.push({ download: this.download, href: this.href });
    };
    document.querySelector('[data-plan-check-report="csv"]').click();
    document.querySelector('[data-plan-check-report="json"]').click();
    // The browser print path survives without a button: Ctrl+P still emits the
    // full register set instead of the live single panel.
    window.dispatchEvent(new Event('beforeprint'));
    const panelsDuringPrint = document.querySelectorAll('[data-plan-check-print-panels] .plan-check-print-panel').length;
    const ids = [...document.querySelectorAll('.plan-check [id]')].map((node) => node.id);
    window.dispatchEvent(new Event('afterprint'));
    const panelsAfterPrint = document.querySelectorAll('[data-plan-check-print-panels]').length;
    HTMLAnchorElement.prototype.click = nativeClick;
    return {
      downloads: downloads.map((item) => item.download),
      localUrls: downloads.every((item) => item.href.startsWith('blob:')),
      panelsDuringPrint,
      panelsAfterPrint,
      duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
    };
  })()`);
  assert.equal(reportLifecycle.downloads.length, 2);
  assert.match(reportLifecycle.downloads[0], /\.csv$/);
  assert.match(reportLifecycle.downloads[1], /\.json$/);
  assert.equal(reportLifecycle.localUrls, true);
  assert.equal(reportLifecycle.panelsDuringPrint, 6);
  assert.equal(reportLifecycle.panelsAfterPrint, 0);
  assert.deepEqual(reportLifecycle.duplicateIds, []);

  // --- PDF and Excel check report ----------------------------------------------
  // Both generators run for real against the parsed fixture. The libraries are
  // fetched only now — the parse itself made no external request.
  const richReports = await page.evaluate(`(async () => {
    const blobs = [];
    const nativeCreate = URL.createObjectURL;
    URL.createObjectURL = function (blob) {
      blobs.push({ type: blob.type, size: blob.size });
      return nativeCreate.call(URL, blob);
    };
    try {
      const pdf = await import('/js/plan-check/report-pdf.js');
      const excel = await import('/js/plan-check/report-excel.js');
      const state = window.__planCheck.state;
      const snapshot = (mode) => window.__planCheck.viewer?.snapshot?.(mode) || '';
      const doc = await pdf.buildPlanCheckPdf(state.result, { snapshot });
      const pdfBlob = doc.output('blob');
      const { XLSX, workbook } = await excel.buildPlanCheckWorkbook(state.result);
      const sheetNames = workbook.SheetNames.slice();
      const xlsxBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      return {
        pdf: { pages: doc.internal.getNumberOfPages(), size: pdfBlob.size, type: pdfBlob.type },
        excel: { sheets: sheetNames, size: xlsxBytes.byteLength },
        pdfName: pdf.planCheckPdfFilename(state.result),
        excelName: excel.planCheckExcelFilename(state.result),
        snapshotIsPng: snapshot('rooms').startsWith('data:image/png'),
      };
    } finally {
      URL.createObjectURL = nativeCreate;
    }
  })()`, { timeout: 120_000 });
  // Cover + table of contents + six chapters, so at least eight pages.
  assert.ok(richReports.pdf.pages >= 8, `PDF chapters: ${richReports.pdf.pages} pages`);
  assert.equal(richReports.pdf.type, 'application/pdf');
  assert.ok(richReports.pdf.size > 20_000, `PDF is not empty: ${richReports.pdf.size}`);
  // Compression plus an opaque, page-sized snapshot keeps the report mailable.
  assert.ok(richReports.pdf.size < 2_000_000, `PDF stays compact: ${richReports.pdf.size}`);
  assert.deepEqual(richReports.excel.sheets,
    ['Info', 'Prüfregeln', 'Fehlermeldungen', 'Layer', 'Räume', 'Flächen', 'Kennzahlen']);
  assert.ok(richReports.excel.size > 5_000, `workbook is not empty: ${richReports.excel.size}`);
  assert.equal(richReports.snapshotIsPng, true);
  assert.match(richReports.pdfName, /-pruefbericht\.pdf$/);
  assert.match(richReports.excelName, /-pruefbericht\.xlsx$/);

  // Clicking the buttons drives the same generators and returns the controls to
  // an enabled state afterwards.
  const buttonRun = await page.evaluate(`(async () => {
    const nativeClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};
    const button = document.querySelector('[data-plan-check-report="excel"]');
    button.click();
    const busyDuring = button.getAttribute('aria-busy');
    for (let attempt = 0; attempt < 200 && button.disabled; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    HTMLAnchorElement.prototype.click = nativeClick;
    return { busyDuring, disabledAfter: button.disabled, label: button.textContent.trim() };
  })()`, { timeout: 120_000 });
  assert.equal(buttonRun.busyDuring, 'true');
  assert.equal(buttonRun.disabledAfter, false);
  assert.equal(buttonRun.label, 'Excel');

  // --- Redesigned workbench -------------------------------------------------
  // The status filter belongs to the register bar once, not to every panel, and
  // the metrics register takes the full width instead of leaving an idle Canvas.
  // The two-column workbench and the single-row register bar are desktop
  // behaviour, so this block runs at a stated laptop width.
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  }, page.sessionId);
  await sleep(200);
  const workbench = await page.evaluate(`(() => {
    const bar = document.querySelector('.plan-check-board__bar');
    const barBox = bar.getBoundingClientRect();
    const tabsBox = bar.querySelector('.tab__controls-container').getBoundingClientRect();
    const filterBox = bar.querySelector('.plan-check-statusfilter').getBoundingClientRect();
    return {
      filtersInBar: bar.querySelectorAll('[data-plan-check-filter]').length,
      filterLabels: [...bar.querySelectorAll('[data-plan-check-filter]')].map((button) => button.textContent.trim()),
      filterIcons: bar.querySelectorAll('[data-plan-check-filter] .icon').length,
      reportIcons: document.querySelectorAll('[data-plan-check-report] .icon').length,
      filtersInPanel: document.querySelectorAll('[data-plan-check-panel] [data-plan-check-filter]').length,
      // The bar may wrap the filter onto its own row, but a register must never
      // be clipped out of reach.
      filterReachable: filterBox.width > 0 && filterBox.right <= barBox.right + 1,
      tabsFit: bar.querySelector('.tab__controls').scrollWidth
        <= bar.querySelector('.tab__controls').clientWidth,
      barWithinBoard: barBox.width <= document.querySelector('.plan-check-board').getBoundingClientRect().width + 1,
      groups: [...document.querySelectorAll('[data-plan-check-group]')].map((group) => group.dataset.planCheckGroup),
      footbarActions: [...document.querySelectorAll('.plan-check-footbar [data-plan-check-action]')]
        .map((button) => button.dataset.planCheckAction),
      viewerToolbarInsideCanvas: Boolean(document.querySelector(
        '[data-plan-check-canvas-wrap] .plan-check-viewer__tools [data-viewer-action="focus-selection"]')),
      legend: document.querySelector('[data-plan-check-legend]')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      inspectorHidden: document.querySelector('[data-plan-check-inspector]')?.hidden,
    };
  })()`);
  // Three states only; unevaluated rules stay reachable through their own group.
  assert.equal(workbench.filtersInBar, 3);
  assert.deepEqual(workbench.filterLabels, ['Alle', 'Warnungen', 'Fehler']);
  // No icons compete with the six register labels for the same row.
  assert.equal(workbench.filterIcons, 0);
  assert.equal(workbench.reportIcons, 0);
  assert.equal(workbench.filtersInPanel, 0);
  assert.equal(workbench.filterReachable, true);
  assert.equal(workbench.tabsFit, true);
  assert.equal(workbench.barWithinBoard, true);
  assert.ok(workbench.groups.length >= 1, `rule outcome groups: ${workbench.groups}`);
  assert.deepEqual(workbench.footbarActions, ['replace-file', 'cancel', 'continue-approval']);
  assert.equal(workbench.viewerToolbarInsideCanvas, true);
  assert.match(workbench.legend, /Fehler/);
  assert.equal(workbench.inspectorHidden, true);

  // Selecting a room from the list opens the attribute card at the element, with
  // the DWG's own values rather than a restatement of the list row.
  const inspector = await page.evaluate(`(() => {
    document.querySelector('#plan-check-tab-rooms').click();
    return { rooms: document.querySelectorAll('[data-select-type="room"]').length };
  })()`);
  assert.ok(inspector.rooms > 0, 'the fixture reports rooms');
  await page.evaluate(`document.querySelectorAll('[data-select-type="room"]')[0].click()`);
  assert.equal(await page.waitFor(`document.querySelector('[data-plan-check-inspector]')?.hidden === false`), true);
  const attributes = await page.evaluate(`(() => {
    const card = document.querySelector('[data-plan-check-inspector]');
    const wrap = document.querySelector('[data-plan-check-canvas-wrap]');
    const cardBox = card.getBoundingClientRect();
    const wrapBox = wrap.getBoundingClientRect();
    const facts = {};
    card.querySelectorAll('dt').forEach((dt) => { facts[dt.textContent.trim()] = dt.nextElementSibling?.textContent.trim(); });
    return {
      facts,
      title: card.querySelector('.plan-check-inspector__name')?.textContent.trim() || '',
      context: document.querySelector('[data-plan-check-viewer-context]')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      selectedRows: document.querySelectorAll('.plan-check-row[aria-pressed="true"]').length,
      // The card stays inside the drawing area and clear of the tool strip.
      insideCanvas: cardBox.left >= wrapBox.left - 1 && cardBox.right <= wrapBox.right + 1
        && cardBox.top >= wrapBox.top - 1 && cardBox.bottom <= wrapBox.bottom + 1,
      clearOfTools: cardBox.right <= document.querySelector('.plan-check-viewer__tools').getBoundingClientRect().left,
      closes: Boolean(card.querySelector('[data-plan-check-action="clear-selection"]')),
    };
  })()`);
  assert.ok(attributes.title.length > 0, 'the attribute card names the selected element');
  assert.equal(attributes.selectedRows, 1);
  assert.ok(attributes.context.includes(attributes.title), `context strip names the selection: ${attributes.context}`);
  for (const label of ['AOID', 'Layer', 'Handle', 'Stützpunkte', 'Rolle']) {
    assert.ok(label in attributes.facts, `attribute card reports ${label}: ${Object.keys(attributes.facts)}`);
  }
  assert.equal(attributes.facts.Layer, 'R_RAUMPOLYGON');
  assert.equal(attributes.facts.Rolle, 'Raumpolygon (R_RAUMPOLYGON)');
  assert.equal(attributes.insideCanvas, true);
  assert.equal(attributes.clearOfTools, true);
  assert.equal(attributes.closes, true);

  // Escape on the Canvas dismisses the card without leaving the viewer, and the
  // list selection is released with it.
  await page.evaluate(`(() => {
    const canvas = document.querySelector('[data-plan-check-canvas]');
    canvas.focus();
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  })()`);
  assert.equal(await page.waitFor(`document.querySelector('[data-plan-check-inspector]')?.hidden === true`), true);
  assert.equal(await page.evaluate(`document.querySelectorAll('.plan-check-row[aria-pressed="true"]').length`), 0);

  // A CAD object picked in the plan itself reports its raw DWG attributes.
  const canvasPick = await page.evaluate(`(async () => {
    document.querySelector('#plan-check-tab-layers').click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    document.querySelector('[data-select-type="layer"][data-select-id="R_RAUMPOLYGON"]').click();
    await new Promise((resolve) => setTimeout(resolve, 120));
    const card = document.querySelector('[data-plan-check-inspector]');
    const facts = {};
    card.querySelectorAll('dt').forEach((dt) => { facts[dt.textContent.trim()] = dt.nextElementSibling?.textContent.trim(); });
    return { hidden: card.hidden, facts, swatch: Boolean(card.querySelector('.plan-check-inspector__swatch')) };
  })()`);
  assert.equal(canvasPick.hidden, false);
  assert.equal(canvasPick.facts.Layername, 'R_RAUMPOLYGON');
  assert.equal(canvasPick.facts.Darstellungselemente, '30');
  assert.equal(canvasPick.swatch, true);

  // Rooms carry identity labels in the plan, and the register's checkboxes hide
  // both the overlay and its label, so list and plan never disagree. The
  // round-trip is measured back to back so nothing else can move the camera.
  const roomVisibility = await page.evaluate(`(async () => {
    document.querySelector('#plan-check-tab-rooms').click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const canvas = document.querySelector('[data-plan-check-canvas]');
    const digest = () => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let value = 2166136261;
      for (let index = 0; index < pixels.length; index += 17) {
        value = Math.imul(value ^ pixels[index], 16777619) >>> 0;
      }
      return value;
    };
    const settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const toggle = (input, checked) => {
      input.checked = checked;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const master = document.querySelector('[data-plan-check-spatial-all="room"]');
    const boxes = [...document.querySelectorAll('[data-plan-check-spatial="room"]')];
    const first = boxes[0];
    await settle();
    const visible = digest();
    toggle(first, false);
    await settle();
    const oneHidden = digest();
    const partialMaster = { checked: master.checked, indeterminate: master.indeterminate };
    const rowHiddenClass = first.closest('.plan-check-layer')?.classList.contains('plan-check-layer--hidden');
    toggle(first, true);
    await settle();
    const restored = digest();
    toggle(master, false);
    await settle();
    const allHidden = digest();
    toggle(master, true);
    await settle();
    return {
      rooms: boxes.length,
      partialMaster,
      rowHiddenClass,
      hidesOne: visible !== oneHidden,
      restoresOne: restored !== oneHidden,
      hidesAll: allHidden !== visible,
      hiddenAfterRestore: window.__planCheck.state.hiddenRooms.size,
    };
  })()`, { timeout: 60_000 });
  assert.equal(roomVisibility.rooms, 30);
  assert.deepEqual(roomVisibility.partialMaster, { checked: false, indeterminate: true });
  assert.equal(roomVisibility.rowHiddenClass, true);
  assert.equal(roomVisibility.hidesOne, true, 'hiding one room repaints the plan');
  assert.equal(roomVisibility.restoresOne, true, 'showing it again brings the room back');
  assert.equal(roomVisibility.hidesAll, true, 'the master checkbox clears every room from the plan');
  assert.equal(roomVisibility.hiddenAfterRestore, 0);

  // The polygon registers answer a question about polygons: the CAD drawing
  // behind them is suppressed, and nothing behind them can be picked either.
  // Measured on the title-block corner of the sheet, which carries CAD geometry
  // but no room or floor polygon — it must be blank in those registers.
  const spatialScope = await page.evaluate(`(async () => {
    const settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = document.querySelector('[data-plan-check-canvas]');
    const cornerInk = () => {
      const width = Math.floor(canvas.width / 3);
      const height = Math.floor(canvas.height / 3);
      const pixels = canvas.getContext('2d')
        .getImageData(canvas.width - width, canvas.height - height, width, height).data;
      let marked = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) marked += 1;
      }
      return marked / (pixels.length / 4);
    };
    const open = async (tab) => {
      document.querySelector('#plan-check-tab-' + tab).click();
      await settle();
      window.__planCheck.viewer.fit(false);
      await settle();
    };
    await open('layers');
    const layersCorner = cornerInk();
    await open('rooms');
    const roomsCorner = cornerInk();
    await open('areas');
    const areasCorner = cornerInk();
    await open('errors');
    const errorsCorner = cornerInk();
    await open('rooms');
    // A pick where only CAD geometry sits must not select a hidden entity.
    window.__planCheck.state.selection = null;
    window.__planCheck.viewer.setSelection(null);
    const canvasBox = canvas.getBoundingClientRect();
    const pointer = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
      button: 0, pointerId: 21, pointerType: 'mouse', clientX: x, clientY: y, bubbles: true, cancelable: true,
    }));
    const x = canvasBox.left + canvasBox.width * 0.88;
    const y = canvasBox.top + canvasBox.height * 0.88;
    pointer('pointerdown', x, y);
    pointer('pointerup', x, y);
    await settle();
    return {
      layersCorner, roomsCorner, areasCorner, errorsCorner,
      pickedNothing: window.__planCheck.state.selection === null,
    };
  })()`, { timeout: 60_000 });
  assert.ok(spatialScope.layersCorner > 0.005,
    `the layer register draws the whole sheet: ${spatialScope.layersCorner}`);
  assert.ok(spatialScope.errorsCorner > 0.005,
    `the findings register keeps the drawing as context: ${spatialScope.errorsCorner}`);
  assert.equal(spatialScope.roomsCorner, 0, 'the room register paints no CAD geometry');
  assert.equal(spatialScope.areasCorner, 0, 'the area register paints no CAD geometry');
  assert.equal(spatialScope.pickedNothing, true, 'a suppressed entity cannot be selected');

  // The master checkbox replaces the former pair of show-all/hide-all buttons and
  // reports a partial selection as indeterminate.
  const layerMaster = await page.evaluate(`(() => {
    document.querySelector('#plan-check-tab-layers').click();
    const master = document.querySelector('[data-plan-check-layers-all]');
    const first = document.querySelector('[data-plan-check-layer]');
    const before = { checked: master.checked, indeterminate: master.indeterminate };
    first.checked = false;
    first.dispatchEvent(new Event('change', { bubbles: true }));
    const partial = { checked: master.checked, indeterminate: master.indeterminate };
    master.checked = false;
    master.dispatchEvent(new Event('change', { bubbles: true }));
    const hiddenAll = [...document.querySelectorAll('[data-plan-check-layer]')].every((input) => !input.checked);
    master.checked = true;
    master.dispatchEvent(new Event('change', { bubbles: true }));
    const shownAll = [...document.querySelectorAll('[data-plan-check-layer]')].every((input) => input.checked);
    return { before, partial, hiddenAll, shownAll };
  })()`);
  assert.deepEqual(layerMaster.before, { checked: true, indeterminate: false });
  assert.deepEqual(layerMaster.partial, { checked: false, indeterminate: true });
  assert.equal(layerMaster.hiddenAll, true);
  assert.equal(layerMaster.shownAll, true);

  // The metrics register spans the workbench; the Canvas column collapses rather
  // than sitting empty beside a full-width table.
  const metricsLayout = await page.evaluate(`(() => {
    document.querySelector('#plan-check-tab-metrics').click();
    const workbenchNode = document.querySelector('[data-plan-check-workbench]');
    const wide = workbenchNode.classList.contains('plan-check-workbench--wide');
    const viewerVisible = getComputedStyle(document.querySelector('.plan-check-viewer')).display !== 'none';
    const tables = [...document.querySelectorAll('.plan-check-metric-table')];
    return {
      wide,
      viewerVisible,
      tables: tables.length,
      overflowing: tables.filter((table) => table.scrollWidth - table.clientWidth > 1).length,
      shareColumn: document.querySelector('.plan-check-metric__share')?.textContent.trim() || '',
    };
  })()`);
  assert.equal(metricsLayout.wide, true);
  assert.equal(metricsLayout.viewerVisible, false);
  assert.ok(metricsLayout.tables >= 3, `metric tables: ${metricsLayout.tables}`);
  assert.equal(metricsLayout.overflowing, 0);

  // Return to the rules register so the print and viewer probes below start from
  // the default state.
  await page.evaluate(`(() => {
    document.querySelector('#plan-check-tab-rules').click();
    document.querySelector('[data-plan-check-search]').value = '';
  })()`);

  // Density must not cost the accessible contract: every control keeps a name,
  // the heading ladder stays gapless and the desktop target policy (24px, 44px
  // for the pointer-coarse breakpoints) still holds for the dense rows.
  const density = await page.evaluate(`(() => {
    const scope = document.querySelector('.plan-check');
    const named = (el) => Boolean((el.getAttribute('aria-label') || '').trim()
      || (el.getAttribute('aria-labelledby') || '').trim()
      || el.textContent.trim()
      || (el.labels && el.labels.length && [...el.labels].some((label) => label.textContent.trim())));
    const controls = [...scope.querySelectorAll('button, [href], input, select, textarea, summary')]
      .filter((el) => el.offsetParent !== null || el === document.activeElement);
    const measure = (el) => {
      const box = el.getBoundingClientRect();
      return Math.min(Math.round(box.width), Math.round(box.height));
    };
    return {
      unnamed: controls.filter((el) => !named(el)).map((el) => el.outerHTML.slice(0, 90)),
      headings: [...scope.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1])),
      smallRows: [...scope.querySelectorAll('.plan-check-row')].filter((el) => measure(el) < 24).length,
      smallTools: [...scope.querySelectorAll('.plan-check-viewer__tool')].filter((el) => measure(el) < 24).length,
      smallChecks: [...scope.querySelectorAll('.plan-check-check')].filter((el) => measure(el) < 16).length,
      groupSummaries: [...scope.querySelectorAll('.plan-check-group__head')].every((el) => measure(el) >= 24),
    };
  })()`);
  assert.deepEqual(density.unnamed, []);
  assert.equal(density.smallRows, 0);
  assert.equal(density.smallTools, 0);
  assert.equal(density.smallChecks, 0);
  assert.equal(density.groupSummaries, true);
  assert.equal(density.headings[0], 1, `first heading is the page title: ${density.headings}`);
  assert.ok(density.headings.every((level, index, all) => index === 0 || level <= all[index - 1] + 1),
    `heading ladder has no gaps: ${density.headings}`);

  await browser.send('Emulation.clearDeviceMetricsOverride', {}, page.sessionId);
  await sleep(200);

  // A single CAD handle may own several render primitives (for example a HATCH
  // boundary plus fill); selection must repaint and fit their merged bounds.
  const multiPrimitiveSelection = await page.evaluate(`(async () => {
    const { createPlanCheckViewer } = await import('/js/plan-check/viewer.js');
    const fixture = document.createElement('section');
    fixture.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:300px;background:#fff;z-index:9999';
    fixture.innerHTML = '<div data-plan-check-canvas-wrap style="width:400px;height:300px">'
      + '<canvas data-plan-check-canvas aria-label="Testplan" tabindex="0"></canvas></div>'
      + '<span data-plan-check-scale-line></span><span data-plan-check-scale-label></span>';
    document.body.append(fixture);
    const renderList = [
      { t: 'line', handle: 'MULTI', l: 'A', x1: 0, y1: 0, x2: 10, y2: 0, c: '#000000' },
      { t: 'circle', handle: 'MULTI', l: 'A', cx: 1000, cy: 0, r: 10, c: '#000000' },
      { t: 'point', handle: 'OTHER', l: 'A', x: 5000, y: 0, c: '#000000' },
    ];
    const viewer = createPlanCheckViewer({
      root: fixture,
      result: {
        drawing: { renderList, bounds: { minX: 0, minY: -10, maxX: 5000, maxY: 10 }, insunits: 4 },
        validation: { errors: [], rooms: [], areas: [] },
      },
    });
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await nextFrame();
    const canvas = fixture.querySelector('canvas');
    const digest = () => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let value = 2166136261;
      for (let index = 0; index < pixels.length; index += 17) {
        value = Math.imul(value ^ pixels[index], 16777619) >>> 0;
      }
      return value;
    };
    const before = digest();
    const outcome = viewer.setSelection({ type: 'entity', id: 'MULTI' }, { focus: true });
    await nextFrame();
    const focusedView = viewer.getView();
    const after = digest();
    canvas.blur();
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      button: 0, pointerId: 7, pointerType: 'mouse', clientX: 200, clientY: 150,
      bubbles: true, cancelable: true,
    }));
    const pointerFocused = document.activeElement === canvas;
    canvas.dispatchEvent(new PointerEvent('pointerup', {
      button: 0, pointerId: 7, pointerType: 'mouse', clientX: 200, clientY: 150,
      bubbles: true, cancelable: true,
    }));
    canvas.blur();
    const pageWheel = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    canvas.dispatchEvent(pageWheel);
    canvas.focus();
    const browserZoom = new WheelEvent('wheel', {
      deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true,
    });
    canvas.dispatchEvent(browserZoom);
    const viewerZoom = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    canvas.dispatchEvent(viewerZoom);
    const browserKeyZoom = new KeyboardEvent('keydown', {
      key: '+', ctrlKey: true, bubbles: true, cancelable: true,
    });
    canvas.dispatchEvent(browserKeyZoom);
    const viewerKeyZoom = new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true });
    canvas.dispatchEvent(viewerKeyZoom);
    viewer.dispose();
    fixture.remove();
    return {
      outcome, repainted: before !== after, cameraX: focusedView.x, canvasWidth: canvas.width,
      pointerFocused,
      wheel: {
        pagePrevented: pageWheel.defaultPrevented,
        browserZoomPrevented: browserZoom.defaultPrevented,
        viewerZoomPrevented: viewerZoom.defaultPrevented,
      },
      keyboard: {
        browserZoomPrevented: browserKeyZoom.defaultPrevented,
        viewerZoomPrevented: viewerKeyZoom.defaultPrevented,
      },
    };
  })()`);
  assert.deepEqual(multiPrimitiveSelection.outcome, { count: 2, truncated: false });
  assert.equal(multiPrimitiveSelection.repainted, true);
  assert.equal(multiPrimitiveSelection.pointerFocused, true);
  assert.ok(Math.abs(multiPrimitiveSelection.cameraX - 505) < 1,
    `multi-primitive focus centered at ${multiPrimitiveSelection.cameraX}`);
  assert.ok(multiPrimitiveSelection.canvasWidth > 0);
  assert.deepEqual(multiPrimitiveSelection.wheel, {
    pagePrevented: false,
    browserZoomPrevented: false,
    viewerZoomPrevented: true,
  });
  assert.deepEqual(multiPrimitiveSelection.keyboard, {
    browserZoomPrevented: false,
    viewerZoomPrevented: true,
  });

  const hatchIsland = await page.evaluate(`(async () => {
    const { createPlanCheckViewer } = await import('/js/plan-check/viewer.js');
    const fixture = document.createElement('section');
    fixture.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:300px;background:#fff;z-index:9999';
    fixture.innerHTML = '<div data-plan-check-canvas-wrap style="width:400px;height:300px">'
      + '<canvas data-plan-check-canvas aria-label="Schraffurtest" tabindex="0"></canvas></div>'
      + '<span data-plan-check-scale-line></span><span data-plan-check-scale-label></span>';
    document.body.append(fixture);
    const square = (minimum, maximum) => [
      { x: minimum, y: minimum }, { x: maximum, y: minimum },
      { x: maximum, y: maximum }, { x: minimum, y: maximum },
    ];
    const viewer = createPlanCheckViewer({
      root: fixture,
      result: {
        drawing: {
          renderList: [{ t: 'hatchfill', handle: 'HATCH', l: 'A', c: '#000000', paths: [square(0, 100), square(30, 70)] }],
          bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, insunits: 4,
        },
        validation: { errors: [], rooms: [], areas: [] },
      },
    });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = fixture.querySelector('canvas');
    const view = viewer.getView();
    const pixel = (worldX, worldY) => {
      const cssX = (worldX - view.x) * view.zoom + canvas.clientWidth / 2;
      const cssY = (view.y - worldY) * view.zoom + canvas.clientHeight / 2;
      const scaleX = canvas.width / canvas.clientWidth;
      const scaleY = canvas.height / canvas.clientHeight;
      return [...canvas.getContext('2d').getImageData(
        Math.round(cssX * scaleX), Math.round(cssY * scaleY), 1, 1,
      ).data];
    };
    const filled = pixel(15, 15);
    const island = pixel(50, 50);
    viewer.setBackground('dark', false, true);
    const darkIsland = pixel(50, 50);
    viewer.setBackground('light', false, true);
    const restoredIsland = pixel(50, 50);
    viewer.dispose();
    fixture.remove();
    return { filled, island, darkIsland, restoredIsland };
  })()`);
  assert.ok(hatchIsland.filled[0] < 64 && hatchIsland.filled[1] < 64 && hatchIsland.filled[2] < 64,
    `outer hatch is filled: ${hatchIsland.filled}`);
  assert.ok(hatchIsland.island[0] > 240 && hatchIsland.island[1] > 240 && hatchIsland.island[2] > 240,
    `hatch island remains transparent: ${hatchIsland.island}`);
  assert.ok(hatchIsland.darkIsland.slice(0, 3).reduce((sum, channel) => sum + channel, 0) < 400,
    `dark print source is visible before override: ${hatchIsland.darkIsland}`);
  assert.ok(hatchIsland.restoredIsland[0] > 240 && hatchIsland.restoredIsland[1] > 240 && hatchIsland.restoredIsland[2] > 240,
    `light print surface repaints synchronously: ${hatchIsland.restoredIsland}`);

  const longFilename = await page.evaluate(`(async () => {
    const C = (await import('/js/components.js')).default;
    const { renderPlanCheckPage } = await import('/js/plan-check/view.js');
    const fixture = document.createElement('div');
    fixture.style.cssText = 'position:fixed;left:0;top:0;width:320px;max-height:800px;overflow:auto;background:#fff;z-index:9999';
    const name = 'sehr-langer-dwg-dateiname-ohne-trennbare-leerzeichen-'.repeat(6) + '.dwg';
    fixture.innerHTML = renderPlanCheckPage(C, {
      intakeAvailable: true,
      step: 2,
      phase: 'ready',
      file: { name, size: 1024 },
      result: {
        file: { name, size: 1024 },
        database: { version: 'AC1032', layerCount: 0, entityCount: 0 },
        drawing: { renderList: [], entitySummary: [], bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 } },
        layers: [],
        validation: { rules: [], errors: [], rooms: [], areas: [], metrics: {}, score: 0, passedRules: 0 },
      },
      tab: 'metrics', filter: 'all', search: '', selection: null,
      hiddenLayers: new Set(), background: 'light', changeType: 'new', changeReason: '',
    }, {});
    document.body.append(fixture);
    const summary = fixture.querySelector('.plan-check-file-summary');
    const heading = fixture.querySelector('#plan-check-file-summary-heading');
    const resultHeading = fixture.querySelector('#plan-check-results-heading');
    const metricsHeading = fixture.querySelector('.plan-check-metrics h4');
    const outcome = {
      overflowWrap: getComputedStyle(heading).overflowWrap,
      summaryOverflow: summary.scrollWidth - summary.clientWidth,
      headingTag: heading.tagName,
      resultHeadingTag: resultHeading.tagName,
      metricsHeadingTag: metricsHeading?.tagName || '',
    };
    fixture.remove();
    return outcome;
  })()`);
  assert.equal(longFilename.overflowWrap, 'anywhere');
  assert.ok(longFilename.summaryOverflow <= 1, `long filename summary overflow ${longFilename.summaryOverflow}px`);
  assert.deepEqual({
    file: longFilename.headingTag,
    results: longFilename.resultHeadingTag,
    metrics: longFilename.metricsHeadingTag,
  }, { file: 'H2', results: 'H2', metrics: 'H4' });

  const skins = await page.evaluate(`(() => {
    const values = () => {
      const style = getComputedStyle(document.body);
      return {
        primary: style.getPropertyValue('--color-primary-600').trim().toLowerCase(),
        focus: style.getPropertyValue('--color-focus-ring').trim().toLowerCase(),
      };
    };
    document.body.classList.remove('body--intranet');
    const federal = values();
    document.body.classList.add('body--intranet');
    const intranet = values();
    const back = document.querySelector('[data-plan-check-action="cancel"]');
    back.focus();
    const focusStyle = getComputedStyle(back);
    return {
      federal, intranet,
      focusVisible: back.matches(':focus-visible'),
      outlineWidth: parseFloat(focusStyle.outlineWidth),
      outlineColor: focusStyle.outlineColor,
    };
  })()`);
  assert.deepEqual(skins.federal, { primary: '#d8232a', focus: '#8655f6' });
  assert.deepEqual(skins.intranet, { primary: '#2563eb', focus: '#8655f6' });
  assert.equal(skins.focusVisible, true);
  assert.ok(skins.outlineWidth >= 2);
  assert.notEqual(skins.outlineColor, 'rgba(0, 0, 0, 0)');

  await browser.send('Emulation.setEmulatedMedia', {
    media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  }, page.sessionId);
  const reduced = await page.evaluate(`(() => {
    const durations = [...document.querySelectorAll('.plan-check *')].flatMap((node) => {
      const style = getComputedStyle(node);
      return [style.animationDuration, style.transitionDuration].flatMap((value) => value.split(','));
    });
    const ms = (value) => value.trim().endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000;
    return { matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      maximumMs: Math.max(0, ...durations.map(ms).filter(Number.isFinite)) };
  })()`);
  assert.equal(reduced.matches, true);
  assert.ok(reduced.maximumMs <= 0.011);

  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 320, height: 800, deviceScaleFactor: 1, mobile: true,
  }, page.sessionId);
  await sleep(100);
  const narrow = await page.evaluate(`(() => {
    const back = document.querySelector('[data-plan-check-action="cancel"]');
    const bounds = back.getBoundingClientRect();
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      target: Math.min(bounds.width, bounds.height),
      sectionWidth: document.querySelector('.plan-check-results').getBoundingClientRect().width,
    };
  })()`);
  assert.equal(narrow.width, 320);
  assert.ok(narrow.scrollWidth <= 321, `320px route overflows to ${narrow.scrollWidth}px`);
  assert.ok(narrow.target >= 44, `return target is ${narrow.target}px`);
  assert.ok(narrow.sectionWidth > 0 && narrow.sectionWidth <= 320);
  await browser.send('Emulation.clearDeviceMetricsOverride', {}, page.sessionId);

  // --- Step 3: Freigabe -------------------------------------------------------
  // The last step restates what was entered and checked, then opens a real
  // process instance through the portal's engine.
  const approvalForm = await page.evaluate(`(() => {
    document.querySelector('[data-plan-check-action="continue-approval"]').click();
    const facts = {};
    document.querySelectorAll('.plan-check-approval__facts dt').forEach((dt) => {
      facts[dt.textContent.trim()] = (dt.nextElementSibling?.textContent || '').split(/\s+/).join(' ').trim();
    });
    // Each step carries a screen-reader prefix; compare the visible label alone.
    const visibleLabel = (item) => {
      if (!item) return '';
      const copy = item.cloneNode(true);
      copy.querySelectorAll('.sr-only, .step__indicator-step').forEach((node) => node.remove());
      return copy.textContent.trim();
    };
    const steps = [...document.querySelectorAll('.steps li')].map(visibleLabel);
    return {
      step: window.__planCheck.state.step,
      heading: document.querySelector('.plan-check-approval-card__title')?.textContent.trim() || '',
      facts,
      steps,
      currentStep: visibleLabel(document.querySelector('.steps li[aria-current="step"]')),
      submit: document.querySelector('[data-plan-check-action="submit-approval"]')?.textContent.trim() || '',
      canvas: Boolean(document.querySelector('[data-plan-check-canvas]')),
      duplicateIds: (() => {
        const ids = [...document.querySelectorAll('.plan-check [id]')].map((node) => node.id);
        return ids.filter((id, index) => ids.indexOf(id) !== index);
      })(),
    };
  })()`);
  assert.equal(approvalForm.step, 3);
  assert.deepEqual(approvalForm.steps, ['Standort und Datei', 'Datenqualität', 'Freigabe']);
  assert.equal(approvalForm.currentStep, 'Freigabe');
  assert.equal(approvalForm.heading, 'Antrag im Überblick');
  assert.equal(approvalForm.submit, 'Zur Freigabe einreichen');
  // The Canvas belongs to step 2 and must not survive into the summary.
  assert.equal(approvalForm.canvas, false);
  assert.deepEqual(approvalForm.duplicateIds, []);
  for (const label of ['Objekt', 'Geschoss', 'Datei', 'Art der Änderung', 'Prüfergebnis',
    'Zuständige Stelle', 'Bearbeitungsfrist', 'Antragstellende Person']) {
    assert.ok(label in approvalForm.facts, `summary states ${label}: ${Object.keys(approvalForm.facts)}`);
  }
  assert.match(approvalForm.facts['Objekt'], /1080\/6650\/AA/);
  assert.match(approvalForm.facts['Datei'], /CAD\.V01-CAFM-Plan-DE\.dwg/);
  assert.match(approvalForm.facts['Prüfergebnis'], /35 von 39 Regeln erfüllt/);

  // The report link returns to the register it summarises.
  assert.equal(await page.evaluate(`(() => {
    document.querySelector('[data-plan-check-action="show-report"]').click();
    return window.__planCheck.state.step;
  })()`), 2);

  const submitted = await page.evaluate(`(() => {
    const before = (JSON.parse(localStorage.getItem('bbl_vorgaenge_v1') || '[]')).length;
    document.querySelector('[data-plan-check-action="continue-approval"]').click();
    document.querySelector('[data-plan-check-action="submit-approval"]').click();
    const stored = JSON.parse(localStorage.getItem('bbl_vorgaenge_v1') || '[]');
    const instance = window.__planCheck.state.submission;
    return {
      created: stored.length - before,
      defId: instance?.defId,
      reference: instance?.reference,
      referenceShown: document.querySelector('.plan-check-approval')?.textContent.includes(instance?.reference),
      status: instance?.status,
      linkedBuilding: instance?.linkedEntities?.buildingId,
      score: instance?.data?.score,
      pipeline: [...document.querySelectorAll('.pipeline__step')].map((step) => step.textContent.trim()),
      caseLink: document.querySelector('.plan-check-approval a[href="#/my-cases"]')?.textContent.trim() || '',
      restart: Boolean(document.querySelector('#plan-check-restart')),
      focusedHeading: document.activeElement?.tagName,
    };
  })()`);
  assert.equal(submitted.created, 1, 'exactly one case is opened');
  assert.equal(submitted.defId, 'planfreigabe');
  assert.match(submitted.reference, /^BBL-\d{4}-\d+$/);
  assert.equal(submitted.referenceShown, true);
  assert.equal(submitted.status, 'eingereicht');
  assert.equal(submitted.linkedBuilding, '1080/6650/AA');
  assert.equal(submitted.score, 90);
  assert.equal(submitted.pipeline.length, 4);
  assert.match(submitted.pipeline[0], /Antrag eingereicht/);
  assert.equal(submitted.caseLink, 'Zu meinen Vorgängen');
  assert.equal(submitted.restart, true);

  // Submitting twice must not open a second case.
  assert.equal(await page.evaluate(`(() => {
    const before = (JSON.parse(localStorage.getItem('bbl_vorgaenge_v1') || '[]')).length;
    document.querySelector('[data-plan-check-action="submit-approval"]')?.click();
    return (JSON.parse(localStorage.getItem('bbl_vorgaenge_v1') || '[]')).length - before;
  })()`), 0);

  // The restart action returns to the picker with a clean slate.
  assert.equal(await page.evaluate(`(() => {
    document.querySelector('#plan-check-restart').click();
    return JSON.stringify({
      step: window.__planCheck.state.step,
      submission: window.__planCheck.state.submission,
      picker: Boolean(document.querySelector('[data-plan-check-file]')),
    });
  })()`), JSON.stringify({ step: 1, submission: null, picker: true }));

  // Re-parse the fixture so the reset probe below starts from a result again.
  const { root: restoreRoot } = await browser.send('DOM.getDocument', { depth: 1 }, page.sessionId);
  const { nodeId: restoreInput } = await browser.send('DOM.querySelector', {
    nodeId: restoreRoot.nodeId, selector: '[data-plan-check-file]',
  }, page.sessionId);
  await browser.send('DOM.setFileInputFiles', { files: [FIXTURE], nodeId: restoreInput }, page.sessionId);
  await page.evaluate(`document.querySelector('[data-plan-check-form]').requestSubmit()`);
  assert.equal(await page.waitFor(`Boolean(document.querySelector('.plan-check-quality'))`, { timeout: 120_000 }), true);

  const reset = await page.evaluate(`(() => {
    document.querySelector('[data-plan-check-action="replace-file"]').click();
    return {
      picker: Boolean(document.querySelector('[data-plan-check-file]')),
      canvas: Boolean(document.querySelector('[data-plan-check-canvas]')),
      instruction: document.querySelector('[data-plan-check-drop-zone] strong')?.textContent.trim() || '',
      fileFieldName: document.querySelector('[data-plan-check-file-name]')?.textContent.trim() || '',
      fileFieldHidden: document.querySelector('[data-plan-check-file-name]')?.hidden,
      submitDisabled: document.querySelector('[data-plan-check-form] button[type="submit"]')?.disabled,
      stepFocused: document.activeElement?.id === 'plan-check-step-heading',
      activeWorkers: window.__planCheckActiveWorkerCount,
    };
  })()`);
  assert.deepEqual(reset, {
    picker: true,
    canvas: false,
    instruction: 'DWG-Datei hierher ziehen oder mit dem Dateifeld ausw\u00e4hlen',
    fileFieldName: '',
    fileFieldHidden: true,
    submitDisabled: true,
    stepFocused: true,
    activeWorkers: 0,
  });

  await page.evaluate(`document.querySelector('[data-plan-check-action="cancel"]').click()`);
  assert.equal(await page.waitFor(`location.hash.startsWith('#/app/workspace?') && !document.querySelector('.plan-check')`), true);
  const cleanup = await page.evaluate(`({
    hash: location.hash,
    workers: window.__planCheckWorkerCount,
    activeWorkers: window.__planCheckActiveWorkerCount,
    standalone: document.body.classList.contains('body--standalone-app'),
  })`);
  assert.match(cleanup.hash, /id=1080%2F6650%2FAA/);
  assert.match(cleanup.hash, /floor=1080-6650-AA-2og/);
  assert.ok(cleanup.workers >= 2);
  assert.equal(cleanup.activeWorkers, 0);
  assert.equal(cleanup.standalone, false);
  assert.deepEqual(await page.problems(), []);

  console.log('Plan-check local intake, validation, parsing, cleanup, skins and reflow passed.');
} finally {
  try { if (gatePage) await gatePage.closeTarget(); } catch { /* browser may already be closed */ }
  try { if (page) await page.closeTarget(); } catch { /* browser may already be closed */ }
  browser.close();
}
