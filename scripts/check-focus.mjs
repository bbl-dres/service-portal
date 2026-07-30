// Beweist, dass die sieben entfernten :focus-visible-Doubletten wirklich
// Doubletten waren: für jede Klasse wird ein Element in die geladene Seite
// gesetzt und der Fokuszustand über CDP erzwungen (CSS.forcePseudoState) —
// so hängt die Prüfung nicht davon ab, ob die Klasse gerade irgendwo im
// Markup vorkommt oder das Element überhaupt fokussierbar ist.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const KLASSEN = ['anchor-nav__summary', 'table-wrapper', 'pipeline-wrap',
  'view-switch__btn', 'map-search__clear', 'pf-mosaic__cell', 'med-shot'];
const RING = 'rgb(134, 85, 246)';   // --color-focus-ring #8655F6

const cdp = await launch();
const page = await openPage(cdp, `${APP_BASE}/`);
await sleep(600);
await cdp.send('DOM.enable', {}, page.sessionId);
await cdp.send('CSS.enable', {}, page.sessionId);

// Probeelemente in #main-content einhängen (einige Regeln sind darauf verankert).
await page.evaluate(`(() => {
  const halter = document.createElement('div');
  halter.id = 'fokus-proben';
  halter.innerHTML = ${JSON.stringify(KLASSEN)}
    .map(k => '<button type="button" class="' + k + '" id="probe-' + k + '">x</button>').join('');
  document.querySelector('#main-content').appendChild(halter);
})()`);

const { root } = await cdp.send('DOM.getDocument', { depth: -1 }, page.sessionId);
let fehler = 0;
for (const k of KLASSEN) {
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `#probe-${k}` }, page.sessionId);
  await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['focus', 'focus-visible'] }, page.sessionId);
  const wert = await page.evaluate(`(() => {
    const cs = getComputedStyle(document.getElementById('probe-${k}'));
    return cs.outlineWidth + ' ' + cs.outlineStyle + ' ' + cs.outlineColor;
  })()`);
  const ok = wert === `2px solid ${RING}`;
  if (!ok) fehler++;
  console.log(`${ok ? '  ok ' : ' FEHL'} .${k.padEnd(22)} ${wert}`);
  await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] }, page.sessionId);
}
await cdp.close();
console.log(fehler ? `\n${fehler} Abweichungen` : `\nAlle ${KLASSEN.length} Klassen tragen weiterhin den CD-Fokusring.`);
process.exit(fehler ? 1 : 0);
