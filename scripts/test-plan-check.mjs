// Security-closed Plan Check route: login gate, persistent unavailable state,
// zero file/Worker/WASM intake, both skins, reduced motion, 320 px reflow and
// the contextual return path. The quarantined trusted DWG pipeline has its own
// explicitly opted-in test-plan-check-parser.mjs suite.
import assert from 'node:assert/strict';

import { APP_BASE, launch, openPage, sleep } from './lib/cdp.mjs';

const BUILDING = '1080/6650/AA';
const FLOOR = '1080-6650-AA-2og';
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
    function ObservedWorker(...args) {
      window.__planCheckWorkerCount += 1;
      return new NativeWorker(...args);
    }
    ObservedWorker.prototype = NativeWorker.prototype;
    window.Worker = ObservedWorker;
    window.__planCheckFouc = [];
    const inspect = () => {
      if (!document.querySelector('.plan-check')) return;
      const style = document.querySelector('link[data-app-style="plan-check"]');
      if (!style || style.dataset.loaded !== 'true' || !style.sheet) window.__planCheckFouc.push('plan-check');
    };
    new MutationObserver(inspect).observe(document.getElementById('main-content'), { childList: true, subtree: true });
    location.hash = ${JSON.stringify(`#${route}`)};
  })()`);
  assert.equal(await page.waitFor(`Boolean(document.querySelector('.plan-check-unavailable'))`), true);
  await sleep(200);

  const unavailable = await page.evaluate(`(() => {
    const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
    const section = document.querySelector('.plan-check-unavailable');
    const labelledBy = section?.getAttribute('aria-labelledby') || '';
    const ids = [...document.querySelectorAll('.plan-check [id]')].map((node) => node.id);
    const beforeDrop = document.querySelector('.plan-check')?.textContent || '';
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(['AC1032'], 'must-not-be-accepted.dwg', { type: 'application/octet-stream' }));
    const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer });
    const dispatchResult = document.querySelector('.plan-check')?.dispatchEvent(dropEvent);
    const afterDrop = document.querySelector('.plan-check')?.textContent || '';
    return {
      h1: document.querySelector('.plan-check h1')?.textContent.trim(),
      heading: document.querySelector('#plan-check-unavailable-heading')?.textContent.trim(),
      message: section?.textContent.replace(/\\s+/g, ' ').trim() || '',
      labelled: Boolean(labelledBy && document.getElementById(labelledBy)),
      controls: {
        file: Boolean(document.querySelector('.plan-check input[type="file"]')),
        drop: Boolean(document.querySelector('[data-plan-check-drop-zone]')),
        form: Boolean(document.querySelector('[data-plan-check-form]')),
        submit: Boolean(document.querySelector('.plan-check button[type="submit"]')),
        canvas: Boolean(document.querySelector('[data-plan-check-canvas]')),
      },
      back: document.querySelector('[data-plan-check-action="cancel"]')?.textContent.trim() || '',
      standalone: document.body.classList.contains('body--standalone-app'),
      cssLoaded: Boolean(document.querySelector('link[data-app-style="plan-check"]')?.sheet),
      fouc: window.__planCheckFouc,
      workers: window.__planCheckWorkerCount,
      parserAssets: resources.filter((url) => /parser-worker|vendor\\/libredwg|libredwg-web|\\.wasm(?:$|[?#])/i.test(url)),
      dwgRequests: resources.filter((url) => /\\.dwg(?:$|[?#])/i.test(url)),
      duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
      closedDrop: {
        defaultPrevented: dropEvent.defaultPrevented,
        dispatchResult,
        unchanged: beforeDrop === afterDrop,
        filenameVisible: afterDrop.includes('must-not-be-accepted.dwg'),
        readyAnnounced: /zur Prüfung bereit/.test(afterDrop),
      },
    };
  })()`);
  assert.equal(unavailable.h1, 'Planprüfung');
  assert.equal(unavailable.heading, 'DWG-Prüfung derzeit nicht verfügbar');
  assert.match(unavailable.message, /Sicherheitsgründen deaktiviert/);
  assert.match(unavailable.message, /keine Plandateien eingelesen, verarbeitet oder übertragen/);
  assert.equal(unavailable.labelled, true);
  assert.deepEqual(unavailable.controls, { file: false, drop: false, form: false, submit: false, canvas: false });
  assert.match(unavailable.back, /Zurück zum Objekt/);
  assert.equal(unavailable.standalone, true);
  assert.equal(unavailable.cssLoaded, true);
  assert.deepEqual(unavailable.fouc, []);
  assert.equal(unavailable.workers, 0);
  assert.deepEqual(unavailable.parserAssets, []);
  assert.deepEqual(unavailable.dwgRequests, []);
  assert.deepEqual(unavailable.duplicateIds, []);
  assert.deepEqual(unavailable.closedDrop, {
    defaultPrevented: true,
    dispatchResult: false,
    unchanged: true,
    filenameVisible: false,
    readyAnnounced: false,
  });

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
    assert.equal(await page.waitFor(`document.querySelector('.plan-check-unavailable')?.textContent.includes(${JSON.stringify(contextCase.warning)})`), true);
    const rendered = await page.evaluate(`({
      warning: document.querySelector('.plan-check-unavailable')?.textContent || '',
      back: document.querySelector('[data-plan-check-action="cancel"]')?.textContent.trim() || '',
    })`);
    assert.match(rendered.warning, new RegExp(contextCase.warning));
    assert.match(rendered.back, new RegExp(contextCase.back));
  }
  await page.evaluate(`location.hash = ${JSON.stringify(`#${route}`)}`);
  assert.equal(await page.waitFor(`document.querySelector('[data-plan-check-action="cancel"]')?.textContent.includes('Zurück zum Objekt')`), true);

  // The viewer remains testable without enabling quarantined DWG intake. A
  // single CAD handle may own several render primitives (for example a HATCH
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
      sectionWidth: document.querySelector('.plan-check-unavailable').getBoundingClientRect().width,
    };
  })()`);
  assert.equal(narrow.width, 320);
  assert.ok(narrow.scrollWidth <= 321, `320px route overflows to ${narrow.scrollWidth}px`);
  assert.ok(narrow.target >= 44, `return target is ${narrow.target}px`);
  assert.ok(narrow.sectionWidth > 0 && narrow.sectionWidth <= 320);
  await browser.send('Emulation.clearDeviceMetricsOverride', {}, page.sessionId);

  await page.evaluate(`document.querySelector('[data-plan-check-action="cancel"]').click()`);
  assert.equal(await page.waitFor(`location.hash.startsWith('#/app/workspace?') && !document.querySelector('.plan-check')`), true);
  const cleanup = await page.evaluate(`({
    hash: location.hash,
    workers: window.__planCheckWorkerCount,
    standalone: document.body.classList.contains('body--standalone-app'),
  })`);
  assert.match(cleanup.hash, /id=1080%2F6650%2FAA/);
  assert.match(cleanup.hash, /floor=1080-6650-AA-2og/);
  assert.equal(cleanup.workers, 0);
  assert.equal(cleanup.standalone, false);
  assert.deepEqual(await page.problems(), []);

  console.log('Plan-check security gate, skins, reflow and return path passed.');
} finally {
  try { if (gatePage) await gatePage.closeTarget(); } catch { /* browser may already be closed */ }
  try { if (page) await page.closeTarget(); } catch { /* browser may already be closed */ }
  browser.close();
}
