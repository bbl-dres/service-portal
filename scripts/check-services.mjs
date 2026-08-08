// End-to-end coverage for the expanded service catalogue: count, topic filter,
// representative detail pages, the small-order report branch, and procurement.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const CASES = [
  ['/services', `(() => {
     const n = document.querySelector('#svc-count')?.textContent.replace(/\\s+/g,' ').trim();
     const themes = [...document.querySelectorAll('#svc-filters input[name=topic]')].map(i => i.value).join(',');
     return n + ' | topics: ' + themes;
   })()`],
  ['/services?topic=E', `(() => {
     const n = document.querySelector('#svc-count')?.textContent.replace(/\\s+/g,' ').trim();
     const pill = document.querySelector('.active-filter')?.textContent.trim();
     return n + ' | pill: ' + pill;
   })()`],
  ['/services/mobiliarschluessel-bestellen', `document.querySelector('h1')?.textContent.trim() + ' | contact: ' + (document.querySelector('.container__aside')?.textContent.match(/[\\w._-]+@bbl\\.admin\\.ch/)||['—'])[0]`],
  ['/services/delegation-beantragen', `document.querySelector('h1')?.textContent.trim() + ' | steps: ' + document.querySelectorAll('.pipeline__step').length`],
  ['/services/publikationsauftrag', `document.querySelector('h1')?.textContent.trim() + ' | pipeline: ' + !!document.querySelector('.pipeline')`],
  ['/services/unbefangenheitserklaerung', `document.querySelector('h1')?.textContent.trim()`],
  ['/app/fault-report?type=kleinauftrag', `document.querySelector('h1')?.textContent.trim()`],
];

const b = await launch({ port: 9342 });
let bad = 0;
for (const [route, probe] of CASES) {
  const p = await openPage(b, APP_BASE + route);
  await sleep(700);
  const v = await p.evaluate(probe);
  const errs = p.problems ? await p.problems() : [...p.exceptions, ...p.consoleErrors];
  const ok = v && !String(v).includes('undefined') && !String(v).includes('nicht gefunden') && !errs.length;
  if (!ok) bad++;
  console.log((ok ? 'OK   ' : 'FAIL ') + route.padEnd(42) + ' -> ' + v + (errs.length ? '  errors: ' + errs.join(' | ') : ''));
  await p.closeTarget();
}
await b.close();
console.log(bad ? `\n${bad} failures` : '\nAll cases passed.');
process.exit(bad ? 1 : 0);
