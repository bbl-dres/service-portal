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

// The overview leads with one card per sibling page, the way the data and digitalisation
// overviews do. Counts are derived from the fixture and the download groups, so a page
// that gains a module says so without anyone editing a number.
const overview = await page.evaluate(`(async () => {
  const pause = (ms = 800) => new Promise(resolve => setTimeout(resolve, ms));
  location.hash = '#/knowledge/workspace';
  await pause();
  const main = document.querySelector('#main-content');
  return {
    firstHeading: main.querySelector('h2')?.textContent.trim() || '',
    cards: [...main.querySelectorAll('.card')].map(function (card) {
      const iconNode = card.querySelector('.domain-tile__icon .icon');
      const style = iconNode ? (iconNode.getAttribute('style') || '') : '';
      // Parsed by splitting, not by a regex: a pattern containing an escaped slash
      // cannot survive being written inside a template literal, which has already
      // cost this repository three debugging sessions.
      const after = style.split('icons/')[1] || '';
      return {
        icon: after.split('.svg')[0] || '',
        href: card.querySelector('.card__link')?.getAttribute('href') || '',
      };
    }).filter((card) => card.href.startsWith('#/knowledge/workspace/')),
  };
})()`);
check(overview.firstHeading === 'Themen' && overview.cards.length === 4,
  'the overview leads with one card per sibling page',
  `${overview.firstHeading} · ${overview.cards.length} cards`);
check(overview.cards.every((card) => card.icon),
  'every card carries an icon', overview.cards.map((card) => card.icon || '(none)').join(', '));
check(new Set(overview.cards.map((card) => card.href)).size === 4,
  'the cards address four distinct pages', overview.cards.map((card) => card.href).join(' '));

// Downloads are grouped by the moment they are needed, not listed as fourteen files.
const downloads = await page.evaluate(`(async () => {
  const pause = (ms = 800) => new Promise(resolve => setTimeout(resolve, ms));
  location.hash = '#/knowledge/workspace/downloads';
  await pause();
  const main = document.querySelector('#main-content');
  return {
    groups: [...main.querySelectorAll('.accordion__title')].map((node) => node.textContent.trim()),
    items: main.querySelectorAll('.download-items li').length,
    tools: /AutoCAD/.test(main.textContent || '') && /Revit/.test(main.textContent || ''),
  };
})()`);
check(downloads.groups.length === 4 && downloads.items > 0,
  'the download page groups its files in an accordion',
  `${downloads.groups.length} groups · ${downloads.items} files`);
check(downloads.tools, 'the download page offers the planned AutoCAD and Revit tooling');

const catalogue = await page.evaluate(`(async () => {
  const pause = (ms = 800) => new Promise(resolve => setTimeout(resolve, ms));
  location.hash = '#/knowledge/workspace/multispace';
  await pause();
  // The handbook presents the modules as cards, following the wireframe: a full-width
  // grid, not a list inside a document page.
  const links = [...document.querySelectorAll('#main-content .wsm-module-card .card__link')]
    .map((node) => node.getAttribute('href'));
  const photos = document.querySelectorAll('#main-content .wsm-space__photo').length;
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
  'the handbook carries a short gallery of realised spaces and the way to all of them',
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

// Every module page names the realised places that used it, and says so when there are
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
  'a module used by a realised place lists it under Planungsbeispiele',
  `${examples.used.rows} example(s)`);
check(examples.unused.hasSection && examples.unused.rows === 0
  && /Planungsbeispiele/.test(examples.unused.emptyHint),
  'a module with no realised place says so instead of showing an empty section',
  examples.unused.emptyHint.trim());
check(!examples.used.objectObject && !examples.unused.objectObject,
  'no component is called with the wrong argument shape');

// Each module card leads with a picture. Until real photography is dropped into
// assets/images/multispace-modules/, the slot shows the module's own colour — the one the
// plan editor paints its rooms with — so a card still identifies its module instead of
// showing a broken frame.
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
  'the fallback gives each module its own colour rather than one neutral grey',
  `${pictures.distinct} distinct`);
check(pictures.detail && pictures.detailColour === pictures.cardColour,
  'the module detail page shows the same picture as its card',
  `${pictures.cardColour} vs ${pictures.detailColour}`);

// Planungsbeispiele: a gallery of realised places and one page each. The licence check is
// the point of substance — several referenced photographs are marked as not freely
// licensed, so an image must never appear without its licence line.
const examplePages = await page.evaluate(`(async () => {
  const pause = (ms = 900) => new Promise(resolve => setTimeout(resolve, ms));
  const main = () => document.querySelector('#main-content');
  location.hash = '#/knowledge/workspace/inspiration';
  await pause();
  const cards = main().querySelectorAll('.card').length;
  const photos = main().querySelectorAll('.wsm-example__photo').length;
  const scopes = [...main().querySelectorAll('.wsm-example__scope')].map((n) => n.textContent.trim());
  const first = main().querySelector('.card__link');
  const href = first ? first.getAttribute('href') : '';
  location.hash = href.replace(/^#/, '');
  await pause();
  const figures = [...main().querySelectorAll('.wsm-example__figure')];
  const captioned = figures.filter((figure) => {
    const caption = (figure.querySelector('figcaption') || {}).textContent || '';
    return caption.trim().length > 0;
  }).length;
  const detail = {
    sections: [...main().querySelectorAll('h2')].map((n) => n.textContent.trim()),
    figures: figures.length,
    captioned,
    downloads: main().querySelectorAll('.download-items li').length,
    facts: main().querySelectorAll('.kv dt').length,
    objectObject: (main().textContent || '').includes('[object Object]'),
  };
  location.hash = '#/knowledge/workspace/inspiration/gibt-es-nicht';
  await pause();
  const missing = (main().querySelector('h1') || {}).textContent.trim();
  return { cards, photos, scopes, detail, missing };
})()`);
check(examplePages.cards === 4 && examplePages.photos === 4,
  'the gallery shows every realised place with a picture',
  `${examplePages.cards} cards · ${examplePages.photos} photos`);
check(examplePages.scopes.every((scope) => ['Geschoss', 'Zone', 'Raum'].includes(scope)),
  'each card states its scope, because an example is a place and not a building',
  examplePages.scopes.join(', '));
check(examplePages.detail.figures > 0 && examplePages.detail.captioned === examplePages.detail.figures,
  'no photograph appears without its caption and licence',
  `${examplePages.detail.captioned} of ${examplePages.detail.figures}`);
check(examplePages.detail.downloads > 0 && examplePages.detail.facts > 0
  && !examplePages.detail.objectObject,
  'the example page carries its floor plan and its location facts',
  `${examplePages.detail.downloads} plan(s) · ${examplePages.detail.facts} facts`);
check(/nicht gefunden/i.test(examplePages.missing),
  'an unknown example is a not-found page', examplePages.missing);

const problems = await page.problems();
check(problems.length === 0, 'the branch produces no runtime problems', problems.join(' | '));

await cdp.close();
console.log(failures ? `\n✗ ${failures} check(s) FAILED` : '\n✓ all checks passed');
process.exit(failures ? 1 : 0);
