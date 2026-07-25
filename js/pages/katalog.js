// Datenbezug — Datensatzkatalog (DCAT-AP-CH).
// Gleiches Muster wie #/services: Suche links, Filter-Dropdowns, Ansichtswechsel
// rechts, aktive Filter als Pills, Galerie/Liste und eine Detailansicht unter
// #/data/katalog/<id>. Datenmodell und Vorschaubilder stammen aus dem
// Datenkatalog-Prototyp (data/datasets.json).

const PER_PAGE = 9;

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
  const thema = query.get('thema') || '';
  const klass = query.get('klass') || '';
  const tags = (query.get('tag') || '').split(',').map(s => s.trim()).filter(Boolean);
  const view = query.get('view') === 'liste' ? 'liste' : 'galerie';
  const wanted = Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1);

  const themen = uniq(all.map(d => t(d.meta.thema))).sort((a, b) => a.localeCompare(b, 'de'));
  const klassen = uniq(all.map(d => d.meta.klassifizierung));

  const matches = (d) =>
    (!q || (t(d.title) + ' ' + t(d.description) + ' ' + t(d.fullDescription)).toLowerCase().includes(q)) &&
    (!thema || t(d.meta.thema) === thema) &&
    (!klass || d.meta.klassifizierung === klass) &&
    (!tags.length || tags.every(x => (d.tags || []).includes(x)));

  const datasets = all.filter(matches);
  const totalPages = Math.max(1, Math.ceil(datasets.length / PER_PAGE));
  const page = Math.min(wanted, totalPages);
  const visible = datasets.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const base = { q: rawQ, thema, klass, tag: tags, view };
  const hash = (patch = {}) => C.catalogueHash('#/data/katalog', { ...base, ...patch });

  // Jede Pill verlinkt auf dieselbe Ansicht ohne diesen einen Wert — das
  // Entfernen eines Filters braucht kein JS und bleibt verlinkbar.
  const active = [
    ...(rawQ ? [{ label: `Suche: „${rawQ}“`, href: hash({ q: '' }) }] : []),
    ...(thema ? [{ label: thema, href: hash({ thema: '' }) }] : []),
    ...(klass ? [{ label: klassLabel(core, klass), href: hash({ klass: '' }) }] : []),
    ...tags.map(x => ({ label: tagLabel(core, x), href: hash({ tag: tags.filter(y => y !== x) }) })),
  ];
  const filterBar = C.activeFilters({ filters: active, resetHref: '#/data/katalog' });

  const card = (d) => C.card({
    title: t(d.title),
    desc: t(d.description),
    href: `#/data/katalog/${encodeURIComponent(d.id)}`,
    image: preview(C, d),
    imageAlt: '',
    badges: [
      C.badge(t(d.meta.thema), 'blue'),
      C.badge(klassLabel(core, d.meta.klassifizierung), klassVariant(d.meta.klassifizierung)),
      ...(d.meta.personenbezogen && d.meta.personenbezogen !== 'none'
        ? [C.badge(core.label(`enum.personaldata.${d.meta.personenbezogen}`, 'Personenbezogen'), 'warning')] : []),
    ],
    footer: `<span>${C.escape(formats(d).join(' · ') || '—')}</span>
      <span class="btn btn--link">Öffnen ${C.icon('ArrowRight', 'icon--base')}</span>`,
  });

  const listView = (rows) => C.table({
    caption: 'Datensätze',
    zebra: true,
    columns: [
      { key: 'title', label: 'Datensatz', render: d =>
        `<a href="#/data/katalog/${encodeURIComponent(d.id)}">${C.escape(t(d.title))}</a>
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
    ${C.catalogueControls({
      formId: 'ds-search', inputId: 'dsq', searchLabel: 'Datensatz suchen', placeholder: 'Datensatz suchen...', q: rawQ,
      filtersLabel: 'Datensätze filtern',
      filters: `
        ${C.select({ id: 'thema-filter', name: 'thema', label: 'Thema', value: thema,
          options: [{ value: '', label: 'Alle Themen' }, ...themen.map(x => ({ value: x, label: x }))] })}
        ${C.select({ id: 'klass-filter', name: 'klass', label: 'Klassifizierung', value: klass,
          options: [{ value: '', label: 'Alle Klassifizierungen' }, ...klassen.map(x => ({ value: x, label: klassLabel(core, x) }))] })}`,
    })}
    ${filterBar}
    ${C.catalogueResults({
      visible, count: datasets.length, total: all.length, view, page, totalPages,
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
    filters: [{ id: 'thema-filter', param: 'thema' }, { id: 'klass-filter', param: 'klass' }],
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
    mount.innerHTML = C.notFound({ backHref: '#/data/katalog', backLabel: 'Datenbezug und API Verzeichnis',
      title: 'Datensatz nicht gefunden',
      body: 'Dieser Datensatz existiert nicht. <a href="#/data/katalog">Zur Übersicht «Datenbezug und API Verzeichnis»</a>' });
    return;
  }
  setTitle(t(d.title));
  setCrumbs([...crumbs(), { label: t(d.title) }]);

  const img = preview(C, d);

  // Schlagworte führen zurück in den Katalog — als gesetzter Filter.
  const tagPills = (d.tags || []).map(x =>
    `<a class="badge badge--gray" href="${C.catalogueHash('#/data/katalog', { tag: [x] })}">${C.escape(tagLabel(core, x))}</a>`).join('');

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
      backHref: '#/data/katalog', backLabel: 'Datenbezug und API Verzeichnis',
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
    { label: 'Datenbezug und API Verzeichnis', href: '#/data/katalog' },
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
