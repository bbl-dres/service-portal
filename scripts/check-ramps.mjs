// Verify that tokenised ramps retain the exact computed values of the former
// explicit rules at every CD breakpoint.
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

const WIDTHS = [375, 480, 640, 768, 1024, 1280, 1544, 1920];
// Expected values are the pre-refactor declarations, in pixels.
const EXPECTED = {
  gap:       { 375: 20, 480: 28, 640: 36, 768: 36, 1024: 40, 1280: 48, 1544: 48, 1920: 64 },
  sectionPt: { 375: 48, 480: 48, 640: 48, 768: 48, 1024: 56, 1280: 56, 1544: 56, 1920: 80 },
  sectionPb: { 375: 56, 480: 56, 640: 56, 768: 56, 1024: 80, 1280: 80, 1544: 80, 1920: 128 },
  targetMin: { 375: 44, 480: 44, 640: 44, 768: 44, 1024: 44, 1280: 44, 1544: 44, 1920: 44 },
  controlH:  { 375: 44, 480: 44, 640: 44, 768: 44, 1024: 44, 1280: 48, 1544: 48, 1920: 52 },
};

const cdp = await launch();
const page = await openPage(cdp, `${APP_BASE}/`);
let failures = 0;
for (const w of WIDTHS) {
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: w, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  // Use probe elements because responsive home-page content makes a page
  // selector unreliable across widths.
  const actual = await page.evaluate(`(() => {
    const number = (v) => Math.round(parseFloat(v));
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden';
    host.innerHTML = '<div class="grid"></div><div class="container section"></div>' +
      '<div class="tok" style="height:var(--target-min);width:var(--control-h)"></div>';
    document.body.appendChild(host);
    const [grid, sec, tok] = host.children;
    const out = {
      gap:       number(getComputedStyle(grid).rowGap),
      sectionPt: number(getComputedStyle(sec).paddingTop),
      sectionPb: number(getComputedStyle(sec).paddingBottom),
      targetMin: number(getComputedStyle(tok).height),
      controlH:  number(getComputedStyle(tok).width),
    };
    host.remove();
    return out;
  })()`);
  for (const [key, table] of Object.entries(EXPECTED)) {
    const ok = actual[key] === table[w];
    if (!ok) failures++;
    console.log(`${ok ? '  ok ' : 'FAIL '} ${String(w).padStart(4)}px  ${key.padEnd(10)} ${actual[key]} (expected ${table[w]})`);
  }
}
await cdp.close();
console.log(failures ? `\n${failures} discrepancies` : '\nAll ramps are unchanged.');
process.exit(failures ? 1 : 0);
