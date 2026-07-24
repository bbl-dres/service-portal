// Shared UI component helpers — all return HTML strings (pages compose via templates).
// Class names follow the CD Bund design system; see docs/cd-gap-analysis.md.

const ICON_BASE = 'assets/icons/';

// CD's own chevron path (Select.vue:19 — identical to assets/icons/ChevronDown.svg)
const CHEVRON_SVG = '<svg role="presentation" aria-hidden="true" viewBox="0 0 24 24">'
  + '<path d="m5.706 10.015 6.669 3.85 6.669-3.85.375.649-7.044 4.067-7.044-4.067z"/></svg>';

// --- Placeholder photography -------------------------------------------------
// Demo images come from Unsplash (data/*.json carry a `photo` = Unsplash photo id).
// The id is only ever interpolated after a strict charset check; the `color` of
// the record stays behind the image, so a failed/offline fetch degrades to CD's
// image-not-available placeholder over the plain colour block.
const PHOTO_BASE = 'https://images.unsplash.com/photo-';
const PHOTO_ID = /^[A-Za-z0-9_-]+$/;

export function photoUrl(id, { w = 800, h = 0, q = 70, gray = false } = {}) {
  if (!id || !PHOTO_ID.test(id)) return '';
  let u = `${PHOTO_BASE}${id}?auto=format&fit=crop&w=${w}&q=${q}`;
  if (h) u += `&h=${h}`;
  if (gray) u += '&sat=-100';   // historic material reads as archival b/w
  return u;
}

export function photo(o = {}) {
  const src = photoUrl(o.id, { w: o.w, h: o.h, q: o.q, gray: o.gray });
  const img = src
    ? `<img src="${src}" alt="${escape(o.alt || '')}" loading="lazy" decoding="async" onerror="this.remove()">`
    : '';
  return `<div class="photo${o.cls ? ' ' + o.cls : ''}" style="background-color:${escape(o.color || '#2f4356')}${o.style ? ';' + o.style : ''}">${img}${o.overlay || ''}</div>`;
}

export function icon(name, cls = 'icon--base') {
  const u = ICON_BASE + name + '.svg';
  return `<span class="icon ${cls}" style="-webkit-mask-image:url('${u}');mask-image:url('${u}')" aria-hidden="true"></span>`;
}

export function escape(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- Badges (badge.postcss) --------------------------------------------------
export function badge(text, variant = 'gray', size = '') {
  return `<span class="badge badge--${variant}${size ? ' badge--' + size : ''}">${escape(text)}</span>`;
}

export function audienceTag(a) {
  const map = { internal: ['blue', 'Intern'], external: ['green', 'Extern'], both: ['gray', 'Intern + Extern'] };
  const [v, l] = map[a] || map.both;
  return badge(l, v);
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

// --- Tag items — CD's filter control (tag-item.postcss) ----------------------
export function tagItem({ label, active = false, size = '', iconName = '', attrs = '' }) {
  const cls = ['tag-item', active ? 'tag-item--active' : '', size ? 'tag-item--' + size : ''].filter(Boolean).join(' ');
  return `<button type="button" class="${cls}" aria-pressed="${active}"${attrs ? ' ' + attrs : ''}>`
    + `<span class="tag-item__inner">${iconName ? icon(iconName, 'icon--sm') : ''}`
    + `<span class="tag-item__text">${escape(label)}</span></span></button>`;
}

export function pageHeader({ title, lead }) {
  return `<div class="page-header"><h1 tabindex="-1">${escape(title)}</h1>${lead ? `<p class="lead">${escape(lead)}</p>` : ''}</div>`;
}

// Flat CD card (card--flat) — used for compact text-led teasers.
export function tile({ title, desc, href, extra = '' }) {
  return `<a class="card card--flat card--clickable" href="${href}">
    <div class="card__content"><div class="card__body">
      <span class="card__title">${escape(title)}</span>
      ${desc ? `<span class="card__description">${escape(desc)}</span>` : ''}${extra}
    </div></div></a>`;
}

// --- Cards (card.postcss) ----------------------------------------------------
export function card(o) {
  const media = o.photo
    ? `<div class="card__image">${photo({ ...o.photo, alt: o.photo.alt || '', w: 640 })}</div>`
    : o.image ? `<div class="card__image"><img src="${o.image}" alt="${escape(o.imageAlt || '')}" loading="lazy"></div>`
    : o.placeholder ? `<div class="card__image"><div class="photo image__not-available">${icon('Image')}<p class="image__not-available-text">${escape(o.placeholder === true ? 'Bild folgt' : o.placeholder)}</p></div></div>`
    : '';
  // CD: `card--default` is the plain shadow card (with or without image);
  // `card--universal` is the variant whose image is letterboxed (object-contain),
  // so it stays opt-in via o.variant — image-less cards are default, not universal.
  const variant = o.variant || 'default';
  const inner = `${media}
    <div class="card__content">
      <div class="card__body">
        <div class="card__title">${escape(o.title)}</div>
        ${o.badges ? `<div class="pill-row">${o.badges.join('')}</div>` : ''}
        ${o.desc ? `<p class="card__description">${escape(o.desc)}</p>` : ''}
      </div>
      ${o.footer ? `<div class="card__footer">${o.footer}</div>` : ''}
    </div>`;
  const cls = `card card--${variant}${o.href ? ' card--clickable' : ''}`;
  const ext = o.external ? ' target="_blank" rel="noopener external"' : '';
  return o.href ? `<a class="${cls}" href="${escape(o.href)}"${ext}>${inner}</a>` : `<div class="${cls}">${inner}</div>`;
}

// --- Tables (table.postcss) --------------------------------------------------
// columns: [{ key, label, render?(row) }]; rows: object[]; caption names the table.
export function table({ columns, rows, zebra, caption, showCaption }) {
  const head = columns.map(c => `<th scope="col">${escape(c.label)}</th>`).join('');
  const body = (rows || []).map(r =>
    `<tr>${columns.map((c, i) => {
      const cell = c.render ? c.render(r) : escape(r[c.key]);
      return i === 0 ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`;
    }).join('')}</tr>`
  ).join('');
  const cls = ['table', zebra ? 'table--zebra' : '', showCaption ? 'table--caption' : ''].filter(Boolean).join(' ');
  return `<div class="table-wrapper" tabindex="0" role="region" aria-label="${escape(caption || 'Tabelle')}">
    <table class="${cls}">
    ${caption ? `<caption>${escape(caption)}</caption>` : ''}
    <thead><tr>${head}</tr></thead>
    <tbody>${body || `<tr><td colspan="${columns.length}" class="muted">Keine Einträge</td></tr>`}</tbody>
  </table></div>`;
}

export function empty(msg) { return `<div class="empty">${escape(msg)}</div>`; }

// Ansage in die persistente Live-Region (#live in index.html) — für Trefferzahl-,
// Ansichts- und Seitenwechsel, die sonst still wären (WCAG 4.1.3). Nur Text
// mutieren, nie den Knoten neu erzeugen, sonst feuert aria-live nicht.
export function announce(msg) {
  const n = document.getElementById('live');
  if (n) n.textContent = msg;
}

// Icon-Kachel (domain-tile): bildlose Karte mit grossem Icon, Titel, Text und
// «Öffnen»-Fuss. Eine Quelle für die Übersichtskarten (Daten, Wissen,
// Digitalisierung) — bildlose Karten sind card--default (CD, nicht --universal).
export function domainTile({ icon: ic, title, desc, meta = '', href, external = false }) {
  const ext = external ? ' target="_blank" rel="noopener external"' : '';
  return `<a class="card card--default card--clickable" href="${escape(href)}"${ext}>
    <div class="card__content">
      <div class="card__body">
        <span class="domain-tile__icon">${icon(ic, 'icon--2xl')}</span>
        <div class="card__title">${escape(title)}</div>
        <p class="card__description">${escape(desc)}</p>
      </div>
      <div class="card__footer">
        <span>${escape(meta)}</span>
        <span class="btn btn--link">Öffnen ${icon(external ? 'External' : 'ArrowRight', 'icon--base')}</span>
      </div>
    </div>
  </a>`;
}

// Share-Bar (share-bar.postcss) — nach der Brotkrume auf Detailseiten: Drucken
// und Link kopieren. Rechtsbündig (flex-row-reverse) wie im CD.
export function shareBar() {
  // CD: nur Icons (aria-label), keine sichtbaren Beschriftungen (ShareBar.vue).
  return `<div class="share-bar">
    <div class="share-container">
      <button class="btn btn--bare share-bar__btn" type="button" onclick="window.print()" aria-label="Seite drucken" title="Drucken">${icon('Printer', 'icon--xl')}</button>
      <button class="btn btn--bare share-bar__btn" type="button" aria-label="Link kopieren" title="Teilen"
        onclick="try{navigator.clipboard.writeText(location.href)}catch(e){}">${icon('Share', 'icon--xl')}</button>
    </div>
  </div>`;
}

// --- Notifications (notification.postcss) ------------------------------------
// variant: info | success | warning | error | hint | alert
export function notification(text, variant = 'info', iconName = 'InfoCircle') {
  return `<div class="notification notification--${variant}">${icon(iconName, 'notification__icon')}<div class="notification__content">${text}</div></div>`;
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
    const t = (x && typeof x === 'object') ? (x.label != null ? x.label : x.text) : x;
    const sel = String(v) === String(o.value == null ? '' : o.value) ? ' selected' : '';
    const dis = (x && typeof x === 'object' && x.disabled) ? ' disabled' : '';
    return `<option value="${escape(v)}"${sel}${dis}>${escape(t)}</option>`;
  }).join('');

  return `<div class="form__group__select${o.wrapClass ? ' ' + o.wrapClass : ''}">
  ${o.label ? `<label for="${escape(id)}"${lbl.length ? ` class="${lbl.join(' ')}"` : ''}>${escape(o.label)}${
      o.required ? '<span class="sr-only"> Pflichtfeld</span>' : ''}</label>` : ''}
  <div class="select${o.bare ? ' select--bare' : ''}">
    <select id="${escape(id)}" name="${escape(o.name || id)}" class="${ctrl.join(' ')}"${
      o.required ? ' required aria-required="true"' : ''}${
      o.disabled ? ' disabled' : ''}${
      isError ? ' aria-invalid="true"' : ''}${
      described ? ` aria-describedby="${escape(described)}"` : ''}${o.attrs ? ' ' + o.attrs : ''}>${opts}</select>
    <div class="select__icon">${CHEVRON_SVG}</div>
  </div>
  ${o.hint ? `<div class="badge badge--sm badge--info" id="${escape(hintId)}">${escape(o.hint)}</div>` : ''}
  ${o.message ? `<div class="badge badge--sm badge--${escape(msgType)}" id="${escape(msgId)}" role="${
      isError ? 'alert' : 'status'}">${escape(o.message)}</div>` : ''}
</div>`;
}

// Bare CD select chrome: the `.select` positioning box plus the chevron in its
// `.select__icon` divider. Use when the label/message layer is supplied elsewhere.
export const chevron = CHEVRON_SVG;

export function selectBox(inner, extraCls = '') {
  return `<div class="select${extraCls ? ' ' + extraCls : ''}">${inner}<div class="select__icon">${CHEVRON_SVG}</div></div>`;
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
  const lbl = o.required ? ' class="text--asterisk"' : '';
  const attrs = `${o.required ? ' required aria-required="true"' : ''}`
    + `${isError ? ' aria-invalid="true"' : ''}`
    + `${described ? ` aria-describedby="${escape(described)}"` : ''}`;
  const cls = `input--outline input--base${isError ? ' input--error' : ''}`;
  return `<div class="form__group__input">
    <label for="${escape(id)}"${lbl}>${escape(o.label)}${o.required ? '<span class="sr-only"> Pflichtfeld</span>' : ''}</label>
    ${o.control(cls, attrs)}
    ${o.hint ? `<div class="badge badge--sm badge--info" id="${escape(hintId)}">${escape(o.hint)}</div>` : ''}
    ${o.message ? `<div class="badge badge--sm badge--${escape(msgType)}" id="${escape(msgId)}" role="alert">${escape(o.message)}</div>` : ''}
  </div>`;
}

// --- Download items (download-item.postcss) ----------------------------------
export function downloadItem({ href, title, description, meta = [], heading = 'h4' }) {
  const real = href && href !== '#';
  const inner = `${icon('Download', 'download-item__icon')}
    <div>
      <${heading} class="download-item__title">${escape(title)}</${heading}>
      ${description ? `<p class="download-item__description">${escape(description)}</p>` : ''}
      ${meta.length ? `<p class="meta-info download-item__meta-info">${
        meta.filter(Boolean).map(m => `<span class="meta-info__item">${escape(m)}</span>`).join('')}</p>` : ''}
    </div>`;
  return real
    ? `<a class="download-item" href="${escape(href)}" download>${inner}</a>`
    : `<span class="download-item" aria-disabled="true" title="Im Prototyp nicht verfügbar">${inner}
       <span class="sr-only">(im Prototyp nicht verfügbar)</span></span>`;
}

// Link for a demo download that has no real target yet.
export function downloadLink(url, label, iconName = 'Download') {
  const real = url && url !== '#';
  return real
    ? `<a class="btn btn--link" href="${escape(url)}">${icon(iconName, 'btn__icon')} ${escape(label)}</a>`
    : `<span class="btn btn--link" aria-disabled="true" title="Im Prototyp nicht verfügbar">${icon(iconName, 'btn__icon')} ${escape(label)}<span class="sr-only"> (im Prototyp nicht verfügbar)</span></span>`;
}

// --- Pagination (pagination.postcss) -----------------------------------------
// CD anatomy: an editable current-page field, "von N Seiten", then prev/next as
// icon-only outline buttons (disabled at the ends). `href(page)` builds the
// target hash so the caller keeps its own filters; `inputId` is wired by the
// caller for typed page jumps.
export function pagination({ page, totalPages, href, inputId, label = 'Seitennavigation' }) {
  if (totalPages <= 1) return '';
  const control = (target, text, iconName, disabled) => {
    const inner = `${icon(iconName, 'btn__icon')}<span class="btn__text">${text}</span>`;
    return disabled
      ? `<li><span class="btn btn--outline btn--icon-only" aria-disabled="true" aria-label="${text}">${inner}</span></li>`
      : `<li><a class="btn btn--outline btn--icon-only" href="${escape(href(target))}" aria-label="${text}">${inner}</a></li>`;
  };
  return `
    <nav class="pagination-wrap" aria-label="${escape(label)}">
      <div class="pagination">
        <label class="sr-only" for="${inputId}">Seite</label>
        <input id="${inputId}" class="pagination__input input--outline input--base" type="text" inputmode="numeric"
          value="${page}" aria-label="Seite" autocomplete="off">
        <div class="pagination__text">von ${totalPages} Seiten</div>
        <ul class="pagination_items">
          ${control(page - 1, 'Vorherige Seite', 'ChevronLeft', page === 1)}
          ${control(page + 1, 'Nächste Seite', 'ChevronRight', page === totalPages)}
        </ul>
      </div>
    </nav>`;
}

// Wires the editable page field of a pagination block. `go(target)` navigates.
export function wirePagination(mount, inputId, page, totalPages, go) {
  const input = mount.querySelector('#' + inputId);
  if (!input) return;
  const jump = () => {
    const parsed = Number.parseInt(input.value, 10);
    const target = Math.min(totalPages, Math.max(1, Number.isFinite(parsed) ? parsed : page));
    if (target === page) { input.value = String(page); return; }
    go(target);
  };
  input.addEventListener('change', jump);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); jump(); } });
}

// --- Ergebniskopf (search.postcss:208-234) ----------------------------------
// Die Leiste über der Trefferliste: Anzahl links, Steuerung rechts. Der
// Ansichtswechsel steht als Icon-Gruppe rechts, abgetrennt durch einen Strich.
export function resultsHeader({ count, total, unit, page = 1, totalPages = 1, view = 'galerie' }) {
  const pageInfo = totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : '';
  return `
    <div class="search-results__header">
      <div class="search-results__header__left">
        <strong>${escape(String(count))}</strong>von ${escape(String(total))} ${escape(unit)}${pageInfo}
      </div>
      <div class="search-results__header__right">${viewSwitch(view)}</div>
    </div>`;
}

// Icon-Umschalter Galerie/Liste — keine Beschriftung, der Zustand steht in
// aria-pressed und im aria-label.
export function viewSwitch(view = 'galerie') {
  const btn = (key, label, iconName) => {
    const on = view === key;
    return `<button type="button" class="view-switch__btn" data-view="${key}"
      aria-pressed="${on}" aria-label="${escape(label)}" title="${escape(label)}">${icon(iconName, 'icon--md')}</button>`;
  };
  return `<div class="view-switch" role="group" aria-label="Ansicht">
    ${btn('galerie', 'Galerieansicht', 'Apps')}${btn('liste', 'Listenansicht', 'List')}
  </div>`;
}

// --- Login-Hinweis (AGOV / FedLogin) -----------------------------------------
// Kein Inhalt wird versteckt; abgemeldet erscheint nur dieser Hinweis dort, wo
// ein Vorgang ausgelöst würde. Der Button ruft window.__login() (in app.js
// verdrahtet), das die Session setzt und die Seite neu zeichnet.
export function loginGate(text = 'Zum Starten dieses Vorgangs ist eine Anmeldung erforderlich.') {
  return `<div class="notification notification--hint login-gate">
    ${icon('Lock', 'notification__icon')}
    <div class="notification__content">
      <p style="margin:0 0 .75rem">${text}</p>
      <button type="button" class="btn btn--outline login-gate__btn" onclick="window.__login && window.__login()">
        ${icon('User', 'btn__icon')}<span class="btn__text">Anmelden mit AGOV / FedLogin</span>
      </button>
    </div>
  </div>`;
}

export const C = {
  icon, escape, badge, audienceTag, statusBadge, pageHeader, tile, card, table, empty, shareBar, domainTile, announce,
  notification, backLink, photo, photoUrl, select, selectBox, chevron, field, tagItem, downloadItem, downloadLink,
  pagination, wirePagination, resultsHeader, viewSwitch, loginGate,
};
export default C;
