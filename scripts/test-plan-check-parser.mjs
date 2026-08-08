import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { launch, openPage } from './lib/cdp.mjs';
import { createStaticServer } from './serve.mjs';

const trustedDwgOptIn = process.env.PLAN_CHECK_TRUSTED_DWG_TEST === '1';
const TRUSTED_FIXTURE_SHA256 = 'e69f34d37ed6a7c7223457a7478a534ecbfd4cac556ef693cb8060129299e0a9';
const REQUIRED_FIX_COMMIT = '3d0f9fc2eddbd6579c99af3111c37c98f03475d0';
const REJECTED_RUNTIME_HASHES = new Set([
  '438b77262a85e8815e3928f3ff97a51ec84df06d3f3fd184c8459e798d568b81',
  '62deaef11c2d6cf8fd0a0ee83d29120ca40bdabc2cdd9baa1f7911410bf9d73f',
  'd8b78f6d5e63e6e178cf7343cfd08ebe798d75b6754c593e15d8f948b823e038',
]);

async function verifyApprovedCandidate() {
  const manifestUrl = new URL('../js/vendor/libredwg/APPROVED-CANDIDATE.json', import.meta.url);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
  } catch (error) {
    throw new Error(`Trusted parser opt-in requires a reviewed APPROVED-CANDIDATE.json: ${error.message}`);
  }
  assert.equal(manifest.schema, 'bbl-plan-check-parser-candidate/1');
  assert.equal(manifest.libredwgFixCommit, REQUIRED_FIX_COMMIT);
  assert.match(String(manifest.correspondingSourceUrl || ''), /^https:\/\//);
  assert.ok(String(manifest.correspondingSourceCommit || '').length >= 40);
  assert.ok(String(manifest.buildRecipe || '').trim());
  assert.ok(String(manifest.license || '').trim());
  const requiredFiles = [
    'dist/libredwg-web.js', 'wasm/libredwg-web.js', 'wasm/libredwg-web.wasm',
  ];
  for (const relativePath of requiredFiles) {
    const expected = String(manifest.files?.[relativePath] || '').toLowerCase();
    assert.match(expected, /^[a-f0-9]{64}$/, `missing candidate hash: ${relativePath}`);
    assert.equal(REJECTED_RUNTIME_HASHES.has(expected), false,
      `known-vulnerable 0.7.9 runtime rejected: ${relativePath}`);
    const content = await readFile(new URL(`../js/vendor/libredwg/${relativePath}`, import.meta.url));
    const actual = createHash('sha256').update(content).digest('hex');
    assert.equal(actual, expected, `candidate runtime hash mismatch: ${relativePath}`);
  }
}

if (!trustedDwgOptIn) {
  console.log('Plan-check LibreDWG golden skipped (set PLAN_CHECK_TRUSTED_DWG_TEST=1 for the trusted-fixture quarantine run).');
} else {
await verifyApprovedCandidate();
const server = createStaticServer();
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
const cdp = await launch();

try {
  const page = await openPage(cdp, `${origin}/index.html`, { login: false });
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
    if (fixtureSha256 !== ${JSON.stringify(TRUSTED_FIXTURE_SHA256)}) {
      throw new Error('Trusted Plan Check fixture hash mismatch; refusing to invoke LibreDWG.');
    }
    const file = new File([bytes], 'CAD.V01-CAFM-Plan-DE.dwg', { type: 'application/octet-stream' });
    const progress = [];
    const parser = createPlanCheckParser({ allowTrustedFixture: true });
    try {
      const parsed = await parser.parse(file, { onProgress: (entry) => progress.push(entry) });
      const externalRequests = performance.getEntriesByType('resource')
        .map((entry) => entry.name)
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
        file: parsed.file,
        fixtureSha256,
        elapsedMs: parsed.elapsedMs,
        database: parsed.database,
        renderCount: parsed.drawing.renderList.length,
        bounds: parsed.drawing.bounds,
        rooms: parsed.validation.rooms.length,
        areas: parsed.validation.areas.length,
        score: parsed.validation.score,
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

  assert.deepEqual(result.file, { name: 'CAD.V01-CAFM-Plan-DE.dwg', size: 381_509 });
  assert.equal(result.fixtureSha256, TRUSTED_FIXTURE_SHA256);
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
  assert.equal(result.score, 95);
  assert.deepEqual(result.firedRules, ['STYLE_002', 'TEXT_001']);
  const expectedFindingSources = { STYLE_002: 'handles', TEXT_001: 'handles' };
  for (const finding of result.findingTargets) {
    assert.ok(finding.count > 0, `${finding.ruleCode} must resolve to visible Canvas geometry`);
    assert.equal(finding.source, expectedFindingSources[finding.ruleCode]);
  }
  assert.deepEqual(result.externalRequests, []);
  for (const stage of ['reading', 'loading-engine', 'parsing', 'normalizing', 'validating', 'complete']) {
    assert.ok(result.stages.includes(stage), `missing progress stage ${stage}`);
  }
  assert.deepEqual(page.exceptions, []);
  assert.deepEqual(page.consoleErrors, []);
  console.log('Plan-check browser parser golden passed:', JSON.stringify(result));
  await page.closeTarget();
} finally {
  cdp.close();
  await new Promise((resolve) => server.close(resolve));
}
}
