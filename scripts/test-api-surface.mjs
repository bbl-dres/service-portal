// K-03: the modules below are shared contracts, not grab bags. This pure-Node
// check locks the deliberately small ESM surface and the removal of object
// members that had no consumer. It needs neither a browser nor the dev server.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (path) => import(pathToFileURL(join(ROOT, path)).href);

// session.js reads once during module evaluation. A minimal in-memory storage
// keeps the test deterministic outside a browser.
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

let failures = 0;
const check = (ok, label, detail = '') => {
  console.log(`   ${ok ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
};
const sameNames = (actual, expected) => {
  const left = [...actual].sort();
  const right = [...expected].sort();
  return JSON.stringify(left) === JSON.stringify(right);
};
const exactModule = (name, mod, names) => check(
  sameNames(Object.keys(mod), names),
  `${name}: only the intended ESM exports`,
  Object.keys(mod).sort().join(', '),
);
const lacks = (object, names) => names.filter((name) => name in object);

const [sessionModule, links, crumbs, coreModule, engineModule, maps, components] = await Promise.all([
  load('js/session.js'),
  load('js/links.js'),
  load('js/crumbs.js'),
  load('js/core.js'),
  load('js/process-engine.js'),
  load('js/buildings-map.js'),
  load('js/components.js'),
]);

console.log('■ Public module surfaces');
exactModule('session', sessionModule, ['session']);
exactModule('links', links, [
  'application', 'caseDetails', 'constructionProject', 'dataset', 'documentSearch',
  'floorplanEditor', 'news', 'portfolioItem', 'processDocumentation', 'service', 'shop',
  'shopCart', 'shopProduct', 'tenancy',
]);
exactModule('crumbs', crumbs, ['APPLICATIONS', 'DATA', 'SERVICES', 'trail']);
exactModule('core', coreModule, ['core']);
exactModule('process-engine', engineModule, ['engine']);
exactModule('buildings-map', maps, ['initEstateMap', 'initPickerMap']);
exactModule('components', components, [
  'announce', 'badge', 'default', 'empty', 'escape', 'icon', 'loading', 'menu',
  'mountBanner', 'notification', 'select', 'toast', 'wireLogin', 'wireMenu', 'wireShare',
]);

console.log('■ Object surfaces and retained contracts');
const sessionDead = lacks(sessionModule.session, ['onChange']);
check(sessionDead.length === 0, 'session has no unobserved listener API', sessionDead.join(', '));

const coreDead = lacks(coreModule.core, [
  'projectsForBuilding', 'servicesByDomain', 'applicationsByGroup',
  'mediaForObject', 'mediaForBuilding', 'failed',
]);
check(coreDead.length === 0, 'core contains no unused convenience accessors', coreDead.join(', '));
check(typeof coreModule.core.data === 'object' && typeof coreModule.core.available === 'function'
  && typeof coreModule.core.failedAreas === 'function', 'used core diagnostics remain available');
check(typeof coreModule.core.floorsForBuilding === 'function',
  'core provides canonical building floors to property views');

const componentDead = lacks(components.default, [
  'FOCUSABLE', 'notFound', 'stepIndicator', 'loginButton', 'mountBanner', 'wireShare', 'wireLogin',
]);
check(componentDead.length === 0, 'C contains only components consumed through C', componentDead.join(', '));
check(typeof components.default.catalogueResults === 'function'
  && typeof components.default.renderNotFound === 'function', 'the default C contract remains usable');

console.log('■ ActionCard contract');
const legacyActionCard = components.default.actionCard({
  title: 'Aktionen <alt>', lead: 'Vorbelegt & bereit',
  links: [{ label: 'Öffnen & prüfen', href: '#/legacy?a=1&b=2', icon: 'Wrench' }],
});
check(legacyActionCard.includes('<a class="fp-svc" href="#/legacy?a=1&amp;b=2">')
  && legacyActionCard.includes('Öffnen &amp; prüfen')
  && legacyActionCard.includes('Aktionen &lt;alt&gt;')
  && legacyActionCard.includes('Vorbelegt &amp; bereit'),
  'existing links calls remain links and escape their data');
check(legacyActionCard.includes('ArrowRight.svg') && !legacyActionCard.includes('Wrench.svg'),
  'existing links retain the follow arrow regardless of the historical icon field');

const structuredActionCard = components.default.actionCard({
  items: [
    { type: 'link', id: 'open<&', label: 'Öffnen <jetzt>', href: '#/open?a=1&b=2',
      description: 'Detail & Kontext', icon: 'External' },
    { type: 'button', id: 'export"', label: 'Exportieren', description: 'CSV erstellen', icon: 'Download' },
    { type: 'handoff', id: 'editor', label: 'Editor öffnen', description: 'Separate App folgt', icon: 'Lock' },
    { type: 'disabled', id: 'checker', label: 'Plan prüfen', description: 'Noch nicht verfügbar',
      icon: "Lock');color:red" },
  ],
});
const actionCount = (pattern) => (structuredActionCard.match(pattern) || []).length;
check(actionCount(/<a class="fp-svc"/g) === 1
  && actionCount(/<button class="fp-svc" type="button"/g) === 1
  && actionCount(/role="link" aria-disabled="true"/g) === 2,
  'items create semantic links, real buttons, and both disabled handoff aliases');
check(actionCount(/class="fp-svc__description"/g) === 4
  && structuredActionCard.includes('Detail &amp; Kontext')
  && structuredActionCard.includes('id="open&lt;&amp;"')
  && structuredActionCard.includes('id="export&quot;"'),
  'descriptions remain visible, and dynamic text and IDs are escaped');
check(structuredActionCard.includes('External.svg') && structuredActionCard.includes('Download.svg')
  && structuredActionCard.includes('Lock.svg') && !structuredActionCard.includes('color:red'),
  'optional icons are used and invalid icon names fall back safely');
check(components.default.actionCard({ links: [{ label: 'Alt', href: '#/alt' }], items: [] }) === '',
  'an explicitly empty items array hides the action card');
const newWindowAction = components.default.actionCard({
  links: [{ label: 'Plan-Editor', href: '#/app/floorplan-editor?building=A%2FB', newWindow: true }],
});
check(newWindowAction.includes('target="_blank" rel="noopener"')
  && newWindowAction.includes('External.svg'),
  'standalone domain applications receive a safe new-window contract and External icon');

console.log('■ New-window contract for application launches');
const applicationEntry = components.default.downloadItem({
  href: '#/app/portfolio', title: 'Anwendung starten', newWindow: true,
});
check(applicationEntry.includes('href="#/app/portfolio" target="_blank" rel="noopener"')
  && applicationEntry.includes('External.svg'),
  'portal-internal application entry points open safely in a new tab');
const anonymousApplicationAccess = components.default.accessCard({
  href: '#/app/portfolio', label: 'Anwendung starten', newWindow: true,
  requiresLogin: true, loggedIn: false,
});
check(anonymousApplicationAccess.includes('<a class="btn btn--outline btn--icon-right"')
  && anonymousApplicationAccess.includes('target="_blank" rel="noopener"')
  && anonymousApplicationAccess.includes('Anwendung starten')
  && anonymousApplicationAccess.includes('Die Anmeldung erfolgt in der gestarteten Anwendung.')
  && !anonymousApplicationAccess.includes('data-login'),
  'an anonymous launch opens the target application login gate in a new tab');
const sameWindowLogin = components.default.accessCard({
  href: '#/app/portfolio', label: 'Öffnen', requiresLogin: true, loggedIn: false,
});
check(sameWindowLogin.includes('data-login-next="#/app/portfolio"')
  && !sameWindowLogin.includes('target="_blank"'),
  'the existing combined login remains for normal same-tab access cards');

check(['available', 'definitions', 'reset'].every((name) => typeof engineModule.engine[name] === 'function'),
  'specifically used engine diagnostics remain available');
check(links.service('a/b') === '#/services/a%2Fb'
  && links.application('a/b') === '#/applications/a%2Fb'
  && links.documentSearch('A & B') === '#/app/document-archive?q=A%20%26%20B'
  && links.floorplanEditor('1080/6650/AA', '1080-6650-AA-2og')
    === '#/app/floorplan-editor?building=1080%2F6650%2FAA&floor=1080-6650-AA-2og',
  'search targets use the central correctly encoding link contracts');

console.log(failures ? `\n✗ ${failures} check(s) FAILED` : '\n✓ all API surfaces match');
process.exit(failures ? 1 : 0);
