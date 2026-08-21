// Proves that six removed :focus-visible blocks were duplicates. Insert one
// element per class and force focus through CDP CSS.forcePseudoState so the
// check does not depend on current markup or native focusability.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const CLASSES = ['table-wrapper', 'pipeline-wrap',
  'view-switch__btn', 'map-search__clear', 'pf-mosaic__cell', 'med-shot'];
const RING = 'rgb(134, 85, 246)';   // --color-focus-ring #8655F6

const cdp = await launch();
const page = await openPage(cdp, `${APP_BASE}/`);
await sleep(600);
await cdp.send('DOM.enable', {}, page.sessionId);
await cdp.send('CSS.enable', {}, page.sessionId);

// Insert probes under #main-content because some rules are scoped there.
await page.evaluate(`(() => {
  const host = document.createElement('div');
  host.id = 'focus-probes';
  host.innerHTML = ${JSON.stringify(CLASSES)}
    .map(k => '<button type="button" class="' + k + '" id="probe-' + k + '">x</button>').join('');
  document.querySelector('#main-content').appendChild(host);
})()`);

const { root } = await cdp.send('DOM.getDocument', { depth: -1 }, page.sessionId);
let failures = 0;
for (const k of CLASSES) {
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `#probe-${k}` }, page.sessionId);
  await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['focus', 'focus-visible'] }, page.sessionId);
  const value = await page.evaluate(`(() => {
    const cs = getComputedStyle(document.getElementById('probe-${k}'));
    return cs.outlineWidth + ' ' + cs.outlineStyle + ' ' + cs.outlineColor;
  })()`);
  const ok = value === `2px solid ${RING}`;
  if (!ok) failures++;
  console.log(`${ok ? '  ok ' : 'FAIL '} .${k.padEnd(22)} ${value}`);
  await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] }, page.sessionId);
}
await cdp.close();
console.log(failures ? `\n${failures} discrepancies` : `\nAll ${CLASSES.length} classes retain the CD focus ring.`);
process.exit(failures ? 1 : 0);
