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
  assert.deepEqual(parsed.reports, ['print', 'csv', 'json']);
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
    const nativePrint = window.print;
    let printCalls = 0;
    HTMLAnchorElement.prototype.click = function() {
      downloads.push({ download: this.download, href: this.href });
    };
    window.print = () => { printCalls += 1; };
    document.querySelector('[data-plan-check-report="csv"]').click();
    document.querySelector('[data-plan-check-report="json"]').click();
    document.querySelector('[data-plan-check-report="print"]').click();
    const panelsDuringPrint = document.querySelectorAll('[data-plan-check-print-panels] .plan-check-print-panel').length;
    const ids = [...document.querySelectorAll('.plan-check [id]')].map((node) => node.id);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const panelsAfterPrint = document.querySelectorAll('[data-plan-check-print-panels]').length;
    HTMLAnchorElement.prototype.click = nativeClick;
    window.print = nativePrint;
    return {
      downloads: downloads.map((item) => item.download),
      localUrls: downloads.every((item) => item.href.startsWith('blob:')),
      printCalls,
      panelsDuringPrint,
      panelsAfterPrint,
      duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
    };
  })()`);
  assert.equal(reportLifecycle.downloads.length, 2);
  assert.match(reportLifecycle.downloads[0], /\.csv$/);
  assert.match(reportLifecycle.downloads[1], /\.json$/);
  assert.equal(reportLifecycle.localUrls, true);
  assert.equal(reportLifecycle.printCalls, 1);
  assert.equal(reportLifecycle.panelsDuringPrint, 6);
  assert.equal(reportLifecycle.panelsAfterPrint, 0);
  assert.deepEqual(reportLifecycle.duplicateIds, []);

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
