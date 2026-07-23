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
    : o.image ? `<div class="card__image"><img src="${o.image}" alt="${escape(o.imageAlt || '')}" loading="lazy"></div>` : '';
  // CD: a card without an image is `card--universal`, with one is `card--default`.
  const variant = o.variant || (media ? 'default' : 'universal');
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
  return o.href ? `<a class="${cls}" href="${o.href}">${inner}</a>` : `<div class="${cls}">${inner}</div>`;
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

// --- Notifications (notification.postcss) ------------------------------------
// variant: info | success | warning | error | hint | alert
export function notification(text, variant = 'info', iconName = 'InfoCircle') {
  return `<div class="notification notification--${variant}">${icon(iconName, 'notification__icon')}<div class="notification__content">${text}</div></div>`;
}

export function backLink(href, label) {
  return `<a class="btn btn--link" href="${href}">${icon('ChevronLeft', 'btn__icon')}<span class="btn__text">${escape(label)}</span></a>`;
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

export const C = {
  icon, escape, badge, audienceTag, statusBadge, pageHeader, tile, card, table, empty,
  notification, backLink, photo, photoUrl, select, selectBox, chevron, field, tagItem, downloadItem, downloadLink,
};
export default C;
