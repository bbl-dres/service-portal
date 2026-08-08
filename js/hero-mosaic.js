// Bildmosaik mit Standortkarte — der Kopf der Objekt-Detailseiten.
//
// Aufbau: ein grosses Bild links, bis zu vier Nebenkacheln, rechts die Karte.
// Gibt es nur ein Bild, belegt es den gesamten Bildbereich ohne leere
// Nebenkacheln; die Standortkarte bleibt daneben.
// Jede Kachel öffnet die Vollbildgalerie (js/gallery.js) bei ihrem eigenen
// Bild; die letzte echte Nebenkachel trägt die «Alle Bilder anzeigen»-Auflage
// mit der Zahl der verdeckten Aufnahmen.
//
// Vorher lag der Baustein im Liegenschafteninventar (js/apps/portfolio.js) und
// war dort nicht erreichbar. Er hängt an nichts Portfoliospezifischem: er
// bekommt eine Liste von Galerieeinträgen und eine Karten-Container-Kennung.
// Das Mietendenportal zeigt dieselben Objekte aus Mietersicht und soll sie
// gleich darstellen — deshalb steht der Baustein jetzt für beide bereit.

const SIDE_SLOTS = 4;

// `items` sind Galerieeinträge in der Form, die js/gallery.js liest:
//   { id, photoSrc, photo, title, meta, type, gray?, details: [[Label, Wert]] }
// `mapId` ist die id des Kartencontainers — der Aufrufer montiert die Karte
// selbst, weil nur er weiss, welche Koordinaten und welcher Zoom gelten.
export function heroMosaic(C, { items = [], mapId, mapLabel, id = 'pf-mosaic', lat, lon }) {
  const esc = (s) => C.escape(String(s == null ? '' : s));
  const n = items.length;

  const tile = (it, i, cls, w, overlay = '') =>
    `<button type="button" class="pf-mosaic__cell interactive-control ${cls}" data-gallery="${i}"
       aria-label="${esc(it.title)} — in der Galerie öffnen (Bild ${i + 1} von ${n})">
      ${C.photo({ src: it.photoSrc, id: it.photo, color: 'var(--color-secondary-600)', alt: it.title, w, gray: it.gray,
        cls: 'pf-mosaic__photo', overlay })}
    </button>`;
  const placeholder = (cls) =>
    `<div class="pf-mosaic__cell ${cls} pf-mosaic__cell--empty" aria-hidden="true">
      <div class="photo pf-mosaic__photo image__not-available">${C.icon('Image', 'icon--lg')}
        <p class="image__not-available-text">Kein Bild</p></div>
    </div>`;

  const side = items.slice(1, 1 + SIDE_SLOTS);
  const hasSide = side.length > 0;
  const hidden = n - (1 + side.length);
  // Auflage auf der letzten ECHTEN Nebenkachel — nie auf einem Platzhalter, der
  // führt nirgendwohin. Bei genau zwei Bildern bleibt sie weg: dort verdeckte
  // sie das einzige Nebenbild vollständig.
  const showMore = side.length >= 2 || hidden > 0;
  const sideTiles = side.map((it, i) => {
    const isLast = i === side.length - 1 && showMore;
    const overlay = isLast
      ? `<span class="pf-mosaic__more">${hidden > 0 ? `<span class="pf-mosaic__more-num">+${hidden}</span>` : ''}
          <span class="pf-mosaic__more-label">Alle Bilder anzeigen</span></span>`
      : '';
    return tile(it, i + 1, 'pf-mosaic__cell--side', 640, overlay);
  }).join('') + placeholder('pf-mosaic__cell--side').repeat(Math.max(0, SIDE_SLOTS - side.length));

  // Zähler nur, wenn es etwas zu zählen gibt — «0 Bilder» auf einem Platzhalter
  // wäre doppelt gemoppelt, der Kasten sagt es schon.
  const mainCell = n
    ? tile(items[0], 0, 'pf-mosaic__cell--main', 1600,
        `<span class="pf-hero__badge">${C.icon('Image', 'icon--base')} ${n} Bild${n === 1 ? '' : 'er'}</span>`)
    : placeholder('pf-mosaic__cell--main');

  // Kopfzeile über der Standortkarte: der Weg nach draussen zu Google Maps.
  // Unsere Karte zeigt die Lage im Portalkontext (swisstopo-Grundkarte, andere
  // Objekte, Parzellen); für Anfahrt, Strassenansicht und Umgebung greift man
  // zu dem, was man ohnehin auf dem Telefon hat. Der `search`-Endpunkt der
  // Google-Maps-URL-API setzt einen echten Marker auf die Koordinate — anders
  // als `@lat,lng,zoom`, das nur die Kamera bewegt und den Ort NICHT markiert.
  //
  // `noopener noreferrer` und `rel~="external"` (das Blatt hängt daran das
  // Aussenverweis-Symbol) — es verlässt das Portal in einen fremden Dienst.
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

// Galerieeinträge aus einer `bilder`-Liste, wie sie an Gebäuden, Grundstücken
// und Mietverhältnissen hängt. Eine Form für alle drei, damit die Galerie
// überall dieselben Angaben zeigt — inklusive Bildnachweis, denn die Aufnahmen
// der BBL-Mediendatenbank sind nicht frei lizenziert.
export function galleryItemsFrom(bilder, { idPrefix, title, ort = '' } = {}) {
  return (bilder || []).map((x, i) => ({
    id: `${idPrefix}-bild-${i}`,
    photo: '', photoSrc: x.src, title: x.titel || title,
    meta: [x.fotograf && `© ${x.fotograf}`, ort].filter(Boolean).join(' · '),
    type: 'foto', gray: !!x.historisch,
    details: [
      ['Titel', x.titel || title],
      x.fotograf && ['Fotograf:in', x.fotograf],
      x.credit && ['Copyright', x.credit],
      x.lizenz && ['Lizenz', x.lizenz],
      x.quelle && ['Quelle', x.quelle],
    ].filter(Boolean),
  }));
}

// Klick-Verdrahtung der Mosaik-Kacheln: jede [data-gallery]-Kachel öffnet die
// Vollbildgalerie bei ihrem eigenen Bild. Stand vorher wortgleich dreimal in
// den Detailansichten (Portfolio-Gebäude, -Grundstück, Mietverhältnis —
// Design-Review B19). `openGallery` kommt als Parameter, damit dieses Modul
// die Galerie nicht selbst laden muss, wo sie nicht gebraucht wird.
export function wireHeroMosaic(root, openGallery, items, C, { param = 'bild' } = {}) {
  // Klassen- statt id-Scope: das Mosaik heisst je App anders (#pf-mosaic,
  // #mt-mosaic — testgepinnt), trägt aber immer .pf-mosaic (Mietende-Befund).
  root.querySelectorAll('.pf-mosaic [data-gallery]').forEach((el) => {
    el.addEventListener('click', () => openGallery(items, Number(el.dataset.gallery) || 0, C, { param }));
  });
}

export default { heroMosaic, galleryItemsFrom, wireHeroMosaic };
