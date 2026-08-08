// Measure search-route transfer cost with the development server's compression.
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
      total: Math.round(sum(() => true) / 1024),
      data: Math.round(sum(x => /\\.(json|geojson)/.test(x.name)) / 1024),
      files: json.map(x => x.name.split('/').pop() + ':' + Math.round((x.transferSize || 0) / 1024)).join(' '),
    });
  })()`);
  const r = JSON.parse(out);
  console.log(`${route.padEnd(26)} ${String(r.requests).padStart(3)} requests / ${String(r.total).padStart(4)} KB total / ${String(r.data).padStart(4)} KB data`);
  console.log('   ' + r.files);
  await p.closeTarget();
}
await b.close();
