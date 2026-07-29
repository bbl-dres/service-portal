// Datenbezug — Datensatzkatalog (DCAT-AP-CH).
// Gleiches Muster wie #/services: Suche links, Filter-Dropdowns, Ansichtswechsel
// rechts, aktive Filter als Pills, Galerie/Liste und eine Detailansicht unter
// #/data/catalog/<id>. Datenmodell und Vorschaubilder stammen aus dem
// Datenkatalog-Prototyp (data/datasets.json).

const PER_PAGE = 9;

// Aufschiebbarer Bestand, den diese Ansicht liest — der Router lädt ihn nach,
// bevor render() den ersten Accessor aufruft (H4).
export const needs = ["datasets"];

export function katalog(ctx) {
  const { params } = ctx;
  return params[1] ? detail(ctx, params[1]) : list(ctx);
}

// ============================== LISTE ==============================

function list(ctx) {
  const { mount, core, C, query, setTitle, setCrumbs } = ctx;
  setTitle('Datenbezug und API Verzeichnis');
  setCrumbs(crumbs());

  const all = core.datasets();
  const t = core.t;

  const rawQ = query.get('q') || '';
  const q = rawQ.toLowerCase();
  // Filter sind mehrwertig (Mehrfachauswahl-Checkboxen): komma-getrennt im Hash.
  const themas = (query.get('topic') || '').split(',').map(s => s.trim()).filter(Boolean);
  const klasses = (query.get('classification') || '').split(',').map(s => s.trim()).filter(Boolean);
  const tags = (query.get('tag') || '').split(',').map(s => s.trim()).filter(Boolean);
  const view = query.get('view') === 'list' ? 'list' : 'gallery';
  const wanted = Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1);

  const themen = uniq(all.map(d => t(d.meta.thema))).sort((a, b) => a.localeCompare(b, 'de'));
  const klassen = uniq(all.map(d => d.meta.klassifizierung));

  // Sortierung (catbar): leer = Datenreihenfolge («Sortieren»-Platzhalter). Das
  // Ausgabedatum steht als deutscher Text («10. Mai 2025») → Monat parsen zum Sortieren.
  const DE_MON = { Januar: 1, Februar: 2, 'März': 3, April: 4, Mai: 5, Juni: 6, Juli: 7, August: 8, September: 9, Oktober: 10, November: 11, Dezember: 12 };
  const dateKey = (s) => { const m = String(s || '').match(/(\d+)\.\s*([A-Za-zäöü]+)\s*(\d{4})/); return m ? Number(m[3]) * 10000 + (DE_MON[m[2]] || 0) * 100 + Number(m[1]) : 0; };
  const SORT_OPTS = [{ value: 'title', label: 'Titel (A–Z)' }, { value: 'thema', label: 'Thema' }, { value: 'date', label: 'Ausgabedatum (neuste zuerst)' }];
  const SORTS = {
    title: (a, b) => t(a.title).localeCompare(t(b.title), 'de'),
    thema: (a, b) => t(a.meta.thema).localeCompare(t(b.meta.thema), 'de') || t(a.title).localeCompare(t(b.title), 'de'),
    date: (a, b) => dateKey(b.meta.ausgabedatum) - dateKey(a.meta.ausgabedatum) || t(a.title).localeCompare(t(b.title), 'de'),
  };
  const sortKey = SORT_OPTS.some(o => o.value === query.get('sort')) ? query.get('sort') : '';

  const matches = (d) =>
    (!q || (t(d.title) + ' ' + t(d.description) + ' ' + t(d.fullDescription)).toLowerCase().includes(q)) &&
    (!themas.length || themas.includes(t(d.meta.thema))) &&
    (!klasses.length || klasses.includes(d.meta.klassifizierung)) &&
    (!tags.length || tags.every(x => (d.tags || []).includes(x)));

  const filtered = all.filter(matches);
  const datasets = sortKey ? filtered.slice().sort(SORTS[sortKey]) : filtered;
  const totalPages = Math.max(1, Math.ceil(datasets.length / PER_PAGE));
  const page = Math.min(wanted, totalPages);
  const visible = datasets.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const base = { q: rawQ, topic: themas, classification: klasses, tag: tags, sort: sortKey, view };
  const hash = (patch = {}) => C.catalogueHash('#/data/catalog', { ...base, ...patch });

  // Jede Pill verlinkt auf dieselbe Ansicht ohne diesen einen Wert — das
  // Entfernen eines Filters braucht kein JS und bleibt verlinkbar.
  const active = [
    ...(rawQ ? [{ label: `Suche: „${rawQ}“`, href: hash({ q: '' }) }] : []),
    ...themas.map(x => ({ label: x, href: hash({ topic: themas.filter(y => y !== x) }) })),
    ...klasses.map(x => ({ label: klassLabel(core, x), href: hash({ classification: klasses.filter(y => y !== x) }) })),
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
      C.badge(t(d.meta.thema), 'blue'),
      C.badge(klassLabel(core, d.meta.klassifizierung), klassVariant(d.meta.klassifizierung)),
      ...(d.meta.personenbezogen && d.meta.personenbezogen !== 'none'
        ? [C.badge(core.label(`enum.personaldata.${d.meta.personenbezogen}`, 'Personenbezogen'), 'warning')] : []),
    ],
    footerInfo: C.escape(formats(d).join(' · ') || '—'), footerAction: C.cardAction(),
  });

  const listView = (rows) => C.table({
    caption: 'Datensätze',
    zebra: true,
    columns: [
      { key: 'title', label: 'Datensatz', render: d =>
        `<a href="#/data/catalog/${encodeURIComponent(d.id)}">${C.escape(t(d.title))}</a>
         <br><span class="small muted">${C.escape(t(d.description))}</span>` },
      { key: 'thema', label: 'Thema', render: d => C.escape(t(d.meta.thema)) },
      { key: 'klass', label: 'Klassifizierung', render: d =>
        C.badge(klassLabel(core, d.meta.klassifizierung), klassVariant(d.meta.klassifizierung)) },
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
      formId: 'ds-search', inputId: 'dsq', searchLabel: 'Datensatz suchen', placeholder: 'Datensatz suchen...', q: rawQ,
      countId: 'ds-count', count: `<strong>${datasets.length}</strong> von ${all.length} Datensätzen${totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : ''}`,
      sort: { id: 'ds-sort', value: sortKey, options: SORT_OPTS },
      filterId: 'ds-filter', filterLabel: 'Filter', filterCount: themas.length + klasses.length + tags.length,
      panelId: 'ds-filters', panel: `
        ${C.filterGroup({ dim: 'topic', legend: 'Thema', selected: themas, options: themen.map(x => ({ value: x, label: x })) })}
        ${C.filterGroup({ dim: 'classification', legend: 'Klassifizierung', selected: klasses, options: klassen.map(x => ({ value: x, label: klassLabel(core, x) })) })}
        <a class="btn btn--bare btn--sm" href="${hash({ topic: [], klass: [], tag: [] })}">${C.icon('Refresh', 'icon--base')} Zurücksetzen</a>`,
      view, views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List']],
    })}
    ${filterBar}
    ${C.catalogueResults({
      resetHref: '#/data/catalog',
      visible, count: datasets.length, total: all.length, view, page, totalPages, header: false,
      card, listView, unit: 'Datensätzen',
      paginationInputId: 'ds-page', paginationLabel: 'Seitennavigation Datensätze',
      paginationHref: (p) => hash({ page: p }),
      available: core.available('datasets'),
      emptyMsg: 'Keine Datensätze gefunden.',
      unavailableMsg: 'Datensätze konnten nicht geladen werden (Ladefehler).',
    })}
  </div>`;

  C.announceCatalogue({ count: datasets.length, total: all.length, unit: 'Datensätzen', page, totalPages, view });

  C.wireCatalogue(mount, {
    formId: 'ds-search', inputId: 'dsq', pageInputId: 'ds-page', page, totalPages, hash,
    sortId: 'ds-sort', filterToggleId: 'ds-filter', panelId: 'ds-filters',
  });
}

// ============================== DETAIL ==============================

function detail(ctx, id) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  const d = core.dataset(C.safeDecode(id));
  const t = core.t;

  if (!d) {
    setTitle('Datensatz nicht gefunden');
    setCrumbs(crumbs());
    mount.innerHTML = C.notFound({ backHref: '#/data/catalog', backLabel: 'Datenbezug und API Verzeichnis',
      title: 'Datensatz nicht gefunden',
      body: 'Dieser Datensatz existiert nicht. <a href="#/data/catalog">Zur Übersicht «Datenbezug und API Verzeichnis»</a>' });
    return;
  }
  setTitle(t(d.title));
  setCrumbs([...crumbs(), { label: t(d.title) }]);

  const img = preview(C, d);

  // Schlagworte führen zurück in den Katalog — als gesetzter Filter.
  const tagPills = (d.tags || []).map(x =>
    `<a class="badge badge--gray" href="${C.catalogueHash('#/data/catalog', { tag: [x] })}">${C.escape(tagLabel(core, x))}</a>`).join('');

  const persons = (d.responsiblePersons || []).map(p => `
    <div class="data-row">
      <div class="data-row__key">${C.escape(p.role)}</div>
      <div class="data-row__value">
        <a href="https://admindir.verzeichnisse.admin.ch/person/${encodeURIComponent(p.admindirId)}"
           target="_blank" rel="noopener external">AdminDir ${C.escape(p.admindirId)}</a>
      </div>
    </div>`).join('');

  // Metadaten in der Reihenfolge des Datenkatalogs (config.metaFields.dataset).
  const metaRows = [
    ['Kontaktstelle', d.meta.kontaktstelle
      ? `<a href="mailto:${C.escape(d.meta.kontaktstelle)}">${C.escape(d.meta.kontaktstelle)}</a>` : ''],
    ['Ausgabedatum', C.escape(d.meta.ausgabedatum)],
    ['Aktualisierungsintervall', C.escape(core.label(`enum.frequency.${d.meta.aktualisierungsintervall}`, d.meta.aktualisierungsintervall))],
    ['Status', C.escape(core.label(`enum.status.${d.meta.status}`, d.meta.status))],
    ['Klassifizierung', C.badge(klassLabel(core, d.meta.klassifizierung), klassVariant(d.meta.klassifizierung))],
    ['Personenbezogene Daten', C.badge(core.label(`enum.personaldata.${d.meta.personenbezogen}`, '—'), 'gray')],
    ['Archivwürdig', C.escape(core.label(`enum.archival.${d.meta.archivwuerdig}`, d.meta.archivwuerdig))],
    ['Thema', C.escape(t(d.meta.thema))],
    ['Rechtsgrundlage', C.escape(t(d.meta.rechtsgrundlage))],
    ['Bemerkung', C.escape(t(d.meta.kommentar))],
  ];

  // Bereitstellungsformen: ein CD-Akkordeon pro Distribution, im Panel die
  // vollständigen DCAT-Felder (config.distributionFields des Datenkatalogs).
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
  const distValue = (dist, f) => {
    const raw = dist[f.key] || (f.fallback ? dist[f.fallback] : '');
    const val = t(raw);
    if (!val) return '<span class="muted">—</span>';
    if (f.link) return `<a href="${C.escape(val)}" target="_blank" rel="noopener external" class="break-all">${C.escape(val)}</a>`;
    if (f.enumPrefix) return C.escape(core.label(`${f.enumPrefix}.${val}`, val));
    if (f.key === 'lizenz') return C.escape(licenceLabel(val));
    return C.escape(val);
  };
  const dists = (d.distributions || []).map((dist) => {
    const format = dist.dateiformat || dist.format || '';
    const download = dist.downloadUrl || dist.zugriffsUrl || '';
    return {
      title: t(dist.name) || dist.titel,
      meta: format ? C.badge(format, 'gray', 'sm') : '',
      body: `<div class="data-rows">
          ${DIST_FIELDS.map(f => `<div class="data-row">
            <div class="data-row__key">${f.label}</div>
            <div class="data-row__value">${distValue(dist, f)}</div>
          </div>`).join('')}
        </div>
        <div class="row mt-4">${C.downloadLink(download, 'Datensatz beziehen')}</div>`,
    };
  });

  const pubs = (d.publications || []).map(p => `
    <div class="data-row">
      <div class="data-row__key">${C.escape(t(p.catalog))}</div>
      <div class="data-row__value">${C.escape(t(p.value))}</div>
    </div>`).join('');

  const section = (title, body) => C.detailSection({ title, body });

  mount.innerHTML = `
  <div class="container section">
    ${C.detailHead({
      backHref: '#/data/catalog', backLabel: 'Datenbezug und API Verzeichnis',
      title: t(d.title), lead: t(d.description),
      tags: tagPills,
      image: img ? `<img src="${img}" alt="" loading="lazy">` : '',
    })}

    ${section('Beschreibung', `<p>${C.escape(t(d.fullDescription) || t(d.description))}</p>`)}

    ${section('Verantwortliche Personen', persons
      ? `<div class="box"><div class="data-rows">${persons}</div></div>`
      : `<div class="box"><p class="muted" style="margin:0">Für diesen Datensatz ist keine verantwortliche Person hinterlegt.</p></div>`)}

    ${section('Metadaten', `<div class="data-rows">${metaRows.map(([k, v]) => `
      <div class="data-row">
        <div class="data-row__key">${C.escape(k)}</div>
        <div class="data-row__value">${v || '<span class="muted">—</span>'}</div>
      </div>`).join('')}</div>`)}

    ${section('Bereitstellungsformen', dists.length
      ? C.accordion(dists, { id: 'dist' })
      : '<p class="muted">Für diesen Datensatz ist keine Bereitstellungsform erfasst.</p>')}

    ${section('Publikationen in externen Katalogen', pubs
      ? `<div class="data-rows">${pubs}</div>`
      : '<p class="muted">Dieser Datensatz ist in keinem externen Katalog publiziert.</p>')}
  </div>`;

  // CD-Akkordeon: auf- und zuklappen (gemeinsame Verdrahtung).
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

// Vorschaubild: entweder eine mitgelieferte Datei (`image`) oder — wie im
// übrigen Portal — eine Unsplash-ID (`photo`).
function preview(C, d) {
  if (d.image) return encodeURI(d.image);
  return d.photo ? C.photoUrl(d.photo, { w: 800 }) : '';
}

function formats(d) { return uniq((d.distributions || []).map(x => x.dateiformat || x.format)); }

function klassLabel(core, key) { return core.label(`enum.classification.${key}`, key); }

// Höhere Schutzstufe = auffälligere Auszeichnung.
function klassVariant(key) {
  return { public: 'success', internal: 'info', confidential: 'warning', secret: 'error' }[key] || 'gray';
}

function tagLabel(core, key) { return core.label(`tag.${key}`, key); }

// Die Zeile heisst bereits «Lizenz» — der Wert nennt nur die Bedingung.
function licenceLabel(key) {
  return { terms_by: 'Namensnennung', terms_by_ask: 'Namensnennung / Bewilligung',
    terms_open: 'Frei verwendbar', terms_ask: 'Bewilligung erforderlich' }[key] || key || '';
}

export default katalog;
