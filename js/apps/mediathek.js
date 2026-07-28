// Mediathek — Immobilien-Medienbibliothek (Fotos & Videos der Bauten), modelliert nach mediathek.admin.ch.
//
// Die Übersicht folgt demselben Katalogmuster wie Dienstleistungen, Anwendungen
// und Datenkatalog: C.catalogueBar (Suche · Trefferzahl · Sortierung · Filter ·
// Ansichtswechsel) über C.catalogueResults, Zustand vollständig im URL-Hash.
// Dazu eine dritte Ansicht, die es sonst nur im Liegenschaften-Inventar gibt:
// die KARTE.
//
// Georeferenz: jede Aufnahme trägt ihre EIGENEN Koordinaten (`lat` / `lon` in
// data/media.json) — so wie ein echtes Foto seine EXIF-Position mitbringt. Kein
// Zusammenführen über `buildingId` mehr: der Aufnahmeort ist eine Eigenschaft
// des Mediums, nicht des abgebildeten Objekts, und Aufnahmen desselben Gebäudes
// stehen dadurch als eigene Punkte auf der Karte.
// (Demo-Daten: die Positionen wurden aus dem Objektstandort abgeleitet und
// liegen bis ~30 m um ihn herum — plausibel, aber keine echten Kamerapunkte.)

import { initEstateMap } from '../buildings-map.js';
import { openGallery } from '../gallery.js';

// Historic material is rendered desaturated, so the archive reads as an archive.
const isHistoric = (m) => m.historicPeriod === 'historisch';
// Demo images are Unsplash placeholders — say so rather than passing them off
// as the (fictional) BBL archive credits shown in the metadata block.
const PLACEHOLDER_NOTE = '<p class="small muted">Platzhalterbild (Unsplash) — Demo-Daten, nicht das reale Archivbild.</p>';

const PER_PAGE = 12;
const SORT_OPTS = [
  ['datum-desc', 'Datum (neuste zuerst)'],
  ['datum-asc', 'Datum (älteste zuerst)'],
  ['titel', 'Titel (A–Z)'],
  ['objekt', 'Objekt (A–Z)'],
];

export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs } = ctx;
  if (params[0]) return detail(ctx, params[0]);

  setTitle('Mediathek');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Mediathek' },
  ]);

  const all = core.media();
  const bname = (id) => { const b = core.building(id); return b ? b.name : id; };

  /* ------------------------------------------------------------- Zustand -- */
  const rawQ = (query.get('q') || '').trim();
  const typs = (query.get('typ') || '').split(',').filter(Boolean);
  const epochen = (query.get('epoche') || '').split(',').filter(Boolean);
  const objekte = (query.get('objekt') || '').split(',').filter(Boolean);
  const sortKey = SORT_OPTS.some(([v]) => v === query.get('sort')) ? query.get('sort') : 'datum-desc';
  const view = ['galerie', 'liste', 'karte'].includes(query.get('view')) ? query.get('view') : 'galerie';

  const base = { q: rawQ, typ: typs, epoche: epochen, objekt: objekte, sort: sortKey, view };
  const hash = (patch = {}) => C.catalogueHash('#/app/mediathek', { ...base, ...patch });

  const needle = rawQ.toLowerCase();
  const matches = (m) => !needle || [m.title, bname(m.buildingId), m.photographer, m.date]
    .some(v => String(v || '').toLowerCase().includes(needle));

  const hits = all.filter(m => matches(m)
    && (!typs.length || typs.includes(m.mediaType))
    && (!epochen.length || epochen.includes(m.historicPeriod))
    && (!objekte.length || objekte.includes(m.buildingId)));

  const SORTS = {
    'datum-desc': (a, b) => String(b.date).localeCompare(String(a.date)),
    'datum-asc': (a, b) => String(a.date).localeCompare(String(b.date)),
    titel: (a, b) => a.title.localeCompare(b.title, 'de-CH'),
    objekt: (a, b) => bname(a.buildingId).localeCompare(bname(b.buildingId), 'de-CH'),
  };
  const sorted = hits.slice().sort(SORTS[sortKey] || SORTS['datum-desc']);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const page = Math.min(Math.max(1, parseInt(query.get('page') || '1', 10) || 1), totalPages);
  const visible = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Einträge für die geteilte Vollbildgalerie (js/gallery.js). Die Reihenfolge
  // entspricht der Trefferliste, damit Blättern in der Galerie der Sortierung folgt.
  const galleryItems = () => sorted.filter(m => m.photo).map(m => ({
    photo: m.photo, title: m.title, meta: `${m.date} · ${bname(m.buildingId)}`,
    type: m.mediaType, gray: isHistoric(m),
    href: `#/app/mediathek/${encodeURIComponent(m.mediaId)}`,
    details: [
      ['Typ', m.mediaType === 'video' ? 'Video' : 'Foto'],
      ['Datum', m.date],
      ['Epoche', m.historicPeriod === 'historisch' ? 'Historisch' : 'Aktuell'],
      ['Objekt', bname(m.buildingId)],
      [m.mediaType === 'video' ? 'Quelle' : 'Fotograf:in', m.photographer],
      ['Copyright', m.copyright],
      ['Zugriff', m.accessLevel],
      ['Koordinaten', Number.isFinite(m.lat) ? `${m.lat.toFixed(5)}, ${m.lon.toFixed(5)}` : '—'],
    ],
  }));

  /* ------------------------------------------------------------ Bausteine -- */
  const periodBadge = (p) => p === 'historisch' ? C.badge('Historisch', 'warning') : C.badge('Aktuell', 'info');
  const typLabel = (t) => t === 'video' ? 'Video' : 'Foto';

  const card = (m) => C.card({
    title: m.title,
    desc: `${bname(m.buildingId)} · ${m.photographer}`,
    href: `#/app/mediathek/${encodeURIComponent(m.mediaId)}`,
    titleTag: 'h3',
    photo: { id: m.photo, color: m.color, alt: '', gray: isHistoric(m) },
    badges: [
      C.badge(typLabel(m.mediaType), m.mediaType === 'video' ? 'purple' : 'blue'),
      periodBadge(m.historicPeriod),
      ...(m.accessLevel !== 'öffentlich' ? [C.badge('Intern', 'gray')] : []),
    ],
    footerInfo: C.escape(m.date), footerAction: C.cardAction(),
  });

  const listView = (rows) => C.table({
    caption: 'Aufnahmen',
    zebra: true,
    columns: [
      { key: 'title', label: 'Titel', render: m =>
        `<a href="#/app/mediathek/${encodeURIComponent(m.mediaId)}">${C.escape(m.title)}</a>` },
      { key: 'typ', label: 'Typ', render: m => C.escape(typLabel(m.mediaType)) },
      { key: 'objekt', label: 'Objekt', render: m => C.escape(bname(m.buildingId)) },
      { key: 'epoche', label: 'Epoche', render: m => periodBadge(m.historicPeriod) },
      { key: 'urheber', label: 'Urheberschaft', render: m => C.escape(m.photographer) },
      { key: 'datum', label: 'Datum', align: 'right', render: m => C.escape(m.date) },
    ],
    rows,
  });

  // Ein Punkt je AUFNAHME, aus deren eigenen Koordinaten.
  const mapPoints = () => sorted
    .filter(m => Number.isFinite(m.lat) && Number.isFinite(m.lon))
    .map(m => ({
      lat: m.lat, lon: m.lon, bblId: m.mediaId, label: m.title,
      sub: `${typLabel(m.mediaType)} · ${m.date} · ${bname(m.buildingId)}`,
      href: `#/app/mediathek/${encodeURIComponent(m.mediaId)}`,
    }));
  const mapView = () => {
    const n = mapPoints().length;
    return `<div class="pf-map dash-map mt-4" id="med-map" role="group"
        aria-label="Karte der Aufnahmeorte"></div>
      <p class="small muted mt-2">${n} von ${sorted.length} Aufnahmen sind georeferenziert.`
      + ` Demo-Daten: die Positionen liegen bis rund 30 m um das abgebildete Objekt.</p>`;
  };

  const active = [
    ...(rawQ ? [{ label: `Suche: „${rawQ}“`, href: hash({ q: '' }) }] : []),
    ...typs.map(x => ({ label: typLabel(x), href: hash({ typ: typs.filter(y => y !== x) }) })),
    ...epochen.map(x => ({ label: x === 'historisch' ? 'Historisch' : 'Aktuell', href: hash({ epoche: epochen.filter(y => y !== x) }) })),
    ...objekte.map(x => ({ label: bname(x), href: hash({ objekt: objekte.filter(y => y !== x) }) })),
  ];

  const objOpts = [...new Set(all.map(m => m.buildingId))]
    .map(id => ({ value: id, label: bname(id) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de-CH'));

  /* ---------------------------------------------------------------- Render */
  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Mediathek',
      lead: 'Fotos und Videos der Bundesbauten — von historischen Aufnahmen bis zu aktuellen Dokumentationen.',
    })}
    ${C.catalogueBar({
      formId: 'med-search', inputId: 'medq', searchLabel: 'Aufnahme suchen',
      placeholder: 'Titel, Objekt oder Urheberschaft…', q: rawQ,
      countId: 'med-count',
      // In der Karte ist «Seite x von y» sinnlos: sie zeigt alle Treffer.
      count: view === 'karte'
        ? `<strong>${sorted.length}</strong> ${sorted.length === 1 ? 'Aufnahme' : 'Aufnahmen'}`
        : `<strong>${sorted.length}</strong> von ${all.length} Aufnahmen${totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : ''}`,
      sort: { id: 'med-sort', value: sortKey, options: SORT_OPTS },
      filterId: 'med-filter', filterLabel: 'Filter', filterCount: typs.length + epochen.length + objekte.length,
      panelId: 'med-filters', panel: `
        ${C.filterGroup({ dim: 'typ', legend: 'Medientyp', selected: typs, options: [
          { value: 'photo', label: 'Foto' }, { value: 'video', label: 'Video' }] })}
        ${C.filterGroup({ dim: 'epoche', legend: 'Epoche', selected: epochen, options: [
          { value: 'historisch', label: 'Historisch' }, { value: 'aktuell', label: 'Aktuell' }] })}
        ${C.filterGroup({ dim: 'objekt', legend: 'Objekt', selected: objekte, options: objOpts })}
        <div class="catbar__panel__actions"><a class="btn btn--bare btn--sm" href="${hash({ typ: [], epoche: [], objekt: [] })}">${C.icon('Refresh', 'icon--base')}<span class="btn__text">Zurücksetzen</span></a></div>`,
      view, views: [['galerie', 'Galerieansicht', 'Apps'], ['liste', 'Listenansicht', 'List'], ['karte', 'Kartenansicht', 'Map']],
    })}
    ${C.activeFilters({ filters: active, resetHref: '#/app/mediathek' })}
    ${C.catalogueResults({
      resetHref: '#/app/mediathek',
      visible, count: sorted.length, total: all.length, view, page, totalPages, header: false,
      card, listView, mapView, unit: 'Aufnahmen', regionLabel: 'Aufnahmen',
      paginationInputId: 'med-page', paginationLabel: 'Seitennavigation Mediathek',
      paginationHref: (p) => hash({ page: p }),
      available: core.available('media'),
      emptyMsg: 'Keine Aufnahmen gefunden.',
      unavailableMsg: 'Medien konnten nicht geladen werden (Ladefehler).',
    })}
  </div>`;

  C.announceCatalogue({ count: sorted.length, total: all.length, unit: 'Aufnahmen', page, totalPages, view });
  C.wireCatalogue(mount, {
    formId: 'med-search', inputId: 'medq', pageInputId: 'med-page', page, totalPages, hash,
    sortId: 'med-sort', filterToggleId: 'med-filter', panelId: 'med-filters',
  });

  if (view === 'galerie') {
    // Fortschrittliche Verbesserung: der href auf die Detailseite bleibt die
    // Rückfallebene (und die Tastaturbedienung), der Klick öffnet die Vollbild-
    // galerie an genau diesem Bild — wie in der Objekt-Detailansicht.
    const items = galleryItems();
    mount.querySelectorAll('.catalogue-grid .card__link, main .grid .card__link').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = decodeURIComponent((a.getAttribute('href') || '').split('/').pop());
        const i = items.findIndex(x => x.href.endsWith(encodeURIComponent(id)));
        if (i < 0) return;              // ohne Treffer normal navigieren
        e.preventDefault();
        openGallery(items, i, C);
      });
    });
  }

  if (view === 'karte') {
    const el = mount.querySelector('#med-map');
    if (el) initEstateMap(el, mapPoints(), null, null, { focusPopup: false })
      .catch(() => { /* Karte ist optional; der Fehlertext steht im Container */ });
  }
}

// Detail view: #/app/mediathek/MED-001
function detail(ctx, id) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  const m = core.media().find(x => x.mediaId === id);
  if (!m) {
    mount.innerHTML = C.notFound({ backHref: '#/app/mediathek', backLabel: 'Mediathek',
      title: 'Medium nicht gefunden',
      body: 'Dieses Medium existiert nicht (oder wurde zurückgezogen). <a href="#/app/mediathek">Zur Übersicht «Mediathek»</a>' });
    return;
  }

  setTitle(m.title);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Mediathek', href: '#/app/mediathek' },
    { label: m.title },
  ]);

  const b = core.building(m.buildingId);
  const bn = b ? b.name : m.buildingId;
  const isVideo = m.mediaType === 'video';
  const isPublic = m.accessLevel === 'öffentlich';
  const periodBadge = m.historicPeriod === 'historisch'
    ? C.badge('Historisch', 'warning')
    : C.badge('Aktuell', 'info');

  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: '#/app/mediathek', backLabel: 'Mediathek' })}
    <div class="container--grid gap--responsive">
      <div class="container__main stack">
        <div class="row gap-sm">${C.badge(isVideo ? 'Video' : 'Foto', 'blue')}${periodBadge}</div>
        <h1 tabindex="-1">${C.escape(m.title)}</h1>
        ${C.photo({
          id: m.photo, color: m.color, alt: m.title, w: 1200, gray: m.historicPeriod === 'historisch',
          style: 'height:380px;border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center',
          overlay: isVideo ? `<span style="color:#fff;opacity:.92;">${C.icon('Video', 'icon--xl')}</span>` : '',
        })}
        ${PLACEHOLDER_NOTE}
        <a class="btn btn--outline btn--lg" href="${C.escape(m.url || '#')}">${C.icon('Download', 'icon--base')} Herunterladen</a>
        ${!isPublic
          ? C.notification('Dieses Medium ist als <strong>intern</strong> klassifiziert. Der Download erfordert eine entsprechende Berechtigung (Freigabe).', 'warning', 'Lock')
          : `<p class="small muted">Frei verwendbar gemäss angegebenem Copyright.</p>`}
      </div>
      <aside class="container__aside stack-lg">
        <div class="box">
          <h3>Metadaten</h3>
          <dl class="kv">
            <dt>Typ</dt><dd>${isVideo ? 'Video' : 'Foto'}</dd>
            <dt>Datum</dt><dd>${C.escape(m.date)}</dd>
            <dt>Epoche</dt><dd>${m.historicPeriod === 'historisch' ? 'Historisch' : 'Aktuell'}</dd>
            <dt>Gebäude</dt><dd><a href="#/app/portfolio?id=${encodeURIComponent(m.buildingId)}">${C.escape(bn)}</a></dd>
            <dt>${isVideo ? 'Quelle' : 'Fotograf:in'}</dt><dd>${C.escape(m.photographer)}</dd>
            <dt>Copyright</dt><dd>${C.escape(m.copyright)}</dd>
            <dt>Zugriff</dt><dd>${C.escape(m.accessLevel)}</dd>
          </dl>
        </div>
      </aside>
    </div>
  </div>`;
}
