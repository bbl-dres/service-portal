import { anchorNavPage } from './anchor-nav.js';
// Since the search overhaul, content lives in js/knowledge-content.js. It has
// two consumers (this page renders it and search indexes it), so it no longer
// belongs in the page module.
import {
  AREAS, FAQS, MULTISPACE_MODULES, sectionDomId,
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
// Most pages are static document directories. The workspace branch owns several
// catalogues and is implemented separately so this module stays focused on the
// knowledge overview and the ordinary subject-area pages.

/** Declare only the catalogues used by the exact workspace route being rendered. */
export function needs(params = []) {
  if (params[0] !== 'workspace') return [];
  const slug = params[1] || '';
  // The workspace hub and both document pages use authored content only.
  if (!slug || slug === 'kreislauf' || slug === 'downloads') return [];
  // The handbook overview pairs each example's authored visualisations with one
  // context photograph; module details need the shop catalogue instead.
  if (slug === 'multispace') {
    if (params.length === 2) return ['multispaceModules', 'media', 'workspaceExamples'];
    if (params.length === 3 && /^modul-[1-9]\d*$/.test(params[2])) {
      return ['multispaceModules', 'shopProducts', 'workspaceExamples'];
    }
    return [];
  }
  if (slug === 'inspiration' && (params.length === 2 || params.length === 3)) {
    return ['media', 'workspaceExamples'];
  }
  return [];
}

export default async function render(ctx) {
  const area = ctx.params[0];
  if (!area) return overview(ctx);
  if (!AREAS[area]) return notFound(ctx);
  if (area === 'workspace') {
    const workspace = await import('./workspace-knowledge.js');
    if (ctx.stale()) return;
    return workspace.default(ctx);
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
      desc: 'Der Ausstattungsstandard Multispace: Module, Ausstattung und illustrative Planungsbeispiele.',
      // Counted from the standard itself, so the tile cannot drift from it when
      // a new edition of the handbook changes the module set.
      meta: `${MULTISPACE_MODULES.length} Module & Vorgaben` },
    { title: AREAS.publishing.title, icon: 'Printer', href: '#/knowledge/publishing',
      desc: 'Auftragsformulare, Preise und Merkblätter der Produktion und der Publikationen.', meta: `${count('publishing')} Unterlagen` },
    { title: AREAS.guides.title, icon: 'Book', href: '#/knowledge/guides',
      desc: 'Kurzanleitungen, Schulungsunterlagen und Lernvideos zur Nutzung des Portals.', meta: `${count('guides')} Unterlagen` },
    // Process documentation moved under the data section (2026-08-13), where it
    // sits with the metadata catalogue it belongs with.
    // The tile stays as a CROSS-REFERENCE — people who learned to look for it
    // here should be carried across, not sent to a dead end.
    { title: 'Dokumentation der Geschäftsarchitektur', icon: 'Share', href: '#/data/architecture',
      desc: 'Die Dokumentation der Geschäftsarchitektur — Prozesse, Geschäftsobjekte und ihre Realisierung.',
      meta: 'In Daten und Digitalisierung' },
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
function areaPage(ctx, area) {
  const { C, setTitle, setCrumbs } = ctx;
  const title = area.title;
  setTitle(title);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Wissen und Hilfsmittel', href: '#/knowledge' },
    { label: title },
  ]);

  // A section is either a document list (`items`), free-form content (`html`),
  // or the FAQ accordion (`faq`); the process page needs all three forms rather
  // than forcing them into a list.
  const sections = area.sections.map(s => ({
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
    title,
    lead: area.lead,
    intro: area.intro,
    sections,
    back: { href: '#/knowledge', label: 'Wissen und Hilfsmittel' },
    beforeSectionsHtml: area === AREAS.guides ? guidesTutorialPlaceholder() : '',
  });
}

// The tutorial is deliberately a non-interactive preview: the prototype has no
// video destination yet, so a button or link would promise an action that does
// not exist. Text, branding, play mark and provider pill remain HTML/CSS rather
// than pixels, making the eventual title or destination change inexpensive.
function guidesTutorialPlaceholder() {
  return `<figure class="tutorial-video">
    <img class="tutorial-video__image"
         src="assets/images/customer-portal-tutorial-placeholder.jpg"
         width="1672" height="941" alt="" loading="eager" decoding="async">
    <span class="tutorial-video__brand" aria-hidden="true">
      <span class="tutorial-video__crest">
        <img src="assets/swiss-logo-flag.svg" alt="">
      </span>
      <span class="tutorial-video__copy">
        <span class="tutorial-video__portal">BBL Kundenportal</span>
        <span class="tutorial-video__title">Einführung ins Kundenportal</span>
      </span>
    </span>
    <span class="tutorial-video__play" aria-hidden="true"></span>
    <span class="tutorial-video__provider" aria-hidden="true">
      <span class="tutorial-video__provider-mark"></span>
      <span>Auf YouTube ansehen</span>
    </span>
    <figcaption class="sr-only">Videoplatzhalter: «Einführung ins Kundenportal», 8 Minuten. Die Vorschau ist im Prototyp noch nicht verlinkt.</figcaption>
  </figure>`;
}

function notFound(ctx) {
  ctx.C.renderNotFound(ctx, { thing: 'Dieses Fachgebiet', title: 'Seite nicht gefunden',
    backHref: '#/knowledge', backLabel: 'Wissen und Hilfsmittel',
    crumbs: [{ label: 'Startseite', href: '#/' }, { label: 'Wissen und Hilfsmittel', href: '#/knowledge' }] });
}
