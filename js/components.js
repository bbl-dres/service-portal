// Shared UI component helpers — all return HTML strings (pages compose via templates).

const ICON_BASE = 'assets/icons/';

export function icon(name, cls = '') {
  const u = ICON_BASE + name + '.svg';
  return `<span class="icon ${cls}" style="-webkit-mask-image:url('${u}');mask-image:url('${u}')" aria-hidden="true"></span>`;
}

export function escape(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function badge(text, variant = 'gray') {
  return `<span class="badge badge--${variant}">${escape(text)}</span>`;
}

export function audienceTag(a) {
  const map = { internal: ['tag-internal', 'Intern'], external: ['tag-external', 'Extern'], both: ['tag-both', 'Intern + Extern'] };
  const [c, l] = map[a] || map.both;
  return `<span class="badge ${c}">${l}</span>`;
}

const STATUS_VARIANT = {
  entwurf: 'gray', eingereicht: 'info', in_pruefung: 'warning', in_pruefung_gs: 'warning',
  in_pruefung_pfm: 'warning', rueckfrage: 'warning', in_arbeit: 'warning', triage: 'info',
  genehmigt: 'success', in_projekt: 'info', abgeschlossen: 'success', erledigt: 'success',
  geliefert: 'success', abgelehnt: 'error', zurueckgezogen: 'gray',
};
export function statusBadge(status, label) {
  return badge(label || status, STATUS_VARIANT[status] || 'gray');
}

export function pageHeader({ title, lead }) {
  return `<div class="page-header"><h1 tabindex="-1">${escape(title)}</h1>${lead ? `<p class="lead">${escape(lead)}</p>` : ''}</div>`;
}

export function tile({ title, desc, href }) {
  return `<a class="tile" href="${href}"><span class="tile__title">${escape(title)}</span>${desc ? `<span class="tile__desc">${escape(desc)}</span>` : ''}</a>`;
}

export function card(o) {
  const inner = `
    ${o.image ? `<div class="card__image"><img src="${o.image}" alt="${escape(o.imageAlt || '')}" loading="lazy"></div>` : ''}
    <div class="card__body">
      <div class="card__title">${escape(o.title)}</div>
      ${o.badges ? `<div class="pill-row">${o.badges.join('')}</div>` : ''}
      ${o.desc ? `<p class="card__desc">${escape(o.desc)}</p>` : ''}
    </div>
    ${o.footer ? `<div class="card__footer">${o.footer}</div>` : ''}`;
  return o.href
    ? `<a class="card card--clickable" href="${o.href}">${inner}</a>`
    : `<div class="card">${inner}</div>`;
}

// columns: [{ key, label, render?(row) }]; rows: object[]
export function table({ columns, rows, zebra }) {
  const head = columns.map(c => `<th>${escape(c.label)}</th>`).join('');
  const body = (rows || []).map(r =>
    `<tr>${columns.map(c => `<td>${c.render ? c.render(r) : escape(r[c.key])}</td>`).join('')}</tr>`
  ).join('');
  return `<div class="table-wrapper"><table class="data${zebra ? ' zebra' : ''}">
    <thead><tr>${head}</tr></thead>
    <tbody>${body || `<tr><td colspan="${columns.length}" class="muted">Keine Einträge</td></tr>`}</tbody>
  </table></div>`;
}

export function empty(msg) { return `<div class="empty">${escape(msg)}</div>`; }

export function notification(text, variant = 'info', iconName = 'InfoCircle') {
  return `<div class="notification notification--${variant}">${icon(iconName, 'icon--lg')}<div>${text}</div></div>`;
}

export function backLink(href, label) {
  return `<a class="btn btn--link" href="${href}">${icon('ChevronLeft', 'icon--sm')} ${escape(label)}</a>`;
}

export const C = { icon, escape, badge, audienceTag, statusBadge, pageHeader, tile, card, table, empty, notification, backLink };
export default C;
