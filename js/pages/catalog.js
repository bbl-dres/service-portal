// Data access — dataset catalogue (DCAT-AP-CH).
// Uses the same pattern as #/services: search on the left, filter dropdowns and
// the view switcher on the right, active filters as pills, gallery/list views,
// and a detail view at #/data/catalog/<id>. The data model and preview images
// come from the data catalogue prototype (data/datasets.json).

// 12, matching the sibling catalogues (B16).
const PER_PAGE = 12;
const NO_RESPONSIBLE_PERSON_MESSAGE = 'Für diesen Datensatz ist keine verantwortliche Person hinterlegt.';

// The parent data route contract in data.js declares the collection because the
// router only reaches this module through its delegate. This delegated module
// therefore has no `needs` export of its own.

export function catalog(ctx) {
  const { params } = ctx;
  return params[1] ? detail(ctx, params[1]) : list(ctx);
}

// ============================== LIST ===============================

function list(ctx) {
  const { mount, core, C, query, setTitle, setCrumbs } = ctx;
  setTitle('Datenbezug und API Verzeichnis');
  setCrumbs(crumbs());

  const all = core.datasets();
  const t = core.t;

  // Read the catalogue pattern's state from ONE source (C.catalogueState, B16).
  const state = C.catalogueState(query, {
    base: '#/data/catalog', perPage: PER_PAGE,
    sortOpts: ['title', 'thema', 'date'],
    filters: { topic: null, classification: null, tag: null },
  });
  const { q: rawQ, view, hash } = state;
  const q = rawQ.toLowerCase();
  const topics = state.selected.topic, classifications = state.selected.classification, tags = state.selected.tag;

  const topicOptions = uniq(all.map(d => t(d.meta['thema']))).sort((a, b) => a.localeCompare(b, 'de'));
  const classificationOptions = uniq(all.map(d => d.meta['klassifizierung']));

  // Sorting (catbar): empty means data order (the «Sortieren» placeholder). The
  // publication date is German text («10. Mai 2025»), so parse its month for sorting.
  const GERMAN_MONTH_NUMBER = { 'Januar': 1, 'Februar': 2, 'März': 3, 'April': 4, 'Mai': 5, 'Juni': 6, 'Juli': 7, 'August': 8, 'September': 9, 'Oktober': 10, 'November': 11, 'Dezember': 12 };
  const dateKey = (s) => { const m = String(s || '').match(/(\d+)\.\s*([A-Za-zäöü]+)\s*(\d{4})/); return m ? Number(m[3]) * 10000 + (GERMAN_MONTH_NUMBER[m[2]] || 0) * 100 + Number(m[1]) : 0; };
  const SORT_OPTIONS = [{ value: 'title', label: 'Titel (A–Z)' }, { value: 'thema', label: 'Thema' }, { value: 'date', label: 'Ausgabedatum (neuste zuerst)' }];
  const SORTS = {
    title: (a, b) => t(a.title).localeCompare(t(b.title), 'de'),
    thema: (a, b) => t(a.meta['thema']).localeCompare(t(b.meta['thema']), 'de') || t(a.title).localeCompare(t(b.title), 'de'),
    date: (a, b) => dateKey(b.meta['ausgabedatum']) - dateKey(a.meta['ausgabedatum']) || t(a.title).localeCompare(t(b.title), 'de'),
  };
  const sortKey = state.sort;

  const matches = (d) =>
    (!q || (t(d.title) + ' ' + t(d.description) + ' ' + t(d.fullDescription)).toLowerCase().includes(q)) &&
    (!topics.length || topics.includes(t(d.meta['thema']))) &&
    (!classifications.length || classifications.includes(d.meta['klassifizierung'])) &&
    (!tags.length || tags.every(x => (d.tags || []).includes(x)));

  const filtered = all.filter(matches);
  const datasets = sortKey ? filtered.slice().sort(SORTS[sortKey]) : filtered;
  const { visible, totalPages, page } = state.clamp(datasets);

  // Each pill links to the same view without that value, so removing a filter
  // needs no JavaScript and remains deep-linkable.
  const active = [
    ...(rawQ ? [{ label: `Suche: «${rawQ}»`, href: hash({ q: '' }) }] : []),
    ...topics.map(x => ({ label: x, href: hash({ topic: topics.filter(y => y !== x) }) })),
    ...classifications.map(x => ({ label: classificationLabel(core, x), href: hash({ classification: classifications.filter(y => y !== x) }) })),
    ...tags.map(x => ({ label: tagLabel(core, x), href: hash({ tag: tags.filter(y => y !== x) }) })),
  ];
  const filterBar = C.activeFilters({ filters: active, resetHref: '#/data/catalog' });

  const card = (d) => C.card({
    title: t(d.title),
    desc: t(d.description),
    href: `#/data/catalog/${encodeURIComponent(d.id)}`,
    image: preview(C, d),
    imageAlt: '',
    badges: [
      C.badge(t(d.meta['thema']), 'blue'),
      C.badge(classificationLabel(core, d.meta['klassifizierung']), classificationVariant(d.meta['klassifizierung'])),
      ...(d.meta['personenbezogen'] && d.meta['personenbezogen'] !== 'none'
        ? [C.badge(core.label(`enum.personaldata.${d.meta['personenbezogen']}`, 'Personenbezogen'), 'warning')] : []),
    ],
    footerInfo: C.escape(formats(d).join(' · ') || '—'), footerAction: C.cardAction(),
  });

  const listView = (rows) => C.table({
    caption: 'Datensätze',
    zebra: true,
    // The first column is the row link; as in all catalogue list views, clicking
    // anywhere on the row follows it (consistent affordance, tbl-8).
    rowsClickable: true,
    columns: [
      { key: 'title', label: 'Datensatz', render: d =>
        `<a href="#/data/catalog/${encodeURIComponent(d.id)}">${C.escape(t(d.title))}</a>
         <br><span class="small muted">${C.escape(t(d.description))}</span>` },
      { key: 'thema', label: 'Thema', render: d => C.escape(t(d.meta['thema'])) },
      { key: 'klass', label: 'Klassifizierung', render: d =>
        C.badge(classificationLabel(core, d.meta['klassifizierung']), classificationVariant(d.meta['klassifizierung'])) },
      { key: 'formate', label: 'Formate', render: d => C.escape(formats(d).join(', ') || '—') },
    ],
    rows,
  });

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Datenbezug und API Verzeichnis',
      lead: 'Die Datensätze des BBL — beschrieben nach DCAT-AP-CH, mit Bezugswegen, Klassifizierung und Datenverantwortung.',
    })}
    ${C.catalogueBar({
      formId: 'ds-search', inputId: 'dsq', searchLabel: 'Datensatz suchen', placeholder: 'Datensatz suchen…', q: rawQ,
      countId: 'ds-count', count: `<strong>${datasets.length}</strong> von ${all.length} Datensätzen${totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : ''}`,
      sort: { id: 'ds-sort', value: sortKey, options: SORT_OPTIONS },
      filterId: 'ds-filter', filterLabel: 'Filter', filterCount: topics.length + classifications.length + tags.length,
      panelId: 'ds-filters', panel: `
        ${C.filterGroup({ dim: 'topic', legend: 'Thema', selected: topics, options: topicOptions.map(x => ({ value: x, label: x })) })}
        ${C.filterGroup({ dim: 'classification', legend: 'Klassifizierung', selected: classifications, options: classificationOptions.map(x => ({ value: x, label: classificationLabel(core, x) })) })}
        ${/* The parameter is named `classification`, not `klass`; with the
              wrong key, the filter survived its own reset. */''}
        ${C.panelReset({ href: hash({ topic: [], classification: [], tag: [] }) })}`,
      view, views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List']],
    })}
    ${filterBar}
    ${C.catalogueResults({
      resetHref: '#/data/catalog',
      visible, count: datasets.length, view, page, totalPages,
      // unit carries both grammatical cases; the old emptyMsg/unavailableMsg
      // overrides existed only as a grammatical workaround (A14).
      card, listView, unit: { nom: 'Datensätze', dat: 'Datensätzen' },
      paginationInputId: 'ds-page', paginationLabel: 'Seitennavigation Datensätze',
      paginationHref: (p) => hash({ page: p }),
      available: core.available('datasets'),
    })}
  </div>`;

  C.announceCatalogue({ count: datasets.length, total: all.length, unit: { nom: 'Datensätze', dat: 'Datensätzen' }, page, totalPages, view });

  C.wireCatalogue(mount, {
    formId: 'ds-search', inputId: 'dsq', pageInputId: 'ds-page', page, totalPages, hash,
    sortId: 'ds-sort', filterToggleId: 'ds-filter', panelId: 'ds-filters',
  });
  // Row clicks in list view. Clean up through onUnmount so the reused mount does
  // not accumulate another click listener on every visit.
  ctx.onUnmount(C.wireTableRows(mount));
}

// ============================== DETAIL =============================

function detail(ctx, id) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  const d = core.dataset(C.safeDecode(id));
  const t = core.t;

  if (!d) {
    C.renderNotFound(ctx, { thing: 'Dieser Datensatz', title: 'Datensatz nicht gefunden',
      backHref: '#/data/catalog', backLabel: 'Datenbezug und API Verzeichnis', crumbs: crumbs() });
    return;
  }
  setTitle(t(d.title));
  setCrumbs([...crumbs(), { label: t(d.title) }]);

  const img = preview(C, d);

  // Tags lead back to the catalogue with that filter selected.
  const tagPills = (d.tags || []).map(x =>
    `<a class="badge badge--gray" href="${C.catalogueHash('#/data/catalog', { tag: [x] })}">${C.escape(tagLabel(core, x))}</a>`).join('');

  // Render key-value rows through the ONE dl.kv recipe (ruled variant), not the
  // parallel .data-rows implementation; .kv itself disproves the old rationale
  // («a dl would need a grid for every pair») (C7).
  const persons = (d.responsiblePersons || []).map(p => `
      <dt>${C.escape(p.role)}</dt>
      <dd><a href="https://admindir.verzeichnisse.admin.ch/person/${encodeURIComponent(p.admindirId)}"
           target="_blank" rel="noopener external">AdminDir ${C.escape(p.admindirId)}</a></dd>`).join('');

  // Metadata in data-catalogue order (config.metaFields.dataset).
  const metaRows = [
    ['Kontaktstelle', d.meta['kontaktstelle']
      ? `<a href="mailto:${C.escape(d.meta['kontaktstelle'])}">${C.escape(d.meta['kontaktstelle'])}</a>` : ''],
    ['Ausgabedatum', C.escape(d.meta['ausgabedatum'])],
    ['Aktualisierungsintervall', C.escape(core.label(`enum.frequency.${d.meta['aktualisierungsintervall']}`, d.meta['aktualisierungsintervall']))],
    ['Status', C.escape(core.label(`enum.status.${d.meta.status}`, d.meta.status))],
    ['Klassifizierung', C.badge(classificationLabel(core, d.meta['klassifizierung']), classificationVariant(d.meta['klassifizierung']))],
    ['Personenbezogene Daten', C.badge(core.label(`enum.personaldata.${d.meta['personenbezogen']}`, '—'), 'gray')],
    ['Archivwürdig', C.escape(core.label(`enum.archival.${d.meta['archivwuerdig']}`, d.meta['archivwuerdig']))],
    ['Thema', C.escape(t(d.meta['thema']))],
    ['Rechtsgrundlage', C.escape(t(d.meta['rechtsgrundlage']))],
    ['Bemerkung', C.escape(t(d.meta['kommentar']))],
  ];

  // Distributions: one CD accordion item per distribution, with all DCAT fields
  // in the panel (data catalogue config.distributionFields).
  const DIST_FIELDS = [
    { key: 'identifikator', label: 'Identifikator' },
    { key: 'titel', label: 'Titel', fallback: 'name' },
    { key: 'zugriffsUrl', label: 'Zugriffs-URL', link: true },
    { key: 'downloadUrl', label: 'Download-URL', link: true },
    { key: 'status', label: 'Status', enumPrefix: 'enum.status' },
    { key: 'dateiformat', label: 'Dateiformat', fallback: 'format' },
    { key: 'lizenz', label: 'Lizenz' },
    { key: 'bemerkungen', label: 'Bemerkungen' },
  ];
  const distributionValue = (dist, f) => {
    const raw = dist[f.key] || (f.fallback ? dist[f.fallback] : '');
    const val = t(raw);
    if (!val) return '<span class="muted">—</span>';
    if (f.link) return `<a href="${C.escape(val)}" target="_blank" rel="noopener external" class="break-all">${C.escape(val)}</a>`;
    if (f.enumPrefix) return C.escape(core.label(`${f.enumPrefix}.${val}`, val));
    if (f.key === 'lizenz') return C.escape(licenceLabel(val));
    return C.escape(val);
  };
  const distributions = (d.distributions || []).map((dist) => {
    const format = dist['dateiformat'] || dist.format || '';
    const download = dist.downloadUrl || dist['zugriffsUrl'] || '';
    return {
      title: t(dist.name) || dist['titel'],
      meta: format ? C.badge(format, 'gray', 'sm') : '',
      body: `<dl class="kv kv--ruled">
          ${DIST_FIELDS.map(f => `<dt>${f.label}</dt><dd>${distributionValue(dist, f)}</dd>`).join('')}
        </dl>
        <div class="row mt-4">${C.downloadLink(download, 'Datensatz beziehen')}</div>`,
    };
  });

  // A publication IS an entry in another catalogue, so link it rather than
  // forcing people to search for its name there. `url` is optional: when an
  // announced publication has not been entered yet, keep the name as text
  // instead of creating a dead link. It leaves the portal, hence target/rel as
  // on the access URLs above.
  const publications = (d.publications || []).map(p => {
    const name = C.escape(t(p.value));
    return `
      <dt>${C.escape(t(p.catalog))}</dt>
      <dd>${p.url
        ? `<a href="${C.escape(p.url)}" target="_blank" rel="noopener external" class="break-all">${name}</a>`
        : name}</dd>`;
  }).join('');

  const section = (title, body) => C.detailSection({ title, body });

  mount.innerHTML = `
  <div class="container section">
    ${C.detailHead({
      backHref: '#/data/catalog', backLabel: 'Datenbezug und API Verzeichnis',
      title: t(d.title), lead: t(d.description),
      tags: tagPills,
      image: img ? `<img class="hero-media hero-media--16x9" src="${img}" alt="" loading="lazy">` : '',
    })}

    ${/* Article wrapper: the page reads as ONE 60rem column (measure on the
          parent, C25), and the header lead above uses the same 60rem. */''}
    <div class="measure-xl">
    ${section('Beschreibung', `<p>${C.escape(t(d.fullDescription) || t(d.description))}</p>`)}

    ${section('Verantwortliche Personen', persons
      ? `<div class="box"><dl class="kv kv--ruled">${persons}</dl></div>`
      : `<div class="box"><p class="muted m-0">${NO_RESPONSIBLE_PERSON_MESSAGE}</p></div>`)}

    ${section('Metadaten', `<dl class="kv kv--ruled">${metaRows.map(([k, v]) => `
      <dt>${C.escape(k)}</dt>
      <dd>${v || '<span class="muted">—</span>'}</dd>`).join('')}</dl>`)}

    ${section('Bereitstellungsformen', distributions.length
      ? C.accordion(distributions, { id: 'dist' })
      : '<p class="muted">Für diesen Datensatz ist keine Bereitstellungsform erfasst.</p>')}

    ${section('Publikationen in externen Katalogen', publications
      ? `<dl class="kv kv--ruled">${publications}</dl>`
      : '<p class="muted">Dieser Datensatz ist in keinem externen Katalog publiziert.</p>')}
    </div>
  </div>`;

  // CD accordion: expand and collapse through the shared wiring.
  C.wireAccordion(mount);
}

// ============================== Helpers ==============================

function crumbs() {
  return [
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Datenbezug und API Verzeichnis', href: '#/data/catalog' },
  ];
}

function uniq(arr) { return [...new Set(arr.filter(Boolean))]; }

// Preview image: the supplied local file (`image`). The former Unsplash-photo
// fallback was removed after the image review (2026-08-04); all 19 illustrated
// datasets carry `image`.
function preview(C, d) {
  return d.image ? encodeURI(d.image) : '';
}

function formats(d) { return uniq((d.distributions || []).map(x => x['dateiformat'] || x.format)); }

function classificationLabel(core, key) { return core.label(`enum.classification.${key}`, key); }

// Higher protection level means more prominent emphasis.
function classificationVariant(key) {
  return { public: 'success', internal: 'info', confidential: 'warning', secret: 'error' }[key] || 'gray';
}

function tagLabel(core, key) { return core.label(`tag.${key}`, key); }

// The row is already labelled «Lizenz»; the value states only its condition.
function licenceLabel(key) {
  return { terms_by: 'Namensnennung', terms_by_ask: 'Namensnennung / Bewilligung',
    terms_open: 'Frei verwendbar', terms_ask: 'Bewilligung erforderlich' }[key] || key || '';
}

export default catalog;
