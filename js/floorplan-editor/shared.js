// Shared presentation primitives for the standalone floor-plan editor.
// Keep this module stateless: navigation and the workbench both use it.

import { formatArea, formatNumber } from '../format.js';
import { planCheck } from '../links.js';
import { safeAssetUrl } from '../security/urls.js';

export const BASE = '#/app/floorplan-editor';
export const COLOR_DEFAULT = 'none';
export const VIEW_MODES = new Set(['2d', '3d', 'walk']);
export const PLAN_STATUS = {
  accepted: { label: 'abgenommen', variant: 'success' },
  not_synced: { label: 'nicht synchronisiert', variant: 'warning' },
  inventory: { label: 'Bestandsgrundriss', variant: 'gray' },
};

export const clean = (value) => String(value || '').trim().toLocaleLowerCase('de');
export const address = (building) => `${building.street || ''}, ${building.zip || ''} ${building.city || ''}`.replace(/^,\s*/, '').trim();
export const productImage = (product) => product?.photo
  ? safeAssetUrl(`assets/images/shop/${String(product.photo).replace(/^images\//, '')}`, 'assets/images/shop/') : '';
const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2)
  .map((part) => part[0]).join('').toLocaleUpperCase('de') || 'BBL';
export const optionMarkup = (options, value) => options.map((option) => {
  const item = typeof option === 'object' ? option : { value: option, label: option };
  return `<option value="${String(item.value).replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"${String(item.value) === String(value) ? ' selected' : ''}>${String(item.label).replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</option>`;
}).join('');
export const useSwatch = (group) => ({
  arbeit: 'work', zusammen: 'collab', infra: 'infra', sonder: 'special',
})[group] || 'infra';
export const COLOR_DESCRIPTIONS = {
  none: 'Keine Farbcodierung',
  use: 'Raumfunktion / Nutzungstyp',
  sia: 'Flächenart nach SIA 416',
  've': 'Zugeordnete Verwaltungseinheit',
  module: 'Multispace-Ausstattungsstandard',
};
export const panelToggleIcon = (side) => `<svg class="fpe-panel-toggle-icon fpe-panel-toggle-icon--${side}" viewBox="0 0 24 24" aria-hidden="true">
  <rect x="3.5" y="5.5" width="17" height="13"></rect>
  <rect class="fpe-panel-toggle-icon__pane" x="${side === 'left' ? '3.5' : '14.5'}" y="5.5" width="6" height="13"></rect>
</svg>`;
export const number = (value) => formatNumber(value);
export const area = (value) => formatArea(value, { maximumFractionDigits: 1 });

/**
 * The portfolio view addressed by what it shows: a place, a single object, or
 * everything. The breadcrumb of the building detail walks back through exactly
 * these links, and the view's own state serialises through the same function, so
 * a crumb and a tree click cannot produce two different URLs for one scope.
 *
 * A place is the full path — country, then region, then city — because the
 * structure tree matches its nodes on the complete ancestry, not on the last
 * segment alone.
 */
export function portfolioRoute({
  country = '', region = '', city = '', obj = '', mode = '', sort = '',
} = {}) {
  const params = new URLSearchParams();
  if (mode && mode !== 'map') params.set('mode', mode);
  if (sort && sort !== 'name') params.set('sort', sort);
  if (obj) params.set('obj', obj);
  else {
    if (country) params.set('country', country);
    if (region) params.set('region', region);
    if (city) params.set('city', city);
  }
  const search = params.toString();
  return search ? `${BASE}?${search}` : BASE;
}

/**
 * The editor's own breadcrumb. The standalone layout hides the portal shell, so
 * `setCrumbs` has nothing to draw and every surface renders its own — always in
 * the same slot below the header. Keeping the bar on the landing as well is what
 * stops the page jumping by its height when moving between a detail and the
 * portfolio, and it gives a scoped portfolio the «one level up» affordance that
 * a filter pill cannot express.
 *
 * `steps` runs outermost first. The last entry is the current surface and never
 * links, so a peer view such as the work queue can carry a single honest crumb
 * rather than being hung under a parent it does not have.
 */
export function breadcrumbStepsHTML(C, steps) {
  // The trail starts outside the application. A standalone layout hides the
  // portal shell, so without this crumb the only ways back were the browser's
  // Back button and the address bar. It is a link like any other, which means it
  // passes through the router's unsaved-work guard.
  const items = [{ label: 'Kundenportal', href: '#/' }, ...(Array.isArray(steps) ? steps : [])]
    .filter(Boolean);
  return items.map((step, index) => (index === items.length - 1
    ? `<span aria-current="page">${C.escape(step.label)}</span>`
    : `<a href="${C.escape(step.href || BASE)}" data-leave>${C.escape(step.label)}</a>${
      C.icon('ChevronRight', 'icon--sm')}`)).join('');
}

export function breadcrumbBarHTML(C, steps, { id = '' } = {}) {
  const body = breadcrumbStepsHTML(C, steps);
  if (!body) return '';
  return `<div class="fpe-context">
    <nav class="fpe-breadcrumb" aria-label="Sie sind hier"${id ? ` id="${C.escape(id)}"` : ''}>${body}</nav>
  </div>`;
}

export function prototypeFooterHTML() {
  return `<footer class="fpe-local-note">
    <strong>Feedback-Prototyp</strong>
    <nav aria-label="Projektlinks">
      <a href="https://github.com/bbl-dres/service-portal" target="_blank" rel="noopener noreferrer">Quellcode</a>
      <a href="https://www.admin.ch/de/rechtliches" target="_blank" rel="noopener noreferrer">Rechtliches</a>
      <a href="https://www.bbl.admin.ch/de/kontakt" target="_blank" rel="noopener noreferrer">Kontakt</a>
    </nav>
  </footer>`;
}

// The two landing views are peers, so the switch belongs in the persistent
// header rather than inside one of them. The design system has no application
// shell to borrow here; this mirrors its own `top-bar-navigation` anatomy —
// horizontal links with an `aria-current` active state.
function viewSwitchHTML(C, view) {
  const item = (id, label, href) => `<a class="fpe-viewnav__item${view === id ? ' is-active' : ''}"
    href="${C.escape(href)}"${view === id ? ' aria-current="page"' : ''}>${C.escape(label)}</a>`;
  return `<nav class="fpe-viewnav" aria-label="Ansicht">
    ${item('portfolio', 'Portfolio', BASE)}
    ${item('work', 'Meine Arbeit', `${BASE}?view=work`)}
  </nav>`;
}

// `view` is empty in the workbench and names the landing view otherwise.
//
// On the landing the header carries the plan-upload action so it is reachable
// from BOTH views rather than only from the work queue: uploading a plan is the
// one thing a visitor may want to do regardless of which register they are on.
// The workbench keeps its own object-specific handoff in the same slot. The
// landing has no header search: the portfolio carries its field inside the
// catalogue bar, and the work queue inside its table.
export function editorHeaderHTML(C, session, editMode = false, planCheckHref = '', view = '') {
  const user = session.user();
  const search = !view;
  const uploadAction = view
    ? `<a class="btn btn--filled btn--sm" id="fpe-plan-upload" href="${C.escape(planCheck())}"
        target="_blank" rel="noopener noreferrer"><span class="btn__text">Plan hochladen und prüfen</span></a>`
    : '';
  return `<header class="fpe-header">
    <a class="fpe-brand plain-link" id="fpe-home" href="${BASE}" data-leave aria-label="Plan-Editor – Startseite">
      <img src="assets/swiss-logo-flag.svg" alt="" aria-hidden="true"><span>BBL <strong>Plan-Editor</strong></span>
    </a>
    ${view ? viewSwitchHTML(C, view) : ''}
    ${editMode ? '<span class="fpe-edit-state" title="Bearbeitungsmodus"><i aria-hidden="true"></i><span class="fpe-edit-state__text">Bearbeitungsmodus</span></span>' : ''}
    <span class="fpe-header__spacer"></span>
    ${search ? `<button class="btn btn--bare btn--sm btn--icon-left fpe-search-jump" id="fpe-search-jump" type="button" data-action="focus-search">${C.icon('Search', 'btn__icon')}<span class="btn__text">Suche</span></button>` : ''}
    ${uploadAction}
    ${planCheckHref ? `<a class="btn btn--outline btn--sm btn--icon-left" id="fpe-plan-check" href="${C.escape(planCheckHref)}" target="_blank" rel="noopener noreferrer">${C.icon('Search', 'btn__icon')}<span class="btn__text">Planprüfung öffnen</span></a>` : ''}
    <span class="fpe-header__divider" aria-hidden="true"></span>
    <span class="fpe-user" title="${C.escape(user?.name || '')}"><span>${C.escape(initials(user?.name))}</span><span class="sr-only">Angemeldet als ${C.escape(user?.name || '')}</span></span>
  </header>`;
}
