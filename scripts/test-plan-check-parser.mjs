import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { launch, openPage } from './lib/cdp.mjs';
import { createStaticServer } from './serve.mjs';

const FIXTURE_SHA256 = 'e69f34d37ed6a7c7223457a7478a534ecbfd4cac556ef693cb8060129299e0a9';
const RUNTIME_HASHES = Object.freeze({
  'dist/libredwg-web.js': '438b77262a85e8815e3928f3ff97a51ec84df06d3f3fd184c8459e798d568b81',
  'wasm/libredwg-web.js': '62deaef11c2d6cf8fd0a0ee83d29120ca40bdabc2cdd9baa1f7911410bf9d73f',
  'wasm/libredwg-web.wasm': 'd8b78f6d5e63e6e178cf7343cfd08ebe798d75b6754c593e15d8f948b823e038',
  LICENSE: '8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903',
});

async function verifyRuntimeManifest() {
  const vendorUrl = new URL('../js/vendor/libredwg/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('RUNTIME-MANIFEST.json', vendorUrl), 'utf8'));
  assert.equal(manifest.schema, 'bbl-plan-check-runtime/1');
  assert.equal(manifest.package.name, '@mlightcad/libredwg-web');
  assert.equal(manifest.package.version, '0.7.9');
  assert.equal(manifest.package.license, 'GPL-3.0');
  assert.match(manifest.package.correspondingSourceUrl, /^https:\/\/github\.com\/mlightcad\/libredwg-web\//);
  assert.deepEqual(Object.keys(manifest).sort(), ['files', 'package', 'schema']);
  for (const [relativePath, expected] of Object.entries(RUNTIME_HASHES)) {
    assert.equal(manifest.files[relativePath], expected, `manifest hash: ${relativePath}`);
    const content = await readFile(new URL(relativePath, vendorUrl));
    assert.equal(createHash('sha256').update(content).digest('hex'), expected,
      `runtime hash: ${relativePath}`);
  }
  const fixture = await readFile(
    new URL('../assets/plan-check/CAD.V01-CAFM-Plan-DE.dwg', import.meta.url),
  );
  assert.equal(fixture.byteLength, 381_509);
  assert.equal(createHash('sha256').update(fixture).digest('hex'), FIXTURE_SHA256);
}

await verifyRuntimeManifest();
const server = createStaticServer();
const requestedPaths = [];
server.on('request', (request) => requestedPaths.push(new URL(request.url, 'http://localhost').pathname));
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
const cdp = await launch();

try {
  const page = await openPage(cdp, `${origin}/index.html`, { login: false });

  // The Worker repeats the cheap input gates before importing the parser. A
  // renamed non-DWG therefore cannot allocate the WASM runtime unnecessarily.
  const rejectionRequestOffset = requestedPaths.length;
  const rejected = await page.evaluate(`(async () => {
    const bytes = new TextEncoder().encode('NOTDWG');
    const worker = new Worker('/js/plan-check/parser-worker.js', {
      type: 'module', name: 'plan-check-rejection-probe',
    });
    const reply = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Worker rejection timed out')), 5000);
      worker.onmessage = (event) => {
        if (event.data?.type !== 'error') return;
        clearTimeout(timeout);
        resolve(event.data.error);
      };
      worker.onerror = (event) => {
        clearTimeout(timeout);
        reject(new Error(event.message || 'Worker failed'));
      };
    });
    worker.postMessage({
      type: 'parse',
      requestId: 1,
      buffer: bytes.buffer,
      file: { name: 'renamed.dwg', size: bytes.byteLength },
      dwgVersion: 'AC1032',
    }, [bytes.buffer]);
    const error = await reply;
    worker.terminate();
    return error;
  })()`);
  assert.equal(rejected.code, 'INVALID_DWG_HEADER');
  assert.equal(requestedPaths.slice(rejectionRequestOffset)
    .some((path) => /vendor\/libredwg|libredwg-web|\.wasm$/i.test(path)), false,
  'Worker input rejection must happen before the runtime is requested');

  const result = await page.evaluate(`(async () => {
    const NativeWorker = window.Worker;
    const workers = [];
    function ObservedWorker(...args) {
      const worker = new NativeWorker(...args);
      const record = { url: String(args[0]), terminated: false };
      workers.push(record);
      const terminate = worker.terminate.bind(worker);
      worker.terminate = () => { record.terminated = true; return terminate(); };
      return worker;
    }
    ObservedWorker.prototype = NativeWorker.prototype;
    window.Worker = ObservedWorker;

    const { createPlanCheckParser } = await import('/js/plan-check/parser-client.js');
    const { planCheckFindingRenderItems } = await import('/js/plan-check/viewer.js');
    const response = await fetch('/assets/plan-check/CAD.V01-CAFM-Plan-DE.dwg');
    const bytes = await response.arrayBuffer();
    const fixtureSha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((value) => value.toString(16).padStart(2, '0')).join('');
    if (fixtureSha256 !== ${JSON.stringify(FIXTURE_SHA256)}) {
      throw new Error('Plan Check golden fixture hash mismatch.');
    }

    // A normal File object with a caller-selected name exercises the public
    // arbitrary-file API; the bundled bytes serve only as deterministic input.
    const file = new File([bytes], 'uploaded-reference-copy.dwg', {
      type: 'application/octet-stream',
    });
    const progress = [];
    const parser = createPlanCheckParser();
    const api = Object.keys(parser).sort();
    try {
      const parsed = await parser.parse(file, {
        onProgress: (entry) => progress.push(entry),
      });
      const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
      const externalRequests = resources
        .filter((url) => new URL(url, location.href).origin !== location.origin);
      const findingTargets = parsed.validation.errors.map((finding) => {
        const resolved = planCheckFindingRenderItems(
          finding, parsed.drawing.renderList, parsed.drawing.dimensionInfo,
        );
        return {
          ruleCode: finding.ruleCode,
          count: resolved.items.length,
          source: resolved.source,
          truncated: resolved.truncated,
        };
      });
      return {
        api,
        file: parsed.file,
        fixtureSha256,
        elapsedMs: parsed.elapsedMs,
        database: parsed.database,
        renderCount: parsed.drawing.renderList.length,
        bounds: parsed.drawing.bounds,
        completeness: parsed.drawing.completeness,
        rooms: parsed.validation.rooms.length,
        areas: parsed.validation.areas.length,
        score: parsed.validation.score,
        passedRules: parsed.validation.passedRules,
        evaluatedRules: parsed.validation.metrics.evaluatedRules,
        dimensions: parsed.drawing.dimensionInfo,
        ngf: parsed.validation.metrics.ngf,
        gf: parsed.validation.metrics.gf,
        categorySource: parsed.validation.metrics.categorySource,
        rules: parsed.validation.rules.length,
        firedRules: [...new Set(parsed.validation.errors.map((error) => error.ruleCode))].sort(),
        findingTargets,
        stages: progress.map((entry) => entry.stage),
        externalRequests,
        parserWorkers: workers.map((worker) => ({ ...worker })),
      };
    } finally {
      parser.dispose();
    }
  })()`);

  assert.deepEqual(result.api, ['dispose', 'parse']);
  assert.deepEqual(result.file, { name: 'uploaded-reference-copy.dwg', size: 381_509 });
  assert.equal(result.fixtureSha256, FIXTURE_SHA256);
  assert.equal(result.parserWorkers.length, 1);
  assert.equal(result.parserWorkers[0].terminated, true);
  assert.equal(result.database.version, 'AC1032');
  assert.equal(result.database.entityCount, 3_504);
  assert.equal(result.database.layerCount, 17);
  assert.equal(result.database.unknownEntityCount, 0);
  assert.equal(result.rules, 40);
  assert.equal(result.renderCount, 3_557);
  assert.ok(result.bounds.width > 0 && result.bounds.height > 0);
  assert.equal(result.rooms, 30);
  assert.equal(result.areas, 1);
  // Partial normalization is a finding, not a reason to withhold the result:
  // the reference drawing has two unsupported and ten non-renderable entities
  // and is still fully scored.
  assert.equal(result.score, 90);
  assert.equal(result.passedRules, 35);
  assert.equal(result.evaluatedRules, 39);
  assert.equal(result.completeness.status, 'incomplete');
  assert.deepEqual(result.completeness.reasons.map((reason) => reason.code),
    ['UNSUPPORTED_ENTITY', 'NON_RENDERABLE_ENTITY']);
  assert.deepEqual(result.firedRules,
    ['DIM_002', 'INCOMPLETE_001', 'STYLE_002', 'TEXT_001', 'TEXT_002']);
  // DIM_002 resolves through the dimension's ACAD_DIMASSOC linkage: the fixture
  // holds one associative and one non-associative dimension.
  assert.equal(result.dimensions.length, 2);
  assert.deepEqual(result.dimensions.map((item) => item.associative).sort(), [false, true]);
  const expectedFindingSources = {
    INCOMPLETE_001: 'none', STYLE_002: 'handles', TEXT_001: 'handles', TEXT_002: 'handles',
    // A DIMENSION has no own render primitive; the finding resolves to the
    // geometry of its layer so the plan still shows where to look.
    DIM_002: 'related-layer',
  };
  for (const finding of result.findingTargets) {
    assert.equal(finding.source, expectedFindingSources[finding.ruleCode]);
    if (finding.source === 'handles' || finding.source === 'related-layer') {
      assert.ok(finding.count > 0, `${finding.ruleCode} must resolve to visible Canvas geometry`);
    } else {
      assert.equal(finding.count, 0);
    }
  }
  // The area balance is now populated: GF is measured from the floor polygon,
  // NGF follows the stated HNF convention for unclassified rooms.
  assert.ok(result.gf > 0, `GF must be measured: ${result.gf}`);
  assert.ok(result.ngf > 0, `NGF must follow the classification convention: ${result.ngf}`);
  assert.equal(result.categorySource, 'convention');
  assert.deepEqual(result.externalRequests, []);
  for (const suffix of [
    '/js/vendor/libredwg/dist/libredwg-web.js',
    '/js/vendor/libredwg/wasm/libredwg-web.js',
    '/js/vendor/libredwg/wasm/libredwg-web.wasm',
  ]) {
    assert.ok(requestedPaths.some((path) => path.endsWith(suffix)),
      `missing local runtime request: ${suffix}`);
  }
  for (const stage of ['reading', 'loading-engine', 'parsing', 'normalizing', 'validating', 'complete']) {
    assert.ok(result.stages.includes(stage), `missing progress stage ${stage}`);
  }
  assert.deepEqual(page.exceptions, []);
  assert.deepEqual(page.consoleErrors, []);
  console.log('Plan-check local-file parser golden passed:', JSON.stringify(result));
  await page.closeTarget();
} finally {
  cdp.close();
  await new Promise((resolve) => server.close(resolve));
}
