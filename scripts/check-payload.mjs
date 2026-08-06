// Was kostet die Suchroute jetzt über die Leitung? Gemessen mit den
// Komprimierungseinstellungen des Entwicklungsservers.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const b = await launch({ port: 9347 });
for (const route of ['/', '/search?q=mustervorlage']) {
  const p = await openPage(b, APP_BASE + route);
  await sleep(1600);
  const out = await p.evaluate(`(() => {
    const e = performance.getEntriesByType('resource');
    const sum = (f) => e.filter(f).reduce((n, x) => n + (x.transferSize || 0), 0);
    const json = e.filter(x => /\\.(json|geojson)(\\?|$)/.test(x.name));
    return JSON.stringify({
      requests: e.length,
      alles: Math.round(sum(() => true) / 1024),
      daten: Math.round(sum(x => /\\.(json|geojson)/.test(x.name)) / 1024),
      dateien: json.map(x => x.name.split('/').pop() + ':' + Math.round((x.transferSize || 0) / 1024)).join(' '),
    });
  })()`);
  const r = JSON.parse(out);
  console.log(`${route.padEnd(26)} ${String(r.requests).padStart(3)} Requests · ${String(r.alles).padStart(4)} KB gesamt · ${String(r.daten).padStart(4)} KB Daten`);
  console.log('   ' + r.dateien);
  await p.closeTarget();
}
await b.close();
