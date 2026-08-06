// K-05: each data route must load only the deferred files it actually reads.
// Every case starts in a fresh page context so the core/module cache of an
// earlier route cannot conceal an unnecessary or missing request.
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

const OWNED_FILES = ['applications.json', 'datasets.json', 'catalog-labels.json'];
const CASES = [
  { route: '/data', want: ['applications.json', 'datasets.json'] },
  { route: '/data/catalog', want: ['catalog-labels.json', 'datasets.json'] },
  { route: '/data/catalog/11', want: ['catalog-labels.json', 'datasets.json'] },
  { route: '/data/digitalisation/strategy', want: [] },
  { route: '/data/ict-projects', want: [] },
  { route: '/data/gibtsnicht', want: [], title: 'Seite nicht gefunden' },
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

      const got = [...new Set(result.files.filter((name) => OWNED_FILES.includes(name)))].sort();
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
