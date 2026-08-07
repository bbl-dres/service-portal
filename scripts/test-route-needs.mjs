// K-05/K-04: each route must load only the deferred files it actually reads.
// Every case starts in a fresh page context so the core/module cache of an
// earlier route cannot conceal an unnecessary or missing request.
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

const DATA_FILES = ['applications.json', 'datasets.json', 'catalog-labels.json'];
const ESTATE_FILES = ['buildings.geojson', 'parcels.geojson', 'landcovers.geojson'];
const WORKSPACE_FILES = ['buildings.geojson', 'floors.json', 'spaces.json', 'workspace-planning.json'];
const EDITOR_FILES = [...WORKSPACE_FILES, 'shop-products.json'];
const CASES = [
  { route: '/data', tracked: DATA_FILES, want: ['applications.json', 'datasets.json'] },
  { route: '/data/catalog', tracked: DATA_FILES, want: ['catalog-labels.json', 'datasets.json'] },
  { route: '/data/catalog/11', tracked: DATA_FILES, want: ['catalog-labels.json', 'datasets.json'] },
  { route: '/data/digitalisation/strategy', tracked: DATA_FILES, want: [] },
  { route: '/data/ict-projects', tracked: DATA_FILES, want: [] },
  { route: '/data/gibtsnicht', tracked: DATA_FILES, want: [], title: 'Seite nicht gefunden' },
  { route: '/app/dataportal', tracked: ESTATE_FILES, want: [] },
  { route: '/app/dataportal/energie-klima', tracked: ESTATE_FILES, want: [] },
  { route: '/app/dataportal/immobilien', tracked: ESTATE_FILES, want: ESTATE_FILES },
  { route: '/app/workspace', tracked: WORKSPACE_FILES, want: WORKSPACE_FILES },
  { route: '/app/workspace?id=1080%2F6650%2FAA', tracked: WORKSPACE_FILES, want: WORKSPACE_FILES },
  { route: '/app/floorplan-editor?building=1080%2F6650%2FAA&floor=1080-6650-AA-2og',
    tracked: EDITOR_FILES, want: EDITOR_FILES },
];

let failures = 0;
const check = (condition, label, actual = '') => {
  console.log(`${condition ? '✓' : '✗'} ${label}${actual ? ` (${actual})` : ''}`);
  if (!condition) failures++;
};

const browser = await launch();
try {
  for (const testCase of CASES) {
    const page = await openPage(browser, `${APP_BASE}${testCase.route}`);
    try {
      const result = JSON.parse(await page.evaluate(`(async () => {
        const deadline = performance.now() + 5000;
        while ((!document.querySelector('#main-content h1')
          || document.querySelector('#main-content [aria-busy="true"]'))
          && performance.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return JSON.stringify({
          title: document.querySelector('#main-content h1')?.textContent.trim() || '',
          files: performance.getEntriesByType('resource')
            .map((entry) => entry.name.split('/').pop().split('?')[0])
            .filter((name) => /\\.(?:json|geojson)$/.test(name)),
        });
      })()`));

      // Do not deduplicate: the Immobilien case also proves that each GeoJSON
      // master file is fetched exactly once.
      const got = result.files.filter((name) => testCase.tracked.includes(name)).sort();
      const want = [...testCase.want].sort();
      check(JSON.stringify(got) === JSON.stringify(want),
        `${testCase.route} lädt nur den deklarierten Bestand`, got.join(', ') || 'keiner');
      check(!!result.title, `${testCase.route} rendert eine Überschrift`);
      if (testCase.title) check(result.title === testCase.title,
        `${testCase.route} behält die lokale 404-Ansicht`, result.title);

      const problems = await page.problems();
      check(!problems.length, `${testCase.route} ohne Browserfehler`, problems.join(' | '));
    } finally {
      await page.closeTarget();
    }
  }
} finally {
  browser.close();
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
