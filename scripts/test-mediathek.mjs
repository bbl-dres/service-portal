// Mediathek Bauten (js/apps/mediathek.js) — Übersicht, Sortierungen, die drei
// Ansichten und die Detailseite.
//
// Anlass: das Bildregister data/media.json umfasst Gebäude, Grundstücke UND
// Bauprojekte. Ein Medium trägt je nach Bezug buildingId, parcelId oder
// projectId. Die Mediathek las nur buildingId — bei einem Grundstücksbild war
// das null, und `sort=objekt` lief auf `null.localeCompare`. Die Route war
// vollständig kaputt, ohne dass eine Suite es gemerkt hätte.
//
// Darum prüft diese Suite JEDE Sortierung und JEDE Ansicht einzeln: der Fehler
// trat nur bei einer von vier Sortierungen auf.
//
//   node scripts/test-mediathek.mjs      (dev server must be running)
import { readFileSync } from 'node:fs';
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let failures = 0;
const check = (ok, label) => { console.log(`   ${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };

const MEDIEN = JSON.parse(readFileSync(new URL('../data/media.json', import.meta.url), 'utf8'));
const ECHT = MEDIEN.filter((m) => m.file);
console.log(`   (Register: ${MEDIEN.length} Medien, davon ${ECHT.length} mit echter Aufnahme)`);

(async () => {
  const cdp = await launch();
  try {
    const p = await openPage(cdp, `${APP_BASE}/`);
    await sleep(1400);
    await p.evaluate('window.__login && window.__login()');
    await sleep(600);
    const go = async (hash, ms = 2000) => { await p.evaluate(`location.hash='${hash}'`); await sleep(ms); };
    const lies = () => p.evaluate(`(function(){var m=document.querySelector('#main-content');
      return JSON.stringify({
        h1:(document.querySelector('h1')||{}).innerText||'',
        count:(document.querySelector('.catbar__count')||{}).innerText||'',
        karten:document.querySelectorAll('.card').length,
        zeilen:document.querySelectorAll('table tbody tr').length,
        canvas:!!document.querySelector('canvas'),
        leer:/konnte nicht|nicht verf/.test(m.innerText)});})()`);

    console.log('■ Übersicht');
    await go('#/app/mediathek', 2400);
    let r = JSON.parse(await lies());
    check(/Mediathek Bauten/.test(r.h1), `Seitentitel (${r.h1})`);
    check(new RegExp(`^${MEDIEN.length} von ${MEDIEN.length}`).test(r.count), `alle ${MEDIEN.length} Aufnahmen gezählt (${r.count})`);
    check(r.karten > 0 && !r.leer, `Galerie zeigt Karten (${r.karten})`);

    console.log('■ Sortierungen — jede einzeln (der Fehler traf nur eine)');
    for (const s of ['datum-desc', 'datum-asc', 'titel', 'objekt']) {
      await go(`#/app/mediathek?sort=${s}`, 1800);
      const x = JSON.parse(await lies());
      const probleme = await p.problems();
      check(x.karten > 0 && !x.leer && probleme.length === 0,
        `sort=${s} rendert (${x.karten} Karten${probleme.length ? ' — ' + probleme[0] : ''})`);
    }

    console.log('■ Ansichten');
    await go('#/app/mediathek?view=liste', 1800);
    r = JSON.parse(await lies());
    check(r.zeilen > 0, `Liste zeigt Zeilen (${r.zeilen})`);
    await go('#/app/mediathek?view=karte', 3000);
    r = JSON.parse(await lies());
    check(r.canvas, 'Karte rendert');

    console.log('■ Objektbezug über alle Bestandsarten');
    // Je ein Medium mit Gebäude-, Grundstück- und Projektbezug ansteuern.
    for (const [art, feld] of [['Gebäude', 'buildingId'], ['Grundstück', 'parcelId'], ['Bauprojekt', 'projectId']]) {
      const m = MEDIEN.find((x) => x[feld]);
      if (!m) { console.log(`   – kein Medium mit ${feld}`); continue; }
      await go(`#/app/mediathek/${encodeURIComponent(m.mediaId)}`, 2000);
      const x = JSON.parse(await lies());
      const probleme = await p.problems();
      check(!!x.h1 && !x.leer && probleme.length === 0,
        `${art}-Bild ${m.mediaId} öffnet («${x.h1.slice(0, 40)}»)${probleme.length ? ' — ' + probleme[0] : ''}`);
    }

    console.log('■ Echte Aufnahmen werden auch wirklich geladen');
    const echt = ECHT[0];
    await go(`#/app/mediathek/${encodeURIComponent(echt.mediaId)}`, 2200);
    const bild = await p.evaluate(`(function(){
      var i=[].slice.call(document.querySelectorAll('img')).filter(function(x){
        return (x.getAttribute('src')||'').indexOf('assets/images/buildings')>=0;})[0];
      return JSON.stringify({gefunden:!!i, geladen:i?(i.complete&&i.naturalWidth>0):false,
        src:i?i.getAttribute('src'):''});})()`);
    const b = JSON.parse(bild);
    check(b.gefunden && b.geladen, `lokale Datei geladen (${b.src.split('/').pop() || '—'})`);

    check((await p.problems()).length === 0, 'no exceptions / console errors / error banner');
  } finally {
    console.log(failures ? `\n✗ ${failures} check(s) FAILED` : '\n✓ all checks passed');
    process.exit(failures ? 1 : 0);
  }
})();
