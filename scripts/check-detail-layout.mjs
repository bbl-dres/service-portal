// Das gemeinsame Detailseiten-Muster: Reiterleiste über die VOLLE
// Containerbreite (fluchtet mit dem Hero darüber), darunter im Reiter
// «Übersicht» die Inhaltsspalte plus die klebende Randspalte mit «Aktionen»
// und «Ansprechpersonen». Geprüft über alle Apps, die das Muster verwenden —
// die Regel heisst Konsistenz, also muss sie überall gleich messbar sein.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const SEITEN = [
  ['Liegenschaften Inventar', `${APP_BASE}/app/portfolio?id=${encodeURIComponent('1080/4840/AF')}`],
  ['Mietende',                `${APP_BASE}/app/tenancies/MV-2026-001`],
  ['Workspace Management',    `${APP_BASE}/app/workspace?id=${encodeURIComponent('1080/6650/AA')}`],
];

const cdp = await launch({ webgl: true });
let fehler = 0;

for (const [name, url] of SEITEN) {
  const page = await openPage(cdp, url);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await sleep(2200);

  const r = await page.evaluate(`(() => {
    const q = (s) => document.querySelector(s);
    const b = (s) => { const e = q(s); return e ? Math.round(e.getBoundingClientRect().width) : null; };
    const aside = q('.detail-layout__aside');
    return {
      hero: b('.pf-mosaic'),
      reiterleiste: b('.tab__controls-container'),
      // Die Randspalte muss IM Übersichtspanel liegen, nicht daneben.
      imPanel: !!q('.tab__container .detail-layout__aside'),
      klebt: aside ? getComputedStyle(aside).position : null,
      karten: [...document.querySelectorAll('.detail-layout__aside .box > h2')].map(h => h.textContent.trim()),
      // Beschriftungen der Aktionszeilen müssen alle an derselben Kante beginnen.
      labelX: [...new Set([...document.querySelectorAll('.detail-layout__aside .fp-svc span:not(.icon)')]
        .map(s => Math.round(s.getBoundingClientRect().left)))],
      luecke: (() => { const k = [...document.querySelectorAll('.detail-layout__aside > .box')];
        return k.length > 1 ? Math.round(k[1].getBoundingClientRect().top - k[0].getBoundingClientRect().bottom) : null; })(),
      // Karte im Hero: Aussenverweis bündig auf der Karte.
      mapLink: q('.pf-hero__maplink a')?.getAttribute('href') || '',
      mapLuecke: (() => { const l = q('.pf-hero__maplink'), m = q('.pf-hero__map');
        return l && m ? Math.round(m.getBoundingClientRect().top - l.getBoundingClientRect().bottom) : null; })(),
    };
  })()`);

  // Auf einem anderen Reiter darf die Randspalte NICHT stehen — dort will die
  // Tabelle die volle Breite.
  const andererReiter = await page.evaluate(`(async () => {
    const t = [...document.querySelectorAll('[role="tab"]')][1];
    if (t) t.click();
    await new Promise(r => setTimeout(r, 500));
    return JSON.stringify({
      reiter: t ? t.textContent.trim() : null,
      aside: !!document.querySelector('.tab__container:not([hidden]) .detail-layout__aside'),
      panelBreite: Math.round(document.querySelector('.tab__container:not([hidden])').getBoundingClientRect().width),
    });
  })()`).then(JSON.parse);

  const p = [
    ['Reiterleiste so breit wie der Hero', r.reiterleiste === r.hero],
    ['Randspalte im Übersichtspanel', r.imPanel],
    ['Randspalte klebt', r.klebt === 'sticky'],
    ['Karten: Aktionen · Ansprechpersonen', r.karten.join(' · ') === 'Aktionen · Ansprechpersonen'],
    ['Abstand zwischen den Karten', r.luecke >= 16],
    ['Aktionsbeschriftungen auf EINER Kante', r.labelX.length === 1],
    ['Kartenverweis auf Google Maps', /google\.com\/maps\/search/.test(r.mapLink)],
    ['Verweisleiste bündig auf der Karte', r.mapLuecke === 0],
    [`«${andererReiter.reiter}» ohne Randspalte, volle Breite`,
      !andererReiter.aside && andererReiter.panelBreite === r.hero],
  ];
  console.log(`\n■ ${name}  (Hero ${r.hero}px · Reiterleiste ${r.reiterleiste}px)`);
  for (const [was, ok] of p) { if (!ok) fehler++; console.log(`${ok ? '  ok ' : ' FEHL'} ${was}`); }
  await page.closeTarget();
}

await cdp.close();
console.log(fehler ? `\n${fehler} Abweichungen` : '\nDas Detailseiten-Muster ist in allen Apps gleich aufgebaut.');
process.exit(fehler ? 1 : 0);
