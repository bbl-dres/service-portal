// Prozessdokumentation Bauten (js/apps/process-docs.js + data/processes.json +
// assets/bpmn/) — Landkarte (Baum L1→L2, Katalogleiste, Liste), Prozess-Detail
// («Übersicht» mit Metadaten + bpmn-js-Diagramm, «Prozessschritte» aus dem
// BPMN-XML), Deep-Links (?id=, ?tab=), Katalog-/Übersichts-Einbindung.
// Braucht Netzzugang (unpkg.com, bpmn-js) — wie die MapLibre-/Swagger-Suiten.
//
//   node scripts/test-process-docs.mjs        (dev server must be running)
import { readFileSync } from 'node:fs';
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let fail = 0;
const check = (cond, label, detail = '') => {
  console.log(`   ${cond ? '✓' : '✗'} ${label}${detail ? `  (${detail})` : ''}`);
  if (!cond) fail++;
};
const head = (s) => console.log(`■ ${s}`);
const clean = async (p, label) => {
  const errs = await p.problems();
  check(!errs.length, `${label}: keine Fehler`, errs.join(' | '));
};

// Erwartete Schrittzahl node-seitig aus derselben Quelle wie die App: alle
// typisierten Flusselemente (Präfix bpmn:, die BBL-Dateien sind einheitlich).
const STEP_TAGS = ['startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent',
  'boundaryEvent', 'task', 'userTask', 'serviceTask', 'manualTask', 'scriptTask', 'sendTask',
  'receiveTask', 'businessRuleTask', 'callActivity', 'subProcess', 'exclusiveGateway',
  'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway'];
const expectedSteps = (file) => {
  const xml = readFileSync(file, 'utf8');
  return STEP_TAGS.reduce((n, t) => n + (xml.match(new RegExp(`<bpmn:${t}[ >]`, 'g')) || []).length, 0);
};

(async () => {
  const cdp = await launch();
  try {
    // 1) Landkarte ---------------------------------------------------------
    head('Landkarte');
    let p = await openPage(cdp, `${APP_BASE}/app/process-docs`);
    await sleep(1600);
    let o = JSON.parse(await p.evaluate(`JSON.stringify({
      h1: document.querySelector('h1').textContent.trim(),
      count: document.getElementById('pd-count').textContent.replace(/[\\s\\u00a0]+/g, ' ').trim(),
      branches: document.querySelectorAll('.pf-tree__node').length,
      leaves: [...document.querySelectorAll('.pf-tree__leaf .pf-tree__label')].map(x => x.textContent),
      leafCounts: [...document.querySelectorAll('.pf-tree__leaf .pf-tree__n')].map(x => Number(x.textContent)),
      rows: document.querySelectorAll('.pf-main tbody tr').length,
      cols: [...document.querySelectorAll('.pf-main thead th')].map(t => t.textContent.trim()),
    })`));
    check(o.h1 === 'Prozessdokumentation Bauten', 'Seitentitel', o.h1);
    check(/18 von 18 Prozessen/.test(o.count), 'Trefferzahl 18', o.count);
    check(o.branches === 1, 'ein Prozessbereich (L1)', String(o.branches));
    check(o.leaves.length === 5, '5 Prozessgruppen (L2)', o.leaves.join(', '));
    check(o.leafCounts.reduce((a, b) => a + b, 0) === 18, 'Gruppenzähler summieren auf 18', o.leafCounts.join('+'));
    check(o.rows === 12, '12 Zeilen je Seite', String(o.rows));
    check(o.cols.join('|') === 'Nr.|Prozess|Prozessgruppe|Status', 'Spalten der Listenansicht', o.cols.join('|'));
    await clean(p, 'Landkarte');

    // 2) Gruppenfilter über den Baum --------------------------------------
    head('Gruppenfilter (Baum → Hash → Pille)');
    o = JSON.parse(await p.evaluate(`(async () => {
      const a = [...document.querySelectorAll('.pf-tree__leaf')].find(x => /Bewirtschaftung/.test(x.textContent));
      a.click();
      await new Promise(r => setTimeout(r, 800));
      return JSON.stringify({
        hash: location.hash,
        count: document.getElementById('pd-count').textContent.replace(/[\\s\\u00a0]+/g, ' ').trim(),
        pille: (document.querySelector('.active-filter') || {}).textContent,
        aktiv: (document.querySelector('.pf-tree__leaf.is-active .pf-tree__label') || {}).textContent,
      });
    })()`));
    check(/group=bewirtschaftung/.test(o.hash), 'Gruppe steht im Hash', o.hash);
    check(/3 von 18/.test(o.count), 'gefilterte Trefferzahl', o.count);
    check(/Bewirtschaftung/.test(o.pille || ''), 'Filterpille', o.pille);
    check(o.aktiv === 'Bewirtschaftung', 'aktiver Baum-Eintrag', o.aktiv);
    await clean(p, 'Filter');
    await p.closeTarget();

    // 3) Prozess-Detail: Übersicht mit Diagramm ---------------------------
    head('Detail «Übersicht» (Metadaten + BPMN-Diagramm)');
    p = await openPage(cdp, `${APP_BASE}/app/process-docs?id=TQ.21.00.00.02`);
    o = JSON.parse(await p.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      let n = 0; while (!document.querySelector('#pd-bpmn svg .djs-element') && n++ < 200) await s(100);
      await s(300);
      return JSON.stringify({
        h1: document.querySelector('h1').textContent.trim(),
        tabs: [...document.querySelectorAll('.tab__control')].map(b => b.textContent.trim()),
        djs: document.querySelectorAll('#pd-bpmn .djs-element').length,
        lanes: document.querySelectorAll('#pd-bpmn .djs-element[data-element-id^="Lane"], #pd-bpmn .djs-element[data-element-id*="lane"]').length,
        loadingLeft: !!document.querySelector('#pd-bpmn .loading'),
        toolbar: document.querySelectorAll('[data-bpmn]').length,
        dts: [...document.querySelectorAll('.detail-layout dl.kv--ruled dt')].map(d => d.textContent),
        admindir: document.querySelectorAll('a[href*="admindir"]').length,
        statusZeile: (document.querySelector('.detail-layout dl.kv--ruled .small.muted') || {}).textContent || '',
        kontakt: !!document.querySelector('.detail-layout__aside .box'),
      });
    })()`));
    check(o.h1 === 'Machbarkeit Projektdefinition', 'Prozessname als h1', o.h1);
    check(o.tabs.length === 2 && o.tabs[0] === 'Übersicht', 'zwei Register', o.tabs.join(' | '));
    check(/Prozessschritte \(\d+\)/.test(o.tabs[1] || ''), 'Schrittzahl im Registertitel', o.tabs[1]);
    check(o.djs >= 20, 'Diagramm gerendert (bpmn-js)', `${o.djs} Elemente`);
    check(!o.loadingLeft, 'Ladezustand abgeräumt');
    check(o.toolbar === 3, 'Zoomleiste (3 Knöpfe)', String(o.toolbar));
    check(o.dts.includes('Prozessbereich') && o.dts.includes('Prozessgruppe') && o.dts.includes('Status') && o.dts.includes('ID'),
      'Metadaten-Zeilen', o.dts.join(', '));
    check(o.admindir >= 2, 'Verantwortliche als AdminDir-Links', String(o.admindir));
    check(/Freigegeben und aktiv bewirtschaftet/.test(o.statusZeile), 'Status-Definition am Badge', o.statusZeile.slice(0, 60));
    check(o.kontakt, 'Kontakt-Karte in der Randspalte');
    await clean(p, 'Detail');
    await p.closeTarget();

    // 4) Register «Prozessschritte» per Deep-Link -------------------------
    head('Register «Prozessschritte» (?tab=schritte)');
    const want = expectedSteps('assets/bpmn/TQ.21.00.00.02.bpmn');
    p = await openPage(cdp, `${APP_BASE}/app/process-docs?id=TQ.21.00.00.02&tab=schritte`);
    await sleep(1800);
    o = JSON.parse(await p.evaluate(`JSON.stringify({
      aktiv: (document.querySelector('.tab__control--active') || {}).textContent,
      cols: [...document.querySelectorAll('#pd-steps thead th')].map(t => t.textContent.trim()),
      count: (document.getElementById('pd-st-count') || {}).textContent.replace(/[\\s\\u00a0]+/g, ' ').trim(),
      rows: document.querySelectorAll('#pd-steps tbody tr').length,
      facetten: [...document.querySelectorAll('#pd-steps legend')].map(l => l.textContent.trim()),
      rollen: [...document.querySelectorAll('#pd-steps tbody tr')].some(tr => /TQ /.test(tr.textContent)),
    })`));
    check(/Prozessschritte/.test(o.aktiv || ''), 'Register aktiv per Deep-Link', o.aktiv);
    check(o.cols.join('|') === 'Nr.|Schritt|Typ|Rolle', 'Spalten der Schrittliste', o.cols.join('|'));
    check(new RegExp(`${want} von ${want} Schritten`).test(o.count), `Schrittzahl = BPMN-Inhalt (${want})`, o.count);
    check(o.rows === Math.min(want, 15), 'Zeilen der ersten Seite', String(o.rows));
    check(o.facetten.includes('Art') && o.facetten.includes('Rolle'), 'Facetten Art + Rolle', o.facetten.join(', '));
    check(o.rollen, 'Lanes als Rollen in den Zeilen');
    await clean(p, 'Schritte');
    await p.closeTarget();

    // 5) Unbekannte Kennung ------------------------------------------------
    head('Unbekannte Kennung');
    p = await openPage(cdp, `${APP_BASE}/app/process-docs?id=GIBTS-NICHT`);
    await sleep(1200);
    o = JSON.parse(await p.evaluate(`JSON.stringify({
      h1: document.querySelector('h1').textContent.trim(),
      zurueck: !!document.querySelector('a[href="#/app/process-docs"]'),
    })`));
    check(/nicht gefunden/.test(o.h1), 'renderNotFound', o.h1);
    check(o.zurueck, 'Rückweg in die Landkarte');
    await clean(p, 'NotFound');
    await p.closeTarget();

    // 6) Einbindung: Anwendungskatalog + Daten-Übersicht ------------------
    head('Einbindung (Landingpage + Daten-Übersicht)');
    p = await openPage(cdp, `${APP_BASE}/applications/prozessdokumentation`);
    await sleep(1400);
    o = JSON.parse(await p.evaluate(`JSON.stringify({
      h1: document.querySelector('h1').textContent.trim(),
      einstieg: !!document.querySelector('a[href="#/app/process-docs"]'),
    })`));
    check(o.h1 === 'Prozessdokumentation Bauten (Portal)', 'Anwendungs-Landingpage', o.h1);
    check(o.einstieg, 'Einstieg führt in die App');
    await clean(p, 'Landingpage');
    await p.evaluate(`location.hash = '#/data'`);
    await sleep(1200);
    o = JSON.parse(await p.evaluate(`JSON.stringify({
      kachel: [...document.querySelectorAll('a')].some(a => /Prozessdokumentation Bauten/.test(a.textContent)),
    })`));
    check(o.kachel, 'Kachel auf der Daten-Übersicht');
    await clean(p, 'Daten-Übersicht');
    await p.closeTarget();
  } finally {
    cdp.close();
  }
  console.log(`\n${fail ? `✗ ${fail} check(s) FAILED` : '✓ alle Prüfungen bestanden'}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
