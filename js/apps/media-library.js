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

  setTitle('Mediathek Bauten');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Mediathek Bauten' },
  ]);

  const all = core.media();
  // Das Bildregister umfasst Gebäude, Grundstücke UND Bauprojekte; ein Medium
  // trägt darum je nach Bezug buildingId, parcelId oder projectId. `objektId`
  // vereinheitlicht das, `bname` löst über alle drei Bestände auf.
  // Vorher las die Mediathek nur buildingId — bei einem Grundstücksbild war das
  // null, und die Sortierung lief auf `null.localeCompare`.
  const objektId = (m) => m.buildingId || m.parcelId || m.projectId || '';
  const bname = (id) => {
    if (!id) return 'Ohne Objektbezug';
    const b = core.building(id); if (b) return b.name;
    const p = core.parcel(id); if (p) return p.name;
    const pr = core.project(id); if (pr) return pr.name || id;
    return String(id);
  };

  /* ------------------------------------------------------------- Zustand -- */
  const rawQ = (query.get('q') || '').trim();
  const typs = (query.get('typ') || '').split(',').filter(Boolean);
  const epochen = (query.get('epoche') || '').split(',').filter(Boolean);
  const objekte = (query.get('objekt') || '').split(',').filter(Boolean);
  const sortKey = SORT_OPTS.some(([v]) => v === query.get('sort')) ? query.get('sort') : 'datum-desc';
  const view = ['gallery', 'list', 'map'].includes(query.get('view')) ? query.get('view') : 'gallery';

  const base = { q: rawQ, typ: typs, epoche: epochen, objekt: objekte, sort: sortKey, view };
  const hash = (patch = {}) => C.catalogueHash('#/app/media-library', { ...base, ...patch });

  const needle = rawQ.toLowerCase();
  const matches = (m) => !needle || [m.title, bname(objektId(m)), m.photographer, m.date]
    .some(v => String(v || '').toLowerCase().includes(needle));

  const hits = all.filter(m => matches(m)
    && (!typs.length || typs.includes(m.mediaType))
    && (!epochen.length || epochen.includes(m.historicPeriod))
    && (!objekte.length || objekte.includes(objektId(m))));

  const SORTS = {
    'datum-desc': (a, b) => String(b.date).localeCompare(String(a.date)),
    'datum-asc': (a, b) => String(a.date).localeCompare(String(b.date)),
    titel: (a, b) => a.title.localeCompare(b.title, 'de-CH'),
    objekt: (a, b) => bname(objektId(a)).localeCompare(bname(objektId(b)), 'de-CH'),
  };
  const sorted = hits.slice().sort(SORTS[sortKey] || SORTS['datum-desc']);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const page = Math.min(Math.max(1, parseInt(query.get('page') || '1', 10) || 1), totalPages);
  const visible = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Einträge für die geteilte Vollbildgalerie (js/gallery.js). Die Reihenfolge
  // entspricht der Trefferliste, damit Blättern in der Galerie der Sortierung folgt.
  const galleryItems = () => sorted.filter(m => m.file || m.photo).map(m => ({
    id: m.mediaId,
    photo: m.photo, photoSrc: m.file || '', title: m.title, meta: `${m.date} · ${bname(objektId(m))}`,
    type: m.mediaType, gray: isHistoric(m),
    href: `#/app/media-library/${encodeURIComponent(m.mediaId)}`,
    details: [
      ['Typ', m.mediaType === 'video' ? 'Video' : 'Foto'],
      ['Datum', m.date],
      ['Epoche', m.historicPeriod === 'historisch' ? 'Historisch' : 'Aktuell'],
      ['Objekt', bname(objektId(m))],
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
    desc: `${bname(objektId(m))} · ${m.photographer}`,
    href: `#/app/media-library/${encodeURIComponent(m.mediaId)}`,
    titleTag: 'h3',
    photo: { src: m.file || '', id: m.photo, color: m.color, alt: '', gray: isHistoric(m) },
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
        `<a href="#/app/media-library/${encodeURIComponent(m.mediaId)}">${C.escape(m.title)}</a>` },
      { key: 'typ', label: 'Typ', render: m => C.escape(typLabel(m.mediaType)) },
      { key: 'objekt', label: 'Objekt', render: m => C.escape(bname(objektId(m))) },
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
      sub: `${typLabel(m.mediaType)} · ${m.date} · ${bname(objektId(m))}`,
      href: `#/app/media-library/${encodeURIComponent(m.mediaId)}`,
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

  const objOpts = [...new Set(all.map(objektId).filter(Boolean))]
    .map(id => ({ value: id, label: bname(id) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de-CH'));

  /* ---------------------------------------------------------------- Render */
  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Mediathek Bauten',
      lead: 'Fotos und Videos der Bundesbauten — von historischen Aufnahmen bis zu aktuellen Dokumentationen.',
    })}
    ${C.catalogueBar({
      formId: 'med-search', inputId: 'medq', searchLabel: 'Aufnahme suchen',
      placeholder: 'Titel, Objekt oder Urheberschaft…', q: rawQ,
      countId: 'med-count',
      // In der Karte ist «Seite x von y» sinnlos: sie zeigt alle Treffer.
      count: view === 'map'
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
      view, views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List'], ['map', 'Kartenansicht', 'Map']],
    })}
    ${C.activeFilters({ filters: active, resetHref: '#/app/media-library' })}
    ${C.catalogueResults({
      resetHref: '#/app/media-library',
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

  if (view === 'gallery') {
    // Fortschrittliche Verbesserung: der href auf die Detailseite bleibt die
    // Rückfallebene (und die Tastaturbedienung), der Klick öffnet die Vollbild-
    // galerie an genau diesem Bild — wie in der Objekt-Detailansicht.
    const items = galleryItems();
    // Geteilter Link (?bild=MED-007) öffnet die Galerie direkt bei der Aufnahme.
    const deep = query.get('bild');
    if (deep) {
      const di = items.findIndex(x => x.id === deep);
      if (di >= 0) openGallery(items, di, C, { param: 'bild' });
    }
    mount.querySelectorAll('.catalogue-grid .card__link, main .grid .card__link').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = decodeURIComponent((a.getAttribute('href') || '').split('/').pop());
        const i = items.findIndex(x => x.href.endsWith(encodeURIComponent(id)));
        if (i < 0) return;              // ohne Treffer normal navigieren
        e.preventDefault();
        openGallery(items, i, C, { param: 'bild' });
      });
    });
  }

  if (view === 'map') {
    const el = mount.querySelector('#med-map');
    if (el) {
      // Handle festhalten: ohne ihn ist map.remove() unerreichbar und je Besuch
      // bleibt ein WebGL-Kontext stehen.
      const pm = initEstateMap(el, mapPoints(), null, null, { focusPopup: false });
      ctx.onUnmount(() => pm.then(mp => mp && mp.remove()).catch(() => {}));
      pm.catch(() => { /* Karte ist optional; der Fehlertext steht im Container */ });
    }
  }
}

// Detailansicht: #/app/media-library/MED-001
//
// Gleiche Anatomie wie die Objekt-Detailansicht (js/apps/portfolio.js):
// Zurück-Leiste → Kennzeichen + Titel + Lead → Hero (Bild neben Standortkarte)
// → Registerleiste. Vorher war es ein zweispaltiges Ad-hoc-Layout mit einer
// Metadatenbox in der Randspalte — das einzige Detail im Portal, das nicht dem
// Registermuster folgte.
function detail(ctx, id) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  const all = core.media();
  const m = all.find(x => x.mediaId === id);
  if (!m) {
    mount.innerHTML = C.notFound({ backHref: '#/app/media-library', backLabel: 'Mediathek Bauten',
      title: 'Medium nicht gefunden',
      body: 'Dieses Medium existiert nicht (oder wurde zurückgezogen). <a href="#/app/media-library">Zur Übersicht «Mediathek»</a>' });
    return;
  }

  setTitle(m.title);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Mediathek Bauten', href: '#/app/media-library' },
    { label: m.title },
  ]);

  // Auch hier: das Medium kann an einem Gebäude, einem Grundstück oder einem
  // Bauprojekt hängen. objId() vereinheitlicht, oname() löst über alle auf.
  const objId = (x) => x.buildingId || x.parcelId || x.projectId || '';
  const oid = objId(m);
  const b = core.building(oid) || core.parcel(oid) || null;
  const bn = b ? b.name : (core.project(oid) ? (core.project(oid).name || oid) : (oid || 'Ohne Objektbezug'));
  const isVideo = m.mediaType === 'video';
  const isPublic = m.accessLevel === 'öffentlich';
  const hist = m.historicPeriod === 'historisch';
  const hasGeo = Number.isFinite(m.lat) && Number.isFinite(m.lon);
  // Geschwisteraufnahmen desselben Objekts — echte Daten, kein Füllmaterial.
  const siblings = all.filter(x => objId(x) === oid);
  const galleryItem = (x) => ({
    id: x.mediaId,
    photo: x.photo, photoSrc: x.file || '', title: x.title, meta: `${x.date} · ${bn}`,
    type: x.mediaType, gray: x.historicPeriod === 'historisch',
    href: `#/app/media-library/${encodeURIComponent(x.mediaId)}`,
    details: [
      ['Typ', x.mediaType === 'video' ? 'Video' : 'Foto'],
      ['Datum', x.date],
      ['Epoche', x.historicPeriod === 'historisch' ? 'Historisch' : 'Aktuell'],
      ['Objekt', bn],
      [x.mediaType === 'video' ? 'Quelle' : 'Fotograf:in', x.photographer],
      ['Copyright', x.copyright],
      ['Zugriff', x.accessLevel],
    ],
  });

  const tabs = [
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'metadaten', label: 'Metadaten' },
  ];

  const tabUebersicht = () => `
    ${/* Das Bild steht jetzt HIER statt in einem Hero: auf einer Medien-
          Detailseite ist es der Inhalt, nicht die Kopfzier — und im Register
          bekommt es die volle Breite der Inhaltsspalte. */''}
    <button type="button" class="med-shot" data-open-gallery
      aria-label="${C.escape(m.title)} — in der Galerie öffnen">
      ${C.photo({ src: m.file || '', id: m.photo, color: m.color, alt: '', w: 1600, gray: hist,
        cls: 'med-shot__photo',
        overlay: isVideo ? `<span class="med-shot__play" aria-hidden="true">${C.icon('Video', 'icon--xl')}</span>` : '' })}
    </button>
    ${/* Der frühere Warnkasten zur internen Einstufung ist weg; die Einstufung
          steht als Zeile «Zugriff» im Register Metadaten. */''}
    ${isPublic ? '<p class="small muted">Frei verwendbar gemäss angegebenem Copyright.</p>' : ''}
    <div class="row mt-4" style="gap:.75rem">
      <a class="btn btn--filled" href="${C.escape(m.url || '#')}">${C.icon('Download', 'icon--base')}<span class="btn__text">Herunterladen</span></a>
      <button type="button" class="btn btn--outline" data-open-gallery>${C.icon('Image', 'icon--base')}<span class="btn__text">In der Galerie öffnen</span></button>
    </div>`;

  const tabMetadaten = () => `
    <dl class="kv">
      <dt>Medien-ID</dt><dd>${C.escape(m.mediaId)}</dd>
      <dt>Typ</dt><dd>${isVideo ? 'Video' : 'Foto'}</dd>
      <dt>Datum</dt><dd>${C.escape(m.date)}</dd>
      <dt>Epoche</dt><dd>${hist ? 'Historisch' : 'Aktuell'}</dd>
      <dt>Objekt</dt><dd><a href="#/app/portfolio?id=${encodeURIComponent(oid)}">${C.escape(bn)}</a>
        <span class="small muted">${C.escape(oid)}</span></dd>
      <dt>${isVideo ? 'Quelle' : 'Fotograf:in'}</dt><dd>${C.escape(m.photographer)}</dd>
      <dt>Copyright</dt><dd>${C.escape(m.copyright)}</dd>
      <dt>Zugriff</dt><dd>${C.escape(m.accessLevel)}</dd>
      <dt>Aufnahmeort</dt><dd>${hasGeo
        ? `${m.lat.toFixed(5)}, ${m.lon.toFixed(5)} <span class="small muted">WGS 84</span>`
        : '—'}</dd>
    </dl>
    ${/* Die Karte steht dort, wo die Koordinaten stehen — als Hero über einem
          Foto wäre sie fehl am Platz. */''}
    ${hasGeo ? '<div class="pf-map dash-map mt-4" id="med-detail-map" role="group" aria-label="Aufnahmeort auf der Karte"></div>' : ''}`;

  const panels = { uebersicht: tabUebersicht, metadaten: tabMetadaten };
  const panelHtml = (pid) => (panels[pid] || tabUebersicht)();

  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: '#/app/media-library', backLabel: 'Mediathek Bauten' })}
    <h1 tabindex="-1">${C.escape(m.title)}</h1>
    <p class="lead">${C.escape(bn)} · ${C.escape(m.date)}</p>

    <div class="tabs mt-6">
      ${C.tabBar({ items: tabs, active: tabs[0].id, idPrefix: 'med-tab', ariaLabel: 'Details zur Aufnahme' })}
      ${C.tabPanels({ items: tabs, active: tabs[0].id, idPrefix: 'med-tab', render: panelHtml, heading: true })}
    </div>
  </div>`;

  C.wireTabs(mount);

  // Bild und «In der Galerie öffnen» führen zum selben Betrachter, eingestiegen
  // bei genau dieser Aufnahme.
  const items = siblings.filter(x => x.file || x.photo).map(galleryItem);
  const startAt = Math.max(0, items.findIndex(x => x.href.endsWith(encodeURIComponent(m.mediaId))));
  // NICHT an `mount` hängen: das ist der bestehende #main-content-Knoten des
  // Routers, der beim Seitenwechsel nur seinen innerHTML tauscht. Ein Listener
  // darauf überlebt jede Navigation und sammelt sich an — nach drei besuchten
  // Detailseiten öffnete ein Klick drei Galerien übereinander (gemessen).
  // Der Container hier wird bei jedem Render neu erzeugt, sein Listener geht
  // mit ihm.
  const root = mount.querySelector('.container.section');
  if (root) root.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-gallery]')) { e.preventDefault(); openGallery(items, startAt, C, { param: 'bild' }); }
  });

  if (hasGeo) {
    const el = mount.querySelector('#med-detail-map');
    if (el) {
      const pm = initEstateMap(el, [{ lat: m.lat, lon: m.lon, label: m.title, bblId: m.mediaId,
        sub: `Aufnahmeort · ${bn}` }], null, m.mediaId, { focusPopup: false });
      ctx.onUnmount(() => pm.then(mp => mp && mp.remove()).catch(() => {}));
      pm.catch(() => { /* Karte optional */ });
    }
  }

  window.scrollTo(0, 0);
  const h = mount.querySelector('h1');
  if (h) h.focus({ preventScroll: true });
}
