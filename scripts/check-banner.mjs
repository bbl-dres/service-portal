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
await cdp.close();
console.log(fehler ? `\n${fehler} Abweichungen` : '\nDer Streifen fluchtet auf jeder Stufe mit dem Seiteninhalt.');
process.exit(fehler ? 1 : 0);
