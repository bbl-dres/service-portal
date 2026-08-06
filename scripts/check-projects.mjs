// Bauprojekte nach dem Wegfall des Joins: Galerie, Baum, Karte, Detail.
const { launch, openPage, APP_BASE, sleep } = await import('file:///C:/Users/david/Documents/GitHub/service-portal/scripts/lib/cdp.mjs');

const b = await launch({ port: 9351, webgl: true });

const p = await openPage(b, APP_BASE + '/app/projects');
await sleep(2200);
console.log('Übersicht:', await p.evaluate(`(() => {
  const chips = document.querySelector('.pf-card__chips');
  return JSON.stringify({
    karten: document.querySelectorAll('.grid .card').length,
    pillRows: document.querySelectorAll('.grid .pill-row').length,
    chips: [...(chips?.querySelectorAll('.pf-card__land') || [])].map(x => x.textContent),
    erstesBild: !!document.querySelector('.card__image img'),
    baumLaender: [...document.querySelectorAll('.pf-tree > .pf-tree__item > .pf-tree__node .pf-tree__label')].map(x => x.textContent),
    zahl: document.querySelector('#pj-count, .catbar__count')?.textContent.replace(/\\s+/g,' ').trim(),
  });
})()`));
let errs = p.problems ? await p.problems() : [...p.exceptions, ...p.consoleErrors];
console.log('   Fehler:', errs.length ? errs.join(' | ') : 'keine');
console.log('   geladene Datendateien:', await p.evaluate(`JSON.stringify(performance.getEntriesByType('resource').filter(e=>/\\.(json|geojson)/.test(e.name)).map(e=>e.name.split('/').pop()))`));
await p.closeTarget();

const d = await openPage(b, APP_BASE + '/app/projects/PRJ-04');
await sleep(1500);
console.log('\nDetail PRJ-04:', await d.evaluate(`(() => {
  const kv = [...document.querySelectorAll('.kv dt')].map((dt,i) => dt.textContent + ': ' + (document.querySelectorAll('.kv dd')[i]?.textContent.replace(/\\s+/g,' ').trim() || ''));
  return JSON.stringify({ h1: document.querySelector('h1')?.textContent,
    sub: document.querySelector('h1 + p, .mt-4 p.muted')?.textContent.replace(/\\s+/g,' ').trim(),
    bild: !!document.querySelector('.photo img'), kv: kv.slice(0,3) });
})()`));
errs = d.problems ? await d.problems() : [...d.exceptions, ...d.consoleErrors];
console.log('   Fehler:', errs.length ? errs.join(' | ') : 'keine');

// Kartenansicht
await d.evaluate(`location.hash = '#/app/projects?view=map'`);
await sleep(2500);
console.log('\nKarte:', await d.evaluate(`JSON.stringify({ canvas: !!document.querySelector('canvas'), marker: document.querySelectorAll('.maplibregl-marker').length })`));

await b.close();
