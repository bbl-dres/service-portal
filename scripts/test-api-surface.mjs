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
  `${name}: nur die vorgesehenen ESM-Exporte`,
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

console.log('■ Öffentliche Moduloberflächen');
exactModule('session', sessionModule, ['session']);
exactModule('links', links, [
  'anwendung', 'bauprojekt', 'datensatz', 'dienstleistung', 'dokument', 'mietverhaeltnis',
  'news', 'objekt', 'prozess', 'shop', 'shopProdukt', 'shopWarenkorb', 'vorgang',
]);
exactModule('crumbs', crumbs, ['ANWENDUNGEN', 'DATEN', 'DIENSTLEISTUNGEN', 'trail']);
exactModule('core', coreModule, ['core']);
exactModule('process-engine', engineModule, ['engine']);
exactModule('buildings-map', maps, ['initEstateMap', 'initPickerMap']);
exactModule('components', components, [
  'announce', 'badge', 'default', 'empty', 'escape', 'icon', 'loading', 'menu',
  'mountBanner', 'notification', 'select', 'toast', 'wireLogin', 'wireMenu', 'wireShare',
]);

console.log('■ Objektoberflächen und beibehaltene Verträge');
const sessionDead = lacks(sessionModule.session, ['onChange']);
check(sessionDead.length === 0, 'session hat keine unbeobachtete Listener-API', sessionDead.join(', '));

const coreDead = lacks(coreModule.core, [
  'projectsForBuilding', 'floorsForBuilding', 'servicesByDomain', 'applicationsByGroup',
  'mediaForObject', 'mediaForBuilding', 'failed',
]);
check(coreDead.length === 0, 'core enthält keine ungenutzten Komfortzugriffe', coreDead.join(', '));
check(typeof coreModule.core.data === 'object' && typeof coreModule.core.available === 'function'
  && typeof coreModule.core.failedAreas === 'function', 'benutzte Core-Diagnostik bleibt erhalten');

const componentDead = lacks(components.default, [
  'FOCUSABLE', 'notFound', 'stepIndicator', 'loginButton', 'mountBanner', 'wireShare', 'wireLogin',
]);
check(componentDead.length === 0, 'C enthält nur über C verwendete Bausteine', componentDead.join(', '));
check(typeof components.default.catalogueResults === 'function'
  && typeof components.default.renderNotFound === 'function', 'der Default-C-Vertrag bleibt nutzbar');

check(['available', 'definitions', 'reset'].every((name) => typeof engineModule.engine[name] === 'function'),
  'konkret genutzte Engine-Diagnostik bleibt erhalten');
check(links.dienstleistung('a/b') === '#/services/a%2Fb'
  && links.anwendung('a/b') === '#/applications/a%2Fb'
  && links.dokument('A & B') === '#/app/document-archive?q=A%20%26%20B',
  'Suchziele verwenden die zentralen, korrekt kodierenden Link-Verträge');

console.log(failures ? `\n✗ ${failures} Prüfung(en) FEHLGESCHLAGEN` : '\n✓ alle API-Oberflächen stimmen');
process.exit(failures ? 1 : 0);
