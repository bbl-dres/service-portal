// Browser contract for the Multispace handbook and its local imagery.
//
// The older workspace-branch diagnostic counts `.photo` wrappers. That is useful for
// layout fallback coverage, but a missing file leaves the wrapper in place and removes
// its failed <img>, so it cannot prove that deployable image bytes reached the browser.
import { readFile } from 'node:fs/promises';
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const fixture = JSON.parse(await readFile(
  new URL('../data/multispace-modules.json', import.meta.url), 'utf8'));
const exampleFixture = JSON.parse(await readFile(
  new URL('../data/workspace-examples.json', import.meta.url), 'utf8'));
const mediaFixture = JSON.parse(await readFile(
  new URL('../data/media.json', import.meta.url), 'utf8'));
const modules = fixture.modules || [];
const canonicalExamples = [...(exampleFixture.examples || [])]
  .sort((left, right) => String(right.completed).localeCompare(String(left.completed)));
const previewExamples = canonicalExamples.slice(0, 3);
const mediaById = new Map(mediaFixture.map((media) => [media.mediaId, media]));
const handbookRoute = '#/knowledge/workspace/multispace';
const workspaceRoute = '#/knowledge/workspace';
const inspirationRoute = '#/knowledge/workspace/inspiration';
const missingProbe = 'assets/images/multispace-modules/__missing-image-regression-probe__.jpg';
const scopedGalleryId = (example, imageId) => `${example.exampleId}:${imageId}`;
const galleryHref = (example, imageId = example.contextMediaId) =>
  `${inspirationRoute}?bild=${encodeURIComponent(scopedGalleryId(example, imageId))}`;

let failures = 0;
const runStartedAt = Date.now();
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};
const reportPhase = (label) => console.log(
  `\n■ ${label} (${((Date.now() - runStartedAt) / 1000).toFixed(1)}s elapsed)`,
);

const press = async (cdp, page, key, code, keyCode) => {
  const event = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  const text = key === 'Enter' ? '\r' : '';
  await cdp.send('Input.dispatchKeyEvent', {
    type: text ? 'keyDown' : 'rawKeyDown', ...event,
    ...(text ? { text, unmodifiedText: text } : {}),
  }, page.sessionId);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...event }, page.sessionId);
  await sleep(100);
};

const clickCenter = async (page, selector) => JSON.parse(await page.evaluate(`(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const target = document.querySelector(${JSON.stringify(selector)});
    target?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    await frame();
    await frame();
    const rect = target?.getBoundingClientRect();
    const hit = rect
      ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      : null;
    hit?.click();
    return JSON.stringify({
      found: !!target,
      hitTag: hit?.tagName || '',
      hitClass: hit?.className || '',
      hitHref: hit?.getAttribute?.('href') || '',
    });
  })()`));

const setViewport = async (cdp, page, width) => {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height: 1000, deviceScaleFactor: 1, mobile: width < 768,
  }, page.sessionId);
  await sleep(120);
};

const navigate = async (page, hash, expectedTitle) => {
  await page.evaluate(`location.hash = ${JSON.stringify(hash)}`);
  const ready = await page.waitFor(`location.hash === ${JSON.stringify(hash)}
    && document.querySelector('#main-content h1')?.textContent.trim()
      === ${JSON.stringify(expectedTitle)}`, { timeout: 7000 });
  check(ready, `${hash} renders its expected heading`, expectedTitle);
  return ready;
};

// Lazy images below the fold need to enter the viewport before a load assertion is
// meaningful. Re-read each holder after the event: the shared fallback deliberately
// removes a failed image, and retaining a stale element reference would hide that fact.
const imageStatesFrom = async (page, holderExpression) => JSON.parse(await page.evaluate(`(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const holders = ${holderExpression};
  for (const holder of holders) {
    holder.scrollIntoView({ block: 'center' });
    await wait(25);
  }
  await Promise.all(holders.map(async (holder) => {
    const image = holder.querySelector('img');
    if (image && !image.complete) {
      await Promise.race([
        new Promise((resolve) => {
          if (image.complete) { resolve(); return; }
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        }),
        wait(4000),
      ]);
    }
  }));
  window.scrollTo(0, 0);
  await wait(50);
  return JSON.stringify(holders.map((holder) => {
    const image = holder.querySelector('img');
    const current = image?.currentSrc || image?.src || '';
    let resource;
    try { resource = current ? new URL(current, location.href) : null; } catch { resource = null; }
    return {
      src: image?.getAttribute('src') || '',
      current,
      loaded: !!image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
      naturalWidth: image?.naturalWidth || 0,
      naturalHeight: image?.naturalHeight || 0,
      sameOrigin: !!resource && resource.origin === location.origin,
      path: resource?.pathname || '',
      alt: image?.getAttribute('alt') || '',
      loading: image?.getAttribute('loading') || '',
      fetchPriority: image?.getAttribute('fetchpriority') || '',
      height: Math.round(holder.getBoundingClientRect().height),
      background: getComputedStyle(holder).backgroundColor,
    };
  }));
})()`));

const imageStates = (page, holderSelector) => imageStatesFrom(page,
  `[...document.querySelectorAll(${JSON.stringify(holderSelector)})]`);

const galleryFrameState = async (page) => JSON.parse(await page.evaluate(`(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const image = document.querySelector('.pf-lightbox__img');
  if (image && !image.complete) {
    await Promise.race([
      new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      }),
      wait(4000),
    ]);
  }
  const current = image?.currentSrc || image?.src || '';
  let resource = null;
  try { resource = current ? new URL(current, location.href) : null; } catch { resource = null; }
  const download = document.querySelector('.pf-lightbox [data-el="download"]');
  const mediaLink = document.querySelector('.pf-lightbox [data-el="metalink"]');
  const share = document.querySelector('.pf-lightbox [data-el="share"]');
  return JSON.stringify({
    loaded: !!image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
    src: image?.getAttribute('src') || '',
    path: resource?.pathname || '',
    sameOrigin: !!resource && resource.origin === location.origin,
    alt: image?.getAttribute('alt') || '',
    shareLabel: share?.getAttribute('aria-label') || '',
    shareTitle: share?.getAttribute('title') || '',
    downloadHidden: download?.hidden ?? false,
    downloadHref: download?.getAttribute('href') || '',
    mediaLinkHidden: mediaLink?.hidden ?? false,
    mediaLinkHref: mediaLink?.getAttribute('href') || '',
  });
})()`));

const planningPreview = async (page) => {
  const holderExpression = `(() => {
    const heading = [...document.querySelectorAll('#main-content h2')]
      .find((node) => node.textContent.trim() === 'Planungsbeispiele');
    const section = heading?.closest('section');
    return [...(section?.querySelectorAll('.card') || [])]
      .map((card) => card.querySelector('.photo')).filter(Boolean);
  })()`;
  const pictures = await imageStatesFrom(page, holderExpression);
  const structure = JSON.parse(await page.evaluate(`(() => {
    const heading = [...document.querySelectorAll('#main-content h2')]
      .find((node) => node.textContent.trim() === 'Planungsbeispiele');
    const section = heading?.closest('section');
    const cards = [...(section?.querySelectorAll('.card') || [])];
    const allLink = [...(section?.querySelectorAll('a[href]') || [])]
      .find((link) => /Alle Beispiele anzeigen/.test(link.textContent || ''));
    return JSON.stringify({
      hrefs: cards.map((card) => card.querySelector('.card__link')?.getAttribute('href') || ''),
      badges: cards.map((card) => [...card.querySelectorAll('.pill-row .badge__text')]
        .map((node) => node.textContent.trim())),
      allHref: allLink?.getAttribute('href') || '',
    });
  })()`));
  return { ...structure, pictures };
};

const layoutState = async (page) => JSON.parse(await page.evaluate(`(() => {
  const cards = [...document.querySelectorAll('#main-content .wsm-module-card')];
  return JSON.stringify({
    documentOverflow: Math.max(0,
      document.documentElement.scrollWidth - document.documentElement.clientWidth),
    cardOverflow: cards.reduce((largest, card) => Math.max(largest,
      card.scrollWidth - card.clientWidth), 0),
  });
})()`));

check(modules.length === 11, 'the source fixture exposes the eleven canonical modules',
  `${modules.length} modules`);
check(canonicalExamples.length === 4
  && canonicalExamples.every((example) => example.images?.length === 3
    && example.referenceMediaIds?.includes(example.contextMediaId)
    && mediaById.has(example.contextMediaId)
    && example.images.every((image) => image.kind === 'generated-visualisation'
      && image.imageId && image.src && image.alt && image.caption
      && image.credit && image.license && image.provenance)),
'each planning example owns one context photo and three complete generated visualisations',
canonicalExamples.map((example) => `${example.exampleId}:${example.contextMediaId} + ${example.images
  ?.map((image) => image.imageId).join(',')}`).join(' | '));

const cdp = await launch();
let page;
let freshGalleryPage;
try {
  page = await openPage(cdp, `${APP_BASE}/knowledge/workspace/multispace`);
  await setViewport(cdp, page, 1440);
  await page.waitFor(`document.querySelector('#main-content h1')?.textContent.trim()
    === 'Multispace-Handbuch'`, { timeout: 7000 });

  reportPhase('Handbook images');
  const expectedImages = modules.map((module) => module.images?.[0]?.src || '');
  const expectedRoutes = modules.map((module) => `${handbookRoute}/modul-${module.nr}`);
  const expectedTitles = modules.map((module) => `Modul ${module.nr} · ${module.name}`);
  const expectedPreviewRoutes = previewExamples
    .map((example) => galleryHref(example));
  const expectedPreviewSources = previewExamples
    .map((example) => mediaById.get(example.contextMediaId)?.file || '');
  const expectedPreviewBadges = previewExamples
    .map((example) => [example.scope, 'Standortfoto',
      ...(example.modules || []).map((number) => `M${number}`)]);
  const cards = JSON.parse(await page.evaluate(`JSON.stringify(
    [...document.querySelectorAll('#main-content .wsm-module-card')].map((card) => ({
      href: card.querySelector('.card__link')?.getAttribute('href') || '',
      title: card.querySelector('.card__title')?.textContent.trim() || '',
    })))`));
  const sectionHeadings = JSON.parse(await page.evaluate(`JSON.stringify(
    [...document.querySelectorAll('#main-content h2')]
      .map((heading) => heading.textContent.trim()))`));
  const cardImages = await imageStates(page, '.wsm-module-card__photo');

  check(JSON.stringify(sectionHeadings) === JSON.stringify(['Die 11 Module', 'Planungsbeispiele']),
    'the handbook landing page contains only the module catalogue and planning examples',
    sectionHeadings.join(' | '));
  check(cards.length === 11 && cardImages.length === 11,
    'the handbook renders exactly eleven module cards and image holders',
    `${cards.length} cards / ${cardImages.length} holders`);
  check(JSON.stringify(cards.map((card) => card.href)) === JSON.stringify(expectedRoutes),
    'module links follow canonical numeric route order', cards.map((card) => card.href).join(' | '));
  check(JSON.stringify(cards.map((card) => card.title)) === JSON.stringify(expectedTitles),
    'module cards expose the ordered module number and name',
    cards.map((card) => card.title).join(' | '));
  check(cardImages.length === 11 && cardImages.every((image) => image.loaded),
    'all eleven lazy module images decode',
    cardImages.map((image) => `${image.naturalWidth}×${image.naturalHeight}`).join(', '));
  check(cardImages.every((image) => image.sameOrigin
    && image.src.startsWith('assets/images/multispace-modules/')),
  'every module image is a same-origin local Multispace asset',
  cardImages.map((image) => image.src || '(missing)').join(' | '));
  check(new Set(cardImages.map((image) => image.src)).size === 11
    && JSON.stringify(cardImages.map((image) => image.src)) === JSON.stringify(expectedImages),
  'module image URLs are unique and follow fixture order',
  cardImages.map((image) => image.src || '(missing)').join(' | '));
  check(cardImages.every((image) => image.loading === 'lazy' && !image.fetchPriority),
    'catalogue images retain native lazy loading without high fetch priority',
    cardImages.map((image) => `${image.loading}/${image.fetchPriority || 'normal'}`).join(', '));

  const examples = await planningPreview(page);
  check(examples.hrefs.length === 3
    && JSON.stringify(examples.hrefs) === JSON.stringify(expectedPreviewRoutes),
  'the handbook previews the three newest canonical planning examples',
  examples.hrefs.join(' | '));
  check(JSON.stringify(examples.badges) === JSON.stringify(expectedPreviewBadges),
    'preview cards expose their context-photo status, scope, and module sequence',
    examples.badges.map((badges) => badges.join(' ')).join(' | '));
  check(examples.pictures.length === 3
    && examples.pictures.every((image, index) => image.loaded && image.sameOrigin
      && image.loading === 'lazy' && image.alt === ''
      && image.src === expectedPreviewSources[index]
      && image.src.startsWith('assets/images/buildings/')),
    'the three canonical planning-example cards render their decoded context photos',
    `${examples.pictures.filter((image) => image.loaded).length}/${examples.pictures.length} decoded`);
  check(examples.allHref === inspirationRoute,
    'the separate all-examples link owns the complete inspiration catalogue',
    examples.allHref || '(missing)');

  const desktop = await layoutState(page);
  check(desktop.documentOverflow <= 1 && desktop.cardOverflow <= 1,
    'the handbook stays contained at 1440px',
    `${desktop.documentOverflow}px document / ${desktop.cardOverflow}px card overflow`);

  reportPhase('Keyboard route and module details');
  const focusStart = JSON.parse(await page.evaluate(`(() => {
    const heading = document.querySelector('#main-content h1');
    if (document.activeElement !== heading) heading?.focus();
    return JSON.stringify({
      headingFocused: document.activeElement === heading,
      tag: document.activeElement?.tagName || '',
    });
  })()`));
  check(focusStart.headingFocused, 'keyboard traversal starts at the routed page heading', focusStart.tag);
  await press(cdp, page, 'Tab', 'Tab', 9);
  const tabTarget = JSON.parse(await page.evaluate(`JSON.stringify({
    href: document.activeElement?.getAttribute?.('href') || '',
    inFirstCard: !!document.activeElement?.closest?.('.wsm-module-card'),
  })`));
  check(tabTarget.inFirstCard && tabTarget.href === expectedRoutes[0],
    'Tab reaches the first module card link', tabTarget.href || '(none)');
  await press(cdp, page, 'Enter', 'Enter', 13);
  const firstTitle = `${modules[0].nr} · ${modules[0].name}`;
  const keyboardOpened = await page.waitFor(`location.hash === ${JSON.stringify(expectedRoutes[0])}
    && document.querySelector('#main-content h1')?.textContent.trim()
      === ${JSON.stringify(firstTitle)}`, { timeout: 7000 });
  check(keyboardOpened, 'Enter opens the focused module card', expectedRoutes[0]);

  const detailResults = [];
  for (let index = 0; index < modules.length; index++) {
    const module = modules[index];
    const title = `${module.nr} · ${module.name}`;
    if (index > 0 || !keyboardOpened) await navigate(page, expectedRoutes[index], title);
    const state = (await imageStates(page, '.wsm-module-detail__photo'))[0] || {};
    const caption = await page.evaluate(
      `document.querySelector('.wsm-module-detail__figure figcaption')?.textContent.trim() || ''`);
    const hasGuidelines = await page.evaluate(`
      [...document.querySelectorAll('#main-content h2')]
        .some((heading) => heading.textContent.trim() === 'Einrichtungsrichtlinien')`);
    detailResults.push({
      nr: module.nr,
      src: state.src || '',
      alt: state.alt || '',
      loading: state.loading || '',
      fetchPriority: state.fetchPriority || '',
      caption,
      hasGuidelines,
      loaded: !!state.loaded,
      sameOrigin: !!state.sameOrigin,
    });
  }
  check(detailResults.length === 11 && detailResults.every((entry, index) =>
    entry.loaded && entry.sameOrigin && entry.src === cardImages[index].src
      && entry.alt === (modules[index].images?.[0]?.alt || '')),
  'all eleven module detail heroes decode and match their cards',
  detailResults.map((entry) => `M${entry.nr}:${entry.loaded ? entry.src : 'not decoded'}`).join(' | '));
  check(detailResults.every((entry) => entry.loading === 'eager'
    && entry.fetchPriority === 'high'),
  'every detail hero is eager and high priority',
  detailResults.map((entry) => `${entry.loading}/${entry.fetchPriority}`).join(', '));
  check(detailResults.every((entry, index) => {
    const hero = modules[index].images?.[0] || {};
    return entry.caption.includes(hero.caption || '') && entry.caption.includes(hero.credit || '');
  }), 'every detail hero exposes its caption and credit',
  detailResults.map((entry) => entry.caption || '(missing)').join(' | '));
  check(detailResults.every((entry) => entry.hasGuidelines),
    'module-specific guidelines remain available on every detail page');

  await page.evaluate(`location.hash = '#/knowledge/workspace/multispace/1'`);
  await page.waitFor(`location.hash === '#/knowledge/workspace/multispace/1'
    && document.querySelector('#main-content h1')`, { timeout: 7000 });
  await sleep(100);
  const malformed = JSON.parse(await page.evaluate(`JSON.stringify({
    h1: document.querySelector('#main-content h1')?.textContent.trim() || '',
    hero: !!document.querySelector('.wsm-module-detail__photo'),
  })`));
  check(/nicht gefunden/i.test(malformed.h1) && !malformed.hero,
    'a non-canonical /multispace/1 path is rejected', malformed.h1 || '(missing heading)');
  await navigate(page, `${handbookRoute}/modul-01`, 'Seite nicht gefunden');
  const leadingZeroHero = await page.evaluate(
    `!!document.querySelector('#main-content .wsm-module-detail__photo')`);
  check(!leadingZeroHero, 'a leading-zero module alias is rejected without rendering detail content');

  await navigate(page, inspirationRoute, 'Planungsbeispiele');
  reportPhase('Inspiration galleries');
  const expectedFullExampleRoutes = canonicalExamples.map((example) => galleryHref(example));
  const expectedCoverSources = canonicalExamples
    .map((example) => mediaById.get(example.contextMediaId)?.file || '');
  const exampleCardImages = await imageStates(page, '.wsm-example__photo');
  const galleryCards = JSON.parse(await page.evaluate(`JSON.stringify(
    [...document.querySelectorAll('#main-content .wsm-example-card')].map((card) => ({
      href: card.querySelector('.card__link')?.getAttribute('href') || '',
      dialog: card.querySelector('.card__link')?.getAttribute('aria-haspopup') || '',
      photo: !!card.querySelector('.wsm-example__photo img'),
      badges: [...card.querySelectorAll('.pill-row .badge__text')]
        .map((badge) => badge.textContent.trim()),
    })))`));
  check(galleryCards.length === 4
    && JSON.stringify(galleryCards.map((card) => card.href))
      === JSON.stringify(expectedFullExampleRoutes),
  'all four example cards expose canonical scoped cover-image queries',
  galleryCards.map((card) => card.href).join(' | '));
  check(galleryCards.every((card) => card.dialog === 'dialog' && card.photo
    && card.badges[1] === 'Standortfoto'),
  'each planning example is an explicitly labelled context-photo dialog launcher');
  check(exampleCardImages.length === 4
    && exampleCardImages.every((image, index) => image.loaded && image.sameOrigin
      && image.loading === 'lazy' && image.alt === ''
      && image.src === expectedCoverSources[index]
      && image.src.startsWith('assets/images/buildings/')),
  'all four cards lazily decode their retained building-context photo',
  exampleCardImages.map((image) => image.src || '(missing)').join(' | '));
  const inspirationContract = JSON.parse(await page.evaluate(`JSON.stringify({
    contextLabel: /reales Standortfoto/.test(
      document.querySelector('#main-content')?.textContent || ''),
    disclaimer: /illustrative, nicht verbindliche Visualisierungen/.test(
      document.querySelector('#main-content')?.textContent || ''),
    mediaRequests: performance.getEntriesByType('resource')
      .filter((entry) => {
        try { return new URL(entry.name).pathname.endsWith('/data/media.json'); }
        catch { return false; }
      }).length,
  })`));
  check(inspirationContract.contextLabel && inspirationContract.disclaimer,
    'the inspiration page distinguishes the real context photo from non-binding visualisations');
  check(inspirationContract.mediaRequests === 1,
    'workspace knowledge requests the media registry exactly once for context photography',
    `${inspirationContract.mediaRequests} request(s)`);

  const coverClick = await clickCenter(
    page, '#main-content .wsm-example-card:first-child .wsm-example__photo',
  );
  const coverOpened = await page.waitFor(`document.querySelector('.pf-lightbox[role="dialog"]')
    && new URLSearchParams(location.hash.split('?')[1] || '').get('bild')
      === ${JSON.stringify(scopedGalleryId(canonicalExamples[0], canonicalExamples[0].contextMediaId))}`,
  { timeout: 7000 });
  check(coverClick.found && coverClick.hitHref === expectedFullExampleRoutes[0] && coverOpened,
    'clicking a card cover opens its scoped gallery without leaving the catalogue',
    `${coverClick.hitTag}.${coverClick.hitClass} ${coverClick.hitHref || '(no href)'}`);
  await press(cdp, page, 'Escape', 'Escape', 27);
  await page.waitFor(`!document.querySelector('.pf-lightbox')`);

  for (let exampleIndex = 0; exampleIndex < canonicalExamples.length; exampleIndex++) {
    const example = canonicalExamples[exampleIndex];
    const context = mediaById.get(example.contextMediaId);
    const linkSelector = `#main-content .wsm-example-card:nth-child(${exampleIndex + 1}) .card__link`;
    await page.evaluate(`document.querySelector(${JSON.stringify(linkSelector)})?.focus()`);
    await press(cdp, page, 'Enter', 'Enter', 13);
    const opened = await page.waitFor(`document.querySelector('.pf-lightbox[role="dialog"][aria-modal="true"]')
      && new URLSearchParams(location.hash.split('?')[1] || '').get('bild')
        === ${JSON.stringify(scopedGalleryId(example, example.contextMediaId))}`,
    { timeout: 7000 });
    check(opened, `Enter opens ${example.exampleId} as a modal gallery`);

    const sequence = [await page.evaluate(
      `new URLSearchParams(location.hash.split('?')[1] || '').get('bild') || ''`)];
    const firstFrame = await galleryFrameState(page);
    check(firstFrame.loaded && firstFrame.sameOrigin
      && firstFrame.src === context.file
      && firstFrame.alt === context.title,
    `${example.exampleId} opens its decoded context photo first`,
    `${firstFrame.src || '(missing)'} / ${firstFrame.alt || '(missing alt)'}`);
    const contextDownloadable = /^(?:CC0(?: 1\.0)?|CC BY(?:-SA)? \d(?:\.\d)?)$/i
      .test(String(context.license || '').trim());
    check(firstFrame.shareLabel === 'Bild teilen'
      && firstFrame.shareTitle === 'Teilen'
      && firstFrame.downloadHidden === !contextDownloadable
      && Boolean(firstFrame.downloadHref) === contextDownloadable
      && !firstFrame.mediaLinkHidden
      && firstFrame.mediaLinkHref === `#/app/media-library/${context.mediaId}`,
    `${example.exampleId} retains the context photo's media link and rights policy`,
    `${firstFrame.shareLabel} / download ${firstFrame.downloadHidden ? 'hidden' : 'visible'}`);

    if (exampleIndex === 0) {
      await page.evaluate(`document.querySelector('.pf-lightbox [data-act="meta"]')?.click()`);
      const metadata = JSON.parse(await page.evaluate(`(() => {
        const panel = document.querySelector('.pf-lightbox__meta');
        const values = {};
        panel?.querySelectorAll('dt').forEach((term) => {
          values[term.textContent.trim()] = term.nextElementSibling?.textContent.trim() || '';
        });
        return JSON.stringify({ hidden: panel?.hidden ?? true, values });
      })()`));
      check(!metadata.hidden
        && metadata.values.Bildstatus === 'Standortfoto · keine Abbildung des Raumkonzepts'
        && metadata.values['Medien-ID'] === context.mediaId
        && metadata.values['Fotograf:in'] === context.photographer
        && metadata.values.Lizenz === context.license,
      'the gallery distinguishes and attributes the retained context photograph',
      metadata.values.Bildstatus || '(missing image status)');
    }

    for (let imageIndex = 0; imageIndex < example.images.length; imageIndex++) {
      const expectedImage = example.images[imageIndex];
      const expectedId = scopedGalleryId(example, expectedImage.imageId);
      await press(cdp, page, 'ArrowRight', 'ArrowRight', 39);
      await page.waitFor(`new URLSearchParams(location.hash.split('?')[1] || '').get('bild')
        === ${JSON.stringify(expectedId)}`);
      sequence.push(await page.evaluate(
        `new URLSearchParams(location.hash.split('?')[1] || '').get('bild') || ''`));
      const frame = await galleryFrameState(page);
      check(frame.loaded && frame.sameOrigin
        && frame.src === expectedImage.src && frame.alt === expectedImage.alt
        && frame.downloadHidden && !frame.downloadHref
        && frame.mediaLinkHidden && !frame.mediaLinkHref
        && frame.shareLabel === 'Visualisierung teilen'
        && frame.shareTitle === 'Visualisierung teilen',
      `${example.exampleId} visualisation ${imageIndex + 1} decodes in order without file or media actions`,
      frame.src || '(missing)');

      if (exampleIndex === 0 && imageIndex === 0) {
        const hero = expectedImage;
        const metadata = JSON.parse(await page.evaluate(`(() => {
          const panel = document.querySelector('.pf-lightbox__meta');
          const values = {};
          panel?.querySelectorAll('dt').forEach((term) => {
            values[term.textContent.trim()] = term.nextElementSibling?.textContent.trim() || '';
          });
          return JSON.stringify({ hidden: panel?.hidden ?? true, values });
        })()`));
        check(!metadata.hidden
          && metadata.values.Bildstatus === 'Illustrative, nicht verbindliche Visualisierung'
          && metadata.values.Szenariojahr === String(example.completed)
          && metadata.values.Darstellung === hero.title
          && metadata.values['Bild-ID'] === hero.imageId
          && metadata.values.Bildlegende === hero.caption
          && metadata.values.Urheberschaft === hero.credit
          && metadata.values.Lizenz === hero.license
          && metadata.values.Provenienz === hero.provenance,
        'the gallery exposes complete generated-image status and provenance',
        metadata.values.Bildstatus || '(missing image status)');

        await page.evaluate(`document.querySelector('.pf-lightbox [data-act="share"]')?.click()`);
        const shareModal = JSON.parse(await page.evaluate(`JSON.stringify({
          title: document.querySelector('.modal--xs .modal__title')?.textContent.trim() || '',
          gallery: !!document.querySelector('.pf-lightbox'),
        })`));
        check(shareModal.title === 'Visualisierung teilen' && shareModal.gallery,
          'the share dialog calls generated imagery a visualisation, not an Aufnahme',
          shareModal.title || '(missing title)');
        await page.evaluate(`document.querySelector('.modal--xs [data-modal-close]')?.click()`);
      }
    }
    const expectedSequence = [
      scopedGalleryId(example, example.contextMediaId),
      ...example.images.map((image) => scopedGalleryId(example, image.imageId)),
    ];
    check(JSON.stringify(sequence) === JSON.stringify(expectedSequence),
      `${example.exampleId} preserves context-first then three-visualisation order`,
      sequence.join(' | '));

    await press(cdp, page, 'Escape', 'Escape', 27);
    await page.waitFor(`!document.querySelector('.pf-lightbox')`);
    const closed = JSON.parse(await page.evaluate(`JSON.stringify({
      hash: location.hash,
      activeHref: document.activeElement?.getAttribute?.('href') || '',
      dialog: !!document.querySelector('.pf-lightbox'),
      image: new URLSearchParams(location.hash.split('?')[1] || '').get('bild') || '',
    })`));
    check(!closed.dialog && !closed.image && closed.hash === inspirationRoute
      && closed.activeHref === galleryHref(example),
    `Escape closes ${example.exampleId}, clears only the image query, and restores its trigger`,
    `${closed.hash} / ${closed.activeHref || 'no focus target'}`);
  }

  const directExample = canonicalExamples[0];
  const directImageId = directExample.images[2].imageId;
  const directHash = galleryHref(directExample, directImageId);
  await page.evaluate(`location.hash = ${JSON.stringify(directHash)}`);
  const directOpened = await page.waitFor(`location.hash === ${JSON.stringify(directHash)}
    && document.querySelector('.pf-lightbox [data-act="close"]') === document.activeElement`,
  { timeout: 7000 });
  const directSub = await page.evaluate(
    `document.querySelector('.pf-lightbox__sub')?.textContent.trim() || ''`);
  check(directOpened && /Bild 4 von 4/.test(directSub),
    'a direct image deep link restores the requested gallery position and dialog focus', directSub);
  await press(cdp, page, 'ArrowLeft', 'ArrowLeft', 37);
  const previousId = await page.evaluate(
    `new URLSearchParams(location.hash.split('?')[1] || '').get('bild') || ''`);
  check(previousId === scopedGalleryId(directExample, directExample.images[1].imageId),
    'ArrowLeft updates the shareable query to the previous scoped image', previousId);
  await press(cdp, page, 'Escape', 'Escape', 27);
  const directClosed = JSON.parse(await page.evaluate(`JSON.stringify({
    hash: location.hash,
    h1Focused: document.activeElement === document.querySelector('#main-content h1'),
  })`));
  check(directClosed.hash === inspirationRoute && directClosed.h1Focused,
    'closing a restored deep link returns focus to the routed page heading');

  const formerMediaId = directExample.referenceMediaIds
    .find((mediaId) => mediaId !== directExample.contextMediaId);
  const formerMediaHash = galleryHref(directExample, formerMediaId);
  const canonicalCoverHash = galleryHref(directExample);
  await page.evaluate(`location.hash = ${JSON.stringify(formerMediaHash)}`);
  const mediaAliasOpened = await page.waitFor(`location.hash === ${JSON.stringify(canonicalCoverHash)}
    && document.querySelector('.pf-lightbox[role="dialog"][aria-modal="true"]')`,
  { timeout: 7000 });
  const mediaAliasFrame = await galleryFrameState(page);
  check(mediaAliasOpened && mediaAliasFrame.loaded
    && mediaAliasFrame.src === mediaById.get(directExample.contextMediaId).file,
  'a recognised legacy WSE:MED query canonicalises to the retained context photo',
  `${await page.evaluate('location.hash')} / ${mediaAliasFrame.src || '(missing)'}`);
  await press(cdp, page, 'Escape', 'Escape', 27);

  const legacyHash = `${inspirationRoute}/${directExample.slug}`;
  const legacyTarget = galleryHref(directExample);
  await page.evaluate(`location.hash = ${JSON.stringify(legacyHash)}`);
  const legacyOpened = await page.waitFor(`location.hash === ${JSON.stringify(legacyTarget)}
    && document.querySelector('.pf-lightbox')`, { timeout: 7000 });
  check(legacyOpened, 'a valid legacy example slug normalises to its scoped cover gallery',
    await page.evaluate('location.hash'));
  await press(cdp, page, 'Escape', 'Escape', 27);

  await navigate(page, `${inspirationRoute}/gibt-es-nicht`, 'Seite nicht gefunden');
  const invalidClean = await page.evaluate(`!document.querySelector('.pf-lightbox')`);
  check(invalidClean, 'an unknown legacy example route renders a local 404 without a gallery');
  await navigate(page, `${inspirationRoute}/${directExample.slug}/extra`, 'Seite nicht gefunden');
  const surplusClean = await page.evaluate(`!document.querySelector('.pf-lightbox')`);
  check(surplusClean, 'a surplus inspiration path renders a local 404 without a gallery');

  freshGalleryPage = await openPage(cdp,
    `${APP_BASE}/knowledge/workspace/inspiration?bild=${encodeURIComponent(
      scopedGalleryId(directExample, directExample.contextMediaId),
    )}`);
  const freshOpened = await freshGalleryPage.waitFor(
    `document.querySelector('.pf-lightbox[role="dialog"][aria-modal="true"]')`,
    { timeout: 7000 },
  );
  check(freshOpened, 'a fresh knowledge-route deep link opens without visiting an app first');
  for (const width of [320, 768, 1440]) {
    await setViewport(cdp, freshGalleryPage, width);
    const overlayLayout = JSON.parse(await freshGalleryPage.evaluate(`(() => {
      const overlay = document.querySelector('.pf-lightbox');
      const rect = overlay?.getBoundingClientRect();
      return JSON.stringify({
        position: overlay ? getComputedStyle(overlay).position : '',
        left: Math.round(rect?.left || 0),
        top: Math.round(rect?.top || 0),
        right: Math.round((innerWidth - (rect?.right || 0))),
        bottom: Math.round((innerHeight - (rect?.bottom || 0))),
        documentOverflow: Math.max(0,
          document.documentElement.scrollWidth - document.documentElement.clientWidth),
        portfolioStyle: !!document.querySelector('link[href*="css/apps/portfolio.css"]'),
      });
    })()`));
    check(overlayLayout.position === 'fixed'
      && Math.max(Math.abs(overlayLayout.left), Math.abs(overlayLayout.top),
        Math.abs(overlayLayout.right), Math.abs(overlayLayout.bottom)) <= 1
      && overlayLayout.documentOverflow <= 1 && !overlayLayout.portfolioStyle,
    `the shared gallery fills a fresh ${width}px knowledge viewport without portfolio CSS`,
    JSON.stringify(overlayLayout));
  }
  const freshProblems = await freshGalleryPage.problems();
  check(freshProblems.length === 0, 'the fresh gallery route produces no browser problems',
    freshProblems.join(' | '));

  reportPhase('Responsive containment');
  for (const width of [320, 768]) {
    await navigate(page, handbookRoute, 'Multispace-Handbuch');
    await setViewport(cdp, page, width);
    const catalogueLayout = await layoutState(page);
    check(catalogueLayout.documentOverflow <= 1 && catalogueLayout.cardOverflow <= 1,
    `the handbook stays contained at ${width}px`,
    `${catalogueLayout.documentOverflow}px document / ${catalogueLayout.cardOverflow}px card overflow`);
    await navigate(page, expectedRoutes[0], firstTitle);
    const detailLayout = await layoutState(page);
    check(detailLayout.documentOverflow <= 1,
      `a module detail stays contained at ${width}px`, `${detailLayout.documentOverflow}px overflow`);
  }
  await setViewport(cdp, page, 1440);
  await navigate(page, handbookRoute, 'Multispace-Handbuch');

  const normalProblems = await page.problems();
  check(normalProblems.length === 0, 'normal handbook and detail routes produce no browser problems',
    normalProblems.join(' | '));

  reportPhase('Safe image fallback');
  const fallback = JSON.parse(await page.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const holder = document.querySelector('.wsm-module-card__photo');
    const image = holder?.querySelector('img');
    const before = holder ? getComputedStyle(holder).backgroundColor : '';
    if (image) image.src = ${JSON.stringify(missingProbe)};
    const deadline = performance.now() + 4000;
    while (holder?.querySelector('img') && performance.now() < deadline) await wait(40);
    const link = holder?.closest('.wsm-module-card')?.querySelector('.card__link');
    return JSON.stringify({
      holder: !!holder,
      imageRemoved: !!holder && !holder.querySelector('img'),
      height: Math.round(holder?.getBoundingClientRect().height || 0),
      before,
      after: holder ? getComputedStyle(holder).backgroundColor : '',
      href: link?.getAttribute('href') || '',
    });
  })()`));
  check(fallback.holder && fallback.imageRemoved && fallback.height > 0
    && fallback.before === fallback.after && fallback.href === expectedRoutes[0],
  'a failed card image leaves a coloured, sized card with its link intact',
  `${fallback.height}px / ${fallback.after} / ${fallback.href}`);

  // Drain only the deliberate missing-resource probe before restoring the normal page.
  // CDP normally reports resource failures through Network rather than console.error,
  // but fail if the fallback produced an application exception or error banner.
  const fallbackProblems = await page.problems();
  const unexpectedFallbackProblems = fallbackProblems.filter((problem) =>
    !problem.includes('__missing-image-regression-probe__')
      && !/Failed to load resource/i.test(problem));
  check(unexpectedFallbackProblems.length === 0,
    'the deliberate image failure produces no application-level problem',
    unexpectedFallbackProblems.join(' | '));

  await navigate(page, workspaceRoute, 'Arbeitsplätze gestalten');
  await navigate(page, handbookRoute, 'Multispace-Handbuch');
  const restored = (await imageStates(page, '.wsm-module-card__photo'))[0] || {};
  check(restored.loaded && restored.src === expectedImages[0],
    'a fresh render restores the canonical first image', restored.src || '(missing)');
  const restoredProblems = await page.problems();
  check(restoredProblems.length === 0, 'the restored handbook is browser-clean',
    restoredProblems.join(' | '));
} finally {
  try { await freshGalleryPage?.closeTarget(); } catch { /* browser may already be closed */ }
  try { await page?.closeTarget(); } catch { /* browser may already be closed */ }
  await cdp.close();
}

console.log(failures ? `\n✗ ${failures} check(s) FAILED` : '\n✓ all checks passed');
process.exit(failures ? 1 : 0);
