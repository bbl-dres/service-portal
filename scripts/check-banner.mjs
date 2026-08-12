// The notification banner must align its contents with the page edge by using
// exactly the same horizontal padding as .container.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const WIDTHS = [375, 480, 640, 1024, 1280, 1920];
const cdp = await launch();
const page = await openPage(cdp, `${APP_BASE}/`);
await sleep(600);
let failures = 0;
for (const w of WIDTHS) {
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: w, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  const r = await page.evaluate(`(() => {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-9999px;visibility:hidden';
    host.innerHTML = '<div class="container"></div>' +
      '<div class="notification notification-banner"><div class="notification-banner__wrapper"></div></div>';
    document.body.appendChild(host);
    const c = getComputedStyle(host.children[0]);
    const b = getComputedStyle(host.children[1]);
    const w2 = getComputedStyle(host.children[1].firstElementChild);
    const out = { container: c.paddingLeft, bannerY: b.paddingTop, wrapper: w2.paddingLeft };
    host.remove();
    return out;
  })()`);
  const ok = r.container === r.wrapper;
  if (!ok) failures++;
  console.log(`${ok ? '  ok ' : 'FAIL '} ${String(w).padStart(4)}px  container ${r.container.padStart(6)} / banner horizontal ${r.wrapper.padStart(6)} / vertical ${r.bannerY}`);
}
await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 375, height: 700, deviceScaleFactor: 1, mobile: false }, page.sessionId);
await sleep(150);
const live = await page.evaluate(`(() => {
  const banner = document.querySelector('.notification-banner--fixed');
  const button = document.querySelector('[data-banner-close]');
  const height = banner ? Math.ceil(banner.getBoundingClientRect().height) : 0;
  const buttonHeight = button ? Math.round(button.getBoundingClientRect().height) : 0;
  const padding = Math.round(parseFloat(getComputedStyle(document.body).paddingBottom) || 0);
  const visible = document.body.classList.contains('body--banner-visible');
  const focusProbe = document.createElement('button');
  const bannerTop = banner?.getBoundingClientRect().top || 0;
  focusProbe.type = 'button';
  focusProbe.textContent = 'Focus probe';
  focusProbe.style.cssText = 'position:absolute;left:0;width:44px;height:44px;top:'
    + (window.scrollY + bannerTop + 8) + 'px';
  document.body.appendChild(focusProbe);
  const focusBefore = focusProbe.getBoundingClientRect().bottom;
  const scrollBefore = window.scrollY;
  focusProbe.focus({ preventScroll: true });
  const focusAfter = focusProbe.getBoundingClientRect().bottom;
  const scrollAfter = window.scrollY;
  const focusVisible = focusAfter <= bannerTop;
  focusProbe.remove();
  // The same handler must IGNORE a page-sized element. Clicking anywhere
  // non-interactive focuses <main tabindex="-1">, which is as tall as the page:
  // it overlaps the strip the way everything full-height does, and treating that
  // as «hidden behind the banner» scrolled the page to its own bottom.
  const main = document.querySelector('main');
  const containerBefore = window.scrollY;
  main?.focus({ preventScroll: true });
  const containerAfter = window.scrollY;
  const mainHeight = main ? Math.round(main.getBoundingClientRect().height) : 0;
  button?.click();
  return {
    height, padding, buttonHeight, visible, focusVisible,
    containerBefore, containerAfter, mainHeight,
    focusBefore, focusAfter, scrollBefore, scrollAfter, bannerTop,
    released: !document.body.classList.contains('body--banner-visible')
      && !document.body.style.getPropertyValue('--banner-offset'),
  };
})()`);
const reserved = live.visible && live.height > 0 && Math.abs(live.height - live.padding) <= 1;
if (!reserved) failures++;
if (!live.released) failures++;
if (live.buttonHeight < 44) failures++;
if (!live.focusVisible) failures++;
const containerQuiet = live.containerBefore === live.containerAfter;
if (!containerQuiet) failures++;
console.log(`${reserved ? '  ok ' : 'FAIL '} live banner reserves ${live.padding}px for its ${live.height}px height`);
console.log(`${live.buttonHeight >= 44 ? '  ok ' : 'FAIL '} banner action has a ${live.buttonHeight}px target`);
console.log(`${live.focusVisible ? '  ok ' : 'FAIL '} obscured keyboard focus scrolls above the banner `
  + `(target ${live.focusBefore}->${live.focusAfter}, scroll ${live.scrollBefore}->${live.scrollAfter}, banner starts ${live.bannerTop})`);
console.log(`${containerQuiet ? '  ok ' : 'FAIL '} focusing the ${live.mainHeight}px page container does NOT scroll `
  + `(${live.containerBefore}->${live.containerAfter})`);
console.log(`${live.released ? '  ok ' : 'FAIL '} closing releases the reserved space`);
await cdp.close();
console.log(failures ? `\n${failures} discrepancies` : '\nThe banner aligns with page content at every width.');
process.exit(failures ? 1 : 0);
