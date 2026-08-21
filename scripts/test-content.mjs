// D4 download-item + contact-box unification — verifies the pages that render
// C.downloadItem (foundations, guides, digitalisation docs, application
// entries, my-cases attachments) and C.contactBox (application, services detail)
// still render, with the expected download-items / mailto links and no exceptions.
//
//   node scripts/test-content.mjs      (dev server must be running; see README)
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const ROUTES = [
  { name: 'knowledge/it (subject area)',        url: `${APP_BASE}/knowledge/it`,                items: 1 },
  { name: 'knowledge/guides',                   url: `${APP_BASE}/knowledge/guides`,            items: 1, tutorial: true },
  // The downloads moved to their own page when the area became a drill-down branch: the
  // overview is a hub of cards now, and a hub carries no files.
  { name: 'knowledge/workspace/downloads',      url: `${APP_BASE}/knowledge/workspace/downloads`,
    items: 10, exactItems: true, workspaceDownloads: true },
  { name: 'digitalisation/strategy',            url: `${APP_BASE}/data/digitalisation/strategy`, items: 2 },
  { name: 'applications/property inventory',   url: `${APP_BASE}/applications/liegenschaften-inventar`, items: 1, mailto: true, hero: true },
  { name: 'applications/superb (SAP ERP)',     url: `${APP_BASE}/applications/superb`, items: 2, mailto: true, hero: true, expectedTitle: 'ERP SAP (Supportprozesse)' },
  { name: 'app/workspace (planning)',           url: `${APP_BASE}/app/workspace` },
  { name: 'app/room-booking (form)',            url: `${APP_BASE}/app/room-booking` },
  { name: 'services/report space requirement', url: `${APP_BASE}/services/raumbedarf-melden`,       mailto: true, hero: true },
  { name: 'my-cases/seed-1 (attachments)',     url: `${APP_BASE}/my-cases/seed-1`,                  items: 1, login: true },
];

const PROBE = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; while (!document.querySelector('h1') && n++ < 120) await s(100);
  const h1 = (document.querySelector('h1') || {}).textContent || null;
  const heroMedia = document.querySelector('.hero__image .photo, .hero__image > img, .hero__image figure > img');
  const tutorialImage = document.querySelector('.tutorial-video__image');
  if (tutorialImage?.decode) { try { await tutorialImage.decode(); } catch {} }
  const headings = [...document.querySelectorAll('#main-content h1,#main-content h2,#main-content h3,#main-content h4,#main-content h5,#main-content h6')]
    .filter(el => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; });
  const jumps = []; let prior = 0;
  headings.forEach(el => { const level = Number(el.tagName[1]); if (prior && level > prior + 1) jumps.push(prior + '>' + level); prior = level; });
  return {
    h1,
    notFound: /nicht gefunden/i.test(h1 || ''),
    downloadItems: document.querySelectorAll('.download-item').length,
    downloadHeadings: [...document.querySelectorAll('.download-item__title')].map(el => el.tagName),
    headingJumps: jumps,
    heroRatio: heroMedia ? getComputedStyle(heroMedia).aspectRatio : '',
    mailto: !!document.querySelector('a[href^="mailto:"]'),
    anchorSections: [...document.querySelectorAll('#main-content .anchor-section')].map(section => ({
      id: section.id,
      title: section.querySelector(':scope > h2')?.textContent.trim() || '',
      directList: !!section.querySelector(':scope > .download-items'),
    })),
    toc: [...document.querySelectorAll('#main-content .anchor-nav [data-anchor]')].map(link => ({
      id: link.dataset.anchor || '',
      title: link.textContent.trim(),
    })),
    accordions: document.querySelectorAll('#main-content .accordion').length,
    tutorial: (() => {
      const figure = document.querySelector('.tutorial-video');
      const main = document.querySelector('.container__main');
      if (!figure) return null;
      return {
        firstInMain: main?.firstElementChild === figure,
        imageSrc: tutorialImage?.getAttribute('src') || '',
        imageSize: tutorialImage ? [tutorialImage.naturalWidth, tutorialImage.naturalHeight] : [],
        aspectRatio: getComputedStyle(figure).aspectRatio,
        title: figure.querySelector('.tutorial-video__title')?.textContent.trim() || '',
        provider: figure.querySelector('.tutorial-video__provider')?.textContent.trim() || '',
        hasPlay: !!figure.querySelector('.tutorial-video__play'),
        imageAlt: tutorialImage?.getAttribute('alt'),
        caption: figure.querySelector('figcaption')?.textContent.trim() || '',
        interactive: figure.matches('a,button,iframe,video,[tabindex],[role="button"]')
          || !!figure.querySelector('a,button,iframe,video,[tabindex],[role="button"]'),
      };
    })(),
  };
})()`;

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };

(async () => {
  const cdp = await launch();
  try {
    // openPage sets the session independently for each page (scripts/lib/cdp.mjs):
    // app routes start logged in and all other routes start logged out. Routes
    // outside `#/app/…` that require a session declare `login: true` above.
    // Logging in once on an intermediate page is no longer sufficient.
    for (const route of ROUTES) {
      console.log(`\n■ ${route.name}`);
      const page = await openPage(cdp, route.url, route.login ? { login: true } : {});
      const result = await page.evaluate(PROBE);
      check(result.h1 && !result.notFound, `renders ("${result.h1}")`);
      if (route.expectedTitle) check(result.h1 === route.expectedTitle, `uses the expected title ("${route.expectedTitle}")`);
      if (route.items) check(route.exactItems
        ? result.downloadItems === route.items
        : result.downloadItems >= route.items,
      `${route.exactItems ? '=' : '≥'}${route.items} download-item(s) (got ${result.downloadItems})`);
      if (route.items) check(result.downloadHeadings.every(tag => tag === 'H3'), 'download-item titles use the contextual h3 level');
      if (route.workspaceDownloads) {
        const expectedSections = [
          ['wi-standard-vorgaben', 'Standard und Vorgaben'],
          ['wi-cad-bausteine', 'CAD-Bausteine'],
          ['wi-cad-werkzeuge', 'Werkzeuge für AutoCAD und Revit'],
          ['wi-planungsvorlagen', 'Vorlagen für die Planung'],
        ];
        const gotSections = result.anchorSections.map(({ id, title }) => [id, title]);
        const gotToc = result.toc.map(({ id, title }) => [id, title]);
        check(JSON.stringify(gotSections) === JSON.stringify(expectedSections),
          'downloads render four ordered H2 sections with stable ids');
        check(JSON.stringify(gotToc) === JSON.stringify(expectedSections),
          'the table of contents mirrors every download section exactly once');
        check(result.anchorSections.every((section) => section.directList),
          'each download H2 owns a direct download list');
        check(result.accordions === 0, 'downloads do not reintroduce accordion groups or counts');
      }
      if (route.tutorial) {
        check(result.tutorial?.firstInMain, 'tutorial preview is the first block in the main content column');
        check(result.tutorial?.imageSrc === 'assets/images/customer-portal-tutorial-placeholder.jpg'
          && JSON.stringify(result.tutorial?.imageSize) === JSON.stringify([1672, 941]),
        'tutorial uses the generated local 16:9 background image');
        check(result.tutorial?.aspectRatio === '16 / 9', 'tutorial preview keeps a responsive 16:9 frame');
        check(result.tutorial?.title === 'Einführung ins Kundenportal'
          && result.tutorial?.provider === 'Auf YouTube ansehen' && result.tutorial?.hasPlay,
        'title, provider treatment and play mark are HTML/CSS overlays');
        check(result.tutorial?.imageAlt === '' && result.tutorial?.caption,
          'decorative scene has empty alt text and the figure has a screen-reader caption');
        check(result.tutorial?.interactive === false, 'placeholder exposes no false link or playback control');
      }
      check(result.headingJumps.length === 0, `unbroken heading hierarchy (${result.headingJumps.join(', ') || 'ok'})`);
      if (route.mailto) check(result.mailto === true, 'renders a contact mailto link');
      if (route.hero) check(result.heroRatio === '16 / 9', `consumer declares its hero ratio (${result.heroRatio})`);
      check((await page.problems()).length === 0, `no exceptions / console errors / error banner${(await page.problems())[0] ? ": " + (await page.problems())[0] : ""}`);
      await page.closeTarget();
    }
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
