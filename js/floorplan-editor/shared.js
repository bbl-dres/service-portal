// Shared presentation primitives for the standalone floor-plan editor.
// Keep this module stateless: navigation and the workbench both use it.

import { formatArea, formatNumber } from '../format.js';
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

export function editorHeaderHTML(C, session, editMode = false) {
  const user = session.user();
  return `<header class="fpe-header">
    <a class="fpe-brand plain-link" id="fpe-home" href="${BASE}" data-leave aria-label="Plan-Editor – Gebäudenavigation">
      <img src="assets/swiss-logo-flag.svg" alt="" aria-hidden="true"><span>BBL <strong>Plan-Editor</strong></span>
    </a>
    ${editMode ? '<span class="fpe-edit-state" title="Bearbeitungsmodus"><i aria-hidden="true"></i><span class="fpe-edit-state__text">Bearbeitungsmodus</span></span>' : ''}
    <span class="fpe-header__spacer"></span>
    <button class="btn btn--bare btn--sm btn--icon-left fpe-search-jump" id="fpe-search-jump" type="button" data-action="focus-search">${C.icon('Search', 'btn__icon')}<span class="btn__text">Suche</span></button>
    <span class="fpe-header__divider" aria-hidden="true"></span>
    <span class="fpe-user" title="${C.escape(user?.name || '')}"><span>${C.escape(initials(user?.name))}</span><span class="sr-only">Angemeldet als ${C.escape(user?.name || '')}</span></span>
  </header>`;
}
