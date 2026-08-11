import { anchorNavPage } from './anchor-nav.js';
// Since the search overhaul, content lives in js/knowledge-content.js. It has
// two consumers (this page renders it and search indexes it), so it no longer
// belongs in the page module.
import {
  AREAS, FAQS, MULTISPACE_MODULES, WORKSPACE_BRANCHES, WORKSPACE_DOWNLOAD_GROUPS, sectionDomId,
} from '../knowledge-content.js';

// Knowledge and resources — the portal's reference layer.
//
// ORGANISED BY SUBJECT AREA (L2), then by material type within it (L3), not the
// other way around. The rationale comes from the legacy inventory
// (docs/legacy-analysis.md): the customer platform NEVER pooled resources. The
// toolkit and templates live under «Informatik», while BKB documents live under
// «Beschaffen». Material belongs to the subject area in which someone is
// working. Demand is also highly concentrated: IT and procurement account for
// 40 of 91 reference documents. Someone ordering furniture never comes here;
// they need a service, not a resource.
//
// L3 entries are sections WITHIN a subject-area page, not separate routes. They
// are facets of a collection, and the CD anchor-navigation layout
// (detailPageAnchorNav) presents them in a sticky table of contents. Separate
// routes would produce pages with three documents.
//
// All pages are DELIBERATELY static: document directories for reading and
// downloading, not queryable collections (docs/sitemap.md §2.4).

/**
 * The module fixture is needed only by the workspace branch.
 *
 * The router calls this before render() touches its first accessor, so the other six
 * subject areas load nothing extra for a catalogue they do not show.
 */
export function needs(params = []) {
  // The module detail page also names the furniture a module is built from, which comes
  // from the shop catalogue — the same products the Plan-Editor places.
  // The handbook page also shows realised spaces, which come from the portal's own media
  // library rather than from invented photography.
  // `workspaceExamples` too: the module pages list the realised places that used a module,
  // and an undeclared collection reads as an empty section rather than as an error — the
  // same way the missing shop categories did.
  return params[0] === 'workspace'
    ? ['multispaceModules', 'shopProducts', 'media', 'workspaceExamples']
    : [];
}

export default async function render(ctx) {
  const area = ctx.params[0];
  if (!area) return overview(ctx);
  if (!AREAS[area]) return notFound(ctx);
  // The workspace area is the one that drills down (see routes.js). Its sections declare
  // a branch and each page renders only its own, so the content stays in one list. An
  // unknown branch is a 404 rather than a silently empty page.
  if (area === 'workspace') {
    const slug = ctx.params[1] || '';
    const branch = WORKSPACE_BRANCHES.find((entry) => entry.slug === slug);
    if (!branch) return notFound(ctx);
    // One module, addressed by its number: #/knowledge/workspace/multispace/modul-2.
    if (slug === 'multispace' && ctx.params[2]) return modulePage(ctx, ctx.params[2]);
    // The handbook is a catalogue, not a document page: full width, the modules as cards,
    // and a short gallery of realised spaces. An anchor-navigation page with a table of
    // contents suited the eight-section version of this area and suits it no longer.
    if (slug === 'multispace') return handbookPage(ctx, branch);
    // The branch overview is a hub: cards to the four sibling pages and nothing else. No
    // table of contents either — there is one section to contend with, and a contents
    // list over a single grid is chrome.
    if (!slug) return branchOverview(ctx);
    return areaPage(ctx, AREAS[area], branch);
  }
  return areaPage(ctx, AREAS[area]);
}

/* ================================ OVERVIEW ================================ */

function overview(ctx) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  setTitle('Wissen und Hilfsmittel');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Wissen und Hilfsmittel' }]);

  // A section may carry `html` or `faq` instead of `items`; counting must not
  // assume a document list.
  const count = (k) => AREAS[k].sections.reduce((n, s) => n + (s.items || []).length, 0);
  const areaTiles = [
    { title: AREAS.it.title, icon: 'Desktop', href: '#/knowledge/it',
      desc: 'Vorgaben, Mustervorlagen, Werkzeugkasten und Rahmenverträge für IKT-Beschaffungen.', meta: `${count('it')} Unterlagen` },
    { title: AREAS.procurement.title, icon: 'Balance', href: '#/knowledge/procurement',
      desc: 'BöB, VöB und WTO-Verfahren, Dokumente der BKB sowie Gesuche und Delegationen.', meta: `${count('procurement')} Unterlagen` },
    { title: AREAS.accommodation.title, icon: 'Building', href: '#/knowledge/accommodation',
      desc: 'Flächenstandards, Nachhaltigkeit, Preise und Formulare rund um Gebäude und Betrieb.', meta: `${count('accommodation')} Unterlagen` },
    { title: AREAS.workspace.title, icon: 'Apps', href: '#/knowledge/workspace',
      desc: 'Der Ausstattungsstandard Multispace: Module, Einrichtungsrichtlinien, Farbkonzept und Plandaten.',
      // Counted from the standard itself, so the tile cannot drift from it when
      // a new edition of the handbook changes the module set.
      meta: `${MULTISPACE_MODULES.length} Module & Vorgaben` },
    { title: AREAS.publishing.title, icon: 'Printer', href: '#/knowledge/publishing',
      desc: 'Auftragsformulare, Preise und Merkblätter der Produktion und der Publikationen.', meta: `${count('publishing')} Unterlagen` },
    { title: AREAS.guides.title, icon: 'Book', href: '#/knowledge/guides',
      desc: 'Kurzanleitungen, Schulungsunterlagen und Lernvideos zur Nutzung des Portals.', meta: `${count('guides')} Unterlagen` },
    { title: AREAS.processes.title, icon: 'InfoCircle', href: '#/knowledge/processes',
      desc: 'Die Prozesslandschaft des BBL im Prozessportal Archimap sowie häufige Fragen (FAQ).',
      meta: 'Prozessportal & FAQ' },
  ].map(C.domainTile).join('');

  mount.innerHTML = `
    ${C.pageSection({
      body: C.pageHeader({
        title: 'Wissen und Hilfsmittel',
        lead: 'Die geltenden Vorgaben, Vorlagen und Formulare — gegliedert nach Fachgebiet, weil Unterlagen dort gebraucht werden, wo man gerade arbeitet.',
      }),
    })}
    ${C.pageSection({ title: 'Fachgebiete', alt: true, body: `<div class="grid grid--responsive-cols-2">${areaTiles}</div>` })}`;
}

/* ============================= SUBJECT-AREA PAGE ========================== */

// One page per subject area, organised internally by material type (L3). The
// anchor navigation's sticky table of contents IS the L3 navigation.
/**
 * The cards on the branch overview, one per sibling page.
 *
 * Icons are chosen for what the page is about, not decoration: the handbook is a book,
 * realised spaces are images, the circular model is the refresh cycle, and the download
 * page is a download. Counts are derived, so a page that gains a module or a file says so
 * without anyone remembering to update a number.
 */
function branchCards(C, fixture) {
  const modules = fixture?.modules?.length || 0;
  const files = WORKSPACE_DOWNLOAD_GROUPS.reduce((sum, group) => sum + group.items.length, 0);
  return [
    { icon: 'Book', title: 'Multispace-Handbuch', href: '#/knowledge/workspace/multispace',
      desc: 'Der Ausstattungsstandard: die Module mit Sub-Modulen und Flächenrichtmassen, die Einrichtungsrichtlinien und das Farbkonzept.',
      meta: `${modules} Module` },
    { icon: 'Image', title: 'Planungsbeispiele', href: '#/knowledge/workspace/inspiration',
      desc: 'Umgesetzte Büroflächen der Bundesverwaltung und der Modulmix, aus dem sie bestehen.',
      meta: 'Referenzen' },
    { icon: 'Refresh', title: 'Kreislaufwirtschaft und Occasionsmobiliar', href: '#/knowledge/workspace/kreislauf',
      desc: 'Wie die standardisierte Raumausstattung bewirtschaftet wird — und was mit ausgedientem Mobiliar geschieht.',
      meta: 'Beschaffung & Rückgabe' },
    { icon: 'Download', title: 'Downloads und Vorlagen', href: '#/knowledge/workspace/downloads',
      desc: 'Handbuch, CAD-Bausteine, Vorlagen und die geplanten Werkzeuge für AutoCAD und Revit.',
      meta: `${files} Unterlagen` },
  ].map(C.domainTile).join('');
}

/** The branch hub: four cards, no sections, no contents list. */
function branchOverview(ctx) {
  const { mount, C, core, setTitle, setCrumbs } = ctx;
  const area = AREAS.workspace;
  setTitle(area.title);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Wissen und Hilfsmittel', href: '#/knowledge' },
    { label: area.title },
  ]);
  mount.innerHTML = `
    ${C.pageSection({ body: C.pageHeader({ title: area.title, lead: area.lead }) })}
    ${C.pageSection({
      title: 'Themen',
      alt: true,
      // Three columns, as the digitalisation overview uses: the same pattern, so the two
      // hubs are recognisably the same kind of page.
      body: `<div class="grid grid--responsive-cols-3">${branchCards(C, core.multispaceModules())}</div>`,
    })}
  `;
}

function areaPage(ctx, area, branch = null) {
  const { C, setTitle, setCrumbs } = ctx;
  const title = branch && branch.slug ? branch.label : area.title;
  setTitle(title);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Wissen und Hilfsmittel', href: '#/knowledge' },
    ...(branch && branch.slug
      ? [{ label: area.title, href: '#/knowledge/workspace' }, { label: branch.label }]
      : [{ label: title }]),
  ]);

  // A section is either a document list (`items`), free-form content (`html`),
  // or the FAQ accordion (`faq`); the process page needs all three forms rather
  // than forcing them into a list.
  const chosen = branch
    ? area.sections.filter((section) => (section.branch || 'overview') === branch.key)
    : area.sections;
  const sections = chosen.map(s => ({
    id: sectionDomId(s.id),
    title: s.title,
    html: [
      s.intro ? `<p class="muted">${C.escape(s.intro)}</p>` : '',
      typeof s.html === 'function' ? s.html(C) : (s.html || ''),
      // Do NOT provide `icon`: C.downloadItem chooses «Download» for a file and
      // «External» for a destination outside the portal. The CD makes exactly
      // this distinction (DownloadItem.vue always carries the Download symbol;
      // external destinations carry External). A generic file symbol would make
      // both look alike.
      // `download` marks a FILE. A portal route is a link, not a download, and
      // `safeResourceUrl` deliberately rejects hash URLs — marking one as a
      // download rendered a working in-portal target as a disabled placeholder
      // instead (measured on the IT page: the incident-reporting service).
      // Placeholder resources keep `href: '#'` and stay disabled, which is the
      // intended prototype behaviour.
      s.items ? `<ul class="download-items">${s.items.map(it => C.downloadItem({
        href: '#', ...it,
        download: !it.external && !String(it.href || '').startsWith('#'),
        wrapLi: true,
      })).join('')}</ul>` : '',
      s.faq ? C.accordion(FAQS.map(f => ({ title: f.q, body: `<p class="m-0">${C.escape(f.a)}</p>` })), { id: 'faq' }) : '',
    ].join(''),
  }));

  anchorNavPage(ctx, {
    // A sub-page is named after itself. Repeating the area title on all five made them
    // look like one page that had lost most of its content.
    title,
    lead: branch && branch.slug ? branch.lead : area.lead,
    intro: branch && branch.slug ? '' : area.intro,
    sections,
    back: branch && branch.slug
      ? { href: '#/knowledge/workspace', label: area.title }
      : { href: '#/knowledge', label: 'Wissen und Hilfsmittel' },
  });
}

/* ========================= MULTISPACE MODULE CATALOGUE ==================== */

/**
 * The realised places that used this module.
 *
 * Derived from `data/workspace-examples.json`, where each example already declares the
 * modules it was built from — a second list of links in the module record would be a copy
 * that drifts. A module with no example says so: an empty section reads as a page that
 * failed to load.
 */
function modulePlanningExamplesHTML(C, core, nr) {
  const examples = (core.workspaceExamples ? core.workspaceExamples() : [])
    .filter((example) => (example.modules || []).includes(Number(nr)));
  if (!examples.length) {
    return C.empty('Noch keine Planungsbeispiele für dieses Modul', {
      hint: 'Sobald eine realisierte Fläche mit diesem Modul erfasst ist, erscheint sie hier.',
      action: { href: INSPIRATION_ROUTE, label: 'Alle Planungsbeispiele' },
    });
  }
  return `<ul class="wsm-references">${examples.map((example) => `<li>
    <strong><a href="${INSPIRATION_ROUTE}/${C.escape(example.slug)}">${C.escape(example.title)}</a></strong>
    <span class="small muted">${C.escape(`${example.scope} · ${example.buildingName} · ${example.completed}`)}</span>
    <span class="wsm-references__modules">${(example.modules || [])
      .map((moduleNr) => C.badge(`M${moduleNr}`, Number(moduleNr) === Number(nr) ? 'info' : 'gray'))
      .join('')}</span>
  </li>`).join('')}</ul>`;
}

/**
 * One module: its sub-modules with the handbook's area guide values, the furniture it is
 * built from, and its layout rules.
 *
 * The element list links REAL products from the shop catalogue — the same items the
 * Plan-Editor places — rather than invented article numbers. Prices are deliberately
 * absent: the handbook marks them confidential.
 */
function modulePage(ctx, slug) {
  const { C, core, setTitle, setCrumbs } = ctx;
  const fixture = core.multispaceModules();
  const nr = Number(String(slug).replace(/^modul-/, ''));
  const module = (fixture?.modules || []).find((entry) => entry.nr === nr);
  if (!module) return notFound(ctx);

  const title = `${module.nr} · ${module.name}`;
  setTitle(title);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Wissen und Hilfsmittel', href: '#/knowledge' },
    { label: 'Arbeitsplätze gestalten', href: '#/knowledge/workspace' },
    { label: 'Multispace-Handbuch', href: MODULE_ROUTE },
    { label: title },
  ]);

  const area = (value) => value == null
    ? '—'
    : `${String(value).replace('.', ',')} m²`;
  const subModules = C.table({
    caption: `Sub-Module von Modul ${module.nr}`,
    showCaption: false,
    columns: [
      { key: 'nr', label: 'Sub-Modul' },
      { key: 'name', label: 'Bezeichnung' },
      { key: 'area', label: 'Flächenrichtmass', align: 'right', render: (row) => area(row.area) },
      { key: 'persons', label: 'Personen', align: 'right', render: (row) => row.persons == null ? '—' : String(row.persons) },
    ],
    rows: module.subModules,
  });

  // The furniture, from the shop catalogue by category. A module names the categories it
  // is built from; the products themselves are the portal's own data.
  const products = (core.shopProducts?.() || [])
    .filter((product) => (module.equipment || []).includes(product.category))
    .slice(0, 8);
  const elements = products.length
    ? C.table({
      caption: `Ausstattung von Modul ${module.nr}`,
      showCaption: false,
      columns: [
        { key: 'name', label: 'Produkt' },
        { key: 'brand', label: 'Marke' },
        { key: 'id', label: 'Katalog-ID', align: 'right' },
      ],
      rows: products,
    })
    : C.empty('Keine Ausstattung verknüpft', {
      hint: 'Für dieses Modul sind im Prototyp keine Produkte aus dem Möbelkatalog erfasst.' });

  const sections = [
    { id: sectionDomId('submodule'), title: 'Sub-Module und Flächenrichtmass',
      html: `${module.figuresVerified === false
        ? `<p class="notification notification--warning">${C.escape(module.figuresNote || '')}</p>` : ''}${subModules}` },
    { id: sectionDomId('elemente'), title: 'Ausstattung',
      html: `${elements}<p class="small muted">${C.escape(fixture.confidentiality || '')}</p>` },
    { id: sectionDomId('richtlinien'), title: 'Einrichtungsrichtlinien',
      html: `<ul class="wsm-rules">${(module.guidelines || [])
        .map((rule) => `<li>${C.escape(rule)}</li>`).join('')}</ul>` },
    { id: sectionDomId('beispiele'), title: 'Planungsbeispiele',
      html: modulePlanningExamplesHTML(C, core, module.nr) },
  ];

  anchorNavPage(ctx, {
    title,
    lead: module.description,
    sections,
    back: { href: MODULE_ROUTE, label: 'Multispace-Handbuch' },
  });
}

/* ============================ MULTISPACE HANDBOOK ======================== */

const MODULE_ROUTE = '#/knowledge/workspace/multispace';
const INSPIRATION_ROUTE = '#/knowledge/workspace/inspiration';

/** The realised spaces shown as examples, keyed to buildings the portal has imagery for. */
const REALISED_SPACES = [
  { buildingId: '1080/4840/AF', title: 'Bundeshaus West — 2. OG',
    meta: 'Erstausstattung 2024 · 23 Arbeitsplätze', modules: [2, 5, 7] },
  { buildingId: '1080/6650/AA', title: 'Fellerstrasse 15 — 4. OG',
    meta: 'Erstausstattung 2023 · 27 Arbeitsplätze', modules: [1, 4, 10] },
  { buildingId: '1080/4100/AC', title: 'Holzikofenweg 36 — 1. OG',
    meta: 'Etappe 1, 2022 · Begegnungszonen', modules: [6, 11] },
];

/** One module as a card: number, name, purpose, and what it is made of. */
function moduleCard(C, module) {
  const areas = module.subModules
    .map((sub) => sub.area)
    .filter((value) => value != null);
  const unique = [...new Set(areas.map((value) => String(value).replace('.', ',')))];
  const measure = unique.length === 0
    ? 'ohne Flächenrichtmass'
    : unique.length === 1 ? `Richtmass ${unique[0]} m²` : 'Richtmass je Sub-Modul';
  const count = module.subModules.length;
  return `<div class="card card--default card--clickable wsm-module-card">
    <div class="card__content"><div class="card__body">
      <span class="wsm-module-card__nr">${C.escape(String(module.nr))}</span>
      <h3 class="card__title"><a class="card__link" href="${MODULE_ROUTE}/modul-${module.nr}">${C.escape(module.name)}</a></h3>
      <p class="card__text">${C.escape(module.summary || module.description)}</p>
    </div>
    <div class="card__footer wsm-module-card__foot">
      <span class="small muted">${C.escape(`${count} Sub-Modul${count === 1 ? '' : 'e'} · ${measure}`)}</span>
      ${C.icon('ArrowRight', 'icon--base')}
    </div></div>
  </div>`;
}

/** A short selection of realised spaces, with the way to all of them. */
function realisedSpacesHTML(C, core, fixture) {
  const byNr = new Map((fixture?.modules || []).map((module) => [module.nr, module]));
  const media = core.media ? core.media() : [];
  const cards = REALISED_SPACES.map((space) => {
    const shot = media.find((item) => item.buildingId === space.buildingId && item.mediaType === 'photo');
    const badges = space.modules
      .map((nr) => byNr.get(nr))
      .filter(Boolean)
      .map((module) => C.badge(`M${module.nr} ${module.name}`, 'gray'))
      .join('');
    return `<div class="card card--default">
      ${shot ? C.photo({ id: shot.photo || shot.file, alt: '', w: 640, h: 360, cls: 'wsm-space__photo' }) : ''}
      <div class="card__content"><div class="card__body">
        <h3 class="card__title">${C.escape(space.title)}</h3>
        <p class="card__text small muted">${C.escape(space.meta)}</p>
        <div class="wsm-space__modules">${badges}</div>
      </div></div>
    </div>`;
  }).join('');
  return `<div class="grid grid--responsive-cols-3">${cards}</div>`;
}

/**
 * The handbook: the standard as a web edition.
 *
 * Full width with two bands, following the data and digitalisation overviews rather than
 * the anchor-navigation document layout the rest of this area uses. What is being read
 * here is a catalogue — eleven modules, each its own page — and a table of contents over
 * three headings was chrome around a grid.
 */
function handbookPage(ctx, branch) {
  const { mount, C, core, setTitle, setCrumbs } = ctx;
  const fixture = core.multispaceModules();
  const modules = fixture?.modules || [];
  setTitle(branch.label);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Wissen und Hilfsmittel', href: '#/knowledge' },
    { label: 'Arbeitsplätze gestalten', href: '#/knowledge/workspace' },
    { label: branch.label },
  ]);

  const guidelines = AREAS.workspace.sections
    .filter((section) => section.branch === 'multispace' && section.id !== 'standard');

  mount.innerHTML = `
    ${C.pageSection({
      body: C.pageHeader({
        title: branch.label,
        lead: `Der Ausstattungsstandard des BBL als Webfassung: ${modules.length} Module, `
          + `Flächenrichtmasse, Ausstattung und Einrichtungsrichtlinien. Stand ${C.escape(fixture.currentEdition || '')} — `
          + 'dieselbe Quelle, die der Plan-Editor für die Modulzuordnung nutzt.',
      }),
    })}
    ${C.pageSection({
      title: `Die ${modules.length} Module`,
      alt: true,
      body: `<p class="muted">Jedes Modul ist eine funktionale und gestalterische Einheit — ein Mix einzelner Modulelemente wird nicht empfohlen.</p>
        <div class="grid grid--responsive-cols-3">${modules.map((module) => moduleCard(C, module)).join('')}</div>`,
    })}
    ${C.pageSection({
      title: 'Planungsbeispiele',
      body: `<p class="muted">Umgesetzte Multispace-Flächen aus dem Portfolio — mit den eingesetzten Modulen verknüpft.</p>
        ${realisedSpacesHTML(C, core, fixture)}`,
      // The section's own action slot, as the landing page's news band uses it: the design
      // system puts «alles anzeigen» at the END of the band, aligned right.
      more: { href: INSPIRATION_ROUTE, label: 'Alle Beispiele anzeigen' },
    })}
    ${guidelines.map((section) => C.pageSection({
      title: section.title,
      alt: true,
      body: `${section.intro ? `<p class="muted">${C.escape(section.intro)}</p>` : ''}${
        typeof section.html === 'function' ? section.html(C) : (section.html || '')}`,
    })).join('')}
  `;
}

function notFound(ctx) {
  ctx.C.renderNotFound(ctx, { thing: 'Dieses Fachgebiet', title: 'Seite nicht gefunden',
    backHref: '#/knowledge', backLabel: 'Wissen und Hilfsmittel',
    crumbs: [{ label: 'Startseite', href: '#/' }, { label: 'Wissen und Hilfsmittel', href: '#/knowledge' }] });
}
