// Pure policy and component-boundary checks. No browser or development server.
import C from '../js/components.js';
import {
  classifyUrl, newWindowAttrs, safeAssetUrl, safeLinkUrl, safeMailto, safeResourceUrl, safeTel,
} from '../js/security/urls.js';
import { swisstopoLabelText } from '../js/security/untrusted-text.js';

let failures = 0;
const check = (ok, label) => {
  console.log(`   ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures++;
};

console.log('■ URL policy');
const rejected = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  '//evil.example/path',
  '\\evil.example\path',
  ' javascript:alert(1)',
  '\tjavascript:alert(1)',
  '\njavascript:alert(1)',
  '"javascript:alert(1)',
  "https://example.test/'onclick='alert(1)",
  'https://example.test/%0d%0aLocation:https://evil.test',
  'https://',
  'https://user:password@example.test/',
  'assets/images/bad%zz.jpg',
  'http://evil.example/path',
];
for (const value of rejected) check(safeLinkUrl(value) === '', `rejects ${JSON.stringify(value)}`);

check(classifyUrl('#/services?topic=A') === 'route', 'accepts an internal hash route');
check(classifyUrl('#main-content') === 'fragment', 'accepts a same-document fragment');
check(classifyUrl('assets/images/example.jpg') === 'relative', 'accepts a relative asset');
check(classifyUrl('/assets/example.pdf') === 'relative', 'accepts a root-relative asset');
check(classifyUrl('https://www.admin.ch/path?q=1') === 'external', 'accepts an HTTPS external URL');
check(safeLinkUrl('mailto:test@example.admin.ch', { mailto: true }) !== '', 'accepts mailto only when requested');
check(safeLinkUrl('mailto:test@example.admin.ch') === '', 'rejects mailto in a normal navigation context');
check(safeLinkUrl('tel:+41584656565', { tel: true }) !== '', 'accepts tel only when requested');
check(safeMailto('test@example.admin.ch') === 'mailto:test@example.admin.ch', 'builds a validated mailto URL');
check(safeMailto('test@example.admin.ch\r\nBcc:evil@example.test') === '', 'rejects mail header injection');
check(safeTel('+41 58 465 65 65') === 'tel:+41584656565', 'normalises and validates a telephone URL');
check(safeResourceUrl('assets/images/example.jpg') !== '', 'resource policy accepts a local image');
check(safeResourceUrl('assets/images/datasets/SAP Technische Anlage.jpg') !== '',
  'resource policy preserves maintained local filenames with internal spaces');
check(safeResourceUrl('https://images.example.test/photo.jpg') !== '', 'resource policy accepts an HTTPS image');
check(safeResourceUrl('#/applications') === '', 'resource policy rejects a route as an image');
check(safeAssetUrl('assets/images/example.jpg') !== ''
  && safeAssetUrl('assets/images/../../data/session.json') === ''
  && safeAssetUrl('https://images.example.test/photo.jpg') === '',
  'local asset policy stays inside the repository asset tree without traversal');
check(safeLinkUrl('https://bbl.libal-tech.ch/#/projects') !== ''
  && safeLinkUrl('https://intranet.egate.admin.ch/') !== '',
'migrated HTTPS catalogue targets remain available');
check(newWindowAttrs('https://www.admin.ch/', { external: true })
  === ' target="_blank" rel="noopener noreferrer external"', 'new-window links isolate opener and referrer');

const oldLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
Object.defineProperty(globalThis, 'location', {
  configurable: true, value: { origin: 'http://127.0.0.1:8848' },
});
check(classifyUrl('http://127.0.0.1:8848/assets/a.pdf') === 'relative',
  'permits an absolute URL only when it matches the development origin');
Object.defineProperty(globalThis, 'location', {
  configurable: true, value: { origin: 'https://portal.example.test' },
});
check(classifyUrl('https://portal.example.test/assets/a.pdf') === 'relative',
  'classifies same-origin HTTPS before generic external HTTPS');
check(classifyUrl('http://127.0.0.1:9999/assets/a.pdf') === '',
  'rejects a different HTTP origin');
if (oldLocation) Object.defineProperty(globalThis, 'location', oldLocation);
else delete globalThis.location;

console.log('■ Untrusted swisstopo labels');
check(swisstopoLabelText('<b>Fellerstrasse</b>&nbsp;21 3003 Bern')
  === 'Fellerstrasse 21 3003 Bern', 'decodes the documented bold-label subset');
const hostileLabel = swisstopoLabelText(
  '<img src="https://evil.example/pixel" onerror="alert(1)"><b>Bern</b><script>bad()</script>',
);
check(hostileLabel === 'Bernbad()' && !/[<>]/.test(hostileLabel),
  'extracts text without constructing resource-bearing elements');

console.log('■ Reusable component sinks');
const unsafeCard = C.card({ title: 'Unsicher', href: 'javascript:alert(1)' });
check(!unsafeCard.includes('href=') && !unsafeCard.includes('card--clickable'),
  'card degrades an unsafe target to inert content');
const safeCard = C.card({ title: 'Sicher', href: '#/services' });
check(safeCard.includes('href="#/services"') && safeCard.includes('card--clickable'),
  'card preserves a valid portal route');
const unsafeDownload = C.downloadItem({ title: 'Datei', href: 'data:text/html,<h1>x</h1>' });
check(unsafeDownload.includes('aria-disabled="true"') && !unsafeDownload.includes('href='),
  'download item disables an unsafe data URL');
const routeAsDownload = C.downloadItem({ title: 'Datei', href: '#/services', download: true });
check(routeAsDownload.includes('aria-disabled="true"') && !routeAsDownload.includes('href='),
  'download context rejects navigation routes as resources');
const unsafeAccess = C.accessCard({ href: 'http://external.example/app', external: true });
check(unsafeAccess.includes('aria-disabled="true"') && !unsafeAccess.includes('href='),
  'access card disables an insecure external URL');
const unsafeEmpty = C.empty('Keine Treffer', {
  action: { label: 'Zurücksetzen', href: 'javascript:alert(1)' },
});
check(unsafeEmpty.includes('aria-disabled="true"') && !unsafeEmpty.includes('href='),
  'empty-state action disables an unsafe URL');
const unsafeFilter = C.activeFilters({
  filters: [{ label: 'Test', href: 'javascript:alert(1)' }],
  resetHref: 'data:text/html,x',
});
check((unsafeFilter.match(/aria-disabled="true"/g) || []).length === 2 && !unsafeFilter.includes('href='),
  'filter pills and reset action disable unsafe URLs');
const safeExternal = C.card({
  title: 'Bund', href: 'https://www.admin.ch/', external: true,
});
check(safeExternal.includes('rel="noopener noreferrer external"'),
  'external card carries the complete new-window isolation contract');
const hostileCardShape = C.card({
  title: 'Shape', href: '#/services', variant: 'default" onclick="alert(1)',
  titleTag: 'script', cls: 'pf-card bad" onclick="alert(1)',
});
check(hostileCardShape.includes('card--default') && hostileCardShape.includes('<h3')
  && hostileCardShape.includes(' pf-card') && !hostileCardShape.includes('onclick')
  && !hostileCardShape.includes('<script'),
  'card whitelists its heading, modifier, and extra class tokens');
check(C.card({ title: 'Unknown', variant: 'unknown-safe-token' }).includes('card--default'),
  'card modifiers use the component enum rather than arbitrary BEM-looking values');
const hostileTableShape = C.table({
  columns: [{ key: 'x', label: 'X', align: 'right" onclick="alert(1)', width: '1rem;background:red' }],
  rows: [{ x: 'value' }],
});
check(!hostileTableShape.includes('onclick') && !hostileTableShape.includes('background:red')
  && !hostileTableShape.includes('text-right'),
'table whitelists alignment and column-width values');
const hostileHeadings = C.pageSection({ title: 'Section', titleTag: 'img onerror=alert(1)' })
  + C.detailSection({ title: 'Detail', titleTag: 'script' })
  + C.contactBox({ name: 'Name' }, { heading: 'iframe' })
  + C.domainTile({ title: 'Domain', desc: 'Text', href: '#/data', titleTag: 'svg/onload=alert(1)' });
check((hostileHeadings.match(/<h2/g) || []).length >= 2 && hostileHeadings.includes('<h3')
  && !/<(?:script|iframe|img|svg)[\s/>]/i.test(hostileHeadings),
'content components fall back to contextual heading elements');
const hostileMenu = C.menu({
  menuId: 'security-menu', align: 'end" onclick="alert(1)',
  triggerClass: 'chart__menu bad" onclick="alert(1)', items: [],
});
check(hostileMenu.includes('action-menu__popup--end') && hostileMenu.includes(' chart__menu')
  && !hostileMenu.includes('onclick'),
'menu whitelists alignment and trigger-class tokens');

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
