// Image mosaic with location map: the header for property detail pages.
//
// Anatomy: one large image on the left, up to four side tiles, and the map on
// the right. With only one image, it fills the image area without empty side
// tiles while the location map remains beside it. Each tile opens its own image
// in the fullscreen gallery (js/ui/gallery.js); the last real side tile carries the
// “Show all images” overlay with a count of hidden images.
//
// This component previously lived inside the property inventory
// (js/apps/portfolio.js) and was inaccessible elsewhere. Nothing about it is
// portfolio-specific: it receives gallery items and a map-container ID. The
// tenant portal shows the same properties from a tenant perspective and should
// present them consistently, so the component is shared.

const SIDE_SLOTS = 4;

// `items` are gallery entries in the shape consumed by js/ui/gallery.js:
//   { id, photoSrc, photo, title, meta, type, gray?, details: [[label, value]] }
// `mapId` is the map-container ID. The caller mounts the map because only it
// knows the applicable coordinates and zoom.
export function heroMosaic(C, { items = [], mapId, mapLabel, id = 'pf-mosaic', lat, lon }) {
  const esc = (s) => C.escape(String(s == null ? '' : s));
  const n = items.length;

  const tile = (it, i, cls, w, overlay = '') =>
    `<button type="button" class="pf-mosaic__cell interactive-control ${cls}" data-gallery="${i}"
       aria-label="${esc(it.title)} — in der Galerie öffnen (Bild ${i + 1} von ${n})">
      ${C.photo({ src: it.photoSrc, id: it.photo, color: 'var(--color-secondary-600)', alt: it.title, w, gray: it.gray,
        cls: 'pf-mosaic__photo', overlayHtml: overlay })}
    </button>`;
  const placeholder = (cls) =>
    `<div class="pf-mosaic__cell ${cls} pf-mosaic__cell--empty" aria-hidden="true">
      <div class="photo pf-mosaic__photo image__not-available">${C.icon('Image', 'icon--lg')}
        <p class="image__not-available-text">Kein Bild</p></div>
    </div>`;

  const side = items.slice(1, 1 + SIDE_SLOTS);
  const hasSide = side.length > 0;
  const hidden = n - (1 + side.length);
  // Overlay on the last REAL side tile, never a placeholder that leads nowhere.
  // Hide it with exactly two images because it would fully obscure the only side
  // image.
  const showMore = side.length >= 2 || hidden > 0;
  const sideTiles = side.map((it, i) => {
    const isLast = i === side.length - 1 && showMore;
    const overlay = isLast
      ? `<span class="pf-mosaic__more">${hidden > 0 ? `<span class="pf-mosaic__more-num">+${hidden}</span>` : ''}
          <span class="pf-mosaic__more-label">Alle Bilder anzeigen</span></span>`
      : '';
    return tile(it, i + 1, 'pf-mosaic__cell--side', 640, overlay);
  }).join('') + placeholder('pf-mosaic__cell--side').repeat(Math.max(0, SIDE_SLOTS - side.length));

  // Show a count only when there is something to count. «0 Bilder» on a
  // placeholder would repeat what the box already says.
  const mainCell = n
    ? tile(items[0], 0, 'pf-mosaic__cell--main', 1600,
        `<span class="pf-hero__badge">${C.icon('Image', 'icon--base')} ${n} Bild${n === 1 ? '' : 'er'}</span>`)
    : placeholder('pf-mosaic__cell--main');

  // Heading above the location map: an exit to Google Maps. The portal map shows
  // the location in context (swisstopo base, other properties, parcels), while
  // directions, street view and surroundings use the tool already available on
  // a phone. The Google Maps URL API's `search` endpoint places a real marker at
  // the coordinate, unlike `@lat,lng,zoom`, which moves only the camera and does
  // NOT mark the place.
  //
  // `noopener noreferrer` and `rel~="external"` (the stylesheet uses it for the
  // external-link icon): this leaves the portal for a third-party service.
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lon);
  const mapsUrl = hasGeo
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`
    : '';
  const mapHead = hasGeo
    ? `<p class="pf-hero__maplink"><a href="${esc(mapsUrl)}" target="_blank" rel="external noopener noreferrer">Auf Google Maps ansehen</a></p>`
    : '';

  return `<div class="pf-mosaic pf-mosaic--map${hasSide ? '' : ' pf-mosaic--solo'}" id="${esc(id)}">
    ${mainCell}
    ${hasSide ? `<div class="pf-mosaic__side">${sideTiles}</div>` : ''}
    <div class="pf-hero__mapcol">
      ${mapHead}
      <div class="pf-hero__map" id="${esc(mapId)}" role="group" aria-label="${esc(mapLabel)}"></div>
    </div>
  </div>`;
}

// Gallery entries from the raw `bilder` list attached to buildings, parcels and
// tenancies. One shape for all three gives the gallery consistent information,
// including attribution because images from the BBL media database are not
// freely licensed.
export function galleryItemsFrom(images, { idPrefix, title, location = '' } = {}) {
  return (images || []).map((image, index) => ({
    id: `${idPrefix}-bild-${index}`,
    photo: '', photoSrc: image.src, title: image['titel'] || title,
    meta: [image['fotograf'] && `© ${image['fotograf']}`, location].filter(Boolean).join(' · '),
    type: 'photo', gray: !!image['historisch'],
    details: [
      ['Titel', image['titel'] || title],
      image['fotograf'] && ['Fotograf:in', image['fotograf']],
      image.credit && ['Copyright', image.credit],
      image['lizenz'] && ['Lizenz', image['lizenz']],
      image['quelle'] && ['Quelle', image['quelle']],
    ].filter(Boolean),
  }));
}

// Click wiring for mosaic tiles: every [data-gallery] tile opens its own image in
// the fullscreen gallery. This previously appeared verbatim in three detail
// views (portfolio building, parcel and tenancy; design review B19).
// `openGallery` is passed in so this module need not load the gallery where it
// is unused.
export function wireHeroMosaic(root, openGallery, items, C, { param = 'bild' } = {}) {
  // Scope by class rather than ID: each app names the mosaic differently
  // (#pf-mosaic, #mt-mosaic, pinned by tests), but it always carries .pf-mosaic.
  root.querySelectorAll('.pf-mosaic [data-gallery]').forEach((el) => {
    el.addEventListener('click', () => openGallery(items, Number(el.dataset.gallery) || 0, C, { param }));
  });
}
