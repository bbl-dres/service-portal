// Regression checks for W-15 (document-relative anchor scroll-spy positions)
// and W-16 (the current query survives cross-catalogue navigation).
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};

const waitFor = (page, expression) => page.evaluate(`(async () => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  for (let attempt = 0; attempt < 120; attempt++) {
    if (${expression}) return true;
    await sleep(100);
  }
  return false;
})()`);

const activeAnchor = `(document.querySelector('.anchor-nav [data-anchor].menu__item--active') || {}).getAttribute?.('data-anchor') || null`;

(async () => {
  const cdp = await launch();
  try {
    console.log('\n■ anchor navigation');
    const anchorPage = await openPage(cdp, `${APP_BASE}/knowledge/it`);
    await waitFor(anchorPage, `document.querySelectorAll('.anchor-section[id]').length >= 2`);
    const positions = await anchorPage.evaluate(`(() => {
      const sections = [...document.querySelectorAll('.anchor-section[id]')];
      if (sections.length < 2) return null;
      const second = sections[1];
      return {
        first: sections[0].id,
        second: second.id,
        secondTop: second.getBoundingClientRect().top + window.scrollY,
      };
    })()`);
    check(!!positions, 'page exposes at least two anchor sections');
    if (positions) {
      await anchorPage.evaluate(`window.scrollTo(0, ${JSON.stringify(positions.secondTop - 150)})`);
      await sleep(150);
      check(await anchorPage.evaluate(activeAnchor) === positions.first,
        'second section stays inactive before its document-relative threshold');

      await anchorPage.evaluate(`window.scrollTo(0, ${JSON.stringify(positions.secondTop - 100)})`);
      await sleep(150);
      check(await anchorPage.evaluate(activeAnchor) === positions.second,
        'second section becomes active after its document-relative threshold');
    }
    const anchorProblems = await anchorPage.problems();
    check(anchorProblems.length === 0, 'anchor page has no browser errors', anchorProblems[0] || '');
    await anchorPage.closeTarget();

    console.log('\n■ cross-catalogue search');
    const query = 'Bundeshaus West';
    const servicesPage = await openPage(cdp, `${APP_BASE}/services?q=${encodeURIComponent(query)}`);
    await waitFor(servicesPage, `document.body.textContent.includes('Auch in:')`);
    const links = await servicesPage.evaluate(`(() => [...document.querySelectorAll(
        'a[href^="#/applications?q="], a[href^="#/app/document-archive?q="]'
      )]
      .map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim() })))()`);
    check(links.length > 0, 'related catalogue hint renders for a matching query');
    links.forEach(({ href, text }) => {
      const value = new URLSearchParams((href.split('?')[1] || '')).get('q');
      check(value === query, `${text} link preserves the exact query`, href);
    });
    const serviceProblems = await servicesPage.problems();
    check(serviceProblems.length === 0, 'services page has no browser errors', serviceProblems[0] || '');
    await servicesPage.closeTarget();

    console.log('\n■ global-search result targets');
    const searchPage = await openPage(cdp, `${APP_BASE}/search?q=Datenportal`, { login: true });
    await waitFor(searchPage, `[...document.querySelectorAll('.search-result__title')]
      .some(node => node.textContent.trim() === 'Datenportal (Portal)')`);
    const applicationHref = await searchPage.evaluate(`(() => {
      const title = [...document.querySelectorAll('.search-result__title')]
        .find(node => node.textContent.trim() === 'Datenportal (Portal)');
      return title?.closest('a')?.getAttribute('href') || '';
    })()`);
    check(applicationHref === '#/applications/datenportal',
      'application result uses the central detail link', applicationHref);
    await searchPage.evaluate(`location.hash = ${JSON.stringify(applicationHref)}`);
    await waitFor(searchPage, `!!document.querySelector('a[href="#/app/dataportal"]')`);
    check(await searchPage.evaluate(`!!document.querySelector('a[href="#/app/dataportal"]')`),
      'application detail retains its launch target');

    const documentTitle = 'Dokumentenverzeichnis Bundeshaus West';
    await searchPage.evaluate(`location.hash = ${JSON.stringify(`#/search?q=${encodeURIComponent(documentTitle)}`)}`);
    await waitFor(searchPage, `[...document.querySelectorAll('.search-result__title')]
      .some(node => node.textContent.trim() === ${JSON.stringify(documentTitle)})`);
    const documentHref = await searchPage.evaluate(`(() => {
      const title = [...document.querySelectorAll('.search-result__title')]
        .find(node => node.textContent.trim() === ${JSON.stringify(documentTitle)});
      return title?.closest('a')?.getAttribute('href') || '';
    })()`);
    const expectedDocumentHref = `#/app/document-archive?q=${encodeURIComponent(documentTitle)}`;
    check(documentHref === expectedDocumentHref,
      'document result uses the encoded archive-filter link', documentHref);
    await searchPage.evaluate(`location.hash = ${JSON.stringify(documentHref)}`);
    await waitFor(searchPage, `document.querySelector('#doc-q')?.value === ${JSON.stringify(documentTitle)}`);
    const archive = await searchPage.evaluate(`(() => ({
      h1: document.querySelector('h1')?.textContent.trim() || '',
      q: document.querySelector('#doc-q')?.value || '',
      rows: [...document.querySelectorAll('tbody tr')].map(row => row.textContent.trim()),
    }))()`);
    check(archive.h1 === 'Bauwerksdokumentation' && archive.q === documentTitle
      && archive.rows.some(row => row.includes(documentTitle)),
    'document link opens the archive with the exact result filtered in', `${archive.h1}; ${archive.rows.length} row(s)`);
    const searchProblems = await searchPage.problems();
    check(searchProblems.length === 0, 'global search flow has no browser errors', searchProblems[0] || '');
    await searchPage.closeTarget();
  } finally {
    cdp.close();
  }

  console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error('DRIVER ERROR', error);
  process.exit(2);
});
