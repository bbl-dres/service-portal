// Media-library integration suite: views, sort modes and related-object details.
import { readFileSync } from 'node:fs';
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let failures = 0;
const check = (ok, label) => { console.log(`   ${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };

const media = JSON.parse(readFileSync(new URL('../data/media.json', import.meta.url), 'utf8'));
const localMedia = media.filter((item) => item.file);
console.log(`   (Registry: ${media.length} media records, ${localMedia.length} with local images)`);

(async () => {
  const cdp = await launch();
  try {
    const page = await openPage(cdp, `${APP_BASE}/`);
    await sleep(1400);
    await page.evaluate('window.__login && window.__login()');
    await sleep(600);
    const navigate = async (hash, ms = 2000) => { await page.evaluate(`location.hash='${hash}'`); await sleep(ms); };
    const readView = () => page.evaluate(`(function(){var main=document.querySelector('#main-content');
      return JSON.stringify({
        h1:(document.querySelector('h1')||{}).innerText||'',
        count:(document.querySelector('.catbar__count')||{}).innerText||'',
        cards:document.querySelectorAll('.card').length,
        rows:document.querySelectorAll('table tbody tr').length,
        canvas:!!document.querySelector('canvas'),
        empty:/konnte nicht|nicht verf/.test(main.innerText)});})()`);

    console.log('■ Overview');
    await navigate('#/app/media-library', 2400);
    let result = JSON.parse(await readView());
    check(/Mediathek Bauten/.test(result.h1), `The page has its title (${result.h1})`);
    // Unfiltered the bar states a plain total; the redundant «N von N» is gone
    // (docs/pagination-alignment.md).
    check(new RegExp(`^${media.length} Aufnahmen`).test(result.count), `All ${media.length} records are counted (${result.count})`);
    check(result.cards > 0 && !result.empty, `The gallery renders cards (${result.cards})`);

    console.log('■ Sort modes');
    for (const sort of ['datum-desc', 'datum-asc', 'titel', 'objekt']) {
      await navigate(`#/app/media-library?sort=${sort}`, 1800);
      const view = JSON.parse(await readView());
      const problems = await page.problems();
      check(view.cards > 0 && !view.empty && problems.length === 0,
        `Compatibility sort value ${sort} renders (${view.cards} cards${problems.length ? ' — ' + problems[0] : ''})`);
    }

    console.log('■ Views');
    await navigate('#/app/media-library?view=list', 1800);
    result = JSON.parse(await readView());
    check(result.rows > 0, `The list view renders rows (${result.rows})`);
    await navigate('#/app/media-library?view=map', 3000);
    result = JSON.parse(await readView());
    check(result.canvas, 'The map view renders a canvas');

    console.log('■ Related object types');
    for (const [label, field] of [['Building', 'buildingId'], ['Parcel', 'parcelId'], ['Construction project', 'projectId']]) {
      const item = media.find((entry) => entry[field]);
      if (!item) { console.log(`   – no record with ${field}`); continue; }
      await navigate(`#/app/media-library/${encodeURIComponent(item.mediaId)}`, 2000);
      const view = JSON.parse(await readView());
      const problems = await page.problems();
      check(!!view.h1 && !view.empty && problems.length === 0,
        `${label} image ${item.mediaId} opens (“${view.h1.slice(0, 40)}”)${problems.length ? ' — ' + problems[0] : ''}`);
    }

    console.log('■ Local images');
    const localItem = localMedia[0];
    await navigate(`#/app/media-library/${encodeURIComponent(localItem.mediaId)}`, 2200);
    const imageState = await page.evaluate(`(function(){
      var image=[].slice.call(document.querySelectorAll('img')).filter(function(element){
        return (element.getAttribute('src')||'').indexOf('assets/images/buildings')>=0;})[0];
      return JSON.stringify({found:!!image, loaded:image?(image.complete&&image.naturalWidth>0):false,
        src:image?image.getAttribute('src'):''});})()`);
    const image = JSON.parse(imageState);
    check(image.found && image.loaded, `A local image loads (${image.src.split('/').pop() || '—'})`);

    check((await page.problems()).length === 0, 'No exceptions, console errors or error banner');
  } finally {
    console.log(failures ? `\n✗ ${failures} check(s) failed` : '\n✓ all checks passed');
    process.exit(failures ? 1 : 0);
  }
})();
