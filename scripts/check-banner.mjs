// Der Hinweisstreifen muss seinen Inhalt an derselben Kante ausrichten wie der
// Seiteninhalt — also exakt dieselbe seitliche Polsterung wie .container tragen.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const BREITEN = [375, 480, 640, 1024, 1280, 1920];
const cdp = await launch();
const page = await openPage(cdp, `${APP_BASE}/`);
await sleep(600);
let fehler = 0;
for (const w of BREITEN) {
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: w, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  const r = await page.evaluate(`(() => {
    const halter = document.createElement('div');
    halter.style.cssText = 'position:absolute;left:-9999px;visibility:hidden';
    halter.innerHTML = '<div class="container"></div>' +
      '<div class="notification notification-banner"><div class="notification-banner__wrapper"></div></div>';
    document.body.appendChild(halter);
    const c = getComputedStyle(halter.children[0]);
    const b = getComputedStyle(halter.children[1]);
    const w2 = getComputedStyle(halter.children[1].firstElementChild);
    const out = { container: c.paddingLeft, bannerY: b.paddingTop, wrapper: w2.paddingLeft };
    halter.remove();
    return out;
  })()`);
  const ok = r.container === r.wrapper;
  if (!ok) fehler++;
  console.log(`${ok ? '  ok ' : ' FEHL'} ${String(w).padStart(4)}px  Container ${r.container.padStart(6)} · Streifen seitlich ${r.wrapper.padStart(6)} · oben/unten ${r.bannerY}`);
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
  focusProbe.textContent = 'Fokusprobe';
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
  button?.click();
  return {
    height, padding, buttonHeight, visible, focusVisible,
    focusBefore, focusAfter, scrollBefore, scrollAfter, bannerTop,
    released: !document.body.classList.contains('body--banner-visible')
      && !document.body.style.getPropertyValue('--banner-offset'),
  };
})()`);
const reserved = live.visible && live.height > 0 && Math.abs(live.height - live.padding) <= 1;
if (!reserved) fehler++;
if (!live.released) fehler++;
if (live.buttonHeight < 44) fehler++;
if (!live.focusVisible) fehler++;
console.log(`${reserved ? '  ok ' : ' FEHL'} Live-Streifen reserviert ${live.padding}px für ${live.height}px Höhe`);
console.log(`${live.buttonHeight >= 44 ? '  ok ' : ' FEHL'} Banner-Aktion hat ${live.buttonHeight}px Zielhöhe`);
console.log(`${live.focusVisible ? '  ok ' : ' FEHL'} Verdeckter Tastaturfokus wird über den Streifen gescrollt `
  + `(Ziel ${live.focusBefore}→${live.focusAfter}, Scroll ${live.scrollBefore}→${live.scrollAfter}, Streifen ab ${live.bannerTop})`);
console.log(`${live.released ? '  ok ' : ' FEHL'} Schliessen räumt den reservierten Abstand auf`);
await cdp.close();
console.log(fehler ? `\n${fehler} Abweichungen` : '\nDer Streifen fluchtet auf jeder Stufe mit dem Seiteninhalt.');
process.exit(fehler ? 1 : 0);
