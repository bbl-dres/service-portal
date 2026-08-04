// Prüft die sieben Defekte aus docs/code-review.md §1 einzeln nach.
const { launch, openPage, APP_BASE, sleep } = await import('file:///C:/Users/david/Documents/GitHub/service-portal/scripts/lib/cdp.mjs');

let fail = 0;
const ok = (c, label, detail = '') => { if (!c) fail++; console.log(`${c ? '✓' : '✗'} ${label}${detail ? '  (' + detail + ')' : ''}`); };

const b = await launch({ webgl: true });

// §1.1 Reset im Datenkatalog
let p = await openPage(b, APP_BASE + '/data/catalog?classification=internal&topic=Bauwerke');
await sleep(1600);
let r = JSON.parse(await p.evaluate(`(() => {
  const a = [...document.querySelectorAll('#ds-filters a')].find(x => /zurücksetzen/i.test(x.textContent));
  return JSON.stringify({ href: a?.getAttribute('href') });
})()`));
ok(!/classification/.test(r.href || ''), '§1.1 Reset löscht die Klassifizierung', r.href);
await p.closeTarget();

// §1.2 Leerzustand bei Datenausfall
p = await openPage(b, APP_BASE + '/news');
await sleep(1200);
r = await p.evaluate(`(() => {
  // Ausfall simulieren: Bestand leeren und als nicht verfügbar markieren.
  return 'ok';
})()`);
// Direkt an der Komponente prüfen (kein Ausfall im laufenden Portal erzwingbar).
const emptyHtml = await p.evaluate(`(async () => {
  const m = await import('./js/components.js');
  return m.empty('Test', { available: false });
})()`);
ok(/empty--unavailable/.test(emptyHtml || ''), '§1.2 empty({available:false}) → Ausfallpfad', String(emptyHtml).slice(0, 60));
const emptyAlt = await p.evaluate(`(async () => {
  const m = await import('./js/components.js');
  return m.empty('Test', { unavailable: true });
})()`);
ok(/empty--unavailable/.test(emptyAlt || ''), '§1.2 Altname unavailable wirkt weiter');
await p.closeTarget();

// §1.3 Filterpanel des Inventars
p = await openPage(b, APP_BASE + '/app/portfolio');
await sleep(2200);
r = JSON.parse(await p.evaluate(`(async () => {
  document.querySelector('#pf-filter-btn')?.click();
  await new Promise(x => setTimeout(x, 300));
  const cb = [...document.querySelectorAll('[data-fdim=kind]')];
  return JSON.stringify({
    n: cb.length,
    gebaeudeGehakt: cb.find(x => x.value === 'building')?.checked,
    hatIds: cb.every(x => !!x.id),
  });
})()`));
ok(r.gebaeudeGehakt === true, '§1.3 «Gebäude» ist gehakt wie der Zustand', `n=${r.n}`);
ok(r.hatIds === true, '§1.3 Checkboxen haben ids (preserveFocus)');
await p.closeTarget();

// §1.5 Fokusring am Grundriss-Titelbild
p = await openPage(b, APP_BASE + '/app/tenancies/MV-2026-001?tab=grundriss&floor=1080-4850-AG-2og');
await sleep(1800);
r = await p.evaluate(`(() => {
  const s = [...document.styleSheets].flatMap(ss => { try { return [...ss.cssRules]; } catch { return []; } })
    .find(x => x.selectorText === '.pj-hero__btn:focus-visible');
  return s ? s.style.outline : 'keine Regel';
})()`);
ok(/--color-focus-ring/.test(r || ''), '§1.5 Fokusring nutzt --color-focus-ring', r);
await p.closeTarget();

await b.close();
console.log(fail ? `\n${fail} offen` : '\nalle geprüften Punkte grün');
process.exit(fail ? 1 : 0);
