// Definition-list consistency: every label has a colon and a clear gap between
// label and value columns in every application that uses .kv.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const PAGES = [
  ['Portfolio building', `${APP_BASE}/app/portfolio?id=${encodeURIComponent('1080/4840/AF')}`],
  ['Project',            `${APP_BASE}/app/projects/PRJ-01`],
  ['Tenancy',            `${APP_BASE}/app/tenancies/MV-2019-0001`],
  ['Application',        `${APP_BASE}/applications/portfolio`],
  ['Media library',      `${APP_BASE}/app/media-library`],
];

const cdp = await launch();
let failures = 0;
for (const [name, url] of PAGES) {
  const page = await openPage(cdp, url);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await sleep(1200);
  const r = await page.evaluate(`(() => {
    const dt = document.querySelector('.kv dt');
    if (!dt) return { missing: true };
    const cs = getComputedStyle(dt.parentElement);
    // ::after is absent from textContent, so read it through CSSOM.
    const after = getComputedStyle(dt, '::after').content;
    return { label: dt.textContent.trim(), after, columns: cs.gridTemplateColumns, gap: cs.columnGap };
  })()`);
  if (r.missing) { console.log(`  skip ${name.padEnd(20)} no .kv on page`); await page.closeTarget(); continue; }
  const ok = r.after === String.fromCharCode(34,160,58,34) && parseFloat(r.gap) >= 24 && r.columns.split(' ').length === 2;
  if (!ok) failures++;
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name.padEnd(20)} "${r.label}${r.after === String.fromCharCode(34,160,58,34) ? ':' : ''}" / gap ${r.gap} / tracks ${r.columns}`);
  await page.closeTarget();
}
await cdp.close();
console.log(failures ? `\n${failures} discrepancies` : '\nColon and column spacing are consistent.');
process.exit(failures ? 1 : 0);
