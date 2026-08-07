// BBL Plan-Editor — standalone feedback workbench for rooms and furniture.
//
// This is deliberately a separate micro-app from Workspace (portal/read-only)
// and Planprüfung (DWG import/rules/approval). The browser prototype writes only
// clearly labelled local workspaces/revision simulations; canonical core data is
// cloned and never mutated. Upload and plan checking remain a separate micro-app.

import { floorplanEditor } from '../links.js';
import {
  EDITOR_COLOR_MODES, renderEditorSvg, fitCamera, zoomCamera, panCamera,
  fitCameraToRect, scaleBar, clientToPlan, containingRoom, clampPlacement,
  measurementLabel,
} from '../floorplan-editor-canvas.js';
import {
  MODULE_OPTIONS, USE_OPTIONS, SIA_OPTIONS, createBaseline, cloneDocument,
  EditorHistory,
} from '../floorplan-editor-model.js';
import {
  loadWorkingCopy, saveWorkingCopy, removeWorkingCopy,
  loadRevisionHistory, publishLocalRevision,
} from '../floorplan-editor-repository.js';

export const needs = ['buildings', 'floors', 'spaces', 'workspacePlanning', 'shopProducts'];
export const layout = 'standalone';
export const loginText = 'Der Plan-Editor enthält Arbeitsplatz- und Ausstattungsdaten. Melden Sie sich mit AGOV / FedLogin an, um einen Plan zu öffnen.';

const BASE = '#/app/floorplan-editor';
const COLOR_DEFAULT = 'use';
const VIEW_MODES = new Set(['2d', '3d', 'walk']);
const THREE_D_REFERENCE = 'docs/wireframes/260806%20-%20Workpace%20Management/assets/images/editor-3d-ansicht.png';
const PLAN_STATUS = {
  accepted: { label: 'CAD abgenommen', variant: 'success' },
  not_synced: { label: 'nicht synchronisiert', variant: 'warning' },
  inventory: { label: 'Bestandsgrundriss', variant: 'gray' },
};

const clean = (value) => String(value || '').trim().toLocaleLowerCase('de');
const address = (building) => `${building.street || ''}, ${building.zip || ''} ${building.city || ''}`.replace(/^,\s*/, '').trim();
const productImage = (product) => product?.photo
  ? `assets/images/shop/${String(product.photo).replace(/^images\//, '')}` : '';
const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2)
  .map((part) => part[0]).join('').toLocaleUpperCase('de') || 'BBL';
const optionMarkup = (options, value) => options.map((option) => {
  const item = typeof option === 'object' ? option : { value: option, label: option };
  return `<option value="${String(item.value).replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"${String(item.value) === String(value) ? ' selected' : ''}>${String(item.label).replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</option>`;
}).join('');
const useSwatch = (group) => ({
  arbeit: 'work', zusammen: 'collab', infra: 'infra', sonder: 'special',
})[group] || 'infra';

function planningObjects(core) {
  return (core.data.workspacePlanning || []).map((planning) => {
    const building = core.building(planning.buildingId);
    const floors = core.floorsForBuilding(planning.buildingId).sort((a, b) => a.level - b.level);
    return building && floors.length ? { building, floors, planning } : null;
  }).filter(Boolean);
}

function planningFloor(planning, floorId) {
  return (planning?.floors || []).find((entry) => entry.floorId === floorId) || {
    floorId, planStatus: 'inventory', equipmentCount: null, lastSync: '',
  };
}

function selectedFromQuery(query, document) {
  const raw = query.get('selected') || '';
  const split = raw.indexOf(':');
  if (split < 1) return null;
  const kind = raw.slice(0, split);
  const id = raw.slice(split + 1);
  if (kind === 'room' && document.rooms.some((room) => room.spaceId === id)) return { type: 'room', id };
  if (kind === 'placement' && document.placements.some((placement) => placement.placementId === id)) return { type: 'placement', id };
  return null;
}

function noPlan(ctx, message) {
  const { mount, C, setTitle } = ctx;
  document.body.classList.remove('body--standalone-app');
  setTitle('Plan-Editor');
  mount.innerHTML = `<div class="container section">
    ${C.backLink('#/app/workspace', 'Workspace Management')}
    <div class="page-header"><h1 tabindex="-1">Plan-Editor</h1></div>
    ${C.notification(`<p class="m-0">${C.escape(message)}</p>`, 'warning', 'WarningCircle')}
  </div>`;
}

export default async function render(ctx) {
  const { mount, query, core, session, C, onUnmount, setTitle } = ctx;
  const objects = planningObjects(core);
  if (!objects.length) return noPlan(ctx, 'Es sind keine Gebäude mit einem bearbeitbaren Grundriss verfügbar.');

  const requestedBuilding = query.get('building') || '';
  let object = requestedBuilding ? objects.find((entry) => entry.building.bbl_id === requestedBuilding) : null;
  if (requestedBuilding && !object) return noPlan(ctx, 'Das angeforderte Workspace-Objekt oder seine Grundrisse wurden nicht gefunden.');
  object ||= objects.find((entry) => entry.planning.planAvailability === 'planned') || objects[0];

  const requestedFloor = query.get('floor') || '';
  let floor = requestedFloor ? object.floors.find((entry) => entry.floorId === requestedFloor) : null;
  if (!floor) floor = object.floors.find((entry) => entry.key === '2og') || object.floors[0];
  const building = object.building;
  const plan = planningFloor(object.planning, floor.floorId);
  const canonicalRooms = core.spacesForFloor(floor.floorId);
  if (!canonicalRooms.length) return noPlan(ctx, 'Für das gewählte Geschoss ist keine Raumgeometrie hinterlegt.');

  const baseline = createBaseline({
    building, floor, spaces: canonicalRooms, products: core.shopProducts(),
    planningFloor: plan, user: session.user(),
  });
  const loaded = loadWorkingCopy(floor.floorId, baseline);
  let editorDocument = loaded.ok ? loaded.document : baseline;
  let lastSaved = cloneDocument(editorDocument);
  let hasLocalDraft = loaded.ok && loaded.source === 'browser-local';
  let revisions = loadRevisionHistory(floor.floorId, baseline);
  let lastPublished = revisions.length ? cloneDocument(revisions[revisions.length - 1].document) : null;
  let editHistory = new EditorHistory(editorDocument);

  const validColors = new Set(EDITOR_COLOR_MODES.map((item) => item.value));
  let colorMode = validColors.has(query.get('color')) ? query.get('color') : COLOR_DEFAULT;
  let viewMode = VIEW_MODES.has(query.get('view')) ? query.get('view') : '2d';
  let selected = selectedFromQuery(query, editorDocument);
  let editMode = query.get('edit') === '1';
  let dirty = false;
  let tool = 'select';
  let placementProduct = null;
  let libraryMode = query.get('library') === 'modules' ? 'modules' : 'products';
  let productCategory = '';
  let measurement = null;
  let roomDraft = null;
  let placementGhost = null;
  let camera = fitCamera(floor);
  let resourceQuery = '';
  let productQuery = '';
  let leftOpen = !window.matchMedia('(max-width: 1023px)').matches;
  let rightOpen = !window.matchMedia('(max-width: 1023px)').matches;
  let drag = null;
  let liveText = '';

  const products = core.shopProducts();
  const productsById = new Map(products.map((product) => [String(product.id), product]));
  const roomById = () => new Map(editorDocument.rooms.map((room) => [room.spaceId, room]));
  const placementById = () => new Map(editorDocument.placements.map((placement) => [placement.placementId, placement]));
  const documentsEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const keepValidSelection = () => {
    if (selected?.type === 'room' && editorDocument.rooms.some((room) => room.spaceId === selected.id)) return;
    if (selected?.type === 'placement' && editorDocument.placements.some((placement) => placement.placementId === selected.id)) return;
    selected = null;
  };

  const returnHref = () => `#/app/workspace?id=${encodeURIComponent(building.bbl_id)}&floor=${encodeURIComponent(floor.floorId)}`;

  function syncQuery() {
    const params = new URLSearchParams();
    params.set('building', building.bbl_id);
    params.set('floor', floor.floorId);
    if (colorMode !== COLOR_DEFAULT) params.set('color', colorMode);
    if (viewMode !== '2d') params.set('view', viewMode);
    if (selected) params.set('selected', `${selected.type}:${selected.id}`);
    if (editMode) params.set('edit', '1');
    if (editMode && libraryMode === 'modules') params.set('library', 'modules');
    const next = `${BASE}?${params}`;
    if (location.hash !== next) window.history.replaceState(window.history.state, '', next);
  }

  function announce(message) {
    liveText = message;
    const live = mount.querySelector('#fpe-live');
    if (live) live.textContent = '';
    requestAnimationFrame(() => { const node = mount.querySelector('#fpe-live'); if (node) node.textContent = message; });
    C.announce(message);
  }

  function commit(label, change) {
    const next = cloneDocument(editorDocument);
    change(next);
    if (documentsEqual(next, editorDocument)) return false;
    editHistory.push(next);
    editorDocument = cloneDocument(editHistory.current);
    dirty = !documentsEqual(editorDocument, lastSaved);
    syncDraftChrome();
    announce(label);
    return true;
  }

  function restoreHistory(direction) {
    const result = direction === 'undo' ? editHistory.undo() : editHistory.redo();
    if (!result) return;
    editorDocument = cloneDocument(result);
    dirty = !documentsEqual(editorDocument, lastSaved);
    syncDraftChrome();
    keepValidSelection();
    syncQuery();
    drawWorkArea({ focusSelected: true });
    announce(direction === 'undo' ? 'Änderung rückgängig gemacht.' : 'Änderung wiederholt.');
  }

  function planBadge() {
    const meta = PLAN_STATUS[plan.planStatus] || PLAN_STATUS.inventory;
    return C.badge(meta.label, meta.variant, 'sm');
  }

  function editorVersionLabel() {
    if (dirty) return 'Arbeitskopie — ungespeichert';
    if (lastPublished && documentsEqual(editorDocument, lastPublished)) {
      return `Lokal publiziert — V${(revisions.at(-1)?.number || 1) + 1}`;
    }
    if (hasLocalDraft) return 'Arbeitskopie — nur auf diesem Gerät';
    return editMode ? 'Neue Arbeitskopie' : 'Ausgangsstand';
  }

  const canPublish = () => (dirty || hasLocalDraft)
    && (!lastPublished || !documentsEqual(editorDocument, lastPublished));

  function syncDraftChrome() {
    const version = mount.querySelector('.fpe-version');
    if (version) version.textContent = editorVersionLabel();
    const save = mount.querySelector('#fpe-save');
    if (save) save.disabled = !dirty;
    const publish = mount.querySelector('#fpe-publish');
    if (publish) publish.disabled = !canPublish();
  }

  function headerHTML() {
    const user = session.user();
    const versionLabel = editorVersionLabel();
    return `<header class="fpe-header">
      <a class="fpe-brand" href="${returnHref()}" data-leave>
        <img src="assets/swiss-logo-flag.svg" alt="" aria-hidden="true"><span>BBL <strong>Plan-Editor</strong></span>
      </a>
      <span class="fpe-header__spacer"></span>
      <button class="btn btn--bare btn--sm fpe-search-jump" id="fpe-search-jump" type="button" data-action="focus-search">${C.icon('Search', 'btn__icon')}<span class="btn__text">Suche</span></button>
      <button class="btn btn--outline btn--sm" id="fpe-upload" type="button" disabled title="Planübernahme und Prüfung folgen als separate Anwendung">${C.icon('CloudUpload', 'btn__icon')}<span class="btn__text">Plan hochladen</span></button>
      <span class="fpe-header__divider" aria-hidden="true"></span>
      <span class="fpe-user" title="${C.escape(user?.name || '')}"><span>${C.escape(initials(user?.name))}</span><span class="sr-only">Angemeldet als ${C.escape(user?.name || '')}</span></span>
    </header>
    <div class="fpe-context">
      <a class="btn btn--bare btn--sm btn--icon-only" href="${returnHref()}" data-leave aria-label="Zurück zu Workspace Management">${C.icon('ArrowLeft', 'btn__icon')}</a>
      <div class="fpe-context__selectors">
        ${C.select({ id: 'fpe-building', label: 'Gebäude', hideLabel: true, size: 'sm', value: building.bbl_id,
          options: objects.map((entry) => ({ value: entry.building.bbl_id, label: entry.building.name })) })}
        ${C.select({ id: 'fpe-floor', label: 'Geschoss', hideLabel: true, size: 'sm', value: floor.floorId,
          options: object.floors.map((entry) => ({ value: entry.floorId, label: entry.label })) })}
      </div>
      <div class="fpe-context__panel-mobile" role="group" aria-label="Seitenpanels">
        <button class="btn btn--bare btn--sm btn--icon-only${leftOpen ? ' is-active' : ''}" id="fpe-toggle-left-mobile" type="button" data-action="toggle-left"
          aria-label="${leftOpen ? 'Linkes Panel ausblenden' : 'Linkes Panel einblenden'}" aria-pressed="${leftOpen}">${C.icon('List', 'btn__icon')}</button>
        <button class="btn btn--bare btn--sm btn--icon-only${rightOpen ? ' is-active' : ''}" id="fpe-toggle-right-mobile" type="button" data-action="toggle-right"
          aria-label="${rightOpen ? 'Rechtes Panel ausblenden' : 'Rechtes Panel einblenden'}" aria-pressed="${rightOpen}">${C.icon('Apps', 'btn__icon')}</button>
      </div>
      <span class="fpe-version">${C.escape(versionLabel)}</span>
      <span class="fpe-context__status">${planBadge()}</span>
      ${object.planning.targetDate ? `<span class="fpe-date">${C.icon('Calendar', 'icon--sm')} Stichtag ${C.escape(object.planning.targetDate.split('-').reverse().join('.'))}</span>` : ''}
      <span class="fpe-context__spacer"></span>
      ${editMode
        ? `<span class="fpe-edit-state">Bearbeitungsmodus</span>
           <button class="btn btn--outline btn--sm" id="fpe-save" type="button" data-action="save" title="Speichert die Arbeitskopie nur in diesem Browser"${dirty ? '' : ' disabled'}>${C.icon('Save', 'btn__icon')}<span class="btn__text">Entwurf speichern</span></button>
           <button class="btn btn--filled btn--sm" id="fpe-publish" type="button" data-action="publish" title="Simuliert die Veröffentlichung nur in diesem Browser"${canPublish() ? '' : ' disabled'}><span class="btn__text">Veröffentlichen</span></button>
           <button class="btn btn--outline btn--sm" id="fpe-end-edit" type="button" data-action="end-edit"><span class="btn__text">Beenden</span></button>`
        : `<button class="btn btn--filled btn--sm" id="fpe-start-edit" type="button" data-action="start-edit"><span class="btn__text">Bearbeiten</span>${C.icon('ArrowRight', 'btn__icon')}</button>`}
      <span class="fpe-header__divider" aria-hidden="true"></span>
      <button class="btn btn--bare btn--sm btn--icon-only${leftOpen ? ' is-active' : ''}" id="fpe-toggle-left" type="button" data-action="toggle-left"
        aria-label="${leftOpen ? 'Linkes Panel ausblenden' : 'Linkes Panel einblenden'}" aria-pressed="${leftOpen}">${C.icon('List', 'btn__icon')}</button>
      <button class="btn btn--bare btn--sm btn--icon-only${rightOpen ? ' is-active' : ''}" id="fpe-toggle-right" type="button" data-action="toggle-right"
        aria-label="${rightOpen ? 'Rechtes Panel ausblenden' : 'Rechtes Panel einblenden'}" aria-pressed="${rightOpen}">${C.icon('Apps', 'btn__icon')}</button>
    </div>`;
  }

  function resourceGroups() {
    const term = clean(resourceQuery);
    const groups = new Map();
    const occupiers = [...new Set(editorDocument.rooms.map((room) => room.occupierVe).filter(Boolean))].sort();
    const moduleById = new Map(MODULE_OPTIONS.map((item) => [String(item.value), item]));
    const descriptor = (room) => {
      if (colorMode === 'none') return { key: 'all', label: 'Alle Räume', swatch: 'none' };
      if (colorMode === 'sia') return { key: `sia-${room.sia}`, label: `${room.sia} · ${room.siaLabel}`, swatch: `sia-${clean(room.sia)}` };
      if (colorMode === 've') {
        const index = Math.max(0, occupiers.indexOf(room.occupierVe));
        return room.occupierVe
          ? { key: `ve-${room.occupierVe}`, label: room.occupierVe, swatch: `ve-${String.fromCharCode(97 + (index % 6))}` }
          : { key: 've-unassigned', label: 'Nicht zugeteilt', swatch: 'unassigned' };
      }
      if (colorMode === 'module') {
        const option = moduleById.get(String(room.moduleId));
        return option
          ? { key: `module-${room.moduleId}`, label: option.label, swatch: `module-${room.moduleId}` }
          : { key: 'module-unassigned', label: 'Ohne Ausstattungsstandard', swatch: 'unassigned' };
      }
      return { key: `use-${room.useLabel}`, label: room.useLabel || 'Ohne Nutzung', swatch: useSwatch(room.group) };
    };
    editorDocument.rooms.forEach((room) => {
      const roomPlacements = editorDocument.placements.filter((placement) => placement.roomId === room.spaceId);
      const haystack = clean(`${room.roomNumber} ${room.useLabel} ${room.occupierVe || ''} ${roomPlacements.map((item) => item.name).join(' ')}`);
      if (term && !haystack.includes(term)) return;
      const group = descriptor(room);
      const entry = groups.get(group.key) || { ...group, rooms: [], area: 0 };
      entry.rooms.push({ room, placements: roomPlacements });
      entry.area += Number(room.area) || 0;
      groups.set(group.key, entry);
    });
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'de'));
  }

  function resourceListHTML() {
    const groups = resourceGroups();
    if (!groups.length) return `<div class="fpe-panel-empty">Keine Ressourcen gefunden.</div>`;
    return groups.map((group) => `<section class="fpe-resource-group">
      <h3><span class="fpe-swatch fpe-swatch--${C.escape(group.swatch)}" aria-hidden="true"></span><span>${C.escape(group.label)}</span><span>${group.rooms.length}</span><span>${group.area.toLocaleString('de-CH', { maximumFractionDigits: 1 })} m²</span></h3>
      <ul>${group.rooms.map(({ room, placements }) => {
        const roomSelected = selected?.type === 'room' && selected.id === room.spaceId;
        const open = roomSelected || placements.some((placement) => selected?.type === 'placement' && selected.id === placement.placementId);
        return `<li><button type="button" class="fpe-resource-row${roomSelected ? ' is-selected' : ''}" data-select-type="room" data-select-id="${C.escape(room.spaceId)}" aria-pressed="${roomSelected}">
          <span>${C.icon(open ? 'ChevronDown' : 'ChevronRight', 'icon--sm')}</span><span>${C.escape(room.roomNumber)}</span><span>${Number(room.area).toLocaleString('de-CH')} m²</span></button>
          ${open && placements.length ? `<ul class="fpe-resource-assets">${placements.map((placement) => {
            const active = selected?.type === 'placement' && selected.id === placement.placementId;
            return `<li><button type="button" class="fpe-resource-row fpe-resource-row--asset${active ? ' is-selected' : ''}" data-select-type="placement" data-select-id="${C.escape(placement.placementId)}" aria-pressed="${active}">${C.icon('List', 'icon--sm')}<span>${C.escape(placement.name)}</span></button></li>`;
          }).join('')}</ul>` : ''}</li>`;
      }).join('')}</ul>
    </section>`).join('');
  }

  function productListHTML() {
    const term = clean(productQuery);
    const visible = products.filter((product) => (!productCategory || product.category === productCategory)
      && (!term || clean(`${product.name} ${product.brand} ${product.category} ${product.subcategory}`).includes(term)));
    if (!visible.length) return `<div class="fpe-panel-empty">Keine Produkte gefunden.</div>`;
    return `<div class="fpe-product-grid">${visible.map((product) => {
      const selectedProduct = String(placementProduct?.id) === String(product.id);
      const image = productImage(product);
      const dims = product.dimensions || {};
      return `<button type="button" class="fpe-product${selectedProduct ? ' is-selected' : ''}" data-product="${C.escape(String(product.id))}" aria-pressed="${selectedProduct}">
        <span class="fpe-product__image">${image ? `<img src="${C.escape(image)}" alt="" loading="lazy">` : C.icon('Image', 'icon--lg')}</span>
        <strong>${C.escape(product.name)}</strong><small>${dims.width || '—'} × ${dims.depth || '—'} cm</small><span class="fpe-product__action">Platzieren</span>
      </button>`;
    }).join('')}</div>`;
  }

  function moduleListHTML() {
    const term = clean(productQuery);
    const counts = new Map((object.planning.equipmentGroups || []).map((item) => [String(item.number), Number(item.count) || 0]));
    const room = selected?.type === 'room' ? roomById().get(selected.id) : null;
    const visible = MODULE_OPTIONS.filter((item) => !term || clean(item.label).includes(term));
    if (!visible.length) return `<div class="fpe-panel-empty">Keine Module gefunden.</div>`;
    return `<div class="fpe-module-list">${visible.map((item) => {
      const active = room && String(room.moduleId) === String(item.value);
      return `<button type="button" class="fpe-module-card${active ? ' is-selected' : ''}" data-module="${C.escape(String(item.value))}" aria-pressed="${active}">
        <span class="fpe-swatch fpe-swatch--module-${C.escape(String(item.value))}" aria-hidden="true"></span>
        <span><strong>${C.escape(item.label)}</strong><small>${counts.get(String(item.value)) || 0} Positionen im Projekt</small></span>
        <span class="fpe-module-card__action">${active ? 'Zugewiesen' : 'Raum zuweisen'}</span>
      </button>`;
    }).join('')}</div>`;
  }

  function leftPanelHTML() {
    const editingProducts = editMode && libraryMode === 'products';
    const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort();
    return `<aside class="fpe-left" id="fpe-left" aria-label="${editMode ? 'Produktbibliothek' : 'Ressourcen'}">
      <h2 class="sr-only">${editMode ? 'Produktbibliothek' : 'Ressourcen'}</h2>
      <div class="fpe-panel-head">
        <p class="fpe-overline">${editMode ? 'Bibliothek' : 'Ressourcen'}</p>
        ${editMode ? `<div class="fpe-library-tabs" role="tablist" aria-label="Bibliothek">
          <button type="button" role="tab" data-library="products" aria-selected="${libraryMode === 'products'}"${libraryMode === 'products' ? ' class="is-active"' : ''}>Produkte</button>
          <button type="button" role="tab" data-library="modules" aria-selected="${libraryMode === 'modules'}"${libraryMode === 'modules' ? ' class="is-active"' : ''}>Module</button>
        </div>` : ''}
        <label class="sr-only" for="fpe-left-search">${editMode ? (editingProducts ? 'Produkte' : 'Module') : 'Ressourcen'} suchen</label>
        <div class="fpe-panel-search">${C.icon('Search', 'icon--sm')}<input id="fpe-left-search" type="search" placeholder="${editMode ? (editingProducts ? 'Produkte suchen…' : 'Module suchen…') : 'Schnellsuche…'}" value="${C.escape(editMode ? productQuery : resourceQuery)}"></div>
        ${editingProducts ? C.select({ id: 'fpe-product-category', label: 'Kategorie', size: 'sm', value: productCategory,
          options: [{ value: '', label: 'Alle Kategorien' }, ...categories.map((value) => ({ value, label: value }))] }) : ''}
        ${editMode ? `<p class="small muted m-0">${editingProducts
          ? 'Produkt wählen und anschliessend im Plan platzieren. Bei gewähltem Raum wird es mittig eingefügt.'
          : 'Raum wählen und ein Multispace-Modul zuweisen. Die Zuordnung ist eine Prototypannahme.'}</p>`
          : C.select({ id: 'fpe-color', label: 'Einfärben nach', size: 'sm', value: colorMode, options: EDITOR_COLOR_MODES })}
      </div>
      <div class="fpe-panel-scroll" id="fpe-left-list">${editMode ? (editingProducts ? productListHTML() : moduleListHTML()) : resourceListHTML()}</div>
    </aside>`;
  }

  function toolButton(action, label, icon, options = {}) {
    const active = options.active ? ' is-active' : '';
    const pressed = options.pressed == null ? '' : ` aria-pressed="${options.pressed}"`;
    const disabled = options.disabled ? ' disabled' : '';
    return `<button class="btn btn--bare btn--sm btn--icon-only fpe-tool${active}" id="fpe-action-${action}" type="button" data-action="${action}" aria-label="${label}" title="${label}"${pressed}${disabled}>${C.icon(icon, 'btn__icon')}</button>`;
  }

  function toolbarHTML() {
    if (viewMode !== '2d') {
      return `<div class="fpe-toolbar fpe-toolbar--reference" role="toolbar" aria-label="${viewMode === '3d' ? '3D-Ansicht' : 'Begehungsansicht'}">
        ${C.icon(viewMode === '3d' ? 'Apps' : 'Eye', 'icon--sm')}
        <span>${viewMode === '3d' ? '3D-Referenzansicht' : 'Begehungs-Prototyp'}</span>
      </div>`;
    }
    const placing = tool === 'place' && placementProduct;
    return `<div class="fpe-toolbar" role="toolbar" aria-label="Planwerkzeuge">
      ${placing ? `<button class="btn btn--filled btn--sm" type="button" data-action="cancel-place">${C.icon('Cancel', 'btn__icon')}<span class="btn__text">${C.escape(placementProduct.name)}</span></button><span class="fpe-tool-sep"></span>` : ''}
      ${toolButton('tool-select', 'Auswählen', 'ArrowUp', { active: tool === 'select', pressed: tool === 'select' })}
      ${toolButton('tool-pan', 'Plan verschieben', 'Expand', { active: tool === 'pan', pressed: tool === 'pan' })}
      ${editMode ? toolButton('tool-room', 'Fläche anlegen', 'Plus', { active: tool === 'room', pressed: tool === 'room' }) : ''}
      <span class="fpe-tool-sep"></span>
      ${toolButton('tool-distance', 'Strecke messen', 'ArrowRight', { active: tool === 'distance', pressed: tool === 'distance' })}
      ${toolButton('tool-area', 'Fläche messen', 'Apps', { active: tool === 'area', pressed: tool === 'area' })}
      <span class="fpe-tool-sep"></span>
      ${toolButton('zoom-in', 'Vergrössern', 'Plus')}${toolButton('zoom-out', 'Verkleinern', 'Minus')}${toolButton('fit', 'Plan einpassen', 'Compress')}${toolButton('fit-selection', 'Auswahl einpassen', 'Expand', { disabled: !selected })}
      ${editMode ? `<span class="fpe-tool-sep"></span>${toolButton('undo', 'Rückgängig', 'ArrowLeft', { disabled: !editHistory.canUndo })}${toolButton('redo', 'Wiederholen', 'ArrowRight', { disabled: !editHistory.canRedo })}` : ''}
      ${toolButton('version-history', 'Versionsverlauf', 'Clock')}
      <span class="fpe-tool-sep"></span>${toolButton('print', 'Plan drucken', 'Printer')}
    </div>`;
  }

  function sceneContentHTML() {
    if (viewMode === '2d') {
      return renderEditorSvg({ floor, rooms: editorDocument.rooms, placements: editorDocument.placements,
        selected, colorMode, camera, measurement, editableRooms: editMode,
        roomDraft, placementGhost });
    }
    return `<div class="fpe-reference-view${viewMode === 'walk' ? ' is-walk' : ''}">
      <img src="${THREE_D_REFERENCE}" alt="Referenzdarstellung einer möblierten Büroetage">
      ${viewMode === 'walk' ? '<span class="fpe-walk-reticle" aria-hidden="true"></span>' : ''}
      <p><strong>${viewMode === '3d' ? '3D-Referenzansicht' : 'Begehungs-Prototyp'}</strong><br>Platzhalter zur Validierung der Navigation; nicht aus diesem Plan berechnet.</p>
    </div>`;
  }

  function stageHTML() {
    return `<section class="fpe-stage" id="fpe-stage" aria-label="Plan-Arbeitsfläche">
      <div id="fpe-toolbar-host">${toolbarHTML()}</div>
      <div class="fpe-scene${viewMode === '2d' ? '' : ' fpe-scene--reference'}" id="fpe-scene">${sceneContentHTML()}</div>
      <div class="fpe-view-switch" role="group" aria-label="Darstellung">
        <button type="button" data-action="view-2d"${viewMode === '2d' ? ' class="is-active"' : ''} aria-pressed="${viewMode === '2d'}">2D</button>
        <button type="button" data-action="view-3d"${viewMode === '3d' ? ' class="is-active"' : ''} aria-pressed="${viewMode === '3d'}">3D</button>
        <button type="button" data-action="view-walk"${viewMode === 'walk' ? ' class="is-active"' : ''} aria-pressed="${viewMode === 'walk'}">Begehung</button>
      </div>
      <div class="fpe-scale" id="fpe-scale" aria-hidden="true"${viewMode === '2d' ? '' : ' hidden'}><span></span><i></i></div>
      <div class="fpe-measure-result" role="status"${measurementLabel(measurement || {}) ? '' : ' hidden'}>${C.escape(measurementLabel(measurement || {}))}</div>
    </section>`;
  }

  function floorInspectorHTML() {
    const workplaces = editorDocument.rooms.reduce((sum, room) => sum + (Number(room.capacity) || 0), 0);
    const traffic = editorDocument.rooms.filter((room) => room.sia === 'VF').reduce((sum, room) => sum + (Number(room.area) || 0), 0);
    const groups = new Map();
    editorDocument.rooms.forEach((room) => {
      const entry = groups.get(room.useLabel) || { area: 0, group: room.group };
      entry.area += Number(room.area || 0);
      groups.set(room.useLabel, entry);
    });
    return `<div class="fpe-inspector-title">${C.icon('Building', 'icon--md')}<span>${C.escape(floor.label)}</span><small>Nichts ausgewählt</small></div>
      <section class="fpe-inspector-section"><h3>Geschosskennzahlen</h3><div class="fpe-kpis">
        <div><small>Bruttofläche</small><strong>${Number(floor.areaGross).toLocaleString('de-CH')} m²</strong></div>
        <div><small>Arbeitsplätze</small><strong>${workplaces.toLocaleString('de-CH')}</strong></div>
        <div><small>Räume</small><strong>${editorDocument.rooms.length}</strong></div>
        <div><small>Verortet (illustrativ)</small><strong>${editorDocument.placements.length}</strong></div>
        <div><small>Verkehrsfläche</small><strong>${traffic.toLocaleString('de-CH', { maximumFractionDigits: 1 })} m²</strong></div>
        <div><small>Planungsmenge</small><strong>${plan.equipmentCount == null ? '—' : Number(plan.equipmentCount).toLocaleString('de-CH')}</strong></div>
      </div></section>
      <section class="fpe-inspector-section"><h3>Flächen nach Nutzung</h3><ul class="fpe-breakdown">${[...groups.entries()].sort((a, b) => b[1].area - a[1].area).slice(0, 6)
        .map(([label, entry]) => `<li><span class="fpe-swatch fpe-swatch--${useSwatch(entry.group)}"></span><span>${C.escape(label)}</span><strong>${entry.area.toLocaleString('de-CH', { maximumFractionDigits: 1 })} m²</strong></li>`).join('')}</ul></section>
      <section class="fpe-inspector-section"><h3>Attribute</h3><dl class="fpe-kv">
        <dt>Geschoss-ID</dt><dd class="mono">${C.escape(floor.floorId)}</dd><dt>Gebäude</dt><dd>${C.escape(building.name)}</dd>
        <dt>Adresse</dt><dd>${C.escape(address(building))}</dd><dt>Variante</dt><dd>${C.escape(editorVersionLabel())}</dd>
        <dt>Letzte Synchronisation</dt><dd>${C.escape(plan.lastSync || 'nicht erfasst')}</dd><dt>Planstand</dt><dd>${planBadge()}</dd>
      </dl><p class="small muted">Wählen Sie einen Raum oder ein Ausstattungsobjekt im Plan.</p></section>`;
  }

  function roomInspectorHTML(room) {
    const items = editorDocument.placements.filter((placement) => placement.roomId === room.spaceId);
    const moduleValue = String(room.moduleId || '');
    const [roomX, roomY, roomWidth, roomHeight] = room.rect;
    const localRoom = room.spaceId.startsWith('local-room-');
    return `<div class="fpe-inspector-title"><span><small>Ausgewählter Raum</small>${C.escape(room.roomNumber)}</span><button class="btn btn--bare btn--sm btn--icon-only" type="button" data-action="clear-selection" aria-label="Auswahl aufheben">${C.icon('Cancel', 'btn__icon')}</button></div>
      <section class="fpe-inspector-section"><h3>Details</h3><dl class="fpe-kv"><dt>Fläche</dt><dd>${Number(room.area).toLocaleString('de-CH')} m²</dd><dt>AOID</dt><dd class="mono">${C.escape(room.spaceId)}</dd><dt>Arbeitsplätze</dt><dd>${Number(room.capacity || 0)}</dd></dl></section>
      ${editMode ? `<form class="fpe-inspector-section fpe-form" id="fpe-room-form">
        <h3>Standard-Attribute</h3>
        <div class="fpe-field"><label for="fpe-room-useType">Nutzungsart</label><select id="fpe-room-useType" class="input--outline input--sm" data-room-field="useType">${optionMarkup(USE_OPTIONS, room.useType)}</select></div>
        <div class="fpe-field"><label for="fpe-room-sia">Flächenart SIA 416</label><select id="fpe-room-sia" class="input--outline input--sm" data-room-field="sia">${optionMarkup(SIA_OPTIONS, room.sia)}</select></div>
        <div class="fpe-field"><label for="fpe-room-moduleId">Multispace-Modul</label><select id="fpe-room-moduleId" class="input--outline input--sm" data-room-field="moduleId"><option value="">Ohne Ausstattungsstandard</option>${optionMarkup(MODULE_OPTIONS, moduleValue)}</select></div>
        <div class="fpe-field"><label for="fpe-room-occupierVe">Verwaltungseinheit</label><input id="fpe-room-occupierVe" class="input--outline input--sm" type="text" data-room-field="occupierVe" value="${C.escape(room.occupierVe || '')}"></div>
        <div class="fpe-field"><label for="fpe-room-capacity">Arbeitsplätze</label><input id="fpe-room-capacity" class="input--outline input--sm" type="number" min="0" step="1" data-room-field="capacity" value="${Number(room.capacity) || 0}"></div>
        <div class="fpe-field"><label for="fpe-room-roomNumber">Raumnummer</label><input id="fpe-room-roomNumber" class="input--outline input--sm" type="text" data-room-field="roomNumber" value="${C.escape(room.roomNumber)}" required></div>
        <div class="fpe-field"><label for="fpe-room-roomName">Raumbezeichnung</label><input id="fpe-room-roomName" class="input--outline input--sm" type="text" data-room-field="roomName" value="${C.escape(room.roomName || room.useLabel)}"></div>
        <label class="fpe-check" for="fpe-room-bookable"><input id="fpe-room-bookable" type="checkbox" data-room-field="bookable"${room.bookable ? ' checked' : ''}> Fläche ist reservierbar</label>
        <h3>Geometrie <span>Feedback-Prototyp</span></h3>
        <div class="fpe-form-grid">
          <div class="fpe-field"><label for="fpe-room-x">X (cm)</label><input id="fpe-room-x" class="input--outline input--sm" type="number" min="0" step="10" data-room-geometry="x" value="${Math.round(roomX)}"></div>
          <div class="fpe-field"><label for="fpe-room-y">Y (cm)</label><input id="fpe-room-y" class="input--outline input--sm" type="number" min="0" step="10" data-room-geometry="y" value="${Math.round(roomY)}"></div>
          <div class="fpe-field"><label for="fpe-room-width">Breite (cm)</label><input id="fpe-room-width" class="input--outline input--sm" type="number" min="100" step="10" data-room-geometry="width" value="${Math.round(roomWidth)}"></div>
          <div class="fpe-field"><label for="fpe-room-height">Tiefe (cm)</label><input id="fpe-room-height" class="input--outline input--sm" type="number" min="100" step="10" data-room-geometry="height" value="${Math.round(roomHeight)}"></div>
        </div>
        <p class="small muted m-0">Kanten im Plan ziehen oder Werte eingeben. Zugeordnete Objekte müssen innerhalb der Fläche bleiben.</p>
        ${localRoom ? `<button class="btn btn--outline btn--sm" type="button" data-action="delete-room">${C.icon('Trash', 'btn__icon')}<span class="btn__text">Neue Fläche entfernen</span></button>` : ''}
      </form>` : `<section class="fpe-inspector-section"><h3>Standard-Attribute</h3><dl class="fpe-kv"><dt>Nutzung</dt><dd>${C.escape(room.useLabel)}</dd><dt>Raumbezeichnung</dt><dd>${C.escape(room.roomName || room.useLabel)}</dd><dt>SIA 416</dt><dd>${C.escape(room.siaLabel)} (${C.escape(room.sia)})</dd><dt>Verwaltungseinheit</dt><dd>${C.escape(room.occupierVe || 'nicht zugeteilt')}</dd><dt>Reservierbar</dt><dd>${room.bookable ? 'Ja' : 'Nein'}</dd></dl></section>`}
      <section class="fpe-inspector-section"><h3>Ausstattung in diesem Raum <span>${items.length}</span></h3>${items.length
        ? `<ul class="fpe-inspector-list">${items.map((placement) => `<li><button type="button" data-select-type="placement" data-select-id="${C.escape(placement.placementId)}">${C.escape(placement.name)}${C.icon('ChevronRight', 'icon--sm')}</button></li>`).join('')}</ul>`
        : '<p class="small muted">Noch keine Ausstattungsobjekte verortet.</p>'}
        ${editMode ? '<button type="button" class="btn btn--outline btn--sm" data-action="focus-search"><span class="btn__text">Ausstattung hinzufügen</span></button>' : ''}
      </section>`;
  }

  function placementInspectorHTML(placement) {
    const product = productsById.get(String(placement.productId));
    const room = roomById().get(placement.roomId);
    const image = productImage(product);
    const sameRoom = editorDocument.placements.filter((item) => item.roomId === placement.roomId && item.productId === placement.productId).length;
    const sameFloor = editorDocument.placements.filter((item) => item.productId === placement.productId).length;
    return `<div class="fpe-inspector-title">${C.icon('List', 'icon--md')}<span>Objekt</span><small>${C.escape(room?.roomNumber || 'nicht zugeordnet')}</small><button class="btn btn--bare btn--sm btn--icon-only" type="button" data-action="clear-selection" aria-label="Auswahl aufheben">${C.icon('Cancel', 'btn__icon')}</button></div>
      <div class="fpe-product-preview">${image ? `<img src="${C.escape(image)}" alt="${C.escape(placement.name)}">` : C.icon('Image', 'icon--lg')}</div>
      <section class="fpe-inspector-section"><h3>Objektkennzahlen</h3><div class="fpe-kpis"><div><small>In diesem Raum</small><strong>${sameRoom}</strong></div><div><small>Auf diesem Geschoss</small><strong>${sameFloor}</strong></div></div></section>
      <section class="fpe-inspector-section"><h3>Standard-Attribute</h3><dl class="fpe-kv"><dt>Objektname</dt><dd>${C.escape(placement.name)}</dd><dt>Breite</dt><dd>${placement.width / 100} m</dd><dt>Tiefe</dt><dd>${placement.depth / 100} m</dd><dt>Marke</dt><dd>${C.escape(product?.brand || 'nicht erfasst')}</dd><dt>Katalog-ID</dt><dd class="mono">${C.escape(placement.articleId || String(placement.productId))}</dd><dt>Objekt-ID</dt><dd class="mono">${C.escape(placement.placementId)}</dd></dl></section>
      ${editMode ? `<form class="fpe-inspector-section fpe-form" id="fpe-placement-form"><h3>Position</h3>
        <div class="fpe-form-grid"><div class="fpe-field"><label for="fpe-placement-x">X (cm)</label><input id="fpe-placement-x" class="input--outline input--sm" type="number" step="10" data-placement-field="x" value="${Math.round(placement.x)}"></div><div class="fpe-field"><label for="fpe-placement-y">Y (cm)</label><input id="fpe-placement-y" class="input--outline input--sm" type="number" step="10" data-placement-field="y" value="${Math.round(placement.y)}"></div></div>
        <div class="fpe-field"><label for="fpe-placement-rotation">Drehung</label><select id="fpe-placement-rotation" class="input--outline input--sm" data-placement-field="rotation">${optionMarkup([0, 45, 90, 135, 180, 225, 270, 315].map((value) => ({ value, label: `${value}°` })), placement.rotation)}</select></div>
        <div class="fpe-form-actions"><button class="btn btn--outline btn--sm" type="button" data-action="rotate-left" aria-label="Objekt 45 Grad nach links drehen">${C.icon('ArrowLeft', 'btn__icon')}<span class="btn__text">Drehen</span></button><button class="btn btn--outline btn--sm" type="button" data-action="delete-placement">${C.icon('Trash', 'btn__icon')}<span class="btn__text">Entfernen</span></button></div>
        <p class="small muted">Im Plan ziehen oder mit den Pfeiltasten in 10-cm-Schritten bewegen.</p>
      </form>` : `<section class="fpe-inspector-section"><p class="small muted">Verschieben, drehen und entfernen ist nur im Bearbeitungsmodus möglich.</p></section>`}
      ${product ? `<section class="fpe-inspector-section"><a class="btn btn--outline btn--sm" href="#/app/shop/product/${encodeURIComponent(product.id)}" target="_blank" rel="noopener"><span class="btn__text">Im Produktkatalog öffnen</span>${C.icon('External', 'btn__icon')}</a></section>` : ''}`;
  }

  function inspectorHTML() {
    let content = floorInspectorHTML();
    if (selected?.type === 'room') {
      const room = roomById().get(selected.id); if (room) content = roomInspectorHTML(room);
    } else if (selected?.type === 'placement') {
      const placement = placementById().get(selected.id); if (placement) content = placementInspectorHTML(placement);
    }
    return `<aside class="fpe-right" id="fpe-right" aria-label="Inspektor"><h2 class="sr-only">Inspektor</h2>${content}</aside>`;
  }

  function shellHTML() {
    return `<div class="fpe-app${editMode ? ' is-editing' : ''}${leftOpen ? ' has-left' : ''}${rightOpen ? ' has-right' : ''}" id="fpe-app">
      <h1 class="sr-only" tabindex="-1">Plan-Editor — ${C.escape(floor.label)}, ${C.escape(building.name)}</h1>
      ${headerHTML()}
      <div class="fpe-workbench">
        ${leftPanelHTML()}${stageHTML()}${inspectorHTML()}
      </div>
      <div id="fpe-live" class="sr-only" role="status" aria-live="polite">${C.escape(liveText)}</div>
      <div class="fpe-local-note">${C.icon('InfoCircle', 'icon--sm')} Feedback-Prototyp: Entwürfe, Publikationen und Raumänderungen existieren nur in diesem Browser; keine Backend-Synchronisation oder Berechtigungsprüfung.</div>
    </div>`;
  }

  function syncScale() {
    if (viewMode !== '2d') return;
    const host = mount.querySelector('#fpe-scale');
    const scene = mount.querySelector('#fpe-scene');
    if (!host || !scene) return;
    const matrix = mount.querySelector('#fpe-canvas')?.getScreenCTM?.();
    const pixelsPerUnit = matrix ? Math.hypot(matrix.a, matrix.b) : 0;
    const effectiveCamera = pixelsPerUnit > 0
      ? { width: scene.clientWidth / pixelsPerUnit }
      : camera;
    const scale = scaleBar(effectiveCamera, scene.clientWidth);
    const label = host.querySelector('span');
    const line = host.querySelector('i');
    if (label) label.textContent = scale.label;
    if (line && scale.pixels) line.style.width = `${Math.max(40, Math.min(180, scale.pixels))}px`;
  }

  function draw() {
    mount.innerHTML = shellHTML();
    syncQuery();
    requestAnimationFrame(syncScale);
  }

  function redrawPreservingFocus(fallbackId = '') {
    const restore = C.preserveFocus(mount);
    draw();
    if (!restore() && fallbackId) requestAnimationFrame(() => mount.querySelector(`#${CSS.escape(fallbackId)}`)?.focus({ preventScroll: true }));
  }

  function focusSelectedEntity() {
    if (!selected) return;
    requestAnimationFrame(() => mount.querySelector(`[data-entity="${selected.type}"][data-id="${CSS.escape(selected.id)}"]`)?.focus({ preventScroll: true }));
  }

  function drawScene(focus = false) {
    const restore = C.preserveFocus(mount);
    const scene = mount.querySelector('#fpe-scene');
    if (scene) {
      scene.classList.toggle('fpe-scene--reference', viewMode !== '2d');
      scene.innerHTML = sceneContentHTML();
    }
    const toolbar = mount.querySelector('#fpe-toolbar-host');
    if (toolbar) toolbar.innerHTML = toolbarHTML();
    const scale = mount.querySelector('#fpe-scale');
    if (scale) scale.hidden = viewMode !== '2d';
    const result = mount.querySelector('.fpe-measure-result');
    const label = measurementLabel(measurement || {});
    if (result) { result.textContent = label; result.hidden = !label; }
    const restored = restore();
    if (focus && selected && !restored) focusSelectedEntity();
    requestAnimationFrame(syncScale);
  }

  function drawLeft() {
    const host = mount.querySelector('#fpe-left-list');
    if (host) host.innerHTML = editMode
      ? (libraryMode === 'products' ? productListHTML() : moduleListHTML())
      : resourceListHTML();
  }

  function drawInspector() {
    const host = mount.querySelector('#fpe-right');
    if (host) {
      const template = document.createElement('template');
      template.innerHTML = inspectorHTML();
      host.replaceWith(template.content.firstElementChild);
    }
  }

  function drawWorkArea({ preserveFocus = false, focusSelected = false } = {}) {
    const restore = preserveFocus ? C.preserveFocus(mount) : () => false;
    drawScene(); drawLeft(); drawInspector();
    const restored = restore();
    if (focusSelected && selected && !restored) focusSelectedEntity();
  }

  function selectEntity(type, id, focus = false) {
    selected = type && id ? { type, id } : null;
    syncQuery();
    drawWorkArea();
    if (selected) announce(`${type === 'room' ? 'Raum' : 'Objekt'} ausgewählt.`);
    if (focus && selected) focusSelectedEntity();
  }

  function chooseTool(next) {
    tool = next;
    placementProduct = next === 'place' ? placementProduct : null;
    placementGhost = null;
    roomDraft = null;
    measurement = ['distance', 'area'].includes(next) ? { kind: next, points: [], complete: false } : null;
    drawScene(); drawLeft();
    announce(next === 'distance' ? 'Streckenmessung aktiv. Wählen Sie zwei Punkte.'
      : next === 'area' ? 'Flächenmessung aktiv. Wählen Sie mindestens drei Punkte und drücken Sie Enter.'
        : next === 'room' ? 'Fläche anlegen aktiv. Ziehen Sie im Plan ein Rechteck von mindestens einem Meter Seitenlänge.'
          : next === 'pan' ? 'Verschieben aktiv.' : 'Auswahl aktiv.');
  }

  function addProduct(product, point = null) {
    const selectedRoom = selected?.type === 'room' ? roomById().get(selected.id) : null;
    if (!point && selectedRoom) {
      const [x, y, width, height] = selectedRoom.rect;
      point = { x: x + width / 2, y: y + height / 2 };
    }
    if (!point) {
      placementProduct = product;
      tool = 'place';
      placementGhost = null;
      drawScene(); drawLeft();
      announce(`${product.name} gewählt. Position im Plan auswählen.`);
      return;
    }
    const width = Number(product.dimensions?.width) || 60;
    const depth = Number(product.dimensions?.depth) || 60;
    const room = containingRoom(editorDocument.rooms, point);
    if (!room) { announce('Das Produkt muss innerhalb eines Raums platziert werden.'); return; }
    const id = `local-${floor.floorId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const placement = clampPlacement({
      placementId: id, productId: product.id, articleId: String(product.id), category: product.category || '',
      buildingId: building.bbl_id, floorId: floor.floorId, roomId: room.spaceId,
      name: product.name, x: point.x - width / 2, y: point.y - depth / 2,
      width, depth, height: Number(product.dimensions?.height) || 75, rotation: 0,
      shape: product.shape2d || 'rect', status: 'new', source: 'user',
    }, floor);
    const finalRoom = containingRoom(editorDocument.rooms, {
      x: placement.x + placement.width / 2, y: placement.y + placement.depth / 2,
    });
    if (!finalRoom) { announce('Das Produkt kann an dieser Position keinem Raum zugeordnet werden.'); return; }
    placement.roomId = finalRoom.spaceId;
    commit(`${product.name} platziert.`, (next) => { next.placements.push(placement); });
    selected = { type: 'placement', id };
    placementProduct = null; placementGhost = null; tool = 'select'; syncQuery(); drawWorkArea({ focusSelected: true });
  }

  function finalisePlacementMove(next, placement, previous) {
    Object.assign(placement, clampPlacement(placement, floor));
    const containing = containingRoom(next.rooms, {
      x: placement.x + placement.width / 2,
      y: placement.y + placement.depth / 2,
    });
    if (!containing) {
      Object.assign(placement, previous);
      return false;
    }
    placement.roomId = containing.spaceId;
    if (placement.status !== 'new') placement.status = 'moved';
    return true;
  }

  function changeRoom(field, control) {
    if (!editMode || selected?.type !== 'room') return;
    const value = field === 'bookable' ? control.checked
      : field === 'capacity' ? Math.max(0, Math.round(Number(control.value) || 0))
        : control.value;
    if (field === 'roomNumber' && !String(value).trim()) { control.setCustomValidity('Raumnummer ist erforderlich.'); control.reportValidity(); return; }
    control.setCustomValidity?.('');
    commit('Raumattribut geändert.', (next) => {
      const room = next.rooms.find((entry) => entry.spaceId === selected.id);
      if (!room) return;
      if (field === 'useType') {
        const option = USE_OPTIONS.find((entry) => String(entry.value) === String(value));
        room.useType = value; room.useLabel = option?.label || value;
        room.group = option?.group || room.group; room.groupLabel = option?.groupLabel || room.groupLabel;
      } else if (field === 'sia') {
        const option = SIA_OPTIONS.find((entry) => String(entry.value) === String(value));
        room.sia = value; room.siaLabel = option?.longLabel || option?.label || value;
      } else if (field === 'moduleId') room.moduleId = value || '';
      else room[field] = value;
    });
    drawWorkArea({ preserveFocus: true });
  }

  function roomRectInsideFloor(rect) {
    const [x, y, width, height] = rect;
    const [floorWidth, floorHeight] = floor.extent;
    return [x, y, width, height].every(Number.isFinite)
      && x >= 0 && y >= 0 && width >= 100 && height >= 100
      && x + width <= floorWidth && y + height <= floorHeight;
  }

  function placementsInsideRoom(document, room) {
    const [x, y, width, height] = room.rect;
    return document.placements.filter((item) => item.roomId === room.spaceId).every((item) => {
      const cx = item.x + item.width / 2, cy = item.y + item.depth / 2;
      return cx >= x && cx <= x + width && cy >= y && cy <= y + height;
    });
  }

  function stampRoomGeometry(room, rect) {
    room.rect = rect.map((value) => Number(Number(value).toFixed(3)));
    room.area = Number((rect[2] * rect[3] / 10000).toFixed(1));
  }

  function changeRoomGeometry(field, control) {
    if (!editMode || selected?.type !== 'room') return;
    const value = Number(control.value);
    if (!Number.isFinite(value)) return;
    let accepted = true;
    commit('Raumgeometrie geändert.', (next) => {
      const room = next.rooms.find((entry) => entry.spaceId === selected.id);
      if (!room) return;
      const old = room.rect.slice();
      const rect = old.slice();
      const index = ({ x: 0, y: 1, width: 2, height: 3 })[field];
      rect[index] = value;
      if (!roomRectInsideFloor(rect)) { accepted = false; return; }
      if (field === 'x' || field === 'y') {
        const dx = rect[0] - old[0], dy = rect[1] - old[1];
        next.placements.filter((item) => item.roomId === room.spaceId).forEach((item) => {
          item.x += dx; item.y += dy;
        });
      }
      stampRoomGeometry(room, rect);
      if (!placementsInsideRoom(next, room)) { accepted = false; stampRoomGeometry(room, old); }
    });
    if (!accepted) announce('Geometrie nicht geändert: Mindestgrösse, Geschossgrenze oder verortete Objekte verhindern die Änderung.');
    drawWorkArea({ preserveFocus: true });
  }

  function addRoom(rect) {
    if (!roomRectInsideFloor(rect)) { announce('Neue Fläche ist zu klein oder liegt ausserhalb des Geschosses.'); return; }
    const option = USE_OPTIONS.find((item) => item.value === 'buero') || USE_OPTIONS[0];
    const sia = SIA_OPTIONS.find((item) => item.value === (option.sia || 'HNF')) || SIA_OPTIONS[0];
    const id = `local-room-${floor.floorId}-${Date.now().toString(36)}`;
    const ordinal = editorDocument.rooms.filter((room) => room.spaceId.startsWith('local-room-')).length + 1;
    const room = {
      spaceId: id, floorId: floor.floorId, buildingId: building.bbl_id,
      roomNumber: `Neue Fläche ${ordinal}`, roomName: 'Neue Fläche',
      useType: option.value, useLabel: option.label, sia: sia.value,
      siaLabel: sia.longLabel || sia.label, group: option.group,
      groupLabel: option.groupLabel, area: 0, capacity: 0, bookable: false,
      occupierVe: null, rect: rect.slice(), moduleId: '',
    };
    stampRoomGeometry(room, rect);
    commit('Neue Fläche angelegt.', (next) => { next.rooms.push(room); });
    selected = { type: 'room', id }; tool = 'select'; roomDraft = null;
    syncQuery(); drawWorkArea({ focusSelected: true });
  }

  function removeSelectedRoom() {
    if (!editMode || selected?.type !== 'room' || !selected.id.startsWith('local-room-')) return;
    const room = roomById().get(selected.id);
    if (!room) return;
    const count = editorDocument.placements.filter((item) => item.roomId === room.spaceId).length;
    if (count && !window.confirm(`Neue Fläche und ${count} zugeordnete Objekte entfernen?`)) return;
    commit('Neue Fläche entfernt.', (next) => {
      next.rooms = next.rooms.filter((item) => item.spaceId !== room.spaceId);
      next.placements = next.placements.filter((item) => item.roomId !== room.spaceId);
    });
    selected = null; syncQuery(); drawWorkArea();
  }

  function changePlacement(field, value) {
    if (!editMode || selected?.type !== 'placement') return;
    let accepted = true;
    commit('Objektposition geändert.', (next) => {
      const placement = next.placements.find((entry) => entry.placementId === selected.id);
      if (!placement) return;
      const previous = { ...placement };
      placement[field] = Number(value) || 0;
      accepted = finalisePlacementMove(next, placement, previous);
    });
    if (!accepted) announce('Position nicht geändert: Der Mittelpunkt muss in einem Raum liegen.');
    drawWorkArea({ preserveFocus: true });
  }

  function removeSelectedPlacement() {
    if (!editMode || selected?.type !== 'placement') return;
    const name = placementById().get(selected.id)?.name || 'Objekt';
    commit(`${name} entfernt.`, (next) => { next.placements = next.placements.filter((entry) => entry.placementId !== selected.id); });
    selected = null; syncQuery(); drawWorkArea();
  }

  function saveLocalDraft(redraw = true, announceResult = true) {
    const result = saveWorkingCopy(editorDocument);
    if (!result.ok) {
      announce(`Entwurf konnte nicht gespeichert werden: ${result.reason || 'Browserspeicher nicht verfügbar'}.`);
      return null;
    }
    editorDocument = cloneDocument(result.document);
    lastSaved = cloneDocument(editorDocument);
    hasLocalDraft = true; dirty = false;
    editHistory.reset(editorDocument);
    if (redraw) draw(); else syncDraftChrome();
    if (announceResult) announce('Arbeitskopie nur in diesem Browser gespeichert.');
    return result.document;
  }

  function publishCurrentVersion(closeModal = () => {}) {
    const saved = saveLocalDraft(false, false);
    if (!saved) return;
    const result = publishLocalRevision(saved, baseline, session.user()?.name || 'Unbekannt');
    if (!result.ok) {
      announce(`Veröffentlichung konnte nicht simuliert werden: ${result.reason || 'Browserspeicher nicht verfügbar'}.`);
      return;
    }
    revisions = result.revisions;
    lastPublished = cloneDocument(result.revision.document);
    closeModal();
    draw();
    C.toast(`V${result.revision.number + 1} wurde lokal als veröffentlicht markiert.`, 'success', 'CheckmarkCircle');
    announce('Veröffentlichung im Feedback-Prototyp simuliert. Andere Personen sehen diese Version nicht.');
  }

  function openPublishDialog() {
    if (!canPublish()) return;
    const id = `fpe-confirm-publish-${Date.now()}`;
    const close = C.openModal({
      id: 'fpe-publish-modal', size: 'sm', title: 'Veröffentlichung simulieren?',
      body: `${C.notification('<strong>Nur Feedback-Prototyp.</strong> Die Version wird ausschliesslich in diesem Browser gespeichert. Es findet keine Freigabe, Synchronisation oder Berechtigungsprüfung statt.', 'info', 'InfoCircle')}
        <p>Die aktuelle Arbeitskopie enthält <strong>${editorDocument.rooms.length} Räume</strong> und <strong>${editorDocument.placements.length} Ausstattungsobjekte</strong>.</p>`,
      footer: `<button type="button" class="btn btn--outline" data-modal-close>Abbrechen</button>
        <button type="button" class="btn btn--filled" id="${id}">Im Prototyp veröffentlichen</button>`,
    });
    requestAnimationFrame(() => document.getElementById(id)?.addEventListener('click', () => publishCurrentVersion(close), { once: true }));
  }

  function resetWorkingCopy(closeModal = () => {}) {
    if (dirty && !window.confirm('Nicht gespeicherte Änderungen verwerfen und den Ausgangsstand laden?')) return;
    removeWorkingCopy(floor.floorId);
    editorDocument = cloneDocument(baseline);
    lastSaved = cloneDocument(baseline);
    hasLocalDraft = false; dirty = false; selected = null;
    editHistory.reset(editorDocument);
    closeModal(); draw();
    C.toast('Lokale Arbeitskopie verworfen.', 'success', 'CheckmarkCircle');
  }

  function openVersionHistory() {
    const id = `fpe-reset-copy-${Date.now()}`;
    const rows = [...revisions].reverse().map((revision) => `<li>
      <strong>V${revision.number + 1} · lokal publiziert</strong>
      <span>${C.escape(new Date(revision.createdAt).toLocaleString('de-CH'))} · ${C.escape(revision.createdBy)}</span>
      <small>${revision.document.rooms.length} Räume · ${revision.document.placements.length} Objekte</small>
    </li>`).join('');
    const close = C.openModal({
      id: 'fpe-history-modal', size: 'md', title: 'Versionsverlauf im Prototyp',
      body: `${C.notification('Diese Einträge existieren nur auf diesem Gerät und sind keine freigegebenen Planrevisionen.', 'info', 'InfoCircle')}
        <ol class="fpe-version-list">${rows || '<li><strong>Noch keine lokale Veröffentlichung</strong><span>Eine Publikation kann im Bearbeitungsmodus simuliert werden.</span></li>'}
          <li><strong>V1 · Ausgangsstand</strong><span>${C.escape(plan.lastSync || 'Quellstand des Portals')}</span><small>${baseline.rooms.length} Räume · ${baseline.placements.length} illustrative Objekte</small></li>
        </ol>`,
      footer: `${hasLocalDraft || dirty ? `<button type="button" class="btn btn--outline" id="${id}">Arbeitskopie verwerfen</button>` : ''}
        <button type="button" class="btn btn--filled" data-modal-close>Schliessen</button>`,
    });
    if (hasLocalDraft || dirty) requestAnimationFrame(() => document.getElementById(id)?.addEventListener('click', () => resetWorkingCopy(close), { once: true }));
  }

  function endEditing() {
    if (dirty && !window.confirm('Nicht gespeicherte Änderungen verwerfen und Bearbeitung beenden?')) return;
    if (dirty) {
      editorDocument = cloneDocument(lastSaved); dirty = false;
      keepValidSelection();
    }
    editHistory.reset(editorDocument);
    editMode = false; tool = 'select'; placementProduct = null; placementGhost = null;
    roomDraft = null; measurement = null;
    draw(); announce('Bearbeitungsmodus beendet.');
  }

  function navigateTo(buildingId, floorId) {
    if (dirty && !window.confirm('Nicht gespeicherte Änderungen verwerfen und den Plan wechseln?')) return false;
    location.hash = floorplanEditor(buildingId, floorId);
    return true;
  }

  function fitSelected() {
    if (!selected) return;
    const rect = selected.type === 'room'
      ? roomById().get(selected.id)?.rect
      : (() => {
          const item = placementById().get(selected.id);
          return item ? [item.x, item.y, item.width, item.depth] : null;
        })();
    const next = fitCameraToRect(rect);
    if (!next) return;
    camera = next; viewMode = '2d'; syncQuery(); drawScene(true);
    announce('Auswahl eingepasst.');
  }

  function setView(next) {
    if (!VIEW_MODES.has(next) || viewMode === next) return;
    viewMode = next;
    tool = 'select'; measurement = null; roomDraft = null; placementGhost = null;
    syncQuery(); draw();
    requestAnimationFrame(() => mount.querySelector(`[data-action="view-${next}"]`)?.focus({ preventScroll: true }));
    announce(next === '2d' ? '2D-Plan geöffnet.'
      : next === '3d' ? '3D-Referenzansicht geöffnet. Sie ist nicht aus diesem Plan berechnet.'
        : 'Begehungs-Prototyp geöffnet. Die Darstellung ist ein Referenzbild.');
  }

  function assignModule(moduleId) {
    if (!editMode) return;
    if (selected?.type !== 'room') {
      rightOpen = true;
      announce('Wählen Sie zuerst einen Raum, um ein Modul zuzuweisen.');
      return;
    }
    const option = MODULE_OPTIONS.find((item) => String(item.value) === String(moduleId));
    if (!option) return;
    commit(`${option.label} zugewiesen.`, (next) => {
      const room = next.rooms.find((item) => item.spaceId === selected.id);
      if (room) room.moduleId = String(option.value);
    });
    drawWorkArea({ preserveFocus: true });
  }

  function onClick(event) {
    const leave = event.target.closest('[data-leave]');
    if (leave && dirty && !window.confirm('Nicht gespeicherte Änderungen verwerfen und Plan-Editor verlassen?')) { event.preventDefault(); return; }
    const select = event.target.closest('[data-select-type]');
    if (select) { selectEntity(select.dataset.selectType, select.dataset.selectId, true); return; }
    const productButton = event.target.closest('[data-product]');
    if (productButton && editMode) { const product = productsById.get(productButton.dataset.product); if (product) addProduct(product); return; }
    const moduleButton = event.target.closest('[data-module]');
    if (moduleButton && editMode) { assignModule(moduleButton.dataset.module); return; }
    const libraryTab = event.target.closest('[data-library]');
    if (libraryTab && editMode) {
      libraryMode = libraryTab.dataset.library === 'modules' ? 'modules' : 'products';
      productQuery = ''; placementProduct = null; tool = tool === 'place' ? 'select' : tool;
      syncQuery(); redrawPreservingFocus();
      requestAnimationFrame(() => mount.querySelector(`[data-library="${libraryMode}"]`)?.focus());
      return;
    }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'focus-search') {
      if (!leftOpen) { leftOpen = true; draw(); }
      requestAnimationFrame(() => mount.querySelector('#fpe-left-search')?.focus());
    }
    else if (action === 'toggle-left') { leftOpen = !leftOpen; redrawPreservingFocus('fpe-toggle-left'); }
    else if (action === 'toggle-right') { rightOpen = !rightOpen; redrawPreservingFocus('fpe-toggle-right'); }
    else if (action === 'start-edit') {
      editMode = true; tool = 'select'; draw();
      requestAnimationFrame(() => mount.querySelector('#fpe-left-search')?.focus());
      announce('Bearbeitungsmodus gestartet. Änderungen bleiben lokal, bis sie gespeichert werden.');
    }
    else if (action === 'end-edit') endEditing();
    else if (action === 'save') saveLocalDraft();
    else if (action === 'publish') openPublishDialog();
    else if (action === 'clear-selection') selectEntity(null, null);
    else if (action === 'tool-select') chooseTool('select');
    else if (action === 'tool-pan') chooseTool('pan');
    else if (action === 'tool-room') chooseTool('room');
    else if (action === 'tool-distance') chooseTool('distance');
    else if (action === 'tool-area') chooseTool('area');
    else if (action === 'cancel-place') chooseTool('select');
    else if (action === 'zoom-in') { camera = zoomCamera(camera, .8); drawScene(); }
    else if (action === 'zoom-out') { camera = zoomCamera(camera, 1.25); drawScene(); }
    else if (action === 'fit') { camera = fitCamera(floor); drawScene(); announce('Plan eingepasst.'); }
    else if (action === 'fit-selection') fitSelected();
    else if (action === 'undo') restoreHistory('undo');
    else if (action === 'redo') restoreHistory('redo');
    else if (action === 'version-history') openVersionHistory();
    else if (action === 'print') window.print();
    else if (action === 'view-2d') setView('2d');
    else if (action === 'view-3d') setView('3d');
    else if (action === 'view-walk') setView('walk');
    else if (action === 'rotate-left' && selected?.type === 'placement') {
      const placement = placementById().get(selected.id); if (placement) changePlacement('rotation', ((placement.rotation || 0) - 45 + 360) % 360);
    } else if (action === 'delete-placement') removeSelectedPlacement();
    else if (action === 'delete-room') removeSelectedRoom();
  }

  function onInput(event) {
    if (event.target.id !== 'fpe-left-search') return;
    if (editMode) productQuery = event.target.value; else resourceQuery = event.target.value;
    drawLeft();
  }

  function onChange(event) {
    if (event.target.id === 'fpe-building') {
      const next = objects.find((entry) => entry.building.bbl_id === event.target.value);
      if (next && !navigateTo(next.building.bbl_id, next.floors.find((entry) => entry.key === '2og')?.floorId || next.floors[0].floorId)) {
        event.target.value = building.bbl_id;
      }
      return;
    }
    if (event.target.id === 'fpe-floor') {
      if (!navigateTo(building.bbl_id, event.target.value)) event.target.value = floor.floorId;
      return;
    }
    if (event.target.id === 'fpe-color') {
      colorMode = validColors.has(event.target.value) ? event.target.value : COLOR_DEFAULT;
      syncQuery(); drawScene(); drawLeft();
      announce(`Einfärbung ${EDITOR_COLOR_MODES.find((item) => item.value === colorMode)?.label}.`); return;
    }
    if (event.target.id === 'fpe-product-category') { productCategory = event.target.value; drawLeft(); return; }
    if (event.target.dataset.roomField) changeRoom(event.target.dataset.roomField, event.target);
    if (event.target.dataset.roomGeometry) changeRoomGeometry(event.target.dataset.roomGeometry, event.target);
    if (event.target.dataset.placementField) changePlacement(event.target.dataset.placementField, event.target.value);
  }

  function onPointerDown(event) {
    const stage = event.target.closest('#fpe-stage');
    const svg = mount.querySelector('#fpe-canvas');
    if (!stage || !svg) return;
    const point = clientToPlan(svg, event.clientX, event.clientY);
    if (!point) return;
    if (tool === 'place' && placementProduct) { event.preventDefault(); addProduct(placementProduct, point); return; }
    if (tool === 'room' && editMode) {
      event.preventDefault();
      try { mount.setPointerCapture?.(event.pointerId); } catch { /* synthetic/ended pointer */ }
      drag = { type: 'room-create', pointerId: event.pointerId, start: point };
      roomDraft = { rect: [point.x, point.y, 0, 0], valid: false };
      drawScene(); return;
    }
    if (tool === 'distance' || tool === 'area') {
      event.preventDefault();
      if (!measurement || measurement.complete) measurement = { kind: tool, points: [], complete: false };
      measurement.points.push(point);
      if (tool === 'distance' && measurement.points.length >= 2) measurement.complete = true;
      drawScene();
      if (measurement.complete) announce(`Messung ${measurementLabel(measurement)}.`);
      return;
    }
    const entity = event.target.closest('[data-entity]');
    const roomHandle = event.target.closest('[data-room-handle]');
    if (tool === 'pan' || event.button === 1) {
      event.preventDefault();
      try { mount.setPointerCapture?.(event.pointerId); } catch { /* synthetic/ended pointer */ }
      drag = { type: 'pan', pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, camera: { ...camera } };
      return;
    }
    if (entity?.dataset.entity === 'placement' && editMode && tool === 'select') {
      event.preventDefault();
      const placement = placementById().get(entity.dataset.id);
      if (!placement) return;
      selected = { type: 'placement', id: placement.placementId }; syncQuery();
      try { mount.setPointerCapture?.(event.pointerId); } catch { /* synthetic/ended pointer */ }
      drag = { type: 'placement', pointerId: event.pointerId, start: point, x: placement.x, y: placement.y,
        roomId: placement.roomId, moved: false };
      drawWorkArea({ focusSelected: true });
      return;
    }
    if (entity?.dataset.entity === 'room' && editMode && tool === 'select') {
      event.preventDefault();
      const room = roomById().get(entity.dataset.id);
      if (!room) return;
      selected = { type: 'room', id: room.spaceId }; syncQuery();
      try { mount.setPointerCapture?.(event.pointerId); } catch { /* synthetic/ended pointer */ }
      drag = {
        type: roomHandle ? 'room-resize' : 'room-move', pointerId: event.pointerId,
        handle: roomHandle?.dataset.roomHandle || '', start: point,
        rect: room.rect.slice(), before: cloneDocument(editorDocument), moved: false,
      };
      drawWorkArea({ focusSelected: true });
      return;
    }
    if (entity) selectEntity(entity.dataset.entity, entity.dataset.id, true);
    else if (tool === 'select') selectEntity(null, null);
  }

  function onPointerMove(event) {
    const svg = mount.querySelector('#fpe-canvas');
    if (!drag) {
      if (tool === 'place' && placementProduct && svg) {
        const point = clientToPlan(svg, event.clientX, event.clientY);
        if (!point) return;
        const width = Number(placementProduct.dimensions?.width) || 60;
        const depth = Number(placementProduct.dimensions?.depth) || 60;
        const room = containingRoom(editorDocument.rooms, point);
        placementGhost = {
          x: point.x - width / 2, y: point.y - depth / 2, width, depth,
          shape: placementProduct.shape2d || 'rect', rotation: 0, valid: Boolean(room),
        };
        drawScene();
      }
      return;
    }
    if (drag.pointerId !== event.pointerId) return;
    if (drag.type === 'pan') {
      const rect = svg?.getBoundingClientRect();
      if (!rect?.width || !rect?.height) return;
      camera = panCamera(drag.camera,
        -(event.clientX - drag.clientX) * drag.camera.width / rect.width,
        -(event.clientY - drag.clientY) * drag.camera.height / rect.height);
      drawScene(); return;
    }
    const point = clientToPlan(svg, event.clientX, event.clientY);
    if (!point) return;
    if (drag.type === 'room-create') {
      const [floorWidth, floorHeight] = floor.extent;
      const x1 = Math.max(0, Math.min(floorWidth, drag.start.x));
      const y1 = Math.max(0, Math.min(floorHeight, drag.start.y));
      const x2 = Math.max(0, Math.min(floorWidth, point.x));
      const y2 = Math.max(0, Math.min(floorHeight, point.y));
      const rect = [Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)];
      roomDraft = { rect, valid: rect[2] >= 100 && rect[3] >= 100 };
      drawScene(); return;
    }
    if (drag.type === 'room-move' || drag.type === 'room-resize') {
      const room = selected?.type === 'room' ? roomById().get(selected.id) : null;
      if (!room) return;
      const [floorWidth, floorHeight] = floor.extent;
      let [x, y, width, height] = drag.rect;
      if (drag.type === 'room-move') {
        const dx = point.x - drag.start.x, dy = point.y - drag.start.y;
        x = Math.max(0, Math.min(floorWidth - width, drag.rect[0] + dx));
        y = Math.max(0, Math.min(floorHeight - height, drag.rect[1] + dy));
        const actualDx = x - drag.rect[0], actualDy = y - drag.rect[1];
        const beforeById = new Map(drag.before.placements.map((item) => [item.placementId, item]));
        editorDocument.placements.filter((item) => item.roomId === room.spaceId).forEach((item) => {
          const previous = beforeById.get(item.placementId);
          if (previous) { item.x = previous.x + actualDx; item.y = previous.y + actualDy; }
        });
      } else {
        let left = x, top = y, right = x + width, bottom = y + height;
        if (drag.handle.includes('w')) left = Math.max(0, Math.min(point.x, right - 100));
        if (drag.handle.includes('e')) right = Math.min(floorWidth, Math.max(point.x, left + 100));
        if (drag.handle.includes('n')) top = Math.max(0, Math.min(point.y, bottom - 100));
        if (drag.handle.includes('s')) bottom = Math.min(floorHeight, Math.max(point.y, top + 100));
        x = left; y = top; width = right - left; height = bottom - top;
      }
      drag.moved ||= Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > 3;
      stampRoomGeometry(room, [x, y, width, height]);
      drawScene(); return;
    }
    const placement = selected?.type === 'placement' ? placementById().get(selected.id) : null;
    if (!placement) return;
    drag.moved ||= Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > 3;
    placement.x = drag.x + point.x - drag.start.x;
    placement.y = drag.y + point.y - drag.start.y;
    Object.assign(placement, clampPlacement(placement, floor));
    drawScene();
  }

  function onPointerUp(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.type === 'room-create') {
      const draft = roomDraft;
      roomDraft = null;
      if (event.type !== 'pointercancel' && draft?.valid) addRoom(draft.rect);
      else { chooseTool('select'); announce('Neue Fläche verworfen.'); }
    } else if (drag.type === 'room-move' || drag.type === 'room-resize') {
      const room = selected?.type === 'room' ? roomById().get(selected.id) : null;
      const accepted = drag.moved && event.type !== 'pointercancel' && room
        && roomRectInsideFloor(room.rect) && placementsInsideRoom(editorDocument, room);
      if (!drag.moved) {
        editorDocument = cloneDocument(drag.before);
      } else if (!accepted) {
        editorDocument = cloneDocument(drag.before);
        announce('Raumgeometrie bleibt unverändert: Verortete Objekte müssen innerhalb der Fläche liegen.');
      } else {
        editHistory.push(editorDocument);
        editorDocument = cloneDocument(editHistory.current);
        dirty = !documentsEqual(editorDocument, lastSaved);
        syncDraftChrome();
        announce(drag.type === 'room-move' ? 'Raum und Ausstattung verschoben.' : 'Raumkante verschoben.');
      }
      drawWorkArea({ focusSelected: true });
    } else if (drag.type === 'placement' && drag.moved) {
      const placement = selected?.type === 'placement' ? placementById().get(selected.id) : null;
      if (placement) {
        const cx = placement.x + placement.width / 2, cy = placement.y + placement.depth / 2;
        const containing = containingRoom(editorDocument.rooms, { x: cx, y: cy });
        if (!containing) {
          placement.x = drag.x; placement.y = drag.y; placement.roomId = drag.roomId;
          announce('Objekt bleibt am bisherigen Ort: Der Mittelpunkt muss in einem Raum liegen.');
        } else {
          placement.roomId = containing.spaceId;
          if (placement.status !== 'new') placement.status = 'moved';
          editHistory.push(editorDocument);
          editorDocument = cloneDocument(editHistory.current);
          dirty = !documentsEqual(editorDocument, lastSaved);
          syncDraftChrome();
          announce('Objekt verschoben.');
        }
        drawWorkArea({ focusSelected: true });
      }
    }
    try { mount.releasePointerCapture?.(event.pointerId); } catch { /* capture already gone */ }
    drag = null;
  }

  function onWheel(event) {
    if (viewMode !== '2d' || !event.target.closest('#fpe-stage')) return;
    event.preventDefault();
    const point = clientToPlan(mount.querySelector('#fpe-canvas'), event.clientX, event.clientY);
    camera = zoomCamera(camera, event.deltaY < 0 ? .88 : 1.14, point);
    drawScene();
  }

  function onDoubleClick(event) {
    if (tool === 'area' && event.target.closest('#fpe-stage') && measurement?.points.length >= 3) {
      event.preventDefault(); measurement.complete = true; drawScene(); announce(`Fläche ${measurementLabel(measurement)}.`); return;
    }
    const entity = event.target.closest?.('[data-entity]');
    if (tool === 'select' && entity) {
      event.preventDefault();
      selected = { type: entity.dataset.entity, id: entity.dataset.id };
      syncQuery(); fitSelected();
    }
  }

  function onPointerLeave() {
    if (!drag && placementGhost) { placementGhost = null; drawScene(); }
  }

  function onKeyDown(event) {
    const textControl = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !textControl) {
      if (event.key.toLocaleLowerCase() === 'z') { event.preventDefault(); restoreHistory(event.shiftKey ? 'redo' : 'undo'); return; }
      if (event.key.toLocaleLowerCase() === 'y') { event.preventDefault(); restoreHistory('redo'); return; }
    }
    if (!textControl && !event.ctrlKey && !event.metaKey && !event.altKey && viewMode === '2d') {
      const key = event.key.toLocaleLowerCase();
      if (key === 'v') { event.preventDefault(); chooseTool('select'); return; }
      if (key === 'h') { event.preventDefault(); chooseTool('pan'); return; }
      if (key === 'f') { event.preventDefault(); camera = fitCamera(floor); drawScene(); announce('Plan eingepasst.'); return; }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); camera = zoomCamera(camera, .8); drawScene(); return; }
      if (event.key === '-') { event.preventDefault(); camera = zoomCamera(camera, 1.25); drawScene(); return; }
    }
    if (event.key === 'Escape') {
      if (tool !== 'select') { event.preventDefault(); chooseTool('select'); }
      else if (selected) { event.preventDefault(); selectEntity(null, null); }
      return;
    }
    if (tool === 'area' && event.key === 'Enter' && measurement?.points.length >= 3 && !measurement.complete) {
      event.preventDefault(); measurement.complete = true; drawScene(); announce(`Fläche ${measurementLabel(measurement)}.`); return;
    }
    if ((tool === 'area' || tool === 'distance') && event.key === 'Backspace' && measurement?.points.length) {
      event.preventDefault(); measurement.points.pop(); measurement.complete = false; drawScene(); announce('Letzten Messpunkt entfernt.'); return;
    }
    const entity = event.target.closest?.('[data-entity]');
    if (entity && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); selectEntity(entity.dataset.entity, entity.dataset.id, true); return;
    }
    if (!editMode || textControl) return;
    if (selected?.type === 'room' && selected.id.startsWith('local-room-') && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault(); removeSelectedRoom(); return;
    }
    if (selected?.type !== 'placement') return;
    const moves = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      let accepted = true;
      commit('Objekt mit Tastatur verschoben.', (next) => {
        const placement = next.placements.find((entry) => entry.placementId === selected.id);
        if (!placement) return;
        const previous = { ...placement };
        placement.x += dx * (event.shiftKey ? .1 : 1); placement.y += dy * (event.shiftKey ? .1 : 1);
        accepted = finalisePlacementMove(next, placement, previous);
      });
      if (!accepted) announce('Objekt nicht verschoben: Der Mittelpunkt muss in einem Raum liegen.');
      drawWorkArea({ focusSelected: true });
    } else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelectedPlacement(); }
    else if (event.key.toLocaleLowerCase() === 'r') { event.preventDefault(); const placement = placementById().get(selected.id); if (placement) changePlacement('rotation', ((placement.rotation || 0) + 45) % 360); }
  }

  function beforeUnload(event) {
    if (!dirty) return;
    event.preventDefault(); event.returnValue = '';
  }

  const abort = new AbortController();
  const { signal } = abort;
  mount.addEventListener('click', onClick, { signal });
  mount.addEventListener('input', onInput, { signal });
  mount.addEventListener('change', onChange, { signal });
  mount.addEventListener('pointerdown', onPointerDown, { signal });
  mount.addEventListener('pointermove', onPointerMove, { signal });
  mount.addEventListener('pointerup', onPointerUp, { signal });
  mount.addEventListener('pointercancel', onPointerUp, { signal });
  mount.addEventListener('pointerleave', onPointerLeave, { signal });
  mount.addEventListener('wheel', onWheel, { signal, passive: false });
  mount.addEventListener('dblclick', onDoubleClick, { signal });
  mount.addEventListener('keydown', onKeyDown, { signal });
  window.addEventListener('beforeunload', beforeUnload, { signal });
  window.addEventListener('resize', syncScale, { signal });
  onUnmount(() => abort.abort());

  setTitle(`Plan-Editor — ${floor.label}`);
  draw();
}
