// Applications: catalogue and landing page for each app.
//
// Same pattern as #/services: search on the left, two filter dropdowns, view
// switcher on the right, active-filter pills, gallery/list and pagination. The
// page always has the same header; «Fachanwendungen Bauten» is a filter state
// (?area=buildings), not a separate page type.
//
// Cards lead to #/applications/<appId>, not directly into the app: each has its
// own entry points, access rules and contacts.


import { APP_AREAS, audienceOptions, audienceLabel, audienceTags } from '../domain.js';
import { bookmarkMark, savedFilterDimension, savedFilterGroup, savedFilterPill, savedOnly } from '../ui/bookmark.js';
import { bookmarks } from '../core/bookmarks.js';

// Deferred datasets for this route. The router calls core.ensure(needs) BEFORE
// render(); without the declaration an accessor would read a still-empty list
// and show «no entries» instead of data (docs/code-review.md §3).
// `users` carries the bookmark seed. Both views of this route read it: the
// catalogue draws a «gemerkt» mark per card and offers the favourites filter,
// and the landing page draws the star. Without the directory the seed cannot
// land (js/core/bookmarks.js seedOnce), so a cold visit straight to this route
// showed a person NONE of their own favourites and an empty favourites filter.
export const needs = ['applications', 'contacts', 'users'];
// 12, matching sibling catalogues: divisible by BOTH 2 and 3 grid columns (B16).
const PER_PAGE = 12;

// Areas live in js/domain.js; the same list drives this filter and the landing-
// page area row (application.js).
const AREAS = APP_AREAS;

// Audience lookups come from js/domain.js and the list itself from
// data/reference-data.json (`audiences`); `audience` is an array (B23).

// Sorting (catbar): empty = default (key apps first, «Sortieren» placeholder).
// Use «Bezeichnung (A–Z)»: canonical «Titel» applies only to title fields (B24).
const SORT_OPTS = [{ value: 'name', label: 'Bezeichnung (A–Z)' }, { value: 'group', label: 'Bereich' }];
const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name, 'de'),
  group: (a, b) => a.group.localeCompare(b.group, 'de') || a.name.localeCompare(b.name, 'de'),
};

export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs } = ctx;
  if (params[0]) {
    // Landing-page content lives on the application record (application.js), so
    // there is no additional dataset; only the module is loaded dynamically.
    const mod = await import('./application.js');
    if (ctx.stale()) return;   // A2: do not overwrite newer navigation after await.
    return mod.default(ctx, params[0]);
  }

  setTitle('Anwendungen');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Anwendungen' },
  ]);

  // Read the catalogue pattern from ONE source (C.catalogueState, B16). Each of
  // four catalogues previously carried ~35 identical parsing/clamping/slicing
  // lines.
  const st = C.catalogueState(query, {
    base: '#/applications', perPage: PER_PAGE,
    sortOpts: SORT_OPTS.map(o => o.value),
    filters: { area: AREAS.map(b => b.key), audience: audienceOptions(core).map(a => a.value),
      ...savedFilterDimension() },
  });
  const { q: rawQ, view, sort: sortKey, hash } = st;
  const q = rawQ.toLowerCase();
  const areas = st.selected.area, audiences = st.selected.audience;
  const saved = savedOnly(st.selected.bookmark);

  const all = core.applications();
  const matches = (a) =>
    (!q || (a.name + ' ' + a.description + ' ' + a.group).toLowerCase().includes(q)) &&
    (!areas.length || areas.includes(a.area)) &&
    (!audiences.length || audiences.some(v => (a.audience || []).includes(v))) &&
    (!saved || bookmarks.has('application', a.appId));

  // Default: key applications first; an explicit sort overrides this.
  const filtered = all.filter(matches);
  const apps = sortKey ? filtered.slice().sort(SORTS[sortKey]) : filtered.slice().sort((a, b) => (b.hero ? 1 : 0) - (a.hero ? 1 : 0));
  const { visible, totalPages, page } = st.clamp(apps);

  // Each pill links to the same view without that one value.
  const active = [
    ...(rawQ ? [{ label: `Suche: «${rawQ}»`, href: hash({ q: '' }) }] : []),
    ...savedFilterPill(st.selected.bookmark, hash),
    ...areas.map(x => ({ label: areaLabel(x), href: hash({ area: areas.filter(y => y !== x) }) })),
    ...audiences.map(x => ({ label: audienceLabel(core, x), href: hash({ audience: audiences.filter(y => y !== x) }) })),
  ];

  const card = (a) => C.card({
    title: a.name,
    desc: a.description,
    href: `#/applications/${encodeURIComponent(a.appId)}`,
    // Images are local and freely licensed under assets/images/applications/
    // (provenance in raw field: `bild`). There is no Unsplash fallback; as with building
    // data, a missing file leaves a colour surface.
    photo: { src: a['bild'] && a['bild'].src, alt: '' },
    // ONE mark, placed by C.card: these cards carry a picture, so it lands in its
    // top left corner — the same corner as the star on the detail hero.
    mark: bookmarkMark({ kind: 'application', id: a.appId }),
    badges: [
      audienceTags(core, C, a.audience),
      ...(a.hero ? [C.badge('Schlüsselanwendung', 'info')] : []),
      ...(a.link && a.link.kind === 'external' ? [C.badge('Externes System', 'gray')] : []),
    ],
    footerInfo: C.escape(a.group), footerAction: C.cardAction(),
  });

  const listView = (rows) => C.table({
    caption: 'Anwendungen',
    zebra: true,
    // The first column is the row link. As in every catalogue list, clicking the
    // whole row follows it (consistent affordance, tbl-8).
    rowsClickable: true,
    columns: [
      { key: 'name', label: 'Anwendung', render: a =>
        `<a href="#/applications/${encodeURIComponent(a.appId)}">${C.escape(a.name)}</a>
         <br><span class="small muted">${C.escape(a.description)}</span>` },
      // Directly after the name, so the marks form ONE column to run an eye
      // down. Inline behind each title they would land at a different x on every
      // row, which is reading, not scanning. `Favorit` names the column and the
      // mark names the value, so a row announces «Favorit: Gemerkt».
      { key: 'bookmark', label: 'Favorit', labelHidden: true, align: 'center',
        render: a => bookmarkMark({ kind: 'application', id: a.appId }) },
      { key: 'group', label: 'Bereich', render: a => C.escape(a.group) },
      { key: 'audience', label: 'Zielgruppe', render: a => audienceTags(core, C, a.audience) },
      { key: 'link', label: 'Einstieg', render: a =>
        a.link && a.link.kind === 'external' ? C.badge('Externes System', 'gray') : C.badge('Im Kundenportal', 'blue') },
    ],
    rows,
  });

  // The page anatomy, its element ids and its wiring all come from C.catalogueView
  // (js/ui/components/catalogue.js); what stays here is what actually differs
  // between the three catalogues — wording, filters and the two renderers.
  const catalogue = C.catalogueView({
    prefix: 'app', hash, noun: 'Anwendung', unit: 'Anwendungen',
    title: 'Anwendungen',
    lead: 'Alle Anwendungen des BBL an einem Ort — von den Fachanwendungen für Bauten über Logistik bis zu den zentralen Systemen der Bundesverwaltung.',
    q: rawQ, view, views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List']],
    page, totalPages, sort: { value: sortKey, options: SORT_OPTS },
    count: apps.length, total: all.length,
    filterCount: areas.length + audiences.length + (saved ? 1 : 0),
    panel: `
      ${/* Favourites first: it is the only filter about the READER rather than
            about the catalogue, and it narrows hardest. */''}
      ${savedFilterGroup(st.selected.bookmark)}
      ${/* Use navLabel in the filter too. Clicking «Fachanwendungen Bauten»
            previously created a pill labelled «Immobilien & Bau»: two names
            for one value in ONE interaction path (D24). `label` remains the
            group-column value. */''}
      ${C.filterGroup({ dim: 'area', legend: 'Bereich', selected: areas, options: AREAS.map(b => ({ value: b.key, label: b.navLabel })) })}
      ${C.filterGroup({ dim: 'audience', legend: 'Zielgruppe', selected: audiences, options: audienceOptions(core) })}
      ${C.panelReset({ href: hash({ area: [], audience: [], bookmark: [] }) })}`,
    activeFilters: active, resetHref: '#/applications',
    visible, card, listView, available: core.available('applications'),
  });

  mount.innerHTML = catalogue.html;
  catalogue.wire(mount, ctx);
}

function areaLabel(key) { const b = AREAS.find(x => x.key === key); return b ? b.navLabel : key; }
