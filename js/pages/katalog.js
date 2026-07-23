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
  setTitle('Datenbezug');
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

  const base = { q: rawQ, thema, klass, tags, view };

  // Jede Pill verlinkt auf dieselbe Ansicht ohne diesen einen Wert — das
  // Entfernen eines Filters braucht kein JS und bleibt verlinkbar.
  const active = [
    ...(rawQ ? [{ label: `Suche: „${rawQ}“`, href: hash({ ...base, q: '' }) }] : []),
    ...(thema ? [{ label: thema, href: hash({ ...base, thema: '' }) }] : []),
    ...(klass ? [{ label: klassLabel(core, klass), href: hash({ ...base, klass: '' }) }] : []),
    ...tags.map(x => ({ label: tagLabel(core, x), href: hash({ ...base, tags: tags.filter(y => y !== x) }) })),
  ];
  const filterBar = active.length ? `
    <div class="active-filters mt-4" role="group" aria-label="Aktive Filter">
      <span class="small muted">Aktive Filter:</span>
      ${active.map(f => `<a class="badge badge--gray active-filter" href="${f.href}"
         aria-label="Filter „${C.escape(f.label)}“ entfernen">${C.escape(f.label)}${C.icon('Cancel', 'icon--sm')}</a>`).join('')}
      <a class="btn btn--link" href="#/data/katalog">Alle Filter zurücksetzen</a>
    </div>` : '';

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
      title: 'Datenbezug',
      lead: 'Die Datensätze des BBL — beschrieben nach DCAT-AP-CH, mit Bezugswegen, Klassifizierung und Datenverantwortung.',
    })}
    <form class="service-controls" id="ds-search" role="search">
      <div class="service-controls__search">
        <label class="sr-only" for="dsq">Datensatz suchen</label>
        <input id="dsq" type="search" placeholder="Datensatz suchen..." value="${C.escape(rawQ)}" autocomplete="off">
        <button class="btn btn--bare btn--icon-only service-controls__submit" type="submit" aria-label="Suchen" title="Suchen">${C.icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span></button>
      </div>
      <div class="service-controls__filters" aria-label="Datensätze filtern">
        <div class="form__group__select">
          <label for="thema-filter">Thema</label>
          <div class="select">
            <select id="thema-filter" name="thema">
              <option value="">Alle Themen</option>
              ${themen.map(x => `<option value="${C.escape(x)}"${thema === x ? ' selected' : ''}>${C.escape(x)}</option>`).join('')}
            </select>
            <span class="select__icon">${C.icon('ChevronDown')}</span>
          </div>
        </div>
        <div class="form__group__select">
          <label for="klass-filter">Klassifizierung</label>
          <div class="select">
            <select id="klass-filter" name="klass">
              <option value="">Alle Klassifizierungen</option>
              ${klassen.map(x => `<option value="${C.escape(x)}"${klass === x ? ' selected' : ''}>${C.escape(klassLabel(core, x))}</option>`).join('')}
            </select>
            <span class="select__icon">${C.icon('ChevronDown')}</span>
          </div>
        </div>
      </div>
    </form>
    ${filterBar}
    <section class="mt-6">
      ${C.resultsHeader({ count: datasets.length, total: all.length, unit: 'Datensätzen', page, totalPages, view })}
      ${datasets.length
        ? `${view === 'liste' ? listView(visible) : `<div class="grid grid--3 mt-4">${visible.map(card).join('')}</div>`}
           ${C.pagination({ page, totalPages, inputId: 'ds-page',
              href: (p) => hash({ ...base, page: p }), label: 'Seitennavigation Datensätze' })}`
        : C.empty('Keine Datensätze gefunden.')}
    </section>
  </div>`;

  mount.querySelector('#ds-search').addEventListener('submit', (e) => {
    e.preventDefault();
    location.hash = hash({ ...base, q: mount.querySelector('#dsq').value.trim() });
  });
  mount.querySelector('#thema-filter').addEventListener('change', (e) => {
    location.hash = hash({ ...base, thema: e.target.value });
  });
  mount.querySelector('#klass-filter').addEventListener('change', (e) => {
    location.hash = hash({ ...base, klass: e.target.value });
  });
  mount.querySelectorAll('.view-switch__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      location.hash = hash({ ...base, page, view: btn.getAttribute('data-view') });
    });
  });
  C.wirePagination(mount, 'ds-page', page, totalPages, (target) => {
    location.hash = hash({ ...base, page: target });
  });
}

// ============================== DETAIL ==============================

function detail(ctx, id) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  const d = core.dataset(decodeURIComponent(id));
  const t = core.t;

  if (!d) {
    setTitle('Datensatz nicht gefunden');
    setCrumbs(crumbs());
    mount.innerHTML = `<div class="container section">
      ${C.backLink('#/data/katalog', 'Datenbezug')}
      <div class="page-header mt-4"><h1 tabindex="-1">Datensatz nicht gefunden</h1></div>
      <p class="muted">Dieser Datensatz existiert nicht. <a href="#/data/katalog">Zur Übersicht «Datenbezug»</a></p>
    </div>`;
    return;
  }
  setTitle(t(d.title));
  setCrumbs([...crumbs(), { label: t(d.title) }]);

  const img = preview(C, d);

  // Schlagworte führen zurück in den Katalog — als gesetzter Filter.
  const tagPills = (d.tags || []).map(x =>
    `<a class="badge badge--gray" href="${hash({ tags: [x] })}">${C.escape(tagLabel(core, x))}</a>`).join('');

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
  const dists = (d.distributions || []).map((dist, i) => {
    const format = dist.dateiformat || dist.format || '';
    const download = dist.downloadUrl || dist.zugriffsUrl || '';
    return `
      <div class="accordion__item">
        <h3 style="margin:0">
          <button class="accordion__button" type="button" aria-expanded="false" aria-controls="dist-p-${i}" id="dist-b-${i}">
            <span class="accordion__title">${C.escape(t(dist.name) || dist.titel)}</span>
            <span class="accordion__meta">
              ${format ? C.badge(format, 'gray', 'sm') : ''}${C.icon('ChevronDown', 'icon--base')}
            </span>
          </button>
        </h3>
        <div class="accordion__content" id="dist-p-${i}" role="region" aria-labelledby="dist-b-${i}" hidden>
          <div class="data-rows">
            ${DIST_FIELDS.map(f => `<div class="data-row">
              <div class="data-row__key">${f.label}</div>
              <div class="data-row__value">${distValue(dist, f)}</div>
            </div>`).join('')}
          </div>
          <div class="row mt-4">${C.downloadLink(download, 'Datensatz beziehen')}</div>
        </div>
      </div>`;
  }).join('');

  const pubs = (d.publications || []).map(p => `
    <div class="data-row">
      <div class="data-row__key">${C.escape(t(p.catalog))}</div>
      <div class="data-row__value">${C.escape(t(p.value))}</div>
    </div>`).join('');

  const section = (title, body) => `
    <section class="detail-section">
      <h2 class="detail-section__title">${C.escape(title)}</h2>
      ${body}
    </section>`;

  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/data/katalog', 'Datenbezug')}

    <div class="hero hero--main-image">
      <div class="hero__content">
        <p class="meta-info">
          <span class="meta-info__item">${C.escape(t(d.meta.thema))}</span>
          <span class="meta-info__item">${C.escape(klassLabel(core, d.meta.klassifizierung))}</span>
        </p>
        <h1 class="hero__title" tabindex="-1">${C.escape(t(d.title))}</h1>
        <p class="hero__description">${C.escape(t(d.description))}</p>
        ${tagPills ? `<div class="pill-row">${tagPills}</div>` : ''}
      </div>
      ${img ? `<div class="hero__image"><img src="${img}" alt="" loading="lazy"></div>` : ''}
    </div>

    ${section('Beschreibung', `<p>${C.escape(t(d.fullDescription) || t(d.description))}</p>`)}

    ${section('Verantwortliche Personen', persons
      ? `<div class="box"><div class="data-rows">${persons}</div></div>`
      : `<div class="box"><p class="muted" style="margin:0">Für diesen Datensatz ist keine verantwortliche Person hinterlegt.</p></div>`)}

    ${section('Metadaten', `<div class="data-rows">${metaRows.map(([k, v]) => `
      <div class="data-row">
        <div class="data-row__key">${C.escape(k)}</div>
        <div class="data-row__value">${v || '<span class="muted">—</span>'}</div>
      </div>`).join('')}</div>`)}

    ${section('Bereitstellungsformen', dists
      ? `<div class="accordion" id="dist-acc">${dists}</div>`
      : '<p class="muted">Für diesen Datensatz ist keine Bereitstellungsform erfasst.</p>')}

    ${section('Publikationen in externen Katalogen', pubs
      ? `<div class="data-rows">${pubs}</div>`
      : '<p class="muted">Dieser Datensatz ist in keinem externen Katalog publiziert.</p>')}
  </div>`;

  // CD-Akkordeon: Panels auf- und zuklappen.
  mount.querySelectorAll('#dist-acc .accordion__button').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      const panel = mount.querySelector('#' + btn.getAttribute('aria-controls'));
      if (panel) panel.hidden = expanded;
    });
  });
}

// ============================== Helpers ==============================

function crumbs() {
  return [
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Datenbezug', href: '#/data/katalog' },
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

function hash({ q = '', thema = '', klass = '', tags = [], page = 1, view = '' } = {}) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (thema) p.set('thema', thema);
  if (klass) p.set('klass', klass);
  if (tags.length) p.set('tag', tags.join(','));
  if (page > 1) p.set('page', String(page));
  if (view === 'liste') p.set('view', view);
  const s = p.toString();
  return s ? `#/data/katalog?${s}` : '#/data/katalog';
}

export default katalog;
