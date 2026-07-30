// Misst die gerenderte Grösse des Startseiten-Heros: Breite/Höhe muss 4/3 sein,
// nicht die Originalhöhe (1258 px).
const { launch, openPage, APP_BASE, sleep } = await import('file:///C:/Users/david/Documents/GitHub/service-portal/scripts/lib/cdp.mjs');

const b = await launch({ port: 9341 });
const p = await openPage(b, APP_BASE + '/');
await sleep(1200);
const out = await p.evaluate(`(() => {
    const img = document.querySelector('.home-hero__figure img');
    if (!img) return 'kein Bild';
    const r = img.getBoundingClientRect();
    return JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height),
      ratio: +(r.width / r.height).toFixed(3), src: (img.currentSrc||'').split('/').pop() });
  })()`);
console.log(out);
await b.close();
