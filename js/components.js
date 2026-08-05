// Shared UI component helpers — all return HTML strings (pages compose via templates).
// Class names follow the CD Bund design system; see docs/cd-gap-analysis.md.

const ICON_BASE = 'assets/icons/';

// CD's own chevron path (Select.vue:19 — identical to assets/icons/ChevronDown.svg)
const CHEVRON_SVG = '<svg role="presentation" aria-hidden="true" viewBox="0 0 24 24">'
  + '<path d="m5.706 10.015 6.669 3.85 6.669-3.85.375.649-7.044 4.067-7.044-4.067z"/></svg>';

// --- Placeholder photography -------------------------------------------------
// SEIT DEM BILD-SCREENING (2026-08-04) trägt KEIN Datenbestand mehr Unsplash-
// photo-Ids — alle Bilder liegen lokal unter assets/images/ (Nachweis im
// jeweiligen JSON bzw. assets/images/heroes/README.md). photoUrl/`id` bleibt
// als Rückfallebene für Altstände: die Id wird nur nach strikter Zeichen-
// prüfung interpoliert, und die `color` der Karte bleibt hinter dem Bild.
const PHOTO_BASE = 'https://images.unsplash.com/photo-';
const PHOTO_ID = /^[A-Za-z0-9_-]+$/;

export function photoUrl(id, { w = 800, h = 0, q = 70, gray = false } = {}) {
  if (!id || !PHOTO_ID.test(id)) return '';
  let u = `${PHOTO_BASE}${id}?auto=format&fit=crop&w=${w}&q=${q}`;
  if (h) u += `&h=${h}`;
  if (gray) u += '&sat=-100';   // historic material reads as archival b/w
  return u;
}

// `src` schlägt `id`: liegt eine echte, lokal abgelegte Aufnahme vor
// (assets/images/buildings/…), wird die genommen; sonst greift wie bisher das
// Unsplash-Platzhalterbild über die id. Beides fällt bei einem Ladefehler auf
// die Farbfläche zurück.
const LOKAL = /^assets\/[A-Za-z0-9/_.-]+$/;

export function photo(o = {}) {
  const src = (o.src && LOKAL.test(o.src)) ? o.src : photoUrl(o.id, { w: o.w, h: o.h, q: o.q, gray: o.gray });
  const img = src
    ? `<img src="${src}" alt="${escape(o.alt || '')}" loading="lazy" decoding="async" onerror="this.remove()">`
    : '';
  return `<div class="photo${o.cls ? ' ' + o.cls : ''}" style="background-color:${escape(o.color || 'var(--color-secondary-600)')}${o.style ? ';' + o.style : ''}">${img}${o.overlay || ''}</div>`;
}

export function icon(name, cls = 'icon--base') {
  const u = ICON_BASE + name + '.svg';
  return `<span class="icon ${cls}" style="-webkit-mask-image:url('${u}');mask-image:url('${u}')" aria-hidden="true"></span>`;
}

export function escape(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Umbruchstellen für lange deutsche Komposita: UAX#14 erlaubt nach «/» und nach
// einem Bindestrich von sich aus keinen Umbruch, sodass «Sicherheits-/Datenschutz-
// vorfall» als ein unteilbares Wort galt und mitten im Wort abriss (sichtbar bei
// 1440 UND 320). <wbr> gibt die Stelle frei, ohne ein Zeichen hinzuzufügen —
// `textContent` bleibt identisch, die Tests bleiben also unberührt (Item 5.8).
function breakable(s) {
  return escape(s).replace(/([/–—-])(?=\S)/g, '$1<wbr>');
}

// decodeURIComponent, das bei malformten Sequenzen (roh getippter Hash wie
// `#/applications/%`) nicht wirft, sondern den Rohwert zurückgibt (code-review A6).
export function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// Wiederkehrende englische Fachbegriffe im sonst deutschen Text. Für WCAG 3.1.2
// (Sprache von Teilen) werden sie inline mit lang="en" ausgezeichnet, damit
// Screenreader sie englisch aussprechen.
const EN_TERMS = ['Digital by Design', 'Digital First', 'Digital Only', 'Once-Only', 'Common Data Environment'];

// Escaped den Text und zeichnet bekannte fremdsprachige Phrasen mit lang aus.
// Längere Phrasen zuerst, damit Teilphrasen nicht vorzeitig umschlossen werden.
export function markLang(text, terms = EN_TERMS) {
  let out = escape(text);
  for (const phrase of [...terms].sort((a, b) => b.length - a.length)) {
    const e = escape(phrase);
    if (out.includes(e)) out = out.split(e).join(`<span lang="en">${e}</span>`);
  }
  return out;
}

// --- Badges (badge.postcss) --------------------------------------------------
// CD-Anatomie (Badge.vue:11-18): die Beschriftung liegt in einem .badge__text-
// Span; Symbole tragen .badge__icon / .badge__icon-left (em-skaliert, optisch
// ins 1em-Polster gezogen) statt generischer icon--*-Klassen plus Flex-gap.
export function badge(text, variant = 'gray', size = '') {
  return `<span class="badge badge--${variant}${size ? ' badge--' + size : ''}"><span class="badge__text">${escape(text)}</span></span>`;
}

// Ladezustand — das EINE Muster für «lädt / verarbeitet» (Nutzerentscheid
// 2026-08-04): das CD-Spinner-Symbol (icon--spin; reduced-motion-Killswitch
// in app.css) plus Wortlaut als Statuszeile. role="status" macht den Text zur
// Live-Meldung für Screenreader; das Symbol ist dekorativ. Wortlaut-Kanon:
// «<Gegenstand> wird geladen…», ohne Gegenstand «Wird geladen…». `hideLabel`
// versteckt den Wortlaut sr-only, wo das Symbol optisch reicht (Router,
// Karten-Overlay). Ersetzt die früheren Einzelbauten (Router-Inline,
// map-spinner-Inline, dash-map__loading-Textzeile).
export function loading({ label = 'Wird geladen…', hideLabel = false, size = 'xl' } = {}) {
  return `<div class="loading" role="status">
    ${icon('Spinner', `icon--${size} icon--spin`)}
    <span class="${hideLabel ? 'sr-only' : 'loading__label'}">${escape(label)}</span>
  </div>`;
}

const STATUS_VARIANT = {
  entwurf: 'gray', eingereicht: 'info', in_pruefung: 'warning', in_pruefung_gs: 'warning',
  in_pruefung_pfm: 'warning', rueckfrage: 'warning', in_arbeit: 'warning', triage: 'info',
  genehmigt: 'success', in_projekt: 'info', abgeschlossen: 'success', erledigt: 'success',
  geliefert: 'success', abgelehnt: 'error', zurueckgezogen: 'gray', in_bearbeitung: 'warning',
};
export function statusBadge(status, label) {
  return badge(label || status, STATUS_VARIANT[status] || 'gray');
}


// Seitenabschnitt in CDs Anatomie (section.postcss): das <section> ist das
// ÄUSSERE Element, der .container liegt darin. Nur so kann ein Hintergrund von
// Rand zu Rand laufen — `bg--*` gehört auf die Section, nie auf den Container.
//
// 40 von 42 Seiten rendern `<div class="container section">`, verschmelzen also
// beide Rollen in einem Element. Die Folge ist strukturell, nicht kosmetisch:
// keine solche Seite kann ein Wechselband, einen getönten Einstieg oder einen
// vollbreiten Aufruf tragen — sie ist ein einziges weisses Feld von der
// Brotkrume bis zum Footer. Die Startseite baut es richtig und liest sich
// dadurch als komponierte Seite.
//
// `alt` färbt das Band (secondary-50). Aufrufer wechseln es nach Reihenfolge
// durch, damit die Bänder sauber alternieren. Kein neues CSS: .section,
// .section--default, .section__title, .section__action und .bg--secondary-50
// existieren alle bereits.
export function pageSection({ title = '', body = '', more = null, alt = false, titleTag = 'h2' }) {
  return `<section class="section section--default${alt ? ' bg--secondary-50' : ''}">
      <div class="container">
        ${title ? `<${titleTag} class="section__title">${escape(title)}</${titleTag}>` : ''}
        ${body}
        ${more ? `<div class="section__action">
          <a class="btn btn--bare btn--icon-right" href="${escape(more.href)}">${icon('ArrowRight', 'btn__icon')}<span class="btn__text">${escape(more.label)}</span></a>
        </div>` : ''}
      </div>
    </section>`;
}

// `lead` wird escaped (Normalfall). `leadHtml` ist die bewusste Ausnahme für
// Leads mit Auszeichnung — etwa einem Verweis auf ein Nachbarsystem. Sie ist
// AUSSCHLIESSLICH für autoreneigenes Markup gedacht, nie für Daten aus dem Core
// oder aus Fremddiensten: dort bleibt `lead` und damit das Escaping Pflicht.
// Fixierter Hinweisstreifen am Fensterboden — CDs Consent-Bauteil
// (notification-banner.postcss + NotificationBanner.vue). Anatomie wie dort:
// `.notification-banner` (+ `--fixed`) trägt zusätzlich die `.notification`-
// Klassen, darin ein `__wrapper` mit `__infos` und der Aktion.
function notificationBanner({ id, html, actionLabel = 'Verstanden', variant = 'info', label = 'Hinweis' }) {
  return `<div class="notification-banner notification-banner--fixed notification notification--${escape(variant)}"
      role="region" aria-label="${escape(label)}" data-banner="${escape(id)}">
    <div class="notification-banner__wrapper">
      <p class="notification-banner__infos">${html}</p>
      <button type="button" class="btn btn--outline btn--sm btn--icon-right" data-banner-close>
        ${icon('Checkmark', 'btn__icon')}<span class="btn__text">${escape(actionLabel)}</span></button>
    </div>
  </div>`;
}

// Einhängen und das Wegklicken merken. Ohne Merken erschiene der Hinweis bei
// jedem Seitenwechsel neu — das ist der Grund, weshalb Consent-Bänder überhaupt
// einen Speicher brauchen.
export function mountBanner(host, opts) {
  if (!host) return;
  const key = 'bbl_banner_' + opts.id;
  let seen = false;
  try { seen = localStorage.getItem(key) === '1'; } catch { /* Speicher gesperrt */ }
  if (seen) return;
  host.innerHTML = notificationBanner(opts);
  const btn = host.querySelector('[data-banner-close]');
  if (btn) btn.addEventListener('click', () => {
    host.innerHTML = '';
    try { localStorage.setItem(key, '1'); } catch { /* dann kommt er eben wieder */ }
    announce('Hinweis geschlossen.');
  });
}

export function pageHeader({ title, lead, leadHtml }) {
  const body = leadHtml || (lead ? escape(lead) : '');
  return `<div class="page-header"><h1 tabindex="-1">${escape(title)}</h1>${body ? `<p class="lead">${body}</p>` : ''}</div>`;
}


// --- Cards (card.postcss) ----------------------------------------------------
export function card(o) {
  // `chips`: kurze Merkmale ALS AUFLAGE auf dem Bild statt als Pillenzeile im
  // Kartenkörper — dasselbe Muster wie die Galerie des Liegenschaften-Inventars
  // (`.pf-card__chips`, portfolio.js). Sinnvoll für Angaben, die man beim
  // Überfliegen des Rasters mitliest (Land, Status) und die im Text nur Platz
  // vor Titel und Beschreibung wegnehmen würden. `.card__image` ist bereits
  // `position:relative`, die Auflage braucht deshalb keinen eigenen Kasten.
  const chips = (o.chips || []).filter(Boolean);
  const overlay = chips.length
    ? `<div class="pf-card__chips">${chips.map((c) => `<span class="pf-card__land">${escape(c)}</span>`).join('')}</div>`
    : '';
  // `media` = fertiges Medien-HTML des Aufrufers (RAW — er escaped selbst): die
  // Explorer-Galerie braucht ihren eigenen Vis-Block (16:10-Kachel, Parzellen-
  // Schraffur) und rollte dafür vorher die GANZE Karte von Hand nach (portfolio
  // pfCard, Design-Review A11). Jetzt liefert sie nur das Medium, Körper und
  // Fuss kommen aus dieser einen Quelle.
  const media = o.media
    ? o.media
    : o.photo
    ? `<div class="card__image">${photo({ ...o.photo, alt: o.photo.alt || '', w: 640 })}${overlay}</div>`
    : o.image ? `<div class="card__image"><img src="${escape(o.image)}" alt="${escape(o.imageAlt || '')}" loading="lazy">${overlay}</div>`
    : o.placeholder ? `<div class="card__image"><div class="photo image__not-available">${icon('Image')}<p class="image__not-available-text">${escape(o.placeholder === true ? 'Bild folgt' : o.placeholder)}</p></div>${overlay}</div>`
    : '';
  // CD: `card--default` is the plain shadow card (with or without image);
  // `card--universal` is the variant whose image is letterboxed (object-contain),
  // so it stays opt-in via o.variant — image-less cards are default, not universal.
  const variant = o.variant || 'default';
  const tag = o.titleTag || 'h3';
  const ext = o.external ? ' target="_blank" rel="noopener external"' : '';
  // Stretched-Link-Muster (CD/WAI-ARIA APG): die Karte ist ein <div>, der Titel eine
  // echte Überschrift mit einem <a>, dessen ::after die ganze Karte klickbar macht.
  // So behält das Dokument seine Gliederung UND verschachtelte Links (Badges) bleiben
  // gültig (kein <a> in <a> mehr).
  // `breakable`: lange deutsche Komposita dürfen nach «/» und «-» umbrechen, sonst
  // reisst z. B. «Sicherheits-/Datenschutzvorfall» mitten im Wort (Item 5.8).
  const titleInner = o.href
    ? `<a class="card__link" href="${escape(o.href)}"${ext}>${breakable(o.title)}</a>`
    : breakable(o.title);
  // CD baut den Fuss aus ZWEI benannten Slots (card.postcss:245-257, Card.vue:27-37):
  // `footerInfo` (Metazeile) und `footerAction` (CTA). `footer` bleibt als Roh-Slot
  // für Altaufrufer. Ohne Info-Slot greift CDs --icon-only-Modifier, der den
  // früheren leeren <span></span>-Trick ersetzt (Item 5.12).
  const footerSlots = (o.footerInfo || o.footerAction)
    ? `<div class="card__footer${o.footerInfo ? '' : ' card__footer--icon-only'}">${
        o.footerInfo ? `<div class="card__footer__info">${o.footerInfo}</div>` : ''}${
        o.footerAction ? `<div class="card__footer__action">${o.footerAction}</div>` : ''}</div>`
    : (o.footer ? `<div class="card__footer">${o.footer}</div>` : '');
  const inner = `${media}
    <div class="card__content">
      <div class="card__body">
        <${tag} class="card__title">${titleInner}</${tag}>
        ${/* `idLine`: Kennungszeile in Mono direkt unter dem Titel (bbl_id,
              Projektnummer) — Rezept der Explorer-Galerie (.pf-card__id). */''}
        ${o.idLine ? `<p class="pf-card__id">${escape(o.idLine)}</p>` : ''}
        ${o.badges ? `<div class="pill-row">${o.badges.join('')}</div>` : ''}
        ${o.desc ? `<p class="card__description">${escape(o.desc)}</p>` : ''}
      </div>
      ${footerSlots}
    </div>`;
  return `<div class="card card--${variant}${o.href ? ' card--clickable' : ''}${o.cls ? ' ' + escape(o.cls) : ''}">${inner}</div>`;
}

// --- Tables (table.postcss) --------------------------------------------------
// DIE Tabelle des Portals. Jede Tabelle läuft hier durch — direkt oder über
// C.mountDataTable, das dieselbe Funktion mit Katalogleiste und Blätterleiste
// umgibt. Zweck ist die Einheitlichkeit: eine Schriftstärke je Zeile, Text
// links, Zahlen rechts, gleiche Polster, gleiche Trennlinien.
//
// columns: [{ key, label, render?(row), align?, width? }]
//   align: 'right' für Zahlen — richtet Kopf UND Zelle aus, macht die Spalte
//          schmal und setzt Tabellenziffern (siehe app.css).
//   width: explizite Spaltenbreite ('12rem', '25%') für die Fälle, in denen das
//          Schrumpfen nach Inhalt kein gutes Bild gibt. Landet im <colgroup>.
// rows: object[]; caption names the table.
// `foot` = fertiges <tr>…</tr>-HTML für eine <tfoot>-Zeile (z. B. eine Summenzeile);
// der Aufrufer escaped den Inhalt.
export function table({ columns, rows, zebra, caption, showCaption, foot, rowsClickable, emptyText }) {
  // `align: 'right'|'center'|'left'` je Spalte → CD-Ausrichtungs-Utility auf Kopf + Zelle.
  const al = (c) => c.align ? ` class="text-${c.align}"` : '';
  const head = columns.map(c => `<th scope="col"${al(c)}>${escape(c.label)}</th>`).join('');
  const body = (rows || []).map(r =>
    `<tr>${columns.map((c, i) => {
      const cell = c.render ? c.render(r) : escape(r[c.key]);
      return i === 0 ? `<th scope="row"${al(c)}>${cell}</th>` : `<td${al(c)}>${cell}</td>`;
    }).join('')}</tr>`
  ).join('');
  // `rowsClickable`: die ganze Zeile folgt dem ERSTEN Link in ihr. Das ist reine
  // Mausbequemlichkeit — die Bedienung mit Tastatur und Screenreader läuft
  // weiterhin über diesen Link. Ohne einen solchen Link tut die Zeile nichts;
  // ein `onclick` auf `<tr>` ohne Linkziel wäre für beide unerreichbar.
  const cls = ['table', zebra ? 'table--zebra' : '', showCaption ? 'table--caption' : '',
    rowsClickable ? 'table--rows-clickable' : ''].filter(Boolean).join(' ');
  // Nur eine benannte Tabelle wird zur benannten Region: `aria-label="Tabelle"`
  // war für 11 der 15 Tabellen der Name — im Landmarkenbaum standen elf
  // gleichnamige «Tabelle»-Regionen ohne Unterscheidungsmerkmal (Item 5.6).
  // Ohne Namen bleibt der Kasten ein reiner Scrollbereich; tabindex/role setzt
  // `wireScrollRegions` erst, wenn er wirklich überläuft.
  // <colgroup> nur, wenn mindestens eine Spalte eine Breite vorgibt — ein
  // colgroup aus lauter leeren <col> wäre wirkungslos, aber nicht kostenlos.
  const colgroup = columns.some((c) => c.width)
    ? `<colgroup>${columns.map((c) => `<col${c.width ? ` style="width:${escape(c.width)}"` : ''}>`).join('')}</colgroup>`
    : '';
  return `<div class="table-wrapper"${caption ? ` role="region" aria-label="${escape(caption)}"` : ''}>
    <table class="${cls}">
    ${caption ? `<caption>${escape(caption)}</caption>` : ''}
    ${colgroup}
    <thead><tr>${head}</tr></thead>
    <tbody>${body || `<tr><td colspan="${columns.length}" class="table__empty muted">${escape(emptyText || 'Keine Einträge.')}</td></tr>`}</tbody>
    ${foot ? `<tfoot>${foot}</tfoot>` : ''}
  </table>
  ${/* Sichtbarer Hinweis auf den waagrechten Überlauf (Item 5.7): eine Tabelle,
        die rechts weitergeht, sah bisher aus wie eine Tabelle, die dort endet —
        die abgeschnittene Spalte fand niemand. `position:sticky; left:0` hält den
        Hinweis beim Scrollen an seinem Platz; die Klasse `is-scrollable` setzt
        `wireScrollRegions`, der Hinweis erscheint also nur bei echtem Überlauf.
        aria-hidden: der Wrapper trägt Name + tabindex, und Hilfsmittel lesen
        Tabellen zellenweise statt zu scrollen. */''}
  <p class="table-wrapper__hint" aria-hidden="true">${icon('ArrowRight', 'icon--sm')}Tabelle seitlich scrollbar</p></div>`;
}

// Leerer Zustand. `unavailable: true` (P0-4) markiert «Daten nicht verfügbar»
// (Ladefehler) statt «keine Einträge» — mit Warnsymbol und error-Tönung.
// `hint` ergänzt einen zweiten, helfenden Satz (z. B. «Suche/Filter anpassen»).
export function empty(msg, opts = {}) {
  // EIN Name für diesen Zustand: `available: false`. Vorher hiess er hier
  // `unavailable: true` und im Zwillingsbauteil `catalogueResults` `available` —
  // gegenläufig benannt und gegenläufig gepolt. `news.js` übergab `available`
  // und erreichte den Ausfallpfad damit nie: fiel `news.json` aus, behauptete
  // die Seite, es gebe keine Meldungen. `unavailable` bleibt als Altname
  // gelesen, damit kein Aufrufer stillschweigend umkippt.
  if (opts.available === false || opts.unavailable) {
    return `<div class="empty empty--unavailable">${icon('WarningCircle', 'icon--base')}<span>${escape(msg)}</span></div>`;
  }
  // Angereicherter Leerzustand nur mit Hinweis; ohne bleibt es die schlichte Variante.
  // `action` gibt dem Nullzustand ein Bedienelement statt nur eines Rats: bisher
  // stand dort «Passen Sie Ihre Suche oder die Filter an» und der Weg dahin war
  // wieder nach oben zu scrollen und die Leiste zu finden. `href` navigiert,
  // `id` erwartet, dass der Aufrufer den Button verdrahtet.
  const action = opts.action
    ? (opts.action.href
      ? `<a class="btn btn--outline btn--sm empty__action" href="${escape(opts.action.href)}">${icon('Refresh', 'btn__icon icon--base')}<span class="btn__text">${escape(opts.action.label)}</span></a>`
      : `<button type="button" class="btn btn--outline btn--sm empty__action"${opts.action.id ? ` id="${escape(opts.action.id)}"` : ''}>${icon('Refresh', 'btn__icon icon--base')}<span class="btn__text">${escape(opts.action.label)}</span></button>`)
    : '';
  return (opts.hint || action)
    ? `<div class="empty"><p class="empty__title">${escape(msg)}</p>${
        opts.hint ? `<p class="empty__hint">${opts.hint}</p>` : ''}${action}</div>`
    : `<div class="empty">${escape(msg)}</div>`;
}

// Standard-«nicht gefunden»-Block für Detailrouten (zuvor mehrfach kopiert).
// Titel/Brotkrume setzt die aufrufende Seite; `body` ist HTML (mit Rück-Link).
export function notFound({ backHref, backLabel, title, body }) {
  return `<div class="container section">
    ${backLink(backHref, backLabel)}
    <div class="page-header mt-4"><h1 tabindex="-1">${escape(title)}</h1></div>
    <p class="muted">${body}</p>
  </div>`;
}

// Der ganze ABLAUF einer «nicht gefunden»-Antwort, nicht nur ihr Markup.
//
// Elf Stellen (acht Seiten, fünf Apps) hatten dieselben vier Schritte von Hand
// geschrieben: setTitle · setCrumbs · mount.innerHTML = notFound({…}) · return.
// `notFound` vereinheitlichte nur den letzten davon, und die elf Kopien liefen
// prompt auseinander — zwei setzten überhaupt keine Brotkrumen (die des zuvor
// besuchten Datensatzes blieben stehen), sechs schlossen sie mit «Nicht
// gefunden» ab, drei nicht.
//
// `thing` trägt das Geschlecht, das je Gegenstand wechselt («Dieses
// Bauprojekt», «Diese Anwendung», «Dieser Datensatz»). Wo der Satz mehr sagen
// muss als «… existiert nicht», ersetzt `body` ihn vollständig.
export function renderNotFound(ctx, {
  thing, title, backHref, backLabel, overview = backLabel, crumbs, body,
} = {}) {
  const { mount, setTitle, setCrumbs } = ctx;
  setTitle(title);
  if (crumbs) setCrumbs([...crumbs, { label: 'Nicht gefunden' }]);
  mount.innerHTML = notFound({ backHref, backLabel, title,
    body: body || `${thing} existiert nicht. <a href="${backHref}">Zur Übersicht «${escape(overview)}»</a>` });
}

// Aktive-Filter-Pillenreihe (zuvor in services/applications/katalog kopiert).
// filters = [{ label, href }] — href = dieselbe Ansicht ohne diesen einen Filter.
// Zwei Modi, gleiche Optik (`.active-filters` / `.active-filter`): Katalogseiten
// geben `href` je Pille + `resetHref` (Hash-Navigation, teilbar); JS-State-Seiten
// (Portfolio) geben stattdessen `remove` (Daten-Token je Pille) — dann werden die
// Pillen zu <button data-remove> und der Reset zu <button data-reset>, die der
// Aufrufer verdrahtet. `label` überschreibt den Vorspann «Aktive Filter:».
export function activeFilters({ filters, resetHref, resetLabel = 'Alle Filter zurücksetzen', label = 'Aktive Filter:' }) {
  if (!filters || !filters.length) return '';
  // id je Pille — sonst verliert das Entfernen einer Pille den Fokus an <body> (Item 3.3).
  // CDs interaktive Pille ist .tag-item (volle 44px-Höhenrampe + Fokusring,
  // tag-item.postcss:7-42) — die frühere 32px-Badge lag unter der Zielgrösse.
  const inner = (f) => `<span class="tag-item__inner"><span class="tag-item__text">${escape(f.label)}</span>${icon('Cancel', 'tag-item__icon')}</span>`;
  const pill = (f, i) => f.href != null
    ? `<a class="tag-item tag-item--sm active-filter" id="af-${i}" href="${escape(f.href)}" aria-label="Filter «${escape(f.label)}» entfernen">${inner(f)}</a>`
    : `<button type="button" class="tag-item tag-item--sm active-filter" id="af-${i}" data-remove="${escape(f.remove == null ? '' : f.remove)}" aria-label="Filter «${escape(f.label)}» entfernen">${inner(f)}</button>`;
  const reset = resetHref != null
    ? `<a class="btn btn--link" href="${escape(resetHref)}"><span class="btn__text">${escape(resetLabel)}</span></a>`
    : `<button type="button" class="btn btn--link" data-reset><span class="btn__text">${escape(resetLabel)}</span></button>`;
  // Der Abstand über der Pillenreihe liegt in der Komponentenregel
  // (.active-filters, CD-Rampe pt-4/sm:pt-6/2xl:pt-8 — search.postcss:266-269),
  // nicht in einer festen mt-4-Utility, die die Rampe bei >=640px festnageln würde.
  return `<div class="active-filters" role="group" aria-label="Aktive Filter">
    <span class="small muted">${escape(label)}</span>
    ${filters.map(pill).join('')}
    ${reset}
  </div>`;
}

// Ansage in die persistente Live-Region (#live in index.html) — für Trefferzahl-,
// Ansichts- und Seitenwechsel, die sonst still wären (WCAG 4.1.3). Nur Text
// mutieren, nie den Knoten neu erzeugen, sonst feuert aria-live nicht.
export function announce(msg) {
  const n = document.getElementById('live');
  if (n) n.textContent = msg;
}

// Ersetzt `mount.innerHTML` und stellt Fokus + Cursorposition wieder her, sofern
// das aktive Element eine id trägt. Ein voller innerHTML-Austausch lässt
// document.activeElement sonst auf <body> zurückfallen: im Buchungsformular ging
// nach jeder Auswahl Fokus UND Schreibmarke verloren und Tab begann wieder am
// Seitenkopf (WCAG 2.4.3 / 3.2.2). Rückgabe: true, wenn der Fokus zurückgesetzt wurde.
// Merkt sich Fokus + Schreibmarke und gibt eine Funktion zurück, die beides nach
// dem Neuaufbau wiederherstellt. Als Paar (statt als rerender(mount, html)), weil
// die draw()-Funktionen mehrzeilige Template-Literale mit verschachtelten
// Backticks schreiben und weil der Fokus so auch das erneute Verdrahten in
// wire() überlebt:
//     const restore = C.preserveFocus(mount);
//     mount.innerHTML = `…`;  wire();  restore();
export function preserveFocus(mount) {
  const a = document.activeElement;
  const id = a && mount.contains(a) ? a.id : '';
  const sel = a && typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null;
  return () => {
    if (!id) return false;
    const el = mount.querySelector('#' + CSS.escape(id));
    if (!el) return false;
    el.focus({ preventScroll: true });
    if (sel && el.setSelectionRange) { try { el.setSelectionRange(sel[0], sel[1]); } catch { /* nicht alle Feldtypen */ } }
    return true;
  };
}


// Macht `tabindex` an Scrollbereichen davon abhängig, dass wirklich etwas
// überläuft — ein unbedingtes tabindex="0" erzeugt auf breiten Viewports einen
// toten Tab-Stopp. `.table-wrapper` machte das bisher unbedingt; hier ist es
// gemessen. Ausserdem wird die Region nur dann als Gruppe angesagt, wenn sie
// wirklich scrollt (Item 3.21).
const SCROLL_SEL = '[data-scroll-region], .table-wrapper, pre.api-code';
export function wireScrollRegions(root) {
  const scan = () => {
    root.querySelectorAll(SCROLL_SEL).forEach((el) => {
      const scrolls = el.scrollWidth > el.clientWidth + 1;
      el.classList.toggle('is-scrollable', scrolls);
      if (scrolls) {
        el.setAttribute('tabindex', '0');
        // Eine Region/Gruppe OHNE Namen ist für Hilfsmittel schlechter als keine:
        // sie erscheint als anonymer Knoten im Landmarken-/Gruppenbaum. Nur wer
        // einen Namen mitbringt, wird auch zur benannten Gruppe erklärt.
        const named = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        if (named && !el.hasAttribute('role')) el.setAttribute('role', 'group');
        if (!named) el.removeAttribute('role');
      } else {
        el.removeAttribute('tabindex');
        el.removeAttribute('role');
      }
    });
  };
  scan();
  // Zwei Auslöser: Breitenwechsel (Überlauf entsteht/verschwindet) UND
  // Nachrendern (mountDataTable, renderMain, Tabwechsel tauschen ganze Teilbäume
  // aus — die neuen Wrapper waren sonst nie erfasst und blieben ohne tabindex).
  let pending = 0;
  const queue = () => { if (pending) return; pending = requestAnimationFrame(() => { pending = 0; scan(); }); };
  const mo = typeof MutationObserver === 'function' ? new MutationObserver(queue) : null;
  if (mo) mo.observe(root, { childList: true, subtree: true });
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(queue) : null;
  if (ro) ro.observe(root);
  return () => {
    if (pending) cancelAnimationFrame(pending);
    if (mo) mo.disconnect();
    if (ro) ro.disconnect();
  };
}

// Fokusfalle für modale Overlays (Lightbox, Chart-Vollbild, Dokumentvorschau):
// Tab/Shift+Tab bleiben innerhalb von `container`. Gibt eine Abmelde-Funktion
// zurück. Geteilt, damit alle Dialoge identisch fangen (WCAG 2.4.3 / 2.1.2).
// Exportiert, damit Overlays mit eigener Tastaturlogik (Galerie, Dokument-
// betrachter) DENSELBEN Fokuskreis verwenden — drei abweichende Kopien dieser
// Liste haben bereits einen Trap-Ausbruch produziert (Review lb-trap-1).
export const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
export function trapFocus(container) {
  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const f = [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}

// Kanonisches Modal (CD modal.postcss BEM). `modal()` liefert das Markup, `openModal()`
// hängt es an document.body, fängt den Fokus, schliesst bei Escape / Backdrop-Klick /
// [data-modal-close] und gibt den Fokus zurück. Primitive für neue Dialoge; `body`/
// `footer` sind RAW-HTML (Aufrufer escaped). `size` = sm|md|lg|xl.
function modal({ title = '', body = '', footer = '', size = 'md', id = 'modal' } = {}) {
  const titleId = `${id}-title`, bodyId = `${id}-desc`;
  // Zugänglicher Name «Dialog schliessen» — die Familie benennt überall den
  // Kontext («Galerie schliessen», «Vorschau schliessen», «Hinweis schliessen»);
  // das Modal war das einzige nackte «Schliessen» (Design-Review D15).
  const closeBtn = `<button type="button" class="modal__close" data-modal-close aria-label="Dialog schliessen">${icon('Cancel', 'icon--2xl')}</button>`;
  // CD Modal.vue:2-27 — aria-modal auf der Hülle; role="dialog" + aria-labelledby
  // + aria-describedby auf .modal__content; der Körper trägt die referenzierte id.
  // Der Header existiert IMMER (ohne ihn streckte die Flex-Spalte den Schliessen-
  // Knopf auf volle Breite); `--with-title` schaltet nur die Verteilung um.
  return `<div class="modal modal--${size}" aria-modal="true">
    <div class="modal__backdrop" data-modal-close></div>
    <div class="modal__content" role="dialog"${title ? ` aria-labelledby="${escape(titleId)}"` : ''} aria-describedby="${escape(bodyId)}">
      <div class="modal__header${title ? ' modal__header--with-title' : ''}">${title ? `<h2 class="modal__title" id="${escape(titleId)}">${escape(title)}</h2>` : ''}${closeBtn}</div>
      <div class="modal__body" id="${escape(bodyId)}">${body}</div>
      ${footer ? `<div class="modal__footer">${footer}</div>` : ''}
    </div>
  </div>`;
}
function openModal(opts = {}) {
  const trigger = document.activeElement;
  const host = document.createElement('div');
  host.innerHTML = modal(opts);
  const el = host.firstElementChild;
  document.body.appendChild(el);
  document.body.classList.add('body--overlay-open');   // der EINE Scroll-Lock (Modal, Galerie, Dokumentbetrachter)
  const untrap = trapFocus(el);
  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    untrap(); el.remove(); document.body.classList.remove('body--overlay-open');
    if (trigger && trigger.focus) trigger.focus();
  };
  // stopPropagation, nicht nur preventDefault: ein Modal ist modal. Ohne das
  // erreichte dasselbe Escape auch die Galerie darunter und schloss BEIDE auf
  // einmal — der Listener des Modals läuft in der Erfassungsphase und damit
  // zuerst, sodass ein blosser Wächter «liegt ein Modal darüber?» ins Leere lief.
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault(); e.stopPropagation();
    close();
  };
  el.addEventListener('click', (e) => { if (e.target.closest('[data-modal-close]')) close(); });
  document.addEventListener('keydown', onKey, true);
  const first = el.querySelector('.modal__close'); if (first) first.focus();
  return close;
}

// Kartenfuss in der CD-Anatomie (Card.vue:27-37, card.postcss:245-257):
// `card__footer__info` links, `card__footer__action` rechts. Die Aktion ist im
// CD ein Icon-only-Outline-Button — der Pfeil ist sichtbar, die Beschriftung
// steht sr-only (btn.postcss:160-166). Es gibt im CD also gar keinen sichtbaren
// «Öffnen»-Text.
//
// Hier ist die ganze Karte ein <a>, deshalb darf die Aktion kein zweiter Link
// sein (verschachtelte <a> sind ungültig und erzeugten bisher einen Pseudolink:
// ein <span class="btn btn--link">Öffnen</span>, das wie ein Bedienelement
// aussah, aber weder fokussierbar war noch als Link angekündigt wurde). Sie ist
// deshalb rein dekorativ und für Hilfsmittel ausgeblendet — den zugänglichen
// Namen und die Aktion trägt der Kartenlink selbst.
export function cardAction({ external = false } = {}) {
  return `<span class="btn btn--outline btn--icon-only" aria-hidden="true">${icon(external ? 'External' : 'ArrowRight', 'btn__icon icon--base')}</span>`;
}

function cardFooter(meta = '', opts = {}) {
  return `<div class="card__footer${meta ? '' : ' card__footer--icon-only'}">
    ${meta ? `<div class="card__footer__info">${meta}</div>` : ''}
    <div class="card__footer__action">${cardAction(opts)}</div>
  </div>`;
}

// Icon-Kachel (domain-tile): bildlose Karte mit grossem Icon, Titel, Text und
// Pfeil-Fuss. Eine Quelle für die Übersichtskarten (Daten, Wissen,
// Digitalisierung) — bildlose Karten sind card--default (CD, nicht --universal).
export function domainTile({ icon: ic, title, desc, meta = '', href, external = false, titleTag = 'h3' }) {
  const ext = external ? ' target="_blank" rel="noopener external"' : '';
  // Dasselbe Stretched-Link-Muster wie card(): die Karte ist ein <div>, der
  // Titel-<a> deckt sie per ::after ab. Im CD ist die Kartenwurzel IMMER ein div
  // (Card.vue:2-39) — die frühere Ganzkarten-<a> gab Screenreadern Titel +
  // Beschreibung + Meta als einen langen Linknamen.
  return `<div class="card card--default card--clickable">
    <div class="card__content">
      <div class="card__body">
        <span class="domain-tile__icon">${icon(ic, 'icon--2xl')}</span>
        <${titleTag} class="card__title"><a class="card__link" href="${escape(href)}"${ext}>${escape(title)}</a></${titleTag}>
        <p class="card__description">${escape(desc)}</p>
      </div>
      ${cardFooter(escape(meta), { external })}
    </div>
  </div>`;
}

// Share-Bar (share-bar.postcss) — nach der Brotkrume auf Detailseiten: Drucken
// und Link kopieren. Rechtsbündig (flex-row-reverse) wie im CD.
function shareBar() {
  // CD: nur Icons (aria-label), keine sichtbaren Beschriftungen, grosse Icons (ShareBar.vue, SvgIcon size="xl").
  // Der Teilen-Knopf öffnet den CD-Dialog (openShareModal) — vorher kopierte er
  // still in die Zwischenablage: ohne Rückmeldung, ohne sichtbare URL und ohne
  // Ausweg, wenn die Clipboard-API blockiert ist.
  return `<div class="share-bar">
    <div class="share-container">
      <button class="btn btn--bare share-bar__btn" type="button" onclick="window.print()" aria-label="Seite drucken" title="Drucken">${icon('Printer', 'icon--xl')}</button>
      <button class="btn btn--bare share-bar__btn share-bar__share-button" type="button" data-share
        aria-label="Inhalt teilen" title="Teilen">${icon('Share', 'icon--xl')}</button>
    </div>
  </div>`;
}

// «Inhalt teilen» — CDs Muster (detailPageSimple.vue:810-866): ein Modal in der
// Grösse xs mit einem SCHREIBGESCHÜTZTEN Eingabefeld, das die URL zeigt, darunter
// `.share-url` mit dem Kopieren-Knopf und einer Live-Region, die den Erfolg
// meldet. CDs Vorlage führt darüber noch eine Reihe sozialer Netzwerke
// (Facebook/X/LinkedIn/Xing/WhatsApp); die lassen wir weg — ein internes
// Bundesportal teilt seine Inhalte nicht auf kommerziellen Plattformen.
//
// Warum ein sichtbares Feld statt nur «kopiert»: die Clipboard-API braucht einen
// sicheren Kontext und kann blockiert sein. Steht die URL im Feld, lässt sie sich
// immer noch von Hand markieren — die Funktion fällt also nie ganz aus.
function shareUrlBlock(url, { id = 'share-url-input' } = {}) {
  return `<div class="pt-3">
    <label class="sr-only" for="${escape(id)}">Link zu diesem Inhalt</label>
    <input id="${escape(id)}" class="input--outline input--base" type="text" readonly
      value="${escape(url)}" data-share-url>
    <div class="share-url">
      ${/* CD detailPageSimple.vue:847-853: reiner Beschriftungs-Button (outline,
            mt-3) — die Vorlage führt KEIN Link-Icon auf dem Kopieren-Knopf. */''}
      ${/* «Link kopieren» wie die fünf Menü-Einträge und der Toast «Link
            kopiert.» — CDs Demo sagt «URL Kopieren» (detailPageSimple.vue:850),
            dessen Binnengrosschreibung aber kein Standarddeutsch ist; bewusste
            Abweichung, dokumentiert in docs/design-review.md. */''}
      <button type="button" class="btn btn--outline mt-3" data-share-copy>
        <span class="btn__text">Link kopieren</span></button>
      <div aria-live="polite" data-share-done></div>
    </div>
  </div>`;
}

export function openShareModal(url = location.href, title = 'Inhalt teilen') {
  // CD legt den Inhalt in eine weisse .card (detailPageSimple.vue:817) — die
  // Kopfzeile steht darüber in weisser Schrift auf dem Scrim.
  const close = openModal({ title, size: 'xs',
    body: `<div class="card card--default"><div class="card__content"><div class="card__body">${shareUrlBlock(url)}</div></div></div>` });
  const root = document.querySelector('.modal--xs') || document;
  const input = root.querySelector('[data-share-url]');
  const btn = root.querySelector('[data-share-copy]');
  const done = root.querySelector('[data-share-done]');
  if (input) { input.focus(); input.select(); }
  if (btn) btn.addEventListener('click', () => {
    // Badge-Anatomie wie CD (Badge.vue:11-12): badge__icon-left vor badge__text.
    const ok = () => { if (done) done.innerHTML = `<span class="badge badge--success badge--sm mt-3">${icon('Checkmark', 'badge__icon-left')}<span class="badge__text">Link kopiert</span></span>`; };
    const fail = () => { if (done) done.innerHTML = `<span class="badge badge--warning badge--sm mt-3">${icon('WarningCircle', 'badge__icon-left')}<span class="badge__text">Kopieren nicht möglich — bitte von Hand markieren</span></span>`; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(ok, fail);
    } else if (input) {
      // Rückfallebene ohne Clipboard-API.
      try { input.select(); document.execCommand('copy'); ok(); } catch { fail(); }
    } else fail();
  });
  return close;
}

// Ein Klick auf einen Teilen-Knopf öffnet den Dialog — einmal global verdrahtet,
// damit jede Seite mit einer share-bar ihn bekommt, ohne selbst etwas zu tun.
export function wireShare(root = document) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-share]');
    if (!b) return;
    e.preventDefault();
    openShareModal(b.dataset.share || location.href);
  });
}

// Kopfleiste einer Detailseite: Zurück-Link links, Share-Bar rechts — in EINER
// Zeile (CD: .back-bar + .share-bar auf derselben Höhe nach der Brotkrume).
export function detailBar({ backHref, backLabel } = {}) {
  return `<div class="detail-bar">${
    backHref ? backLink(backHref, backLabel) : '<span></span>'}${shareBar()}</div>`;
}

// Vereinheitlichter Detailseiten-Kopf (CD detailPage*-Muster): detailBar (Zurück +
// Share) und danach ein Hero mit Titel, Lead, Auszeichnungen und optionalem
// Kontextbild (hero--main-image). Ohne `image` fällt der Hero auf die schmale
// Variante zurück. `tags`/`image` sind fertiges HTML; `title`/`lead` werden escaped.
// Kontextbild für den Detailseiten-Hero. Stand wortgleich in services.js und
// digitalisierung.js — inklusive der `<figure>` ohne Randrücksetzung, die dort
// den UA-Standardrand (margin:1em 40px) behielt: das Bild füllte seine
// Rasterspalte nicht und stand links wie rechts 40px eingerückt. Die figcaption
// trug ausserdem `class="small muted"`, obwohl `figcaption` seit Item 1.6 global
// von `.legend` erbt — die Klassen setzten also einen fünften Legendenstil.
// KEINE Bildlegende auf Detailseiten (Nutzerentscheid 2026-07-30): die
// Unsplash-Platzhalter trugen mal einen «Symbolbild»-Vermerk, mal keinen —
// für den Prototyp einheitlich ohne. Die Startseite (echtes BBL-Foto mit
// ©-Vermerk) schreibt ihre figcaption selbst und behält sie. Der `credit`-
// Parameter bleibt als Schnittstelle bestehen, wird aber nicht gerendert.
export function heroFigure({ src, id, color = 'var(--color-secondary-600)', alt = '', w = 800, ratio = '' } = {}) {
  if (!src && !id) return '';
  const ratioClass = { '16x9': 'photo--16x9', '4x3': 'photo--4x3', '21x9': 'photo--21x9' }[ratio]
    || 'hero-media--natural';
  return `<figure class="hero__figure">${photo({ src, id, color, alt, w, cls: ratioClass })}</figure>`;
}

export function detailHead({ backHref, backLabel, title, lead = '', tags = '', image = '' } = {}) {
  const content = `<div class="hero__content">
        <h1 class="hero__title" tabindex="-1">${escape(title)}</h1>
        ${lead ? `<p class="hero__description">${escape(lead)}</p>` : ''}
        ${tags ? `<div class="pill-row">${tags}</div>` : ''}
      </div>`;
  // CD Hero.vue:8 — der Hero ist ein <section>-Band, kein blosses <div>: gleiche
  // Optik (alle Regeln sind Klassenselektoren), aber Gliederungs-/Outline-Parität.
  const hero = image
    ? `<section class="hero hero--main-image">${content}<div class="hero__image">${image}</div></section>`
    : `<section class="hero">${content}</section>`;
  return `${detailBar({ backHref, backLabel })}
    ${hero}`;
}

// Horizontaler Status-Stepper (CD steps / tenant-portal pipeline): Chevron-Segmente
// — erledigt (grün, Haken) · aktuell (Primärfarbe, Uhr) · offen (grau). `steps` =
// [{ label }]; `currentIndex` = Index des aktuellen Schritts. Scrollt horizontal auf Mobil.
export function pipeline(steps, currentIndex = 0, { label = 'Statusverlauf' } = {}) {
  const seg = (st, i) => {
    const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'todo';
    const glyph = state === 'done' ? icon('Checkmark', 'icon--sm pipeline__glyph')
      : state === 'active' ? icon('Clock', 'icon--sm pipeline__glyph') : '';
    const sr = state === 'done' ? '<span class="sr-only">Erledigt: </span>'
      : state === 'active' ? '<span class="sr-only">Aktueller Schritt: </span>' : '';
    return `<li class="pipeline__step pipeline__step--${state}"${state === 'active' ? ' aria-current="step"' : ''}>${glyph}<span>${sr}${escape(st.label)}</span></li>`;
  };
  // aria-label wandert auf den Wrapper, das <ol> bleibt eine reine Liste (damit
  // die Listensemantik erhalten bleibt). KEIN `data-scroll-region` mehr: der
  // Streifen bricht um, statt zu scrollen — es gibt also nichts mehr zu
  // scrollen und damit auch keinen Tastaturzugang zu einer Scrollfläche.
  return `<div class="pipeline-wrap" role="group" aria-label="${escape(label)}">`
    + `<ol class="pipeline">${steps.map(seg).join('')}</ol></div>`;
}


// Ein Detailseiten-Abschnitt: Titel + Inhalt. `body` ist fertiges HTML.
// `titleTag` wie bei pageSection — in Registerkarten sitzt der Abschnitt unter
// einer h2 und braucht eine h3; vorher kopierten zwei Aufrufer dafür das ganze
// Markup von Hand (Design-Review, pages).
export function detailSection({ title, body = '', titleTag = 'h2' }) {
  return `<section class="detail-section">
      <${titleTag} class="detail-section__title">${escape(title)}</${titleTag}>
      ${body}
    </section>`;
}

// CD-Akkordeon (accordion.postcss): ul > li > h3 > button (.accordion__title +
// optionale .accordion__meta + .accordion__arrow) + .accordion__drawer >
// .accordion__content. `items` = [{ title, meta?, body, open? }]; `title` wird
// escaped, `meta`/`body` sind fertiges HTML. Verdrahtung über wireAccordion().
export function accordion(items, { id = 'acc' } = {}) {
  const li = ({ title, meta = '', body = '', open = false }, i) => {
    const bid = `${id}-b-${i}`, pid = `${id}-p-${i}`;
    return `<li class="accordion__item">
      <h3 class="accordion__heading">
        <button class="accordion__button" type="button" id="${bid}" aria-expanded="${open}" aria-controls="${pid}">
          <span class="accordion__title">${escape(title)}</span>
          <span class="accordion__meta">${meta}${icon('ChevronDown', 'icon--xl accordion__arrow')}</span>
        </button>
      </h3>
      <div class="accordion__drawer" id="${pid}" role="region" aria-labelledby="${bid}"${open ? '' : ' hidden'}>
        <div class="accordion__content">${body}</div>
      </div>
    </li>`;
  };
  return `<ul class="accordion" id="${id}-acc">${items.map(li).join('')}</ul>`;
}

// Klick-Verdrahtung für ein oder mehrere Akkordeons in `root` (aria-expanded +
// Drawer ein-/ausblenden). Ersetzt die je Seite kopierte Toggle-Logik.
export function wireAccordion(root) {
  root.querySelectorAll('.accordion__button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      const drawer = root.querySelector('#' + CSS.escape(btn.getAttribute('aria-controls')));
      if (!drawer) return;
      // CD Accordion.js:27-43 — max-height wird animiert (300ms ease-out, Regel
      // am .accordion__drawer); [hidden] fällt erst nach `transitionend`, damit
      // Messung und Übergang greifen. `_accSeq` entwertet den Abschluss-Handler,
      // wenn ein schneller Gegenklick die Richtung wechselt. Bei reduced-motion
      // ist die Dauer ~0 (tokens.css), transitionend feuert trotzdem.
      const seq = (drawer._accSeq = (drawer._accSeq || 0) + 1);
      const done = (fn) => {
        const te = (e) => {
          if (e.propertyName !== 'max-height') return;
          drawer.removeEventListener('transitionend', te);
          if (drawer._accSeq === seq) fn();
        };
        drawer.addEventListener('transitionend', te);
      };
      if (open) {
        drawer.style.maxHeight = drawer.scrollHeight + 'px';
        requestAnimationFrame(() => { drawer.style.maxHeight = '0px'; });
        done(() => { drawer.hidden = true; drawer.style.maxHeight = ''; });
      } else {
        drawer.hidden = false;
        drawer.style.maxHeight = '0px';
        requestAnimationFrame(() => { drawer.style.maxHeight = drawer.scrollHeight + 'px'; });
        done(() => { drawer.style.maxHeight = ''; });
      }
    });
  });
}

// --- Tabs (tab.postcss) ------------------------------------------------------
// Eine APG-Tab-Implementierung (roving tabindex, Klick + Pfeil/Home/End) statt
// fünf leicht abweichender Kopien — davon eine ohne Tastatur (projects). `items`
// = [{ id, label, icon? }]; `id` ist ein Entwickler-Slug (dient zugleich als
// Selektor-/aria-Ziel, daher nicht escaped), `label` wird escaped.
//
// tabBar rendert nur die Registerkarten-Leiste. `panelId` verlinkt ALLE Tabs auf
// EIN gemeinsames Panel (Einzel-Panel-/Neurender-Muster, z. B. dataportal); ohne
// `panelId` zeigt jeder Tab auf sein eigenes `${idPrefix}-panel-${id}` (Mehr-
// Panel-Muster, s. tabPanels).
export function tabBar({ items, active, idPrefix = 'tab', ariaLabel = '', panelId = '', controlsClass = '' } = {}) {
  const btns = items.map((t) => {
    const on = t.id === active;
    const controls = panelId || `${idPrefix}-panel-${t.id}`;
    return `<button type="button" role="tab" id="${idPrefix}-${t.id}" aria-controls="${controls}"`
      + ` class="tab__control${on ? ' tab__control--active' : ''}" aria-selected="${on}"`
      + ` tabindex="${on ? '0' : '-1'}" data-tab="${t.id}">`
      + `${t.icon ? icon(t.icon, 'icon--base') + ' ' : ''}${escape(t.label)}</button>`;
  }).join('');
  return `<div class="tab__controls-container"><div class="tab__controls${controlsClass ? ' ' + controlsClass : ''}"`
    + ` role="tablist"${ariaLabel ? ` aria-label="${escape(ariaLabel)}"` : ''}>${btns}</div></div>`;
}

// Mehr-Panel-Markup (Pattern A): ein .tab__container je Tab, inaktive `hidden`.
// `render(id)` liefert das fertige Panel-HTML. Für das Einzel-Panel-Muster stellt
// der Aufrufer sein eigenes Panel und lässt wireTabs den Inhalt neu rendern.
// `heading: true` stellt jedem Panel eine sr-only-<h2> mit der Tab-Beschriftung
// voran. `aria-labelledby` benennt das Panel nur, sobald der Fokus darin liegt —
// für die Überschriftennavigation (WCAG 2.4.10) fehlte auf reinen Tab-Seiten
// jede Stufe zwischen der <h1> und den <h3> im Panelinhalt.
export function tabPanels({ items, active, idPrefix = 'tab', render, heading = false }) {
  return items.map((t) =>
    `<div class="tab__container" role="tabpanel" id="${idPrefix}-panel-${t.id}"`
    + ` aria-labelledby="${idPrefix}-${t.id}" tabindex="0" data-panel="${t.id}"`
    + `${t.id === active ? '' : ' hidden'}>`
    + `${heading ? `<h2 class="sr-only">${escape(t.label || t.id)}</h2>` : ''}`
    + `${render(t.id)}</div>`).join('');
}

// Verdrahtet die Tab-Leiste(n) in `root`: Klick + Pfeiltasten/Home/End, roving
// tabindex, aria-selected. Vorhandene [data-panel]-Panels werden automatisch
// umgeblendet (Pattern A); `onSelect(id)` rendert bei Einzel-Panel/Neurender den
// Inhalt (Pattern B). `syncHash(id)` spiegelt optional den Tab in die Hash-Query.
// Fokus wird nach `onSelect` per Neuabfrage gesetzt, überlebt also ein Neurender.
export function wireTabs(root, { onSelect, syncHash } = {}) {
  const btns = [...root.querySelectorAll('.tab__control')];
  const panels = [...root.querySelectorAll('[data-panel]')];
  const single = root.querySelectorAll('[role="tabpanel"]');
  const activate = (id) => {
    let activeBtn = null;
    btns.forEach((b) => {
      const on = b.dataset.tab === id;
      if (on) activeBtn = b;
      b.classList.toggle('tab__control--active', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p) => { p.hidden = p.dataset.panel !== id; });
    if (single.length === 1 && activeBtn) single[0].setAttribute('aria-labelledby', activeBtn.id);
    if (onSelect) onSelect(id);
    if (syncHash) syncHash(id);
    // Fokus per Neuabfrage — überlebt ein Neurender durch onSelect; für Maus-
    // Klicks unsichtbar (:focus-visible greift nur bei Tastatur), für die Tastatur
    // korrekt (roving). No-op, wenn die Leiste unverändert bleibt.
    (root.querySelector(`.tab__control[data-tab="${id}"]`) || activeBtn)?.focus();
  };
  btns.forEach((btn, i) => {
    btn.addEventListener('click', () => activate(btn.dataset.tab));
    btn.addEventListener('keydown', (e) => {
      let ni = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') ni = (i + 1) % btns.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ni = (i - 1 + btns.length) % btns.length;
      else if (e.key === 'Home') ni = 0;
      else if (e.key === 'End') ni = btns.length - 1;
      if (ni !== null) { e.preventDefault(); activate(btns[ni].dataset.tab); }
    });
  });
  // Ein per `?tab=` tief verlinkter Tab kann in einer scrollenden Leiste ausserhalb
  // des Sichtfelds liegen — dann sieht der Nutzer eine Leiste, in der scheinbar
  // kein Tab aktiv ist (Item 3.18). `nearest` scrollt nur, wenn nötig.
  const cur = root.querySelector('.tab__control--active');
  if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return { activate };
}

// --- Notifications (notification.postcss) ------------------------------------
// Einmalige, delegierte Verdrahtung des Schliessen-Knopfs aller Notifications —
// Hausregel «kein inline onclick» (vgl. menu()); die Ansage über die persistente
// #live-Region entspricht mountBanner («Hinweis geschlossen.», CD Notification.vue
// bindet den Handler ebenfalls programmatisch).
let notifCloseWired = false;
function ensureNotificationClose() {
  if (notifCloseWired || typeof document === 'undefined') return;
  notifCloseWired = true;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('[data-notification-close]');
    if (!btn) return;
    const n = btn.closest('.notification');
    if (!n) return;
    n.remove();
    announce('Hinweis geschlossen.');
  });
}

// variant: info | success | warning | error | hint | alert
export function notification(text, variant = 'info', iconName = 'InfoCircle', opts = {}) {
  // `live: true` NUR für Meldungen, die als Ergebnis einer Aktion neu eintreffen.
  // Vorher trug jede Notification eine Live-Rolle — auch die statischen Hinweise,
  // die schon beim Laden im Markup stehen. Screenreader lasen die Seite dann als
  // Folge von Statusmeldungen vor, und in einer neu erzeugten Region feuert
  // aria-live ohnehin nicht (Item 3.9).
  const role = opts.live ? ((variant === 'error' || variant === 'alert') ? 'alert' : 'status') : '';
  if (opts.dismissible) ensureNotificationClose();
  const close = opts.dismissible
    ? `<button type="button" class="notification__close" aria-label="Hinweis schliessen" data-notification-close>${icon('Cancel', 'icon--md')}</button>`
    : '';
  const cls = `notification notification--${variant}${opts.dismissible ? ' notification--dismissible' : ''}`;
  return `<div class="${cls}"${role ? ` role="${role}"` : ''}>${icon(iconName, 'notification__icon')}<div class="notification__content">${text}</div>${close}</div>`;
}

// Der Abschluss eines eingereichten Vorgangs. Vier Formular-Apps hatten ihn von
// Hand gebaut — Erfolgsmeldung mit Referenz, Dankesüberschrift, Erklärsatz,
// Knopfreihe — und liefen genau dort auseinander, wo es zählt: space-request
// schrieb sein `<div class="notification notification--success">` selbst und
// verlor damit `.notification__content`, also die Textbreitenbegrenzung;
// workspace nutzt eine h2 (richtig, die Seite hat schon eine h1), die anderen
// eine h1; die Knöpfe waren dreimal `btn--outline`, einmal `btn--filled`.
//
//   lead     Satz in der Erfolgsmeldung («Antrag eingereicht.»)
//   title    Überschrift · `heading:'h2'`, wo die Seite ihre h1 schon hat
//   text     Erklärsatz darunter
//   extra    optionaler HTML-Block dazwischen (Merkmalliste, Zusatzhinweis)
//   actions  [{ href | id, label, variant, icon }] — erste Aktion gefüllt
export function processDone({ instance, lead, title, heading = 'h1', text,
  extra = '', actions = [] } = {}) {
  const knopf = (a, i) => {
    const cls = `btn btn--${a.variant || (i === 0 ? 'filled' : 'outline')}${a.icon ? ' btn--icon-right' : ''}`;
    const inhalt = `${a.icon ? icon(a.icon, 'btn__icon') : ''}<span class="btn__text">${escape(a.label)}</span>`;
    return a.href
      ? `<a class="${cls}" href="${escape(a.href)}">${inhalt}</a>`
      : `<button class="${cls}" type="button" id="${escape(a.id)}">${inhalt}</button>`;
  };
  return `
    ${notification(`<strong>${escape(lead)}</strong> Ihre Referenz: <strong>${escape(instance.reference)}</strong>`,
      'success', 'CheckmarkCircle')}
    <${heading} tabindex="-1" class="mt-6">${escape(title)}</${heading}>
    <p class="lead">${text}</p>
    ${extra}
    ${actions.length ? `<div class="row mt-6">${actions.map(knopf).join('')}</div>` : ''}`;
}

// CD step-indicator.postcss:5-24 / StepIndicator.vue:2-9 — EINE nummerierte
// Schrittanzeige statt der zwei hand-gerollten Kopien in space-request und
// transaction (Item 3.10). Liefert CDs `.step__indicator`-Wrapper, auf den die
// Union-Selektoren aus Item 1.17d/2.3 schon vorbereitet sind.
export function stepIndicator(labels, current = 0, { label = 'Fortschritt' } = {}) {
  const li = (l, i) => {
    const done = i < current, active = i === current;
    const mod = done ? ' step__indicator-step--confirmed' : active ? ' step__indicator-step--active' : '';
    const sr = done ? 'Erledigt: ' : active ? 'Aktueller Schritt: ' : 'Offen: ';
    return `<li class="step__indicator"${active ? ' aria-current="step"' : ''}>`
      + `<span class="step__indicator-step${mod}">${done ? icon('CheckmarkBold', 'icon--sm') : i + 1}</span>`
      + `<span><span class="sr-only">${sr}Schritt ${i + 1} von ${labels.length}: </span>${escape(l)}</span></li>`;
  };
  return `<ol class="steps" aria-label="${escape(label)}">${labels.map(li).join('')}</ol>`;
}

// Blendet einen Fehler oben in der Seite ein und sagt ihn an — für clientseitige
// Aktionsfehler (z. B. localStorage-Speichern fehlgeschlagen, code-review C1).
export function flashError(mount, msg) {
  announce(msg);
  const host = mount && mount.querySelector('.container');
  if (host) host.insertAdjacentHTML('afterbegin', notification(escape(msg), 'error', 'WarningCircle'));
}

// CD back button. Anatomy copied from the design system's own detail pages
// (app/pages/detailPressRelease.vue, detailPublicationCatalog.vue):
//   <Btn variant="outline" size="sm" icon="ArrowLeft" iconPos="left"
//        label="Zurück" class="btn--back" />
// The visible label is always «Zurück»; `label` names the target for screen
// readers ("Zurück zu Datenbezug"). `.back-link-row` clears the CD float.
export function backLink(href, label) {
  return `<div class="back-link-row"><a class="btn btn--outline btn--sm btn--icon-left btn--back" href="${escape(href)}"${
    label ? ` aria-label="Zurück zu ${escape(label)}"` : ''}>${
    icon('ArrowLeft', 'btn__icon')}<span class="btn__text">Zurück</span></a></div>`;
}

// --- Forms (form.postcss + input.postcss + select.postcss) -------------------
// CD select: label + .select wrapper + native <select> + .select__icon chevron.
export function select(o = {}) {
  const id = o.id;
  const size = o.size || 'base';
  const variant = o.variant || 'outline';
  const msgType = o.messageType || 'error';
  const isError = Boolean(o.message) && msgType === 'error';
  const hintId = o.hint ? `${id}-hint` : '';
  const msgId = o.message ? `${id}-msg` : '';
  const described = [hintId, msgId, o.describedBy].filter(Boolean).join(' ');

  const ctrl = [`input--${variant}`, `input--${size}`];
  if (isError) ctrl.push('input--error');

  const lbl = [];
  if (variant === 'negative') lbl.push('text--negative');
  if (o.hideLabel) lbl.push('sr-only');
  if (o.required) lbl.push('text--asterisk');

  const opts = (o.options || []).map((x) => {
    const v = (x && typeof x === 'object') ? x.value : x;
    // Options-Schlüssel ist einheitlich `label` — der frühere `text`-Zweitweg
    // hatte nur noch fault-report als Konsument und ist migriert (Review B14).
    const t = (x && typeof x === 'object') ? x.label : x;
    const sel = String(v) === String(o.value == null ? '' : o.value) ? ' selected' : '';
    const dis = (x && typeof x === 'object' && x.disabled) ? ' disabled' : '';
    return `<option value="${escape(v)}"${sel}${dis}>${escape(t)}</option>`;
  }).join('');

  return `<div class="form__group__select${o.wrapClass ? ' ' + o.wrapClass : ''}">
  ${o.label ? `<label for="${escape(id)}"${lbl.length ? ` class="${lbl.join(' ')}"` : ''}>${escape(o.label)}${
      o.required ? '<span class="sr-only"> Pflichtfeld</span>' : ''}</label>` : ''}
  ${o.hint ? `<p class="form__group__hint" id="${escape(hintId)}">${escape(o.hint)}</p>` : ''}
  <div class="select${o.bare ? ' select--bare' : ''}">
    <select id="${escape(id)}" name="${escape(o.name || id)}" class="${ctrl.join(' ')}"${
      o.required ? ' required aria-required="true"' : ''}${
      o.disabled ? ' disabled' : ''}${
      isError ? ' aria-invalid="true"' : ''}${
      described ? ` aria-describedby="${escape(described)}"` : ''}${o.attrs ? ' ' + o.attrs : ''}>${opts}</select>
    <div class="select__icon">${CHEVRON_SVG}</div>
  </div>
  ${/* KEINE Live-Rolle an der Feldmeldung: jede Formularseite rendert eine
        errorSummary (role="alert") als die EINE Statusmeldung (WCAG 4.1.3) —
        mit role am Feld wurde derselbe Fehler zwei- bis dreimal angesagt. CD
        Input.vue gibt der Meldung ebenfalls keine Live-Rolle; aria-describedby
        liest sie am Feld weiterhin vor. Der frühere `quiet`-Parameter hatte
        null Aufrufer und ist entfallen (Design-Review B9). */''}
  ${o.message ? `<div class="badge badge--sm badge--${escape(msgType)}" id="${escape(msgId)}">${escape(o.message)}</div>` : ''}
</div>`;
}


// Fehlerübersicht am Formularkopf (WCAG 3.3.1/3.3.3). Bisher gab es nur
// Feldmeldungen: bei einem mehrseitigen Behördenformular muss der Nutzer nach
// einer fehlgeschlagenen Absendung an einer Stelle sehen, WAS zu korrigieren ist,
// und direkt dorthin springen können. `errors` ist nach DOM-id verschlüsselt,
// damit die Sprungmarken auflösen; `labels` liefert die Klartextnamen.
export function errorSummary({ errors = {}, labels = {}, id = 'err-summary' } = {}) {
  const ids = Object.keys(errors);
  if (!ids.length) return '';
  const items = ids.map((k) => `<li><a href="#${escape(k)}" data-err-link="${escape(k)}">${
    escape(labels[k] || k)}: ${escape(errors[k])}</a></li>`).join('');
  return `<div class="notification notification--error error-summary" id="${escape(id)}" role="alert">
    ${icon('WarningCircle', 'notification__icon')}
    <div class="notification__content">
      <h2 class="error-summary__title" tabindex="-1">${ids.length === 1
        ? 'Ein Feld muss noch korrigiert werden'
        : `${ids.length} Felder müssen noch korrigiert werden`}</h2>
      <ul class="error-summary__list">${items}</ul>
    </div></div>`;
}

// Die CD-Auswahlhülle: `<select>` plus das Chevron als Overlay. `CHEVRON_SVG`
// steht als Modulkonstante oben — der frühere Export `chevron` war nur ein
// Alias darauf und hatte keinen einzigen Aufrufer.
export function selectBox(inner, extraCls = '', style = '') {
  return `<div class="select${extraCls ? ' ' + extraCls : ''}"${style ? ` style="${style}"` : ''}>${inner}<div class="select__icon">${CHEVRON_SVG}</div></div>`;
}

// Verdrahtet die Sprungmarken der Fehlerübersicht und setzt den Fokus auf ihre
// Überschrift — ohne das landet der Fokus nach einem Fehlversuch auf <body>.
export function wireErrorSummary(mount, { focus = true } = {}) {
  mount.querySelectorAll('[data-err-link]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const t = mount.querySelector('#' + CSS.escape(a.dataset.errLink));
    if (t) { t.focus(); t.scrollIntoView({ block: 'center', behavior: 'auto' }); }
  }));
  if (!focus) return false;
  const h = mount.querySelector('.error-summary__title');
  if (h) { h.focus({ preventScroll: false }); return true; }
  return false;
}

// CD field wrapper for input/textarea. `control` receives (classes, attributes)
// so required/aria-describedby/aria-invalid land on the control itself.
export function field(o = {}) {
  const id = o.id;
  const msgType = o.messageType || 'error';
  const isError = Boolean(o.message) && msgType === 'error';
  const hintId = o.hint ? `${id}-hint` : '';
  const msgId = o.message ? `${id}-msg` : '';
  const described = [hintId, msgId].filter(Boolean).join(' ');
  const lblCls = [o.required ? 'text--asterisk' : '', o.hideLabel ? 'sr-only' : ''].filter(Boolean).join(' ');
  const lbl = lblCls ? ` class="${lblCls}"` : '';
  // `name` fehlte durchgängig (ein Formularfeld ohne name ist für Autofill und für
  // jedes echte Backend unsichtbar); `autocomplete`/`inputmode` steuern auf dem
  // Handy Tastatur und Vorschläge (Item 3.11).
  const attrs = ` name="${escape(o.name || id)}"`
    + `${o.required ? ' required aria-required="true"' : ''}`
    + `${o.autocomplete ? ` autocomplete="${escape(o.autocomplete)}"` : ''}`
    + `${o.inputmode ? ` inputmode="${escape(o.inputmode)}"` : ''}`
    + `${isError ? ' aria-invalid="true"' : ''}`
    + `${described ? ` aria-describedby="${escape(described)}"` : ''}`;
  const cls = `input--outline input--base${isError ? ' input--error' : ''}`;
  // Der Hinweis steht VOR dem Feld (man braucht ihn beim Ausfüllen, nicht danach)
  // und ist ein Absatz, keine Pille; nur die Fehlermeldung bleibt eine Badge mit
  // role="alert" — vorher trugen beide dieselbe Optik und der Hinweis erschien
  // unterhalb des Feldes (Item 3.12).
  return `<div class="form__group__input">
    <label for="${escape(id)}"${lbl}>${escape(o.label)}${o.required ? '<span class="sr-only"> Pflichtfeld</span>' : ''}</label>
    ${o.hint ? `<p class="form__group__hint" id="${escape(hintId)}">${escape(o.hint)}</p>` : ''}
    ${o.control(cls, attrs)}
    ${/* Keine Live-Rolle — wie bei select(): die errorSummary ist die eine
          Statusmeldung (WCAG 4.1.3, Design-Review B9). */''}
    ${o.message ? `<div class="badge badge--sm badge--${escape(msgType)}" id="${escape(msgId)}">${escape(o.message)}</div>` : ''}
  </div>`;
}

// Formularwert aus `mount` lesen (ersetzt das 3× kopierte lokale val()); '' wenn
// das Feld fehlt.
export function val(mount, id) { const el = mount.querySelector('#' + id); return el ? el.value : ''; }

// Mehrere Felder in ein Objekt lesen. `map` = { zielSchlüssel: feldId }. Fehlende
// Felder liefern ''; Coercion (Zahlen) und `|| alt`-Fallbacks macht der Aufrufer.
// Typisch: Object.assign(state, C.readForm(mount, { buildingId: 'bld', ort: 'ort' })).
export function readForm(mount, map) {
  const out = {};
  for (const [key, id] of Object.entries(map)) out[key] = val(mount, id);
  return out;
}

// --- Download items (download-item.postcss) ----------------------------------
// Eine CD-download-item-Zeile für alle Fälle (Dokument, App-Einstieg, Ressource,
// Anhang). Ein echtes externes Ziel öffnet ein neues Fenster; `#` degradiert zu
// einem deaktivierten Ersatz. `note`/`desc` sind austauschbar (Datenobjekte tragen
// `desc`, App-Einträge `note`); `icon` überschreibt das Standardsymbol (extern →
// External, sonst Download). `wrapLi` umschliesst mit `<li>` für `.download-items`.
export function downloadItem({ href, title, note = '', desc = '', meta = [], icon: iconName,
  external = false, heading = 'h3', wrapLi = false, download = false } = {}) {
  const titleTag = /^h[2-6]$/.test(heading) ? heading : 'h3';
  const text = note || desc;
  const sym = iconName || (external ? 'External' : 'Download');
  const inner = `${icon(sym, 'download-item__icon')}
    <div>
      <${titleTag} class="download-item__title">${escape(title)}</${titleTag}>
      ${text ? `<p class="download-item__description">${escape(text)}</p>` : ''}
      ${meta.length ? `<p class="meta-info download-item__meta-info">${
        meta.filter(Boolean).map(m => `<span class="meta-info__item">${escape(m)}</span>`).join('')}</p>` : ''}
    </div>`;
  const real = href && href !== '#';
  const attrs = external ? ' target="_blank" rel="noopener external"' : (download ? ' download' : '');
  const el = real
    ? `<a class="download-item" href="${escape(href)}"${attrs}>${inner}</a>`
    : `<span class="download-item" aria-disabled="true" title="Im Prototyp nicht verfügbar">${inner}
       <span class="sr-only">(im Prototyp nicht verfügbar)</span></span>`;
  return wrapLi ? `<li>${el}</li>` : el;
}

// CD-Kontaktkasten (.box): Name/Rolle/E-Mail(mailto)/Telefon, alle escaped —
// ersetzt die je Seite kopierte Kontaktmarkup und schliesst die unescapten
// mailto-Stellen (code-review B4).
export function contactBox(contact, { title = 'Kontakt', heading = 'h3' } = {}) {
  if (!contact) return '';
  // DIESELBE Anatomie wie contactCard (dl.kv--stack): der Kontakt-Slot der
  // Detailseiten trug zwei Typografien für denselben Zweck — Zeilenliste hier,
  // beschriftete kv-Zeilen dort (Design-Review B22). dt = Rolle; `unit` =
  // Direktionsbereich nach dem BBL-Organigramm («Portfoliomanagement» sagt
  // wenig, «Direktionsbereich Bauten — Portfoliomanagement» verortet).
  const dd = [
    contact.name ? `<strong>${escape(contact.name)}</strong>` : '',
    contact.unit ? escape(contact.unit) : '',
    contact.email ? `<a href="mailto:${escape(contact.email)}">${escape(contact.email)}</a>` : '',
    contact.phone ? escape(contact.phone) : '',
  ].filter(Boolean);
  return `<div class="box"><${heading}>${escape(title)}</${heading}>
    <dl class="kv kv--stack">
      <dt>${escape(contact.role || 'Ansprechperson')}</dt>
      <dd>${dd.join('<br>')}</dd>
    </dl></div>`;
}

// --- Randspalte der Detailansichten -----------------------------------------
// Zwei Karten, die auf jeder Objekt-Detailseite dasselbe leisten: was kann ich
// hier auslösen, und wen frage ich. Sie stehen als Bausteine hier, damit
// Liegenschafteninventar und Mietendenportal nicht zwei Fassungen desselben
// Kastens pflegen — die Randspalte ist genau die Stelle, an der ein Nutzer
// Wiedererkennung erwartet.

// `links` = [{ label, href }]. Die Zeilen tragen dasselbe `.fp-svc`-Raster wie
// die Kurzwege im Raumdetail: Beschriftung, Folgepfeil.
//
// OHNE führendes Symbol: die Symbole standen für die verlinkte Dienstleistung
// («Wrench» für Störung melden, «File» für Dokumente) und wiederholten damit
// nur die Beschriftung daneben — ein Symbol muss etwas beitragen, was der Text
// nicht schon sagt. Der Pfeil rechts bleibt: er sagt, dass die Zeile wegführt.
// `icon` an den Aufrufstellen wird ignoriert (Altbestand, schadet nicht).
export function actionCard({ title = 'Aktionen', lead = '', links = [] } = {}) {
  if (!links.length) return '';
  return `<div class="box">
    <h2>${escape(title)}</h2>
    ${lead ? `<p class="small muted">${escape(lead)}</p>` : ''}
    <div class="fp-svc-list">${links.map((l) => `<a class="fp-svc" href="${escape(l.href)}">${
      `<span>${escape(l.label)}</span>`}${
      icon('ArrowRight', 'icon--sm fp-svc__go')}</a>`).join('')}</div>
  </div>`;
}

// `contacts` = [{ label, name, email, phone }]. `name` entfällt, wo er die
// Rolle nur wiederholt — «Portfoliomanagement / Portfoliomanagement» las sich
// wie ein Anzeigefehler.
export function contactCard({ title = 'Ansprechpersonen', contacts = [] } = {}) {
  if (!contacts.length) return '';
  return `<div class="box">
    <h2>${escape(title)}</h2>
    <dl class="kv kv--stack">${contacts.map((c) => `
      <dt>${escape(c.label)}</dt>
      <dd>${c.name && c.name !== c.label ? `${escape(c.name)}<br>` : ''}${
        c.email ? `<a href="mailto:${escape(c.email)}">${escape(c.email)}</a>` : ''}${
        c.phone ? `<br>${escape(c.phone)}` : ''}</dd>`).join('')}
    </dl>
  </div>`;
}

// Link for a demo download that has no real target yet.
export function downloadLink(url, label, iconName = 'Download') {
  const real = url && url !== '#';
  return real
    ? `<a class="btn btn--link btn--icon-left" href="${escape(url)}">${icon(iconName, 'btn__icon')}<span class="btn__text">${escape(label)}</span></a>`
    : `<span class="btn btn--link btn--icon-left" aria-disabled="true" title="Im Prototyp nicht verfügbar">${icon(iconName, 'btn__icon')}<span class="btn__text">${escape(label)}<span class="sr-only"> (im Prototyp nicht verfügbar)</span></span></span>`;
}

// --- Pagination (pagination.postcss) -----------------------------------------
// CD anatomy: an editable current-page field, "von N Seiten", then prev/next as
// icon-only outline buttons (disabled at the ends). `href(page)` builds the
// target hash so the caller keeps its own filters; `inputId` is wired by the
// caller for typed page jumps.
export function pagination({ page, totalPages, href, inputId, label = 'Seitennavigation', align }) {
  if (totalPages <= 1) return '';
  const control = (target, text, iconName, disabled, key) => {
    const inner = `${icon(iconName, 'btn__icon')}<span class="btn__text">${text}</span>`;
    const id = inputId ? ` id="${escape(inputId)}-${key}"` : '';   // Fokus-Wiederherstellung (Item 3.3)
    // Echte deaktivierte <button> wie CDs PaginationItem.vue — ein <span> mit
    // aria-label ist role=generic (Name verboten) und für SR unzuverlässig.
    if (disabled) return `<li><button type="button" class="btn btn--outline btn--icon-only" disabled aria-label="${text}">${inner}</button></li>`;
    // Ohne `href`-Builder: lokaler Zustand statt Hash-Navigation (C.mountDataTable)
    // — dieselbe CD-Anatomie, aber als <button data-page>.
    return href
      ? `<li><a class="btn btn--outline btn--icon-only"${id} href="${escape(href(target))}" aria-label="${text}">${inner}</a></li>`
      : `<li><button type="button" class="btn btn--outline btn--icon-only"${id} data-page="${target}" aria-label="${text}">${inner}</button></li>`;
  };
  return `
    <nav class="pagination-wrap${align === 'right' ? ' pagination-wrap--right' : ''}" aria-label="${escape(label)}">
      <div class="pagination">
        ${/* EIN Name je Bedienelement (CD Pagination.vue führt genau eine Quelle):
              das sr-only-Label benennt das Feld — ein zusätzliches aria-label
              würde es stumm überschreiben und könnte auseinanderdriften. */''}
        <label class="sr-only" for="${inputId}">Seite</label>
        <input id="${inputId}" class="pagination__input input--outline input--base" type="text" inputmode="numeric"
          value="${page}" autocomplete="off">
        <div class="pagination__text">von ${totalPages} Seiten</div>
        <ul class="pagination_items">
          ${control(page - 1, 'Vorherige Seite', 'ChevronLeft', page === 1, 'prev')}
          ${control(page + 1, 'Nächste Seite', 'ChevronRight', page === totalPages, 'next')}
        </ul>
      </div>
    </nav>`;
}

// Wires the editable page field AND the prev/next `<button data-page>` controls
// of a pagination block. `go(target)` navigates. Vorher banden drei Explorer die
// Buttons selbst — über einen Regex auf das deutsche aria-label («/Nächste/»),
// der bei jeder Umbenennung stumm gebrochen wäre (Design-Review A3); die
// data-page-Bindung wohnt jetzt hier, mountDataTable nutzt denselben Weg.
export function wirePagination(mount, inputId, page, totalPages, go) {
  const clamp = (n) => Math.min(totalPages, Math.max(1, Number.isFinite(n) ? n : page));
  mount.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => {
    go(clamp(Number(b.dataset.page)));
  }));
  const input = mount.querySelector('#' + inputId);
  if (!input) return;
  const jump = () => {
    const target = clamp(Number.parseInt(input.value, 10));
    if (target === page) { input.value = String(page); return; }
    go(target);
  };
  input.addEventListener('change', jump);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); jump(); } });
}

// --- Ergebniskopf (search.postcss:208-234) ----------------------------------
// Die Leiste über der Trefferliste: Anzahl links, Steuerung rechts. Der
// Ansichtswechsel steht als Icon-Gruppe rechts, abgetrennt durch einen Strich.

// EIN `unit`-String diente zwei Kasus zugleich: dem Dativ nach «von» («3 von
// 6 Verträgen») und dem Nominativ der Leer-/Suchtexte («Keine Verträge …») —
// je nach übergebener Form war die eine oder die andere Hälfte falsches
// Deutsch («3 von 6 Verträge», Design-Review A14). `unit` darf deshalb ein
// Objekt `{ nom, dat }` sein; ein einfacher String gilt weiter für beide
// Slots (die meisten Plurale sind kasusinvariant: Objekte, Dokumente, Kosten).
const unitCase = (unit) => (unit && typeof unit === 'object')
  ? { nom: unit.nom || unit.dat || '', dat: unit.dat || unit.nom || '' }
  : { nom: unit || '', dat: unit || '' };

function resultsHeader({ count, total, unit, page = 1, totalPages = 1, view = 'gallery' }) {
  const pageInfo = totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : '';
  return `
    <div class="search-results__header">
      <div class="search-results__header__left">
        <strong>${escape(String(count))}</strong> von ${escape(String(total))} ${escape(unitCase(unit).dat)}${pageInfo}
      </div>
      <div class="search-results__header__right">${viewSwitch(view)}</div>
    </div>`;
}

// Gemeinsamer Ergebnisblock der Katalogseiten (Dienstleistungen/Anwendungen/
// Datensätze) — bisher 3× kopiert (P1-7). Filterung/Sortierung/Slicing bleibt in
// der Seite (unterschiedlich); hier vereinheitlicht: Kopf (Trefferzahl + Ansicht),
// Galerie-/Listenumschaltung, Paginierung und der Leer-/Nicht-verfügbar-Zustand.
// `visible` = die aktuell sichtbare (bereits geschnittene) Seite; `count` = Anzahl
// gefilterter Treffer gesamt; `card(item)`/`listView(items)` rendern die Ansicht.
export function catalogueResults({
  visible, count, total, view = 'gallery', page = 1, totalPages = 1,
  card, listView, mapView, unit, gridCls = 'grid grid--responsive-cols-3',
  paginationHref, paginationInputId, paginationLabel,
  available = true, emptyMsg, unavailableMsg, note = '', header = true,
  regionLabel = '', resetHref = '',
}) {
  // Die Kartenansicht zeigt bewusst ALLE Treffer statt einer Seite: eine Karte
  // mit 10 von 17 Punkten wäre ein falsches Bild der Verteilung. Deshalb bekommt
  // sie auch keine Blätterleiste — `mapView` erhält die volle gefilterte Menge.
  const isMap = view === 'map' && typeof mapView === 'function';
  const body = count
    ? isMap
      ? mapView()
      : `${view === 'list'
        ? listView(visible)
        // Die Galerie trägt CDs responsive `gap--top`-Rampe über dem Raster
        // (search.postcss:196-201) — feste mt-4/mt-6 blieben bei 1024px auf
        // 1rem stehen, wo das CD 2.5rem vorsieht; nur die LISTE schliesst
        // bündig an die Trennlinie an.
        : `<div class="${gridCls} gap--top">${visible.map(card).join('')}</div>`}${
      paginationHref ? pagination({ page, totalPages, inputId: paginationInputId, label: paginationLabel, href: paginationHref }) : ''}`
    : available
      // Nullzustand mit Ausweg: der Rat «oben lassen sich aktive Filter
      // zurücksetzen» verlangte, wieder hochzuscrollen und die Leiste zu finden
      // (Item 5.13). `resetHref` gibt dem Zustand denselben Weg als Bedienelement.
      ? empty(emptyMsg || `Keine ${escape(unitCase(unit).nom)} gefunden.`, {
          hint: 'Passen Sie Ihre Suche oder die Filter an.',
          action: resetHref ? { label: 'Suche und Filter zurücksetzen', href: resetHref } : null,
        })
      : empty(unavailableMsg || `${unitCase(unit).nom} konnten nicht geladen werden (Ladefehler).`, { available: false });
  // header:false, wenn die Seite bereits eine C.catalogueBar rendert (die Trefferzahl
  // + Ansichtswechsel selbst enthält) — dann nur Hinweis + Trefferkörper.
  // Die Trefferliste braucht eine eigene Überschrift: die Karten darin sind
  // <h3>, und ohne <h2> sprang die Gliederung von der Seiten-<h1> direkt auf
  // Stufe 3 (WCAG 1.3.1 / 2.4.10). Sie bleibt sr-only, weil die sichtbare
  // Trefferzahl in der catalogueBar dieselbe Information trägt.
  // `header:false` heisst: über uns steht eine C.catalogueBar — und die trägt
  // bereits `padding-bottom` und `border-bottom`, genau wie CDs
  // `.search-results__header`. Dort folgt die Liste OHNE weiteren Abstand
  // (search.postcss:207-217). Der zusätzliche `mt-6` riss zwischen Trennlinie
  // und erster Zeile eine Lücke auf, die es im CD nicht gibt.
  return `<section${header ? ' class="mt-6"' : ''}>
      <h2 class="sr-only">${escape(regionLabel || unitCase(unit).nom || 'Ergebnisse')}</h2>
      ${header ? resultsHeader({ count, total, unit, page, totalPages, view }) : ''}
      ${note ? `<p class="muted small mt-4">${note}</p>` : ''}
      ${body}
    </section>`;
}

// Standard-Ansage für die Live-Region der Katalogseiten (Trefferzahl · Seite · Ansicht).
export function announceCatalogue({ count, total, unit, page = 1, totalPages = 1, view = 'gallery' }) {
  announce(`${count} von ${total} ${unitCase(unit).dat}${totalPages > 1 ? `, Seite ${page} von ${totalPages}` : ''}, Ansicht ${view === 'list' ? 'Liste' : view === 'map' ? 'Karte' : 'Galerie'}`);
}

// Icon-Umschalter Galerie/Liste — keine Beschriftung, der Zustand steht in
// aria-pressed und im aria-label.
// CD-Ansichtsschalter (Icon-Umschaltgruppe, aria-pressed). `items` erlaubt andere
// Ansichtspaare (z. B. Karten/Liste bei Projekten) statt harter btn--filled-Betonung.
function viewSwitch(view = 'gallery', items = [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List']]) {
  const btn = ([key, label, iconName]) => {
    const on = view === key;
    // Stabile id (aus den Daten, feste Reihenfolge): der Router stellt den Fokus
    // nach einem Zustandswechsel per `document.getElementById(activeId)` her —
    // ohne id war activeId '' und der Fokus fiel auf <body> (WCAG 2.4.3).
    return `<button type="button" class="view-switch__btn" id="view-${escape(key)}" data-view="${key}"
      aria-pressed="${on}" aria-label="${escape(label)}" title="${escape(label)}">${icon(iconName, 'icon--md')}</button>`;
  };
  return `<div class="view-switch" role="group" aria-label="Ansicht">
    ${items.map(btn).join('')}
  </div>`;
}

// --- Katalog-Trio (services / applications / katalog teilen dieses Muster) -----
// Ein Katalog-Hash: q/page/view einheitlich, alle weiteren Filter aus `filters`
// als Query-Parameter (String → gesetzt wenn truthy; Array → komma-verbunden wenn
// nicht leer). Default-Werte (page 1, view 'gallery') bleiben aus der URL, damit
// sie kurz und teilbar bleibt. Schlüssel = Parametername (z. B. `topic`, `tag`).
// `defaultView` bleibt bei 'gallery' (Katalog-Trio, unverändert). Die Suchseite
// setzt 'list' als Standard — CD zeigt Suchergebnisse zuerst als Liste — und
// braucht die Umkehrung: dort wandert 'gallery' in die URL.
export function catalogueHash(base, { q = '', page = 1, view = '', defaultView = 'gallery', ...filters } = {}) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  for (const [k, v] of Object.entries(filters)) {
    if (Array.isArray(v)) { if (v.length) p.set(k, v.join(',')); }
    else if (v) p.set(k, String(v));
  }
  if (page > 1) p.set('page', String(page));
  if (view && view !== defaultView) p.set('view', view);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}


// Verdrahtet die gemeinsamen Katalog-Interaktionen: Suchformular (Submit → Seite 1),
// einfache Filter-Dropdowns (`filters: [{id, param}]` → Wert setzen, Seite 1),
// Ansichtswechsel (behält die Seite) und Pagination. `hash(patch)` baut den Ziel-
// Hash aus Basiszustand + patch (Aufrufer bäckt die Basis ein). Mehrwertige Filter
// (z. B. Themen bei services) verdrahtet der Aufrufer separat.
export function wireCatalogue(mount, { formId, inputId, pageInputId, page = 1, totalPages = 1, hash, filters = [],
  sortId, sortParam = 'sort', filterToggleId, panelId }) {
  const form = mount.querySelector('#' + formId);
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = mount.querySelector('#' + inputId);
    location.hash = hash({ q: input ? input.value.trim() : '', page: 1 });
  });
  filters.forEach(({ id, param }) => {
    const el = mount.querySelector('#' + id);
    if (el) el.addEventListener('change', (e) => { location.hash = hash({ [param]: e.target.value, page: 1 }); });
  });
  // Sortierung (catbar): Wert → Hash, Seite 1.
  if (sortId) {
    const s = mount.querySelector('#' + sortId);
    if (s) s.addEventListener('change', (e) => { location.hash = hash({ [sortParam]: e.target.value, page: 1 }); });
  }
  // Filter-Umschalter (catbar): Panel ein-/ausblenden (rein clientseitig, kein Hash)
  // + Mehrfachauswahl-Checkboxen: bei Änderung alle angehakten Werte der Dimension
  // (data-fdim = Parametername) komma-verbunden in den Hash, Seite 1.
  if (filterToggleId && panelId) {
    const btn = mount.querySelector('#' + filterToggleId), panel = mount.querySelector('#' + panelId);
    if (btn && panel) btn.addEventListener('click', () => {
      const open = !panel.hidden;
      panel.hidden = open;
      btn.setAttribute('aria-expanded', String(!open));
      // Zustand über den Neuaufbau hinweg merken (Item 3.4).
      if (open) PANEL_OPEN.delete(panelId); else PANEL_OPEN.add(panelId);
    });
    if (panel) panel.addEventListener('change', (e) => {
      const cb = e.target.closest('input[data-fdim]'); if (!cb) return;
      const dim = cb.dataset.fdim;
      const values = [...panel.querySelectorAll('input[data-fdim="' + dim + '"]:checked')].map((x) => x.value);
      location.hash = hash({ [dim]: values, page: 1 });
    });
  }
  mount.querySelectorAll('.view-switch__btn').forEach((btn) => {
    btn.addEventListener('click', () => { location.hash = hash({ page, view: btn.getAttribute('data-view') }); });
  });
  if (pageInputId) wirePagination(mount, pageInputId, page, totalPages, (target) => { location.hash = hash({ page: target }); });
}

// --- Kompakte Katalogleiste (catbar) ----------------------------------------
// Einzeilige, wiederverwendbare Toolbar für alle Katalogansichten (Portfolio,
// Dienstleistungen, Datenbezug, Anwendungen): Suche + Trefferzahl links; dann —
// hinter EINER Trennlinie rechts — Sortierung, Filter-Umschalter (mit Aktiv-Zähler)
// und der Ansichtswechsel. Der Filter öffnet ein einklappbares Panel darunter, das
// die früher fest sichtbaren Filter-Dropdowns aufnimmt. Reines Markup; jede Seite
// verdrahtet Suche/Sort/Filter/Ansicht selbst (Portfolio: JS-State, Katalogseiten:
// Hash). `countId` benennt den (per JS gefüllten) Trefferzähler; `sort` = optionales
// Dropdown {id,name,label,value,options:[{value,label}]}; `views` = viewSwitch-Items;
// `panel` = fertiges Filter-HTML (RAW, der Aufrufer escaped).
// Offene Filter-Panels überleben den Neuaufbau: auf den Katalogseiten schreibt
// eine Checkbox in den Hash, der Router zeichnet die Seite neu und catalogueBar()
// gab das Panel wieder mit [hidden] aus — das Panel schlug also nach JEDEM Haken
// zu. Drei Themen auszuwählen bedeutete, die Schublade dreimal zu öffnen. CDs
// `filtersAreOpen` ist ebenfalls Zustand, der Filteränderungen überlebt
// (SearchResultsFilters.vue:42-104). Modulweit, weil der Zustand eine Eigenschaft
// der Ansicht ist, nicht der Daten.
const PANEL_OPEN = new Set();

export function catalogueBar({
  formId, inputId, searchLabel, placeholder = 'Suchen…', q = '', countId = 'cat-count', count = '',
  sort = null, filterId = '', filterLabel = 'Filter', filterCount = 0,
  panelId = '', panel = '', panelHidden = true,
  view = 'gallery', views, showSearch = true,
}) {
  // Ein einmal geöffnetes Panel bleibt offen, bis der Nutzer es selbst zuklappt.
  if (panelId && PANEL_OPEN.has(panelId)) panelHidden = false;
  // Sortierung: bare Select, KEIN sichtbares Label (CD-Muster, vgl. indexPage.vue) —
  // eine deaktivierte «Sortieren»-Option dient als In-Control-Hinweis, ein sr-only-
  // Label als Zugänglichkeit. Passt keine Option (kein/leerer Sortierwert), zeigt die
  // Platzhalter-Option «Sortieren»; sonst ist die aktuelle Sortierung selected.
  const sortHtml = sort ? (() => {
    const cur = sort.value == null ? '' : String(sort.value);
    const hasSel = (sort.options || []).some((o) => String(o.value) === cur);
    return `
      <label class="sr-only" for="${escape(sort.id)}">${escape(sort.label || 'Sortierung')}</label>
      <div class="select select--bare catbar__sort">
        <select id="${escape(sort.id)}" name="${escape(sort.name || 'sort')}" class="input--outline input--sm">
          <option disabled${hasSel ? '' : ' selected'}>${escape(sort.placeholder || 'Sortieren')}</option>${
          (sort.options || []).map((o) => `<option value="${escape(o.value)}"${String(o.value) === cur ? ' selected' : ''}>${escape(o.label)}</option>`).join('')}</select>
        <div class="select__icon">${CHEVRON_SVG}</div>
      </div>`;
  })() : '';
  // Filter-Umschalter: bare Button mit Chevron, der beim Öffnen kippt (CD .search__filters__actions).
  const filterHtml = filterId ? `
      <button type="button" class="btn btn--bare btn--sm catbar__filter" id="${escape(filterId)}" aria-expanded="${!panelHidden}"${panelId ? ` aria-controls="${escape(panelId)}"` : ''}>
        ${icon('Filter', 'btn__icon')}<span class="btn__text">${escape(filterLabel)}</span><span class="catbar__fcount"${filterCount ? '' : ' hidden'}>${filterCount ? `(${filterCount})` : ''}</span>${icon('ChevronDown', 'catbar__chev')}
      </button>` : '';
  // `showSearch:false` — die Suchseite bringt ihr Suchfeld schon im Hero mit; CDs
  // `.search-results__header` trägt dort nur Trefferzahl links und Sortierung
  // rechts (search.postcss:208-233), kein zweites Feld.
  const searchHtml = showSearch ? `
      ${/* role=search kommt mehrfach je Seite vor (Kopfzeilen-Suche + je Katalog-/
            Tabellenleiste eine) — jede Landmarke braucht darum einen eigenen Namen;
            `searchLabel` ist je Leiste bereits eindeutig («Verträge durchsuchen»).
            Der Submit-Knopf hat EINE Namensquelle: das sr-only btn__text (CD-Muster
            btn.postcss:160-166) — kein doppeltes aria-label daneben. */''}
      <form class="catbar__search" id="${escape(formId)}" role="search" aria-label="${escape(searchLabel)}">
        <label class="sr-only" for="${escape(inputId)}">${escape(searchLabel)}</label>
        <input id="${escape(inputId)}" type="search" placeholder="${escape(placeholder)}" value="${escape(q)}" autocomplete="off">
        <button class="btn btn--bare btn--icon-only catbar__submit" type="submit" title="Suchen">${icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span></button>
      </form>` : '';
  return `
    <div class="catbar${showSearch ? '' : ' catbar--no-search'}">${searchHtml}
      <div class="catbar__count" id="${escape(countId)}">${count}</div>
      <div class="catbar__controls">${sortHtml}${filterHtml}${views ? viewSwitch(view, views) : ''}</div>
    </div>${filterId ? `
    <div class="catbar__panel" id="${escape(panelId)}"${panelHidden ? ' hidden' : ''}>${panel}</div>` : ''}`;
}

// --- Datentabelle mit Katalogleiste + Paginierung ---------------------------
// EIN Baustein für das wiederkehrende Muster «lange Tabelle in einer Detailansicht»:
// Suche + Trefferzahl + Sortierung (+ optionale Facetten) über der Tabelle,
// Paginierung darunter. Vorher trug nur das Katalog-Trio eine Leiste, während die
// Tabellen in «Meine Vorgänge» und in der Objekt-Detailansicht (Bemessungen,
// Ausstattung, Verträge, Kosten, Kontakte, Dokumente) ungefiltert und unbegrenzt
// ausgegeben wurden — bei realen Gebäuden werden die sehr lang.
//
// Bewusst LOKALER Zustand statt Hash: diese Tabellen sitzen in Registerkarten, und
// eine Hash-Änderung würde die ganze Seite neu zeichnen und den Tab zurücksetzen.
// Gezeichnet wird nur der eigene Teilbaum, der Fokus bleibt dadurch erhalten.
//
//   host      Element, in das gerendert wird
//   id        eindeutiges Präfix für alle ids in diesem Block
//   rows      Datenzeilen
//   columns   wie bei C.table
//   unit      Plural für die Trefferzahl («Verträge»)
//   searchKeys / search  Felder bzw. Prädikat für die Suche
//   sorts     [{ value, label, cmp }]
//   facets    [{ dim, legend, options:[{value,label}], match(row, values) }]
//   perPage   Standard 10
//   foot(visible, filtered)  optionale <tfoot>-Zeile
export function mountDataTable(host, opts = {}) {
  let unwireScroll = null;
  const {
    id = 'dt', rows: allRows = [], columns = [], unit = 'Einträge', caption,
    searchKeys = [], search, searchLabel, placeholder,
    sorts = [], facets = [], perPage = 10, foot, emptyMsg, note = '', rowsClickable = false,
  } = opts;
  const state = { q: '', sort: '', page: 1, open: false, sel: {} };
  facets.forEach((f) => { state.sel[f.dim] = []; });

  const matchQ = (row) => {
    if (!state.q) return true;
    const q = state.q.toLowerCase();
    if (typeof search === 'function') return search(row, q);
    return searchKeys.some((k) => String(row[k] == null ? '' : row[k]).toLowerCase().includes(q));
  };
  const matchFacets = (row) => facets.every((f) => {
    const vals = state.sel[f.dim] || [];
    if (!vals.length) return true;
    return typeof f.match === 'function' ? f.match(row, vals) : vals.includes(String(row[f.dim]));
  });

  const draw = () => {
    const filtered = allRows.filter((r) => matchQ(r) && matchFacets(r));
    const sortDef = sorts.find((s) => s.value === state.sort);
    const sorted = sortDef && sortDef.cmp ? filtered.slice().sort(sortDef.cmp) : filtered;
    const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
    if (state.page > totalPages) state.page = totalPages;
    const visible = sorted.slice((state.page - 1) * perPage, state.page * perPage);
    const activeFacetCount = facets.reduce((n, f) => n + (state.sel[f.dim] || []).length, 0);

    const restore = preserveFocus(host);
    const u = unitCase(unit);
    host.innerHTML = `
      ${catalogueBar({
        formId: `${id}-form`, inputId: `${id}-q`,
        searchLabel: searchLabel || `${u.nom} durchsuchen`,
        placeholder: placeholder || `${u.nom} durchsuchen…`, q: state.q,
        countId: `${id}-count`,
        count: `<strong>${escape(String(sorted.length))}</strong> von ${escape(String(allRows.length))} ${escape(u.dat)}${
          totalPages > 1 ? ` · Seite ${state.page} von ${totalPages}` : ''}`,
        sort: sorts.length ? { id: `${id}-sort`, value: state.sort, options: sorts.map((s) => ({ value: s.value, label: s.label })) } : null,
        filterId: facets.length ? `${id}-filter` : '', filterCount: activeFacetCount,
        panelId: facets.length ? `${id}-panel` : '',
        panel: facets.map((f) => filterGroup({ dim: f.dim, legend: f.legend, options: f.options, selected: state.sel[f.dim], idPrefix: id })).join(''),
        panelHidden: !state.open,
      })}
      ${note ? `<p class="muted small mt-4">${note}</p>` : ''}
      ${/* Auch OHNE Treffer bleibt die Tabelle stehen — mit einer Zeile, die
            sagt warum. Ein Leerzustand an ihrer Stelle liess Kopfzeile und
            Spalten verschwinden: man sah nicht mehr, was die Tabelle überhaupt
            zeigt, und beim Filtern sprang das Layout. Der Text unterscheidet
            «gar keine Daten» von «nichts für diese Auswahl». */''}
      ${table({ columns, rows: visible, zebra: true, caption, rowsClickable,
        emptyText: allRows.length
          ? `Keine ${u.nom} für diese Suche oder Filterung.`
          : (emptyMsg || `Keine ${u.nom} erfasst.`),
        foot: sorted.length && foot ? foot(visible, sorted) : undefined })}
      ${pagination({ page: state.page, totalPages, inputId: `${id}-page`, label: `Seitennavigation ${u.nom}` })}`;

    // --- Verdrahtung (nur innerhalb von host) ---
    const form = host.querySelector(`#${id}-form`);
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = host.querySelector(`#${id}-q`);
      state.q = input ? input.value.trim() : ''; state.page = 1; draw();
    });
    const sortEl = host.querySelector(`#${id}-sort`);
    if (sortEl) sortEl.addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; draw(); });
    const fBtn = host.querySelector(`#${id}-filter`);
    const fPanel = host.querySelector(`#${id}-panel`);
    if (fBtn && fPanel) {
      fBtn.addEventListener('click', () => { state.open = !state.open; draw(); });
      fPanel.addEventListener('change', (e) => {
        const cb = e.target.closest('input[data-fdim]'); if (!cb) return;
        const dim = cb.dataset.fdim;
        state.sel[dim] = [...fPanel.querySelectorAll(`input[data-fdim="${dim}"]:checked`)].map((x) => x.value);
        state.page = 1; draw();
      });
    }
    if (rowsClickable) wireTableRows(host);
    // wirePagination bindet Eingabefeld UND die [data-page]-Buttons (Review A3).
    wirePagination(host, `${id}-page`, state.page, totalPages, (target) => { state.page = target; draw(); });
    // Vorherige Beobachter ABMELDEN. `host` wird nie ersetzt, nur sein
    // innerHTML — ohne das blieben MutationObserver und ResizeObserver je
    // Suche/Sortierung/Filter/Seitenwechsel zusätzlich aktiv (quadratisch in
    // der Zahl der Interaktionen). Der Router macht es an seiner Aufrufstelle
    // bereits richtig (router.js:261-262).
    if (unwireScroll) { try { unwireScroll(); } catch { /* schon weg */ } }
    unwireScroll = wireScrollRegions(host);
    restore();
    announce(`${sorted.length} von ${allRows.length} ${u.dat}${totalPages > 1 ? `, Seite ${state.page} von ${totalPages}` : ''}`);
  };
  draw();
  // Abbaufunktion für den Aufrufer (ctx.onUnmount), damit die Beobachter auch
  // beim Verlassen der Route verschwinden.
  return () => { if (unwireScroll) { try { unwireScroll(); } catch { /* egal */ } unwireScroll = null; } };
}

// Zeilenklick für `C.table({ rowsClickable: true })`. Die Zeile folgt dem
// ERSTEN Link in sich; Tastatur und Screenreader benutzen weiterhin diesen
// Link. Klicks auf ein Bedienelement oder auf markierten Text bleiben
// unangetastet — sonst liesse sich in der Tabelle nichts mehr kopieren.
// C.mountDataTable ruft das selbst auf; wer C.table direkt rendert, ruft es
// nach dem Einfügen einmal auf `root` auf.
export function wireTableRows(root) {
  if (!root) return () => {};
  const ctrl = new AbortController();
  root.addEventListener('click', (e) => {
    if (e.target.closest('a, button, input, label, select')) return;
    const tr = e.target.closest('.table--rows-clickable tbody tr');
    if (!tr) return;
    if (String(window.getSelection?.() || '').length) return;
    tr.querySelector('a[href]')?.click();
  }, { signal: ctrl.signal });
  return () => ctrl.abort();
}

// Mehrfachauswahl-Filtergruppe (Checkboxen) — dieselbe Optik wie das Portfolio-
// Panel (.filter-group / .filter-check). `dim` = Hash-Parametername (steht auf jeder
// Checkbox als data-fdim), `selected` = aktuell angehakte Werte. Verdrahtet über
// C.wireCatalogue: Panel-Change → alle angehakten Werte der Dimension → Hash.
export function filterGroup({ dim, legend, options = [], selected = [], idPrefix = '', max = 0 }) {
  // `id="${idPrefix}f-${dim}-${i}"` — der Index ist stabil, weil die Optionen aus
  // den Daten in fester Reihenfolge kommen; nötig für die Fokus-Wiederherstellung
  // (Item 3.3). `idPrefix` hält die ids dokumentweit eindeutig, wenn zwei
  // Tabellen dieselbe Facetten-Dimension führen (Review a11y-dup-ids-1).
  // `max` kappt lange Wertelisten: der Rest liegt in einem versteckten Span,
  // den der Aufrufer über den [data-fmore]-Knopf aufdeckt (estate).
  const p = idPrefix ? escape(idPrefix) + '-' : '';
  const cb = (o, i) => `<label class="filter-check"><input type="checkbox" id="${p}f-${escape(dim)}-${i}" data-fdim="${escape(dim)}" value="${escape(o.value)}"${
    selected.includes(o.value) ? ' checked' : ''}><span>${escape(o.label)}</span></label>`;
  const head = max && options.length > max ? options.slice(0, max) : options;
  const rest = max && options.length > max ? options.slice(max) : [];
  return `<fieldset class="filter-group"><legend class="filter-group__legend">${escape(legend)}</legend>${
    head.map(cb).join('')}${rest.length
      ? `<span class="filter-group__more" hidden>${rest.map((o, i) => cb(o, i + head.length)).join('')}</span>
         <button type="button" class="btn btn--link btn--sm" data-fmore="${escape(dim)}" aria-expanded="false"><span class="btn__text">Alle anzeigen (${options.length})</span></button>`
      : ''}</fieldset>`;
}

// --- Aktionsmenü (Kebab-Dropdown) --------------------------------------------
// Ein wiederverwendbares Aktionsmenü für die Dashboard-Toolbar und jede Chart-
// Karte (Superset-Muster). `items` = flache Liste aus `{ action, label, icon }`
// (Menüpunkt), `{ heading }` (Gruppentitel) oder `{ separator:true }`. Verhalten
// via C.wireMenu; die Aktion wird per `data-action` an den Aufrufer gereicht (kein
// inline onclick). `menuId` identifiziert das Menü im gemeinsamen onAction-Handler.
export function menu({ menuId, items = [], label = 'Aktionen', align = 'end', triggerIcon = 'More', triggerClass = '' }) {
  const row = (it) => {
    if (it.separator) return '<div class="action-menu__sep" role="separator"></div>';
    if (it.heading) return `<div class="action-menu__heading">${escape(it.heading)}</div>`;
    return `<button type="button" role="menuitem" class="action-menu__item" data-action="${escape(it.action)}" tabindex="-1">`
      + `${it.icon ? icon(it.icon, 'action-menu__icon') : ''}<span>${escape(it.label)}</span></button>`;
  };
  // aria-controls + Popup-id wie CDs Popover.vue:3-9 — der Auslöser benennt,
  // WAS er aufklappt (menuIds sind je Seite eindeutig, s. Aufrufer).
  const popupId = `${menuId}-popup`;
  return `<div class="action-menu" data-menu="${escape(menuId)}">
    <button type="button" class="action-menu__trigger${triggerClass ? ' ' + triggerClass : ''}" aria-haspopup="true" aria-expanded="false" aria-controls="${escape(popupId)}" aria-label="${escape(label)}" title="${escape(label)}">${icon(triggerIcon, 'icon--base')}</button>
    <div class="action-menu__popup action-menu__popup--${align}" id="${escape(popupId)}" role="menu" aria-label="${escape(label)}" hidden>${items.map(row).join('')}</div>
  </div>`;
}

// Ein einmaliger globaler Schliesser (Klick ausserhalb schliesst offene Menüs),
// damit wiederholtes wireMenu() keine Listener anhäuft. Eigener `.action-menu`-
// Namensraum — `.menu` gehört der CD-Navigations-Flyout-Komponente.
let menuGlobalWired = false;
function ensureMenuGlobal() {
  if (menuGlobalWired || typeof document === 'undefined') return;
  menuGlobalWired = true;
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.action-menu__trigger')) return;
    const inPopup = e.target.closest && e.target.closest('.action-menu__popup');
    document.querySelectorAll('.action-menu__popup:not([hidden])').forEach((pop) => {
      if (pop === inPopup) return;
      pop.hidden = true;
      const trg = pop.closest('.action-menu') && pop.closest('.action-menu').querySelector('.action-menu__trigger');
      if (trg) trg.setAttribute('aria-expanded', 'false');
    });
  });
}

// Verdrahtet alle .action-menu in `root`: Öffnen/Schliessen, Pfeiltasten/Home/End,
// Escape, Klick ausserhalb. Bei Auswahl → onAction(action, menuId, triggerEl).
export function wireMenu(root, onAction) {
  ensureMenuGlobal();
  root.querySelectorAll('.action-menu').forEach((m) => {
    const trigger = m.querySelector('.action-menu__trigger');
    const popup = m.querySelector('.action-menu__popup');
    const items = [...popup.querySelectorAll('.action-menu__item')];
    const open = () => {
      document.querySelectorAll('.action-menu__popup:not([hidden])').forEach((p) => { if (p !== popup) p.hidden = true; });
      popup.hidden = false; trigger.setAttribute('aria-expanded', 'true'); items[0] && items[0].focus();
    };
    const close = (focusTrigger) => { popup.hidden = true; trigger.setAttribute('aria-expanded', 'false'); if (focusTrigger) trigger.focus(); };
    trigger.addEventListener('click', (e) => { e.stopPropagation(); popup.hidden ? open() : close(false); });
    items.forEach((it, i) => {
      it.addEventListener('click', () => { const action = it.dataset.action; close(true); if (onAction) onAction(action, m.dataset.menu, trigger); });
      it.addEventListener('keydown', (e) => {
        let ni = null;
        if (e.key === 'ArrowDown') ni = (i + 1) % items.length;
        else if (e.key === 'ArrowUp') ni = (i - 1 + items.length) % items.length;
        else if (e.key === 'Home') ni = 0;
        else if (e.key === 'End') ni = items.length - 1;
        if (ni !== null) { e.preventDefault(); items[ni].focus(); }
      });
    });
    m.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !popup.hidden) { e.stopPropagation(); close(true); } });
    // APG-Menü-Muster: verlässt der Fokus das Menü (Tab aus einem menuitem, Klick
    // auf ein fokussierbares Ziel aussen), schliesst es — sonst bliebe ein offen
    // sichtbares Menü mit aria-expanded="true" zurück; der globale Schliesser
    // reagiert nur auf Zeigerklicks. Kein preventDefault: der Fokus zieht
    // natürlich weiter (relatedTarget null = Ziel nicht fokussierbar → zu).
    m.addEventListener('focusout', (e) => {
      if (popup.hidden) return;
      if (!m.contains(e.relatedTarget)) close(false);
    });
  });
}

// Kurze, selbst-verschwindende Statusmeldung (für simulierte/erledigte Aktionen).
// CD toast-message (toast-message.postcss:5-18 + ToastMessage.vue): fixer Host
// bei bottom 10 %, innen eine normale Notification (Standard: success mit
// CheckmarkCircle, Fehlerpfade geben 'error'/'warning' mit), 5 s sichtbar.
// Die Meldung ist rein visuell — die SR-Ansage läuft über die persistente
// #live-Region (announce): in einem frisch erzeugten Knoten feuert aria-live nicht.
export function toast(msg, variant = 'success', iconName = 'CheckmarkCircle') {
  announce(msg);
  if (typeof document === 'undefined') return;
  const t = document.createElement('div');
  t.className = 'toast__message';
  t.innerHTML = notification(escape(msg), variant, iconName);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast__message--in'));
  setTimeout(() => { t.classList.remove('toast__message--in'); setTimeout(() => t.remove(), 300); }, 5000);
}

// --- Katalog-Zustand aus der Hash-Query (Katalog-Quartett) -------------------
// Die Lese-Seite des Katalog-Musters: services/applications/catalog/search
// rollten je ~35 Zeilen identisches Parsen/Validieren/Klemmen/Schneiden von
// Hand (Design-Review B16) — nur die Schreib-Seite (catalogueHash/wireCatalogue)
// war geteilt. Hier beides aus einer Quelle.
//
//   query      URLSearchParams der Route
//   base       Basis-Hash der Seite ('#/services')
//   perPage    Galerieseiten-Grösse (Standard 12 — teilbar durch 2 UND 3 Spalten)
//   sortOpts   erlaubte Sortierwerte (Array der option-values); '' = Datenreihenfolge
//   filters    { param: erlaubteWerte[]|null } — mehrwertig, komma-verbunden
//   views      erlaubte Ansichten; defaultView bleibt aus der URL
//
// Rückgabe: { q, view, page, sort, selected, hash(patch), clamp(list) } —
// clamp() schneidet die sortierte Liste auf die Seite zu und liefert
// { visible, totalPages, page } (page ggf. auf den gültigen Bereich geklemmt).
export function catalogueState(query, { base, perPage = 12, sortOpts = [], defaultSort = '',
  views = ['gallery', 'list'], defaultView = 'gallery', filters = {} } = {}) {
  const q = (query.get('q') || '').trim();
  const rawView = query.get('view') || defaultView;
  const view = views.includes(rawView) ? rawView : defaultView;
  const rawSort = query.get('sort') || defaultSort;
  const sort = sortOpts.includes(rawSort) ? rawSort : defaultSort;
  const selected = {};
  for (const [param, allowed] of Object.entries(filters)) {
    const vals = (query.get(param) || '').split(',').map((s) => s.trim()).filter(Boolean);
    selected[param] = allowed ? vals.filter((v) => allowed.includes(v)) : vals;
  }
  const parsed = Number.parseInt(query.get('page') || '1', 10);
  let page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const hash = (patch = {}) => catalogueHash(base, { q, page, view, defaultView, sort, ...selected, ...patch });
  const clamp = (list) => {
    const totalPages = Math.max(1, Math.ceil(list.length / perPage));
    if (page > totalPages) page = totalPages;
    return { visible: list.slice((page - 1) * perPage, page * perPage), totalPages, page };
  };
  return { q, view, page, sort, selected, perPage, hash, clamp };
}

// --- JS-State-Katalogverdrahtung (Explorer) ----------------------------------
// Der lokale Zwilling von wireCatalogue: Portfolio, Bauprojekte, Mietende und
// die Bauwerksdokumentation halten ihren Zustand in einer Variablen statt im
// Hash (Registerkarten/Baum, dokumentiert je App) und trugen dafür je eine
// ~45-Zeilen-Kopie derselben Verdrahtung — Suche mit Tipp-Verzögerung, Sort,
// Filterpanel samt Zähler-Badge, Aktiv-Pillen (Design-Review A2). Die Kopien
// waren bereits gedriftet (toter Reset in Mietende).
//
//   state     { q, sort, page, view, filters: { dim: wert[] } } — wird hier mutiert
//   onChange  Neuzeichnen der Trefferfläche (renderMain)
//   onRemove  (token) für Pillen-Tokens ausserhalb von 'q'/'dim:wert' (z. B. 'sel')
//   onReset   ersetzt das Standard-onChange nach «Alle Filter zurücksetzen»
//             (Explorer setzen hier zusätzlich die Baum-Auswahl zurück)
//
// Rückgabe: { updateFilterBadge, syncFilterChecks, clearFilters } für Aufrufer,
// die den Panel-Zustand selbst anfassen (URL-Wiederherstellung).
export function wireCatalogueState(mount, {
  formId, inputId, sortId = '', filterToggleId = '', panelId = '', resetId = '',
  activeFiltersId = '', state, onChange, onRemove, onReset, debounceMs = 250,
} = {}) {
  const input = inputId ? mount.querySelector('#' + inputId) : null;
  let timer = null;
  const runSearch = () => { state.q = input ? (input.value || '') : ''; state.page = 1; onChange(); };
  const form = formId ? mount.querySelector('#' + formId) : null;
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(timer); runSearch(); });
  if (input) input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(runSearch, debounceMs); });

  const vs = mount.querySelector('.view-switch');
  if (vs) vs.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-switch__btn'); if (!btn) return;
    state.view = btn.dataset.view; state.page = 1; onChange();
  });

  const sortSel = sortId ? mount.querySelector('#' + sortId) : null;
  if (sortSel) sortSel.addEventListener('change', () => { state.sort = sortSel.value; state.page = 1; onChange(); });

  const fbtn = filterToggleId ? mount.querySelector('#' + filterToggleId) : null;
  const fpanel = panelId ? mount.querySelector('#' + panelId) : null;
  const fbadge = fbtn ? fbtn.querySelector('.catbar__fcount') : null;
  const dims = () => Object.keys(state.filters || {});
  const updateFilterBadge = () => {
    if (!fbadge) return;
    const total = dims().reduce((n, d) => n + (state.filters[d] || []).length, 0);
    fbadge.textContent = total ? `(${total})` : ''; fbadge.hidden = !total;
  };
  const syncFilterChecks = () => { if (fpanel) fpanel.querySelectorAll('input[data-fdim]').forEach((cb) => { cb.checked = (state.filters[cb.dataset.fdim] || []).includes(cb.value); }); };
  const clearFilters = () => { dims().forEach((d) => { state.filters[d] = []; }); syncFilterChecks(); updateFilterBadge(); };
  // Aus der URL wiederhergestellte Filter sofort am Knopf anzeigen (url-state-1);
  // die Checkboxen selbst sind schon richtig, wenn filterGroup `selected` erhielt.
  updateFilterBadge();
  if (fbtn && fpanel) fbtn.addEventListener('click', () => {
    const open = !fpanel.hidden; fpanel.hidden = open; fbtn.setAttribute('aria-expanded', String(!open));
  });
  if (fpanel) fpanel.addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-fdim]'); if (!cb) return;
    const dim = cb.dataset.fdim, arr = state.filters[dim] || (state.filters[dim] = []);
    if (cb.checked) { if (!arr.includes(cb.value)) arr.push(cb.value); }
    else state.filters[dim] = arr.filter((x) => x !== cb.value);
    updateFilterBadge(); state.page = 1; onChange();
  });
  const resetBtn = resetId ? mount.querySelector('#' + resetId) : null;
  if (resetBtn) resetBtn.addEventListener('click', () => { clearFilters(); state.page = 1; onChange(); });

  const af = activeFiltersId ? mount.querySelector('#' + activeFiltersId) : null;
  if (af) af.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) {
      state.q = ''; if (input) input.value = '';
      clearFilters();
      if (onReset) onReset(); else { state.page = 1; onChange(); }
      return;
    }
    const pill = e.target.closest('[data-remove]'); if (!pill) return;
    const tok = pill.dataset.remove;
    if (tok === 'q') { state.q = ''; if (input) input.value = ''; state.page = 1; onChange(); return; }
    const i = tok.indexOf(':');
    if (i > 0 && state.filters[tok.slice(0, i)] !== undefined) {
      const dim = tok.slice(0, i);
      state.filters[dim] = (state.filters[dim] || []).filter((x) => x !== tok.slice(i + 1));
      syncFilterChecks(); updateFilterBadge(); state.page = 1; onChange(); return;
    }
    if (onRemove) onRemove(tok);   // z. B. 'sel' — die Baum-Auswahl des Aufrufers
  });

  return { updateFilterBadge, syncFilterChecks, clearFilters };
}

// Kanonischer Filterpanel-Reset — EINE Anatomie für die 13 Panels, die vorher
// in ~7 Varianten auseinanderliefen (Icon-Klasse, Modifier, Wrapper; Design-
// Review B17). Beschriftung «Filter zurücksetzen» (CD-Wortlaut, eventsList.vue)
// — die Pillenreihe darunter behält ihr «Alle Filter zurücksetzen» (sie räumt
// auch Suche und Baum-Auswahl ab). `wrap:''` für Panels mit eigener Aktionszeile
// (Dashboards: .filter-panel__actions).
export function panelReset({ href = '', id = '', label = 'Filter zurücksetzen', wrap = 'catbar__panel__actions' } = {}) {
  const inner = `${icon('Refresh', 'btn__icon icon--base')}<span class="btn__text">${escape(label)}</span>`;
  const ctl = href
    ? `<a class="btn btn--bare btn--sm btn--icon-left" href="${escape(href)}">${inner}</a>`
    : `<button type="button" class="btn btn--bare btn--sm btn--icon-left"${id ? ` id="${escape(id)}"` : ''}>${inner}</button>`;
  return wrap ? `<div class="${escape(wrap)}">${ctl}</div>` : ctl;
}

// --- Formular-Seams (Design-Review A8/A9/B8/B12) -----------------------------
// Fehlermeldung verschwindet, sobald der Nutzer das Feld korrigiert (Item 3.6).
// Superset-Fassung aus building-create: `change` zusätzlich zu `input`, weil
// ein <select> beim Zeigerklick kein input-Ereignis feuert. Vorher trugen
// space-request und building-create je eine Kopie, fault-report und workspace
// gar keine — gleiche Formulare verziehen ungleich.
export function wireFieldErrors(mount, errors) {
  Object.keys(errors).forEach((id) => {
    const el = mount.querySelector('#' + CSS.escape(id));
    if (!el) return;
    const clear = () => {
      if (!errors[id]) return;
      delete errors[id];
      el.classList.remove('input--error');
      el.removeAttribute('aria-invalid');
      const msg = mount.querySelector('#' + CSS.escape(id) + '-msg');
      if (msg) msg.remove();
    };
    el.addEventListener('input', clear, { once: true });
    el.addEventListener('change', clear, { once: true });
  });
}

// Fokus + Ansage auf dem Erfolgsscreen: processDone rendert seine Überschrift
// mit tabindex="-1" GENAU dafür — aber nur building-create nutzte das; in den
// drei Geschwister-Flows fiel der Fokus nach dem Absenden auf <body>.
export function focusProcessDone(mount, instance) {
  const h = mount.querySelector('h1[tabindex="-1"], h2[tabindex="-1"]');
  if (h) h.focus();
  if (instance && instance.reference) announce(`Vorgang erstellt. Referenz ${instance.reference}.`);
}

// Wizard-Kopf: Schrittanzeige + sr-only-Schrittüberschrift (Fokusziel beim
// Wechsel) + Pflichtfeld-Legende. `step` ist 1-basiert wie in den Apps.
export function wizardHead(labels, step, { headId = 'wiz-step-head', label = 'Antragsschritte', legend = true } = {}) {
  return `${stepIndicator(labels, step - 1, { label })}
    <h2 class="sr-only" id="${escape(headId)}" tabindex="-1">Schritt ${step} von ${labels.length}: ${escape(labels[step - 1])}</h2>
    ${legend ? '<p class="small muted">Mit <span class="text--asterisk" aria-hidden="true"></span> markierte Felder sind Pflichtfelder.</p>' : ''}`;
}

// Schrittwechsel ist ein Kontextwechsel: Fokus auf die Schrittüberschrift, Ansage
// MIT Schrittnamen («Schritt 2 von 3: Bedarf») — vorher sagte space-request nur
// die Nummer an, building-create auch den Namen (Design-Review D31).
export function focusWizardStep(mount, labels, step, { headId = 'wiz-step-head' } = {}) {
  const h = mount.querySelector('#' + headId) || mount.querySelector('h1');
  if (h) h.focus({ preventScroll: true });
  announce(`Schritt ${step} von ${labels.length}: ${labels[step - 1]}`);
}

// Kontextzeile unter der Formular-h1 — EINE Formel für alle vier Flows:
// «<Aktion> als NAME · ORG (· Prozess: …)». Vorher entschied jede App selbst,
// ob Name und Prozessvorschau erscheinen (Design-Review B12).
export function contextLine({ action, name = '', org, process = '' }) {
  return `<p class="muted">${escape(action)} als ${name ? `<strong>${escape(name)}</strong> · ` : ''}<strong>${escape(org)}</strong>${
    process ? ` · Prozess: ${escape(process)}` : ''}.</p>`;
}

// --- Login-Hinweis (AGOV / FedLogin) -----------------------------------------
// Kein Inhalt wird versteckt; abgemeldet erscheint nur dieser Hinweis dort, wo
// ein Vorgang ausgelöst würde. Der Button ruft window.__login() (in app.js
// verdrahtet), das die Session setzt und die Seite neu zeichnet.
export function loginGate(text = 'Zum Starten dieses Vorgangs ist eine Anmeldung erforderlich.') {
  // Abstand vor dem Knopf über `.login-gate .btn { margin-top:1rem }` (app.css)
  // statt eines Inline-Stils — CDs Banner-Rampe (notification.postcss:89-92)
  // gilt hier nicht, weil der Knopf IM __content sitzt, nicht daneben.
  return `<div class="notification notification--hint login-gate">
    ${icon('Lock', 'notification__icon')}
    <div class="notification__content">
      <p class="m-0">${text}</p>
      <button type="button" class="btn btn--outline btn--icon-left login-gate__btn" onclick="window.__login && window.__login()">
        ${icon('User', 'btn__icon')}<span class="btn__text">Anmelden mit AGOV / FedLogin</span>
      </button>
    </div>
  </div>`;
}

export const C = {
  icon, escape, badge, statusBadge, loading, pageHeader, card, table, empty,
  mountBanner, openModal, openShareModal, wireShare, domainTile, announce, trapFocus, FOCUSABLE, notFound,
  renderNotFound, activeFilters, detailBar, detailHead, detailSection, markLang, accordion, wireAccordion,
  catalogueResults, announceCatalogue, catalogueHash, catalogueBar, filterGroup, wireCatalogue, pipeline,
  catalogueState, wireCatalogueState, panelReset, wireFieldErrors, focusProcessDone, wizardHead, focusWizardStep, contextLine,
  tabBar, tabPanels, wireTabs, menu, wireMenu, toast,
  notification, flashError, safeDecode, backLink, photo, photoUrl, select, selectBox, field, val, readForm, downloadItem, contactBox, downloadLink,
  actionCard, contactCard,
  pagination, wirePagination, loginGate,
  preserveFocus, wireScrollRegions, errorSummary, wireErrorSummary, stepIndicator, processDone,
  mountDataTable, wireTableRows, cardAction, pageSection, heroFigure,
};
export default C;
