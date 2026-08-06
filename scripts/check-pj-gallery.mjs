// Titelbild + Vollbildgalerie eines Bauprojekts (Medien aus data/projects.json).
const { launch, openPage, APP_BASE, sleep } = await import('file:///C:/Users/david/Documents/GitHub/service-portal/scripts/lib/cdp.mjs');

const b = await launch({ port: 9352 });
for (const id of ['PRJ-04', 'PRJ-02']) {
  const p = await openPage(b, APP_BASE + `/app/projects/${id}`);
  await sleep(1400);
  console.log(id, await p.evaluate(`(() => {
    const btn = document.querySelector('.pj-hero__btn');
    return JSON.stringify({
      knopf: !!btn, aria: btn?.getAttribute('aria-label'),
      legende: document.querySelector('.pj-hero .legend')?.textContent.replace(/\\s+/g,' ').trim(),
      bild: !!document.querySelector('.photo img'),
    });
  })()`));
  if (id === 'PRJ-04') {
    const g = await p.evaluate(`(async () => {
      document.querySelector('.pj-hero__btn').click();
      await new Promise(r => setTimeout(r, 500));
      const ov = document.querySelector('.pf-lightbox');
      const n = document.body.textContent.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
      return JSON.stringify({ overlay: !!ov, zaehler: n, hash: location.hash });
    })()`);
    console.log('   Galerie geöffnet:', g);
    await p.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  }
  const errs = p.problems ? await p.problems() : [...p.exceptions, ...p.consoleErrors];
  console.log('   Fehler:', errs.length ? errs.join(' | ') : 'keine');
  await p.closeTarget();
}
await b.close();
