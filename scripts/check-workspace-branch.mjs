// The workspace knowledge branch: five sub-pages and a module catalogue.
//
// The area used to be one page carrying eight sections, an eleven-module catalogue and a
// document library. It is now a drill-down branch, so what needs proving is that each
// sub-page carries only its own sections, that every module opens, and that the handbook's
// confidential figures never reach a page.
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';
import { WORKSPACE_BRANCHES } from '../js/knowledge-content.js';

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};

const cdp = await launch();
const page = await openPage(cdp, `${APP_BASE}/knowledge/workspace`);
await new Promise((resolve) => setTimeout(resolve, 900));

const slugs = WORKSPACE_BRANCHES.map((branch) => branch.slug);
const pages = await page.evaluate(`(async () => {
  const pause = (ms = 700) => new Promise(resolve => setTimeout(resolve, ms));
  const out = [];
  for (const slug of ${JSON.stringify(slugs)}) {
    location.hash = '#/knowledge/workspace' + (slug ? '/' + slug : '');
    await pause();
    const main = document.querySelector('#main-content');
    out.push({
      slug,
      h1: main?.querySelector('h1')?.textContent.trim() || '',
      headings: [...main.querySelectorAll('h2')].map((node) => node.textContent.trim())
        .filter((text) => text !== 'Inhaltsverzeichnis').length,
      confidential: /CHF|Preis pro|Kostenkennwert/.test(main?.textContent || ''),
    });
  }
  return out;
})()`);

WORKSPACE_BRANCHES.forEach((branch, index) => {
  const rendered = pages[index];
  check(rendered.h1 === (branch.slug ? branch.label : 'Arbeitsplätze gestalten') && rendered.headings > 0,
    `«${branch.label}» renders with its own title and at least one section`,
    `${rendered.h1} · ${rendered.headings} sections`);
});
check(pages.every((entry) => !entry.confidential),
  'no page shows a price or a cost figure from the handbook');

// The overview leads with one CD highlight card per sibling page in the dedicated
// four-item grid. The focused suite owns card content and image behavior.
const overview = await page.evaluate(`(async () => {
  const pause = (ms = 800) => new Promise(resolve => setTimeout(resolve, ms));
  location.hash = '#/knowledge/workspace';
  await pause();
  const main = document.querySelector('#main-content');
  const grid = main.querySelector('.grid.grid--items-4.gap--responsive');
  return {
    firstHeading: main.querySelector('h2')?.textContent.trim() || '',
    grid: !!grid,
    cards: [...(grid?.querySelectorAll('.card') || [])].map(function (card) {
      return {
        href: card.querySelector('.card__link')?.getAttribute('href') || '',
        highlight: card.classList.contains('card--highlight'),
      };
    }).filter((card) => card.href.startsWith('#/knowledge/workspace/')),
  };
})()`);
check(overview.firstHeading === 'Themen' && overview.grid && overview.cards.length === 4,
  'the overview leads with one card per sibling page in the CD four-item grid',
  `${overview.firstHeading} · ${overview.cards.length} cards`);
check(overview.cards.every((card) => card.highlight),
  'every branch uses the CD highlight-card variant');
check(new Set(overview.cards.map((card) => card.href)).size === 4,
  'the cards address four distinct pages', overview.cards.map((card) => card.href).join(' '));

// Downloads follow the CD detail-page pattern: one H2 and one direct list per
// planning phase, with the same ordered entries in the table of contents.
const downloads = await page.evaluate(`(async () => {
  const pause = (ms = 800) => new Promise(resolve => setTimeout(resolve, ms));
  location.hash = '#/knowledge/workspace/downloads';
  await pause();
  const main = document.querySelector('#main-content');
  return {
    groups: [...main.querySelectorAll('.anchor-section')].map((section) => ({
      id: section.id,
      title: section.querySelector(':scope > h2')?.textContent.trim() || '',
      directList: !!section.querySelector(':scope > .download-items'),
    })),
    toc: [...main.querySelectorAll('.anchor-nav [data-anchor]')].map((link) => ({
      id: link.dataset.anchor || '',
      title: link.textContent.trim(),
    })),
    items: main.querySelectorAll('.download-items li').length,
    accordions: main.querySelectorAll('.accordion').length,
    tools: /AutoCAD/.test(main.textContent || '') && /Revit/.test(main.textContent || ''),
  };
})()`);
const expectedDownloadGroups = [
  { id: 'wi-standard-vorgaben', title: 'Standard und Vorgaben' },
  { id: 'wi-cad-bausteine', title: 'CAD-Bausteine' },
  { id: 'wi-cad-werkzeuge', title: 'Werkzeuge für AutoCAD und Revit' },
  { id: 'wi-planungsvorlagen', title: 'Vorlagen für die Planung' },
];
check(JSON.stringify(downloads.groups.map(({ id, title }) => ({ id, title })))
  === JSON.stringify(expectedDownloadGroups)
  && downloads.groups.every((group) => group.directList)
  && downloads.items === 10 && downloads.accordions === 0,
  'the download page exposes four ordered H2 sections and ten direct rows without accordions',
  `${downloads.groups.length} groups · ${downloads.items} files`);
check(JSON.stringify(downloads.toc) === JSON.stringify(expectedDownloadGroups),
  'the download table of contents mirrors the four sections exactly');
check(downloads.tools, 'the download page offers the planned AutoCAD and Revit tooling');

const lifecycle = await page.evaluate(`(async () => {
  const pause = (ms = 800) => new Promise(resolve => setTimeout(resolve, ms));
  location.hash = '#/knowledge/workspace/kreislauf';
  await pause();
  const main = document.querySelector('#main-content');
  return {
    sections: [...main.querySelectorAll('.anchor-section')].map((section) => ({
      id: section.id,
      title: section.querySelector(':scope > h2')?.textContent.trim() || '',
    })),
    toc: [...main.querySelectorAll('.anchor-nav [data-anchor]')].map((link) => ({
      id: link.dataset.anchor || '',
      title: link.textContent.trim(),
    })),
  };
})()`);
const lifecycleIds = [
  'wi-occasionsmobiliar', 'wi-lieferung', 'wi-reparaturen', 'wi-rueckgabe',
];
check(JSON.stringify(lifecycle.sections.map((section) => section.id))
  === JSON.stringify(lifecycleIds),
  'the lifecycle page exposes four stable H2 sections in reading order',
  lifecycle.sections.map((section) => section.id).join(' | '));
check(JSON.stringify(lifecycle.toc) === JSON.stringify(lifecycle.sections),
  'the lifecycle table of contents mirrors every section exactly once');

const catalogue = await page.evaluate(`(async () => {
  const pause = (ms = 800) => new Promise(resolve => setTimeout(resolve, ms));
  location.hash = '#/knowledge/workspace/multispace';
  await pause();
  // The handbook presents the modules as cards, following the wireframe: a full-width
  // grid, not a list inside a document page.
  const links = [...document.querySelectorAll('#main-content .wsm-module-card .card__link')]
    .map((node) => node.getAttribute('href'));
  const photos = document.querySelectorAll('#main-content .wsm-example__photo').length;
  const allExamples = /Alle Beispiele anzeigen/.test(document.querySelector('#main-content').textContent || '');
  const visited = [];
  for (const href of links) {
    location.hash = href.replace(/^#/, '');
    await pause(620);
    const main = document.querySelector('#main-content');
    visited.push({
      href,
      h1: main?.querySelector('h1')?.textContent.trim() || '',
      rows: main.querySelectorAll('table tbody tr').length,
      confidential: /CHF|Preis pro|Kostenkennwert/.test(main?.textContent || ''),
    });
  }
  location.hash = '#/knowledge/workspace/multispace/modul-99';
  await pause();
  const unknown = document.querySelector('#main-content h1')?.textContent.trim() || '';
  return { links, visited, unknown, photos, allExamples };
})()`);

check(catalogue.links.length === 11, 'the handbook shows every module as a card',
  `${catalogue.links.length} cards`);
check(catalogue.photos === 3 && catalogue.allExamples,
  'the handbook previews three canonical planning examples and links to all of them',
  `${catalogue.photos} photos · link ${catalogue.allExamples}`);
check(catalogue.visited.every((entry) => /^\d+ · /.test(entry.h1)),
  'every module link opens its own page',
  catalogue.visited.map((entry) => entry.h1).join(' | '));
check(catalogue.visited.every((entry) => entry.rows > 0),
  'every module page states its sub-modules',
  catalogue.visited.map((entry) => entry.rows).join(','));
check(catalogue.visited.every((entry) => !entry.confidential),
  'no module page shows a price or a cost figure');
check(/nicht gefunden/i.test(catalogue.unknown),
  'an unknown module number is a not-found page, not an empty one', catalogue.unknown);

// Every module page names the planning examples that use it, and says so when there are
// none: an empty section reads as a page that failed to load. The relationship is derived
// from the examples, which already declare their modules, so there is no second list.
const examples = await page.evaluate(`(async () => {
  const pause = (ms = 780) => new Promise(resolve => setTimeout(resolve, ms));
  const read = async (nr) => {
    location.hash = '#/knowledge/workspace/multispace/modul-' + nr;
    await pause();
    const main = document.querySelector('#main-content');
    const headings = [...main.querySelectorAll('h2')].map((node) => node.textContent.trim());
    return {
      nr,
      hasSection: headings.includes('Planungsbeispiele'),
      hasOldSection: headings.includes('Weitere Module'),
      rows: main.querySelectorAll('.wsm-references li').length,
      emptyHint: (main.querySelector('.empty__title') || {}).textContent || '',
      // A substring test, not a regex. Written inside a template literal the escaped
      // brackets collapsed into a character CLASS, which matched almost any text and so
      // reported a defect on every page. No regex patterns in probe strings.
      objectObject: (main.textContent || '').includes('[object Object]'),
    };
  };
  return { used: await read(3), unused: await read(5) };
})()`);
check(examples.used.hasSection && !examples.used.hasOldSection && examples.used.rows > 0,
  'a module used by a planning example lists it under Planungsbeispiele',
  `${examples.used.rows} example(s)`);
check(examples.unused.hasSection && examples.unused.rows === 0
  && /Planungsbeispiele/.test(examples.unused.emptyHint),
  'a module with no matching planning example says so instead of showing an empty section',
  examples.unused.emptyHint.trim());
check(!examples.used.objectObject && !examples.unused.objectObject,
  'no component is called with the wrong argument shape');

// The supported workspace-knowledge suite owns decoded image bytes, card/detail source
// parity, and the forced missing-file fallback. This retained structural probe checks
// that every image holder still carries the module colour underneath the illustration,
// so that shared fallback has the intended surface if a request fails.
const pictures = await page.evaluate(`(async () => {
  const pause = (ms = 850) => new Promise(resolve => setTimeout(resolve, ms));
  location.hash = '#/knowledge/workspace/multispace';
  await pause();
  const blocks = [...document.querySelectorAll('#main-content .wsm-module-card__photo')];
  const colours = blocks.map((node) => getComputedStyle(node).backgroundColor);
  const heights = blocks.map((node) => Math.round(node.getBoundingClientRect().height));
  location.hash = '#/knowledge/workspace/multispace/modul-4';
  await pause();
  const detail = document.querySelector('#main-content .wsm-module-detail__photo');
  return {
    blocks: blocks.length,
    distinct: [...new Set(colours)].length,
    collapsed: heights.filter((value) => value === 0).length,
    detail: !!detail,
    detailColour: detail ? getComputedStyle(detail).backgroundColor : '',
    cardColour: colours[3] || '',
  };
})()`);
check(pictures.blocks === 11 && pictures.collapsed === 0,
  'every module card leads with a picture slot that occupies space',
  `${pictures.blocks} slots · ${pictures.collapsed} collapsed`);
check(pictures.distinct === 11,
  'every module image holder retains its own fallback colour',
  `${pictures.distinct} distinct`);
check(pictures.detail && pictures.detailColour === pictures.cardColour,
  'the module detail and card share the same fallback colour',
  `${pictures.cardColour} vs ${pictures.detailColour}`);

// Planungsbeispiele is a catalogue of gallery launchers, not a second layer of
// document pages. The focused browser suite owns modal interaction and rights.
const examplePages = await page.evaluate(`(async () => {
  const pause = (ms = 900) => new Promise(resolve => setTimeout(resolve, ms));
  const main = () => document.querySelector('#main-content');
  location.hash = '#/knowledge/workspace/inspiration';
  await pause();
  const cards = main().querySelectorAll('.card').length;
  const photos = main().querySelectorAll('.wsm-example__photo').length;
  const photoSources = [...main().querySelectorAll('.wsm-example__photo img')]
    .map((image) => image.getAttribute('src') || '');
  const badges = [...main().querySelectorAll('.card')].map((card) =>
    [...card.querySelectorAll('.pill-row .badge__text')].map((node) => node.textContent.trim()));
  const hrefs = [...main().querySelectorAll('.card__link')]
    .map((link) => link.getAttribute('href') || '');
  return { cards, photos, photoSources, badges, hrefs };
})()`);
check(examplePages.cards === 4 && examplePages.photos === 4,
  'the gallery shows every planning example with a picture',
  `${examplePages.cards} cards · ${examplePages.photos} photos`);
check(examplePages.photoSources.length === 4
  && examplePages.photoSources.every((src) => src.startsWith('assets/images/buildings/')),
  'each card cover is the retained real building-context photograph',
  examplePages.photoSources.join(' | '));
check(examplePages.badges.length === 4 && examplePages.badges.every((badges) =>
  ['Geschoss', 'Zone', 'Raum'].includes(badges[0])
    && badges[1] === 'Standortfoto'
    && badges.slice(2).length > 0
    && badges.slice(2).every((badge) => badge.startsWith('M')
      && Number.isInteger(Number(badge.slice(1))))),
  'each card states its scope, context-photo status, and module references',
  examplePages.badges.map((badges) => badges.join(' ')).join(' | '));
check(examplePages.hrefs.length === 4
  && new Set(examplePages.hrefs).size === 4
  && examplePages.hrefs.every((href) => {
    const [path, query = ''] = href.split('?');
    const imageId = new URLSearchParams(query).get('bild') || '';
    return path === '#/knowledge/workspace/inspiration'
      && /^WSE-\d+:MED-\d+$/.test(imageId) && href.includes('%3A');
  }),
  'each example card opens a unique scoped gallery image query',
  examplePages.hrefs.join(' | '));

const problems = await page.problems();
check(problems.length === 0, 'the branch produces no runtime problems', problems.join(' | '));

await cdp.close();
console.log(failures ? `\n✗ ${failures} check(s) FAILED` : '\n✓ all checks passed');
process.exit(failures ? 1 : 0);
