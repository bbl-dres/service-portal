// Prüft, dass die auf Tokens umgestellten Rampen an JEDER CD-Stufe exakt
// dieselben berechneten Werte liefern wie die ausgeschriebenen Regeln vorher.
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

const BREITEN = [375, 480, 640, 768, 1024, 1280, 1544, 1920];
// Sollwerte = was vor dem Umbau ausgeschrieben im Blatt stand (in px).
const SOLL = {
  gap:       { 375: 20, 480: 28, 640: 36, 768: 36, 1024: 40, 1280: 48, 1544: 48, 1920: 64 },
  sectionPt: { 375: 48, 480: 48, 640: 48, 768: 48, 1024: 56, 1280: 56, 1544: 56, 1920: 80 },
  sectionPb: { 375: 56, 480: 56, 640: 56, 768: 56, 1024: 80, 1280: 80, 1544: 80, 1920: 128 },
  targetMin: { 375: 44, 480: 44, 640: 44, 768: 44, 1024: 44, 1280: 44, 1544: 44, 1920: 44 },
  controlH:  { 375: 44, 480: 44, 640: 44, 768: 44, 1024: 44, 1280: 48, 1544: 48, 1920: 52 },
};

const cdp = await launch();
const page = await openPage(cdp, `${APP_BASE}/`);
let fehler = 0;
for (const w of BREITEN) {
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: w, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  // Eigene Probeelemente statt Seiteninhalt: die Startseite rendert je nach
  // Breite andere Bausteine, ein `querySelector` traf mal ins Leere.
  const ist = await page.evaluate(`(() => {
    const zahl = (v) => Math.round(parseFloat(v));
    const halter = document.createElement('div');
    halter.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden';
    halter.innerHTML = '<div class="grid"></div><div class="container section"></div>' +
      '<div class="tok" style="height:var(--target-min);width:var(--control-h)"></div>';
    document.body.appendChild(halter);
    const [grid, sec, tok] = halter.children;
    const out = {
      gap:       zahl(getComputedStyle(grid).rowGap),
      sectionPt: zahl(getComputedStyle(sec).paddingTop),
      sectionPb: zahl(getComputedStyle(sec).paddingBottom),
      targetMin: zahl(getComputedStyle(tok).height),
      controlH:  zahl(getComputedStyle(tok).width),
    };
    halter.remove();
    return out;
  })()`);
  for (const [k, tabelle] of Object.entries(SOLL)) {
    const ok = ist[k] === tabelle[w];
    if (!ok) fehler++;
    console.log(`${ok ? '  ok ' : ' FEHL'} ${String(w).padStart(4)}px  ${k.padEnd(10)} ${ist[k]} (erwartet ${tabelle[w]})`);
  }
}
await cdp.close();
console.log(fehler ? `\n${fehler} Abweichungen` : '\nAlle Rampen unverändert.');
process.exit(fehler ? 1 : 0);
