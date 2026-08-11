// Pure HTML composition for the floor-plan workbench.
// A fresh immutable snapshot is supplied for each render operation, keeping
// presentation code independent from controller mutation and event handling.

import { EDITOR_COLOR_MODES, measurementLabel, renderEditorSvg } from './canvas.js';
import { swatchCss } from './colors.js';
import { ELEMENT_GLYPHS, STRUCTURE_ELEMENTS, TOOL_GLYPHS } from './structure-elements.js';
import { createColorContext, roomColorDescriptor } from './colors.js';
import { formatArea, formatNumber } from '../format.js';
import { planCheck } from '../links.js';
import { MODULE_OPTIONS, SIA_OPTIONS, USE_OPTIONS } from './model.js';
import {
  BASE, COLOR_DESCRIPTIONS, address, clean, editorHeaderHTML,
  optionMarkup, panelToggleIcon, productImage, prototypeFooterHTML, useSwatch,
} from './shared.js';

export function createWorkbenchViews(context) {
  const {
    C, session, object, building, floor, plan, products, productsById,
    roomById, placementById, editorDocument, editHistory, selected, colorMode,
    viewMode, editMode, dirty, assetLibraryOpen, tool, placementProduct,
    libraryMode, productCategory, measurement, roomDraft, placementGhost, keyboardCursor,
    camera, resourceQuery, productQuery, colorMenuOpen, moreMenuOpen,
    structureMenuOpen, structureUnlocked, expandedGroups, expandedRooms, collapsedSections,
    leftOpen, rightOpen, returnHref: returnUrl, versionLabel,
    publishable, planBadgeHtml,
  } = context;
  const returnHref = () => returnUrl;
  const editorVersionLabel = () => versionLabel;
  const canPublish = () => publishable;
  const planBadge = () => planBadgeHtml;
  const placementsByRoom = new Map();
  editorDocument.placements.forEach((placement) => {
    const items = placementsByRoom.get(placement.roomId);
    if (items) items.push(placement);
    else placementsByRoom.set(placement.roomId, [placement]);
  });

  function headerHTML() {
    const versionLabel = editorVersionLabel();
    // The rail is the resource tree in every mode now, so its toggle has one name.
    // It used to be «Bibliothek» in edit mode, which is what the panel had become.
    const leftPanelUnavailable = false;
    const leftPanelLabel = `Ressourcen ${leftOpen ? 'schliessen' : 'öffnen'}`;
    return `${editorHeaderHTML(C, session, editMode, planCheck(building.bbl_id, floor.floorId))}
    <div class="fpe-context">
      <nav class="fpe-breadcrumb" aria-label="Sie sind hier">
        ${/* Same first crumbs as the building detail: one destination, one name.
              The workbench keeps the chain short — the place hierarchy belongs
              to the detail, which has a full-width bar for it. */''}
        <a href="#/" data-leave>Kundenportal</a>${C.icon('ChevronRight', 'icon--sm')}
        <a href="${BASE}" data-leave>Alle Objekte</a>${C.icon('ChevronRight', 'icon--sm')}
        <a href="${returnHref()}" data-leave>${C.escape(building.name)}</a>${C.icon('ChevronRight', 'icon--sm')}
        <span aria-current="page">${C.escape(floor.label)}</span>
      </nav>
      <div class="fpe-context__panel-mobile" role="group" aria-label="Seitenpanels">
        <button class="btn btn--bare btn--sm btn--icon-only fpe-panel-toggle fpe-panel-toggle--mobile${leftOpen ? ' is-active' : ''}" id="fpe-toggle-left-mobile" type="button" data-action="toggle-left"
          aria-label="${leftPanelLabel}" title="${leftPanelLabel}" aria-pressed="${leftOpen}"${leftPanelUnavailable ? ' disabled' : ''}>${panelToggleIcon('left')}</button>
        <button class="btn btn--bare btn--sm btn--icon-only fpe-panel-toggle fpe-panel-toggle--mobile${rightOpen ? ' is-active' : ''}" id="fpe-toggle-right-mobile" type="button" data-action="toggle-right"
          aria-label="${rightOpen ? 'Rechtes Panel ausblenden' : 'Rechtes Panel einblenden'}" title="${rightOpen ? 'Rechtes Panel ausblenden' : 'Rechtes Panel einblenden'}" aria-pressed="${rightOpen}">${panelToggleIcon('right')}</button>
      </div>
      ${object.planning.targetDate ? `<span class="fpe-date">${C.icon('Calendar', 'icon--sm')} Stichtag ${C.escape(object.planning.targetDate.split('-').reverse().join('.'))}</span>` : ''}
      <span class="fpe-context__spacer"></span>
      <div class="fpe-more">
        <button class="btn btn--outline btn--sm" id="fpe-more-trigger" type="button" data-action="toggle-more-menu"
          aria-haspopup="menu" aria-expanded="${moreMenuOpen}"><span class="btn__text">Mehr</span>${C.icon('ChevronDown', 'btn__icon')}</button>
        <div class="fpe-more-menu" id="fpe-more-menu" role="menu" aria-label="Weitere Planaktionen"${moreMenuOpen ? '' : ' hidden'}>
          ${editMode ? `<button class="fpe-menu-compact-only" type="button" role="menuitem" data-action="save"${dirty ? '' : ' disabled'}>Entwurf speichern</button>
            <button class="fpe-menu-compact-only" type="button" role="menuitem" data-action="publish"${canPublish() ? '' : ' disabled'}>Veröffentlichen</button>
            <button class="fpe-menu-phone-only" type="button" role="menuitem" data-action="undo"${editHistory.canUndo ? '' : ' disabled'}>Rückgängig</button>
            <button class="fpe-menu-phone-only" type="button" role="menuitem" data-action="redo"${editHistory.canRedo ? '' : ' disabled'}>Wiederholen</button>
            <button class="fpe-menu-compact-only" type="button" role="menuitem" data-action="end-edit">Bearbeitung beenden</button>
            <span class="fpe-more-menu__separator fpe-menu-compact-only" role="separator"></span>`
            : `<button class="fpe-menu-phone-only" type="button" role="menuitem" data-action="start-edit">Plan bearbeiten</button>
              <span class="fpe-more-menu__separator fpe-menu-phone-only" role="separator"></span>`}
          <button type="button" role="menuitem" data-action="version-history">Versionsverlauf…</button>
          <button type="button" role="menuitem" data-action="print">Ansicht drucken</button>
          <span class="fpe-more-menu__separator" role="separator"></span>
          <button type="button" role="menuitem" disabled>DWG exportieren</button>
          <button type="button" role="menuitem" disabled>IFC exportieren</button>
          <button type="button" role="menuitem" data-action="copy-link">Link kopieren</button>
          <button type="button" role="menuitem" data-action="copy-plan-id">Plan-ID kopieren</button>
        </div>
      </div>
      ${editMode
        ? `<button class="btn btn--outline btn--sm btn--icon-left fpe-context__edit-action" id="fpe-save" type="button" data-action="save" title="Speichert die Arbeitskopie nur in diesem Browser"${dirty ? '' : ' disabled'}>${C.icon('Save', 'btn__icon')}<span class="btn__text">Entwurf speichern</span></button>
           <button class="btn btn--filled btn--sm fpe-context__edit-action" id="fpe-publish" type="button" data-action="publish" title="Simuliert die Veröffentlichung nur in diesem Browser"${canPublish() ? '' : ' disabled'}><span class="btn__text">Veröffentlichen</span></button>
           <button class="btn btn--outline btn--sm fpe-context__edit-action" id="fpe-end-edit" type="button" data-action="end-edit"><span class="btn__text">Beenden</span></button>`
        : `<button class="btn btn--filled btn--sm btn--icon-right fpe-context__start-edit" id="fpe-start-edit" type="button" data-action="start-edit">${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">Bearbeiten</span></button>`}
      <span class="fpe-header__divider" aria-hidden="true"></span>
      <button class="btn btn--bare btn--sm btn--icon-only fpe-panel-toggle fpe-panel-toggle--desktop${leftOpen ? ' is-active' : ''}" id="fpe-toggle-left" type="button" data-action="toggle-left"
        aria-label="${leftPanelLabel}" title="${leftPanelLabel}" aria-pressed="${leftOpen}"${leftPanelUnavailable ? ' disabled' : ''}>${panelToggleIcon('left')}</button>
      ${rightToggleHTML()}
    </div>`;
  }

  function resourceGroups() {
    const term = clean(resourceQuery);
    const groups = new Map();
    const colorContext = createColorContext(editorDocument.rooms);
    const moduleById = new Map(MODULE_OPTIONS.map((item) => [String(item.value), item]));
    const descriptor = (room) => {
      const option = moduleById.get(String(room.moduleId));
      return roomColorDescriptor(room, colorMode, colorContext, {
        module: option?.label || 'Ohne Ausstattungsstandard',
      });
    };
    editorDocument.rooms.forEach((room) => {
      const roomPlacements = placementsByRoom.get(room.spaceId) || [];
      const haystack = clean(`${room.roomNumber} ${room.useLabel} ${room['occupierVe'] || ''} ${roomPlacements.map((item) => item.name).join(' ')}`);
      if (term && !haystack.includes(term)) return;
      const group = descriptor(room);
      const entry = groups.get(group.key) || { ...group, rooms: [], area: 0 };
      entry.rooms.push({ room, placements: roomPlacements });
      entry.area += Number(room.area) || 0;
      groups.set(group.key, entry);
    });
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'de'));
  }

  /**
   * The resource tree, in the portal's tree language.
   *
   * It keeps its own markup rather than going through `treeHTML`: a row here is TWO
   * controls, not one — a disclosure and a selection — and it carries figures on the
   * right, which the portfolio tree has no notion of. What it borrows is everything a
   * reader sees: indentation as row padding so dividers reach both edges, one divider
   * weight, a guide line only along the selected branch, counts in parentheses, and
   * the two-tone selection where ancestors are light and the selected row is dark
   * with a primary edge bar.
   */
  function resourceListHTML() {
    const groups = resourceGroups();
    if (!groups.length) return `<div class="fpe-panel-empty">Keine Ressourcen gefunden.</div>`;
    const roomRow = ({ room, placements }, rowId) => {
      const roomSelected = selected?.type === 'room' && selected.id === room.spaceId;
      const holdsSelection = selected?.type === 'placement'
        && placements.some((placement) => placement.placementId === selected.id);
      const open = expandedRooms.has(room.spaceId);
      const assetsId = `fpe-resource-assets-${rowId}`;
      const expansionAttributes = placements.length
        ? ` aria-expanded="${open}" aria-controls="${assetsId}"`
        : '';
      const expansionLabel = placements.length
        ? `Ausstattung von ${room.roomNumber} ${open ? 'ausblenden' : 'einblenden'}`
        : `${room.roomNumber} hat keine Ausstattung`;
      return `<li><div class="fpe-resource-room-line${roomSelected ? ' is-selected' : ''}${
        holdsSelection && !roomSelected ? ' is-path' : ''}">
        <button type="button" class="fpe-resource-room-toggle" data-resource-room="${C.escape(room.spaceId)}"${expansionAttributes}
          aria-label="${C.escape(expansionLabel)}"${placements.length ? '' : ' disabled'}>${C.icon(open ? 'ChevronDown' : 'ChevronRight', 'icon--base')}</button>
        <button type="button" class="fpe-resource-row${roomSelected ? ' is-selected' : ''}" data-select-type="room" data-select-id="${C.escape(room.spaceId)}" aria-pressed="${roomSelected}">
          <span class="fpe-resource-row__label">${C.escape(room.roomNumber)}</span><span class="fpe-resource-row__figure">${formatArea(room.area)}</span></button>
      </div>
        ${placements.length ? `<ul class="fpe-resource-assets" id="${assetsId}"${open ? '' : ' hidden'}>${placements.map((placement) => {
          const active = selected?.type === 'placement' && selected.id === placement.placementId;
          return `<li><button type="button" class="fpe-resource-row fpe-resource-row--asset${active ? ' is-selected' : ''}" data-select-type="placement" data-select-id="${C.escape(placement.placementId)}" aria-pressed="${active}"><span class="fpe-resource-row__label">${C.escape(placement.name)}</span></button></li>`;
        }).join('')}</ul>` : ''}</li>`;
    };
    if (colorMode === 'none') {
      const rooms = groups.flatMap((group) => group.rooms);
      return `<ul class="fpe-resource-tree fpe-resource-tree--flat" aria-label="Räume">${rooms.map((entry, index) => roomRow(entry, `flat-${index}`)).join('')}</ul>`;
    }
    return `<div class="fpe-resource-tree">${groups.map((group, groupIndex) => {
      const collapsed = !expandedGroups.has(group.key);
      const groupId = `fpe-resource-group-${groupIndex}`;
      const holdsSelection = Boolean(selected) && group.rooms.some(({ room, placements }) => (
        (selected.type === 'room' && selected.id === room.spaceId)
        || (selected.type === 'placement' && placements.some((item) => item.placementId === selected.id))));
      return `<section class="fpe-resource-group">
      <h3><button type="button" class="fpe-resource-group__head${holdsSelection ? ' is-path' : ''}" data-resource-group="${C.escape(group.key)}" aria-expanded="${!collapsed}" aria-controls="${groupId}">
        ${C.icon(collapsed ? 'ChevronRight' : 'ChevronDown', 'icon--base')}<span class="fpe-swatch" style="background:${swatchCss(group.swatch)}" aria-hidden="true"></span>
        <span class="fpe-resource-row__label">${C.escape(group.label)}</span><span class="fpe-resource-n">${group.rooms.length}</span><span class="fpe-resource-row__figure">${formatArea(group.area, { maximumFractionDigits: 1 })}</span>
      </button></h3>
      <ul class="fpe-resource-rooms" id="${groupId}"${collapsed ? ' hidden' : ''}>${group.rooms.map((entry, roomIndex) => roomRow(entry, `${groupIndex}-${roomIndex}`)).join('')}</ul>
    </section>`;
    }).join('')}</div>`;
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
        <span class="fpe-swatch" style="background:${swatchCss(`module-${item.value}`)}" aria-hidden="true"></span>
        <span><strong>${C.escape(item.label)}</strong><small>${counts.get(String(item.value)) || 0} Positionen im Projekt</small></span>
        <span class="fpe-module-card__action">${active ? 'Zugewiesen' : 'Raum zuweisen'}</span>
      </button>`;
    }).join('')}</div>`;
  }

  function colorMenuHTML() {
    // Rendered in edit mode too. It used to be suppressed there because the rail became
    // the library and carried no colour trigger; now the rail always holds the tree, so
    // the trigger is always present — and suppressing the menu made it a dead control
    // with `aria-haspopup` and `aria-controls` pointing at nothing, which also left
    // `colorMenuOpen` stuck true and swallowed the next Escape.
    return `<div class="fpe-color-menu" id="fpe-color-menu" role="menu" aria-label="Farbe nach"${colorMenuOpen ? '' : ' hidden'}>
      <p class="fpe-overline">Farbe nach</p>${EDITOR_COLOR_MODES.map((item) => `<button type="button" role="menuitemradio" aria-checked="${item.value === colorMode}" tabindex="${item.value === colorMode ? '0' : '-1'}" data-color-mode="${C.escape(item.value)}">
        <span class="fpe-color-radio" aria-hidden="true"><i></i></span><span><strong>${C.escape(item.label)}</strong><small>${C.escape(COLOR_DESCRIPTIONS[item.value] || '')}</small></span>
      </button>`).join('')}
    </div>`;
  }

  /**
   * The left rail is the RESOURCE TREE, in every mode and every view.
   *
   * It used to be the tree in view mode and the product library in edit mode —
   * one slot with two identities. That is why the tree vanished the moment
   * someone started editing, in 2D as much as in 3D: the library took its place
   * and the rail was closed by default so as not to open a picker unasked. The
   * library is a dialog now (`libraryHTML`), so the tree can simply stay.
   */
  function leftPanelHTML() {
    const search = `<label class="sr-only" for="fpe-left-search">Ressourcen suchen</label>
      <div class="fpe-panel-search">${C.icon('Search', 'icon--base')}<input id="fpe-left-search" type="search" placeholder="Suchen…" value="${C.escape(resourceQuery)}"></div>`;
    return `<aside class="fpe-left" id="fpe-left" aria-label="Ressourcen">
      <div class="fpe-panel-head">
        <div class="fpe-panel-title-row"><h2 class="fpe-panel-title">Ressourcen</h2>
          <button class="btn btn--bare btn--sm btn--icon-only fpe-drawer-close" type="button" data-action="toggle-left" aria-label="Ressourcen schliessen">${C.icon('Cancel', 'btn__icon')}</button></div>
        <div class="fpe-resource-tools">${search}<div class="fpe-color-picker">
          <button class="btn btn--outline btn--sm btn--icon-left" id="fpe-color-trigger" type="button" data-action="toggle-color-menu"
            aria-label="Farbe nach Attribut: ${C.escape(EDITOR_COLOR_MODES.find((item) => item.value === colorMode)?.label || '')}" aria-haspopup="menu" aria-expanded="${colorMenuOpen}" aria-controls="fpe-color-menu">${TOOL_GLYPHS.colorBy}<span class="btn__text">Farbe</span></button>
        </div></div>
      </div>
      <div class="fpe-panel-scroll" id="fpe-left-list">${resourceListHTML()}</div>
    </aside>`;
  }

  /**
   * The product library as a dialog.
   *
   * Choosing a product is a transient errand — open, pick, place — so it borrows
   * the design system's modal anatomy rather than occupying a permanent rail:
   * `aria-modal` on the wrapper, `role="dialog"` on the content, a backdrop that
   * closes, and the same `Cancel` cross every other overlay in the portal closes
   * with. It renders from `assetLibraryOpen` like the rest of the shell rather
   * than through `openModal`, because the editor keeps that state in the URL and
   * an imperatively appended overlay would fall outside the state machine.
   */
  function libraryHTML() {
    if (!editMode || !assetLibraryOpen) return '';
    // The body wraps its content in a card. That card is what carries the surface and
    // the padding: the design system keeps the modal content transparent with white
    // header chrome and expects the caller to supply the light box. Without it the
    // product grid sat directly on the scrim, and the full-bleed tab strip had no
    // padding to bleed into and escaped the dialog.

    const editingProducts = libraryMode === 'products';
    const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort();
    return `<div class="modal modal--md fpe-library" id="fpe-library" aria-modal="true">
      <div class="modal__backdrop" data-action="close-library"></div>
      <div class="modal__content" role="dialog" aria-labelledby="fpe-library-title">
        <div class="modal__header modal__header--with-title">
          <h2 class="modal__title" id="fpe-library-title">Bibliothek</h2>
          <button type="button" class="modal__close fpe-library-close" data-action="close-library" aria-label="Bibliothek schliessen">${C.icon('Cancel', 'icon--2xl')}</button>
        </div>
        <div class="modal__body">
          <div class="card"><div class="card__body">
          <div class="fpe-library-tabs" role="tablist" aria-label="Bibliothek">
            <button type="button" id="fpe-library-tab-products" role="tab" data-library="products" aria-controls="fpe-library-list" aria-selected="${editingProducts}" tabindex="${editingProducts ? '0' : '-1'}"${editingProducts ? ' class="is-active"' : ''}>Produkte</button>
            <button type="button" id="fpe-library-tab-modules" role="tab" data-library="modules" aria-controls="fpe-library-list" aria-selected="${!editingProducts}" tabindex="${!editingProducts ? '0' : '-1'}"${!editingProducts ? ' class="is-active"' : ''}>Module</button>
          </div>
          <label class="sr-only" for="fpe-library-search">${editingProducts ? 'Produkte' : 'Module'} suchen</label>
          <div class="fpe-panel-search">${C.icon('Search', 'icon--base')}<input id="fpe-library-search" type="search" placeholder="${editingProducts ? 'Produkte suchen…' : 'Module suchen…'}" value="${C.escape(productQuery)}"></div>
          ${editingProducts ? C.select({ id: 'fpe-product-category', label: 'Kategorie', size: 'sm', value: productCategory,
            options: [{ value: '', label: 'Alle Kategorien' }, ...categories.map((value) => ({ value, label: value }))] }) : ''}
          <div class="fpe-panel-scroll" id="fpe-library-list" role="tabpanel" aria-labelledby="fpe-library-tab-${libraryMode}">${editingProducts ? productListHTML() : moduleListHTML()}</div>
          </div></div>
        </div>
      </div>
    </div>`;
  }

  function toolButton(action, label, icon, options = {}) {
    const active = options.active ? ' is-active' : '';
    const pressed = options.pressed == null ? '' : ` aria-pressed="${options.pressed}"`;
    const disabled = options.disabled ? ' disabled' : '';
    return `<button class="btn btn--bare btn--sm btn--icon-only fpe-tool${active}" id="fpe-action-${action}" type="button" data-action="${action}" aria-label="${label}" title="${label}"${pressed}${disabled}>${C.icon(icon, 'btn__icon')}</button>`;
  }

  // The toolbar is shown in EVERY view. It used to return nothing outside the 2D
  // plan, so switching to 3D in edit mode removed the bar altogether and the view
  // looked broken rather than restricted. What actually differs is which tools a
  // renderer can carry out: furniture can be placed, selected, moved and turned
  // on the floor plane in 3D, while room geometry and measuring need the flat,
  // scaled plan. Those tools are therefore disabled with a stated reason instead
  // of being hidden.
  const SPATIAL_ONLY = '2D-Plan';
  const only2d = (label) => `${label} — nur im ${SPATIAL_ONLY}`;

  /**
   * The right-panel toggle, which also reports what is waiting behind it.
   *
   * Closing the inspector is a choice, so selecting something afterwards must NOT
   * reopen it — that would make the close control pointless. But the inspector is the
   * only place a selection is described, so a silent close swallowed the answer: the
   * room highlighted on the plan and nothing said why. The toggle therefore carries a
   * marker while a selection sits behind a closed panel, and its label names it.
   */
  function rightToggleHTML() {
    const pending = Boolean(selected) && !rightOpen;
    const what = selected?.type === 'room' ? 'Raum' : 'Objekt';
    const label = rightOpen
      ? 'Rechtes Panel ausblenden'
      : (pending ? `Rechtes Panel einblenden — ${what} ausgewählt` : 'Rechtes Panel einblenden');
    return `<button class="btn btn--bare btn--sm btn--icon-only fpe-panel-toggle fpe-panel-toggle--desktop${
      rightOpen ? ' is-active' : ''}${pending ? ' has-pending' : ''}" id="fpe-toggle-right" type="button" data-action="toggle-right"
      aria-label="${label}" title="${label}" aria-pressed="${rightOpen}">${panelToggleIcon('right')}${
      pending ? '<span class="fpe-panel-toggle__dot" aria-hidden="true"></span>' : ''}</button>`;
  }

  function toolbarHTML() {
    const flat = viewMode === '2d';
    if (editMode) {
      const libraryActive = assetLibraryOpen || ['add', 'place'].includes(tool);
      return `<div class="fpe-toolbar" role="group" aria-label="Bearbeitungswerkzeuge">
        <button class="btn ${libraryActive ? 'btn--filled' : 'btn--bare'} btn--sm fpe-tool fpe-tool--labelled${libraryActive ? ' is-active' : ''}" id="fpe-action-toggle-library"
          type="button" data-action="toggle-library" aria-label="Ausstattung hinzufügen" title="Ausstattung hinzufügen"
          aria-pressed="${libraryActive}">${C.icon('Plus', 'btn__icon')}<span class="btn__text">Hinzufügen</span></button>
        <span class="fpe-tool-sep"></span>
        ${toolButton('tool-select', 'Auswählen', 'Pointer', { active: tool === 'select', pressed: tool === 'select' })}
        ${toolButton('tool-measure', 'Messen', 'Ruler',
          { active: tool === 'measure', pressed: tool === 'measure' })}
        <span class="fpe-tool-sep"></span>
        <button class="btn btn--bare btn--sm fpe-tool fpe-structure-trigger${tool === 'room' ? ' is-active' : ''}" id="fpe-structure-trigger"
          type="button" data-action="toggle-structure-menu" aria-haspopup="menu" aria-expanded="${structureMenuOpen}"
          title="Strukturbearbeitung ${structureUnlocked ? 'entsperrt' : 'gesperrt'}">${C.icon(structureUnlocked ? 'Unlock' : 'Lock', 'btn__icon')}
          <span class="btn__text">Struktur ${structureUnlocked ? 'entsperrt' : 'gesperrt'}</span>${C.icon('ChevronDown', 'btn__icon')}</button>
        <span class="fpe-tool-sep"></span>
        <span class="fpe-toolbar__history-action">${toolButton('undo', 'Rückgängig', 'ArrowLeft', { disabled: !editHistory.canUndo })}</span>
        <span class="fpe-toolbar__history-action">${toolButton('redo', 'Wiederholen', 'ArrowRight', { disabled: !editHistory.canRedo })}</span>
      </div>`;
    }
    return `<div class="fpe-toolbar" role="group" aria-label="Planwerkzeuge">
      ${toolButton('tool-select', 'Auswählen', 'Pointer', { active: tool === 'select', pressed: tool === 'select' })}
      ${toolButton('tool-pan', flat ? 'Plan verschieben' : only2d('Plan verschieben'), 'Move',
        { active: tool === 'pan', pressed: flat ? tool === 'pan' : null, disabled: !flat })}
      <span class="fpe-tool-sep"></span>
      ${toolButton('tool-measure', 'Messen', 'Ruler',
        { active: tool === 'measure', pressed: tool === 'measure' })}
    </div>`;
  }

  /**
   * The structure menu, and the range of elements behind the lock.
   *
   * Unlocking reveals the full catalogue of structural elements, all of it disabled.
   * That is deliberate: the one thing the editor can place today is a room rectangle,
   * and showing only that makes structural editing look like a finished, very small
   * feature. Listing what is coming shows the target — space management, not room
   * rectangles — and a greyed row promises nothing.
   *
   * The list stays hidden while locked, so the menu does not open onto a wall of
   * unavailable controls for someone who only wanted to check the lock state.
   */
  function structureMenuHTML() {
    // Rendered in EVERY view. It used to disappear outside the 2D plan, so switching to
    // the model removed the lock state and the whole catalogue from view — the same
    // «looks broken rather than restricted» shape the toolbar had. What genuinely needs
    // the flat drawing is creating a room by dragging a rectangle; that one tool is
    // disabled with a stated reason, as the other plan-only tools are.
    if (!editMode) return '';
    const elements = structureUnlocked
      ? `<span class="fpe-structure-menu__separator" aria-hidden="true"></span>
      <p class="fpe-overline">Bauteile <span class="fpe-structure-menu__soon">in Vorbereitung</span></p>
      ${STRUCTURE_ELEMENTS.map((element) => `<button type="button" role="menuitem" class="fpe-structure-menu__element"
        data-structure-element="${C.escape(element.key)}" disabled
        aria-label="${C.escape(element.label)} — noch nicht verfügbar">${ELEMENT_GLYPHS[element.key] || ''}<span>${C.escape(element.label)}</span></button>`).join('')}`
      : '';
    return `<div class="fpe-structure-menu" id="fpe-structure-menu" role="menu" aria-label="Strukturbearbeitung"${structureMenuOpen ? '' : ' hidden'}>
      <p class="fpe-overline">Strukturwerkzeuge</p>
      <button type="button" role="menuitem" data-action="tool-room"${structureUnlocked && viewMode === '2d' ? '' : ' disabled'}
        title="${structureUnlocked ? (viewMode === '2d' ? 'Raumfläche anlegen' : only2d('Raumfläche anlegen')) : 'Strukturbearbeitung ist gesperrt'}">
        ${TOOL_GLYPHS.roomArea}<span>Raumfläche anlegen${viewMode === '2d' ? '' : ' — nur im 2D-Plan'}</span></button>
      ${elements}
      <span class="fpe-structure-menu__separator" aria-hidden="true"></span>
      <button type="button" role="menuitem" data-action="toggle-structure-lock">
        ${C.icon(structureUnlocked ? 'Lock' : 'Unlock', 'icon--base')}<span>Strukturbearbeitung ${structureUnlocked ? 'sperren' : 'entsperren'}</span></button>
    </div>`;
  }

  function viewNavigationHTML() {
    const modes = [
      { value: '2d', label: '2D', accessible: '2D-Grundriss' },
      { value: '3d', label: '3D', accessible: '3D-Modell' },
      { value: 'walk', label: 'Begehung', accessible: 'Begehungsansicht' },
    ];
    const modeButtons = modes.map((mode) => {
      const active = viewMode === mode.value;
      return `<button type="button" class="fpe-view-nav__mode${active ? ' is-active' : ''}" id="fpe-view-${mode.value}"
        data-action="view-${mode.value}" data-view-mode="${mode.value}" aria-label="${mode.accessible}"
        title="${mode.accessible}" aria-pressed="${active}" tabindex="${active ? '0' : '-1'}">
        <span class="fpe-view-nav__label">${mode.label}</span></button>`;
    }).join('');
    return `<div class="fpe-view-nav" role="group" aria-label="Darstellung wechseln">
      <div class="fpe-view-nav__modes">${modeButtons}</div>
    </div>`;
  }

  function viewActionsHTML() {
    // Zoom in sits ABOVE zoom out, as everywhere else in the portal: the stack
    // reads as a scale with «more» at the top.
    const navigationActions = viewMode === '2d'
      ? `${toolButton('zoom-in', 'Vergrössern', 'Plus')}${toolButton('zoom-out', 'Verkleinern', 'Minus')}${toolButton('fit', 'Plan einpassen', 'Compress')}${toolButton('fit-selection', 'Auswahl einpassen', 'Bullseye', { disabled: !selected })}`
      : `${viewMode === '3d' ? `${toolButton('zoom-in', '3D-Ansicht vergrössern', 'Plus')}${toolButton('zoom-out', '3D-Ansicht verkleinern', 'Minus')}` : ''}${toolButton('three-reset', `${viewMode === 'walk' ? 'Begehung' : '3D-Ansicht'} zurücksetzen`, 'Compress')}`;
    return `<div class="fpe-view-nav__actions" role="group" aria-label="Ansicht navigieren">${navigationActions}</div>`;
  }

  function sceneContentHTML() {
    if (viewMode === '2d') {
      return renderEditorSvg({ floor, rooms: editorDocument.rooms, placements: editorDocument.placements,
        selected, colorMode, camera, measurement, editableRooms: editMode && structureUnlocked,
        roomDraft, placementGhost, keyboardCursor,
        // Only in edit mode: outside it the widget offers handles for a gesture
        // the view does not accept.
        transformWidget: editMode && tool === 'select' });
    }
    return `<div class="fpe-three-view${viewMode === 'walk' ? ' is-walk' : ''}">
      <div class="fpe-three-host" id="fpe-three-host"><p class="fpe-three-loading">3D-Modell wird aufgebaut…</p></div>
      ${viewMode === 'walk' ? '<span class="fpe-walk-reticle" aria-hidden="true"></span>' : ''}
    </div>`;
  }

  /**
   * The measurement reading, as something that can be put away.
   *
   * A bare status line had no way to be dismissed, so clearing a measurement meant
   * leaving the tool. The cross clears the measurement and keeps the tool, which is
   * what someone taking a series of measurements actually wants.
   */
  function measureResultHTML() {
    const value = measurementLabel(measurement || {});
    const points = measurement?.points?.length || 0;
    if (!value && !points) return '<div class="fpe-measure-result" role="status" hidden></div>';
    return `<div class="fpe-measure-result is-open" role="status">
      <span class="fpe-measure-result__value">${C.escape(value || `${points} Punkt${points === 1 ? '' : 'e'}`)}</span>
      <button class="btn btn--bare btn--sm btn--icon-only" type="button" data-action="clear-measure"
        aria-label="Messung löschen" title="Messung löschen">${C.icon('Cancel', 'btn__icon')}</button>
    </div>`;
  }

  function stageHTML() {
    const directPan = viewMode === '2d' && (tool === 'pan' || (!editMode && tool === 'select'));
    const keyboardHelp = tool === 'room'
      ? 'Pfeiltasten bewegen den Planzeiger. Leertaste oder Eingabetaste setzt Anfang und Ende der neuen Raumfläche.'
      : tool === 'measure'
        ? 'Pfeiltasten bewegen den Planzeiger. Leertaste setzt einen Messpunkt. Eingabetaste schliesst ab drei Punkten eine Fläche. Rücktaste entfernt den letzten Punkt, Escape löscht die Messung.'
        : tool === 'place'
          ? 'Pfeiltasten bewegen den Planzeiger. Leertaste oder Eingabetaste platziert das gewählte Produkt. Escape beendet das Platzieren.'
          : 'Pfeiltasten verschieben den sichtbaren Planausschnitt. Plus und Minus ändern den Zoom.';
    const keyboardAttributes = viewMode === '2d' ? ' aria-describedby="fpe-stage-help" tabindex="0"' : ' tabindex="-1"';
    return `<section class="fpe-stage${directPan ? ' is-pan-ready' : ''}" id="fpe-stage" aria-label="Plan-Arbeitsfläche"${keyboardAttributes}>
      ${viewMode === '2d' ? `<p class="sr-only" id="fpe-stage-help">${keyboardHelp}</p>` : ''}
      <div class="fpe-toolbar-host" id="fpe-toolbar-host">${toolbarHTML()}</div>
      <div class="fpe-structure-menu-host" id="fpe-structure-menu-host">${structureMenuHTML()}</div>
      <div class="fpe-scene${viewMode === '2d' ? '' : ' fpe-scene--three'}" id="fpe-scene">${sceneContentHTML()}</div>
      <div class="fpe-view-nav-host" id="fpe-view-nav-host">${viewNavigationHTML()}</div>
      <div class="fpe-view-actions-host" id="fpe-view-actions-host">${viewActionsHTML()}</div>
      <div class="fpe-scale" id="fpe-scale" aria-hidden="true"${viewMode === '2d' ? '' : ' hidden'}><span></span><i></i></div>
      ${measureResultHTML()}
    </section>`;
  }

  /**
   * A collapsible inspector section.
   *
   * The head follows `.fpe-resource-group__head` in the resource tree rather than
   * inventing a second disclosure: a real button inside the heading, carrying
   * `aria-expanded` and `aria-controls`, so the state is announced and not merely
   * drawn. `title` may contain markup — the count span in «Ausstattung in diesem
   * Raum 3» — and callers escape their own text.
   *
   * Forms are deliberately NOT collapsible: hiding the fields someone is filling
   * in is not a service, and `.fpe-form` styles its own children.
   */
  function inspectorSection(key, title, body) {
    const collapsed = collapsedSections.has(key);
    const bodyId = `fpe-section-${key}`;
    return `<section class="fpe-inspector-section${collapsed ? ' is-collapsed' : ''}">
      <h3><button type="button" class="fpe-inspector-section__head" data-inspector-section="${C.escape(key)}"
        aria-expanded="${!collapsed}" aria-controls="${bodyId}"><span class="fpe-inspector-section__label">${title}</span>${
        C.icon(collapsed ? 'ChevronRight' : 'ChevronDown', 'icon--sm')}</button></h3>
      <div class="fpe-inspector-section__body" id="${bodyId}"${collapsed ? ' hidden' : ''}>${body}</div>
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
    return `<div class="fpe-inspector-title"><span><small>Geschoss</small>${C.escape(floor.label)}</span><button class="btn btn--bare btn--sm btn--icon-only fpe-drawer-close" type="button" data-action="toggle-right" aria-label="Inspektor schliessen">${C.icon('Cancel', 'btn__icon')}</button></div>
      ${inspectorSection('floor-kpis', 'Geschosskennzahlen', `<div class="fpe-kpis">
        <div><small>Bruttofläche</small><strong>${formatArea(floor.areaGross)}</strong></div>
        <div><small>Arbeitsplätze</small><strong>${formatNumber(workplaces)}</strong></div>
        <div><small>Räume</small><strong>${editorDocument.rooms.length}</strong></div>
        <div><small>Verortete Objekte</small><strong>${editorDocument.placements.length}</strong></div>
        <div><small>Verkehrsfläche</small><strong>${formatArea(traffic, { maximumFractionDigits: 1 })}</strong></div>
        <div><small>Planungsmenge</small><strong>${plan.equipmentCount == null ? '—' : formatNumber(plan.equipmentCount)}</strong></div>
      </div>`)}
      ${inspectorSection('floor-use', 'Flächen nach Nutzung', `<ul class="fpe-breakdown">${[...groups.entries()].sort((a, b) => b[1].area - a[1].area).slice(0, 6)
        .map(([label, entry]) => `<li><span class="fpe-swatch" style="background:${swatchCss(useSwatch(entry.group))}"></span><span>${C.escape(label)}</span><strong>${formatArea(entry.area, { maximumFractionDigits: 1 })}</strong></li>`).join('')}</ul>`)}
      ${inspectorSection('floor-attributes', 'Attribute', `<dl class="fpe-kv">
        <dt>Geschoss-ID</dt><dd class="mono">${C.escape(floor.floorId)}</dd><dt>Gebäude</dt><dd>${C.escape(building.name)}</dd>
        <dt>Adresse</dt><dd>${C.escape(address(building))}</dd><dt>Variante</dt><dd>${C.escape(editorVersionLabel())}</dd>
        <dt>Letzte Synchronisation</dt><dd>${C.escape(plan.lastSync || 'nicht erfasst')}</dd><dt>Planstand</dt><dd>${planBadge()}</dd>
      </dl>`)}`;
  }

  function roomInspectorHTML(room) {
    const items = placementsByRoom.get(room.spaceId) || [];
    const moduleValue = String(room.moduleId || '');
    const [roomX, roomY, roomWidth, roomHeight] = room.rect;
    const localRoom = room.spaceId.startsWith('local-room-');
    return `<div class="fpe-inspector-title"><span><small>Ausgewählter Raum</small>${C.escape(room.roomNumber)}</span><button class="btn btn--bare btn--sm btn--icon-only" type="button" data-action="fit-selection" aria-label="Auswahl einpassen" title="Auswahl einpassen">${C.icon('Bullseye', 'btn__icon')}</button><button class="btn btn--bare btn--sm btn--icon-only fpe-drawer-close" type="button" data-action="toggle-right" aria-label="Inspektor schliessen">${C.icon('Cancel', 'btn__icon')}</button></div>
      ${inspectorSection('room-details', 'Details', `<dl class="fpe-kv"><dt>Fläche</dt><dd>${formatArea(room.area)}</dd><dt>AOID</dt><dd class="mono">${C.escape(room.spaceId)}</dd><dt>Arbeitsplätze</dt><dd>${Number(room.capacity || 0)}</dd></dl>`)}
      ${editMode ? `<form class="fpe-inspector-section fpe-form" id="fpe-room-form">
        <h3>Standard-Attribute</h3>
        <div class="fpe-field"><label for="fpe-room-useType">Nutzungsart</label><select id="fpe-room-useType" class="input--outline input--sm" data-room-field="useType">${optionMarkup(USE_OPTIONS, room.useType)}</select></div>
        <div class="fpe-field"><label for="fpe-room-sia">Flächenart SIA 416</label><select id="fpe-room-sia" class="input--outline input--sm" data-room-field="sia">${optionMarkup(SIA_OPTIONS, room.sia)}</select></div>
        <div class="fpe-field"><label for="fpe-room-moduleId">Multispace-Modul</label><select id="fpe-room-moduleId" class="input--outline input--sm" data-room-field="moduleId"><option value="">Ohne Ausstattungsstandard</option>${optionMarkup(MODULE_OPTIONS, moduleValue)}</select></div>
        <div class="fpe-field"><label for="fpe-room-administrative-unit">Verwaltungseinheit</label><input id="fpe-room-administrative-unit" class="input--outline input--sm" type="text" data-room-field="occupierVe" value="${C.escape(room['occupierVe'] || '')}"></div>
        <div class="fpe-field"><label for="fpe-room-capacity">Arbeitsplätze</label><input id="fpe-room-capacity" class="input--outline input--sm" type="number" min="0" step="1" data-room-field="capacity" value="${Number(room.capacity) || 0}"></div>
        <div class="fpe-field"><label for="fpe-room-roomNumber">Raumnummer</label><input id="fpe-room-roomNumber" class="input--outline input--sm" type="text" data-room-field="roomNumber" value="${C.escape(room.roomNumber)}" required></div>
        <div class="fpe-field"><label for="fpe-room-roomName">Raumbezeichnung</label><input id="fpe-room-roomName" class="input--outline input--sm" type="text" data-room-field="roomName" value="${C.escape(room.roomName || room.useLabel)}"></div>
        <label class="fpe-check" for="fpe-room-bookable"><input id="fpe-room-bookable" type="checkbox" data-room-field="bookable"${room.bookable ? ' checked' : ''}> Fläche ${'ist'} reservierbar</label>
        <h3>Geometrie <span>${structureUnlocked ? 'entsperrt' : 'gesperrt'}</span></h3>
        <div class="fpe-form-grid">
          <div class="fpe-field"><label for="fpe-room-x">X (cm)</label><input id="fpe-room-x" class="input--outline input--sm" type="number" min="0" step="10" data-room-geometry="x" value="${Math.round(roomX)}"${structureUnlocked ? '' : ' disabled'}></div>
          <div class="fpe-field"><label for="fpe-room-y">Y (cm)</label><input id="fpe-room-y" class="input--outline input--sm" type="number" min="0" step="10" data-room-geometry="y" value="${Math.round(roomY)}"${structureUnlocked ? '' : ' disabled'}></div>
          <div class="fpe-field"><label for="fpe-room-width">Breite (cm)</label><input id="fpe-room-width" class="input--outline input--sm" type="number" min="100" step="10" data-room-geometry="width" value="${Math.round(roomWidth)}"${structureUnlocked ? '' : ' disabled'}></div>
          <div class="fpe-field"><label for="fpe-room-height">Tiefe (cm)</label><input id="fpe-room-height" class="input--outline input--sm" type="number" min="100" step="10" data-room-geometry="height" value="${Math.round(roomHeight)}"${structureUnlocked ? '' : ' disabled'}></div>
        </div>
        ${structureUnlocked ? '' : '<p class="small muted m-0">Im Strukturmenü entsperren, um Raumkanten und Geometriewerte zu bearbeiten.</p>'}
        ${localRoom ? `<button class="btn btn--outline btn--sm btn--icon-left" type="button" data-action="delete-room"${structureUnlocked ? '' : ' disabled'}>${C.icon('Trash', 'btn__icon')}<span class="btn__text">Neue Fläche entfernen</span></button>` : ''}
      </form>` : inspectorSection('room-standard', 'Standard-Attribute', `<dl class="fpe-kv"><dt>Nutzung</dt><dd>${C.escape(room.useLabel)}</dd><dt>Raumbezeichnung</dt><dd>${C.escape(room.roomName || room.useLabel)}</dd><dt>SIA 416</dt><dd>${C.escape(room.siaLabel)} (${C.escape(room.sia)})</dd><dt>Verwaltungseinheit</dt><dd>${C.escape(room['occupierVe'] || 'nicht zugeteilt')}</dd><dt>Reservierbar</dt><dd>${room.bookable ? 'Ja' : 'Nein'}</dd></dl>`)}
      ${inspectorSection('room-equipment', `Ausstattung in diesem Raum <span>${items.length}</span>`, `${items.length
        ? `<ul class="fpe-inspector-list">${items.map((placement) => `<li><button type="button" data-select-type="placement" data-select-id="${C.escape(placement.placementId)}">${C.escape(placement.name)}${C.icon('ChevronRight', 'icon--sm')}</button></li>`).join('')}</ul>`
        : '<p class="small muted">Noch keine Ausstattungsobjekte verortet.</p>'}
        ${editMode ? '<button type="button" class="btn btn--outline btn--sm" data-action="focus-search"><span class="btn__text">Ausstattung hinzufügen</span></button>' : ''}`)}`;
  }

  function placementInspectorHTML(placement) {
    const product = productsById.get(String(placement.productId));
    const room = roomById().get(placement.roomId);
    const image = productImage(product);
    const sameRoom = editorDocument.placements.filter((item) => item.roomId === placement.roomId && item.productId === placement.productId).length;
    const sameFloor = editorDocument.placements.filter((item) => item.productId === placement.productId).length;
    return `<div class="fpe-inspector-title"><span><small>Ausgewähltes Objekt</small>${C.escape(placement.name)}</span><small>${C.escape(room?.roomNumber || 'nicht zugeordnet')}</small><button class="btn btn--bare btn--sm btn--icon-only" type="button" data-action="fit-selection" aria-label="Auswahl einpassen" title="Auswahl einpassen">${C.icon('Bullseye', 'btn__icon')}</button><button class="btn btn--bare btn--sm btn--icon-only fpe-drawer-close" type="button" data-action="toggle-right" aria-label="Inspektor schliessen">${C.icon('Cancel', 'btn__icon')}</button></div>
      <div class="fpe-product-preview">${image ? `<img src="${C.escape(image)}" alt="${C.escape(placement.name)}">` : C.icon('Image', 'icon--lg')}</div>
      ${inspectorSection('placement-kpis', 'Objektkennzahlen', `<div class="fpe-kpis"><div><small>In diesem Raum</small><strong>${sameRoom}</strong></div><div><small>Auf diesem Geschoss</small><strong>${sameFloor}</strong></div></div>`)}
      ${inspectorSection('placement-standard', 'Standard-Attribute', `<dl class="fpe-kv"><dt>Objektname</dt><dd>${C.escape(placement.name)}</dd><dt>Breite</dt><dd>${placement.width / 100} m</dd><dt>Tiefe</dt><dd>${placement.depth / 100} m</dd><dt>Marke</dt><dd>${C.escape(product?.brand || 'nicht erfasst')}</dd><dt>Katalog-ID</dt><dd class="mono">${C.escape(placement.articleId || String(placement.productId))}</dd><dt>Objekt-ID</dt><dd class="mono">${C.escape(placement.placementId)}</dd></dl>`)}
      ${editMode ? `<form class="fpe-inspector-section fpe-form" id="fpe-placement-form"><h3>Position</h3>
        <div class="fpe-form-grid"><div class="fpe-field"><label for="fpe-placement-x">X (cm)</label><input id="fpe-placement-x" class="input--outline input--sm" type="number" step="10" data-placement-field="x" value="${Math.round(placement.x)}"></div><div class="fpe-field"><label for="fpe-placement-y">Y (cm)</label><input id="fpe-placement-y" class="input--outline input--sm" type="number" step="10" data-placement-field="y" value="${Math.round(placement.y)}"></div></div>
        <div class="fpe-field"><label for="fpe-placement-rotation">Drehung</label><select id="fpe-placement-rotation" class="input--outline input--sm" data-placement-field="rotation">${optionMarkup([0, 45, 90, 135, 180, 225, 270, 315].map((value) => ({ value, label: `${value}°` })), placement.rotation)}</select></div>
        <div class="fpe-form-actions"><button class="btn btn--outline btn--sm btn--icon-left" type="button" data-action="rotate-left" aria-label="Objekt 45 Grad nach links drehen">${C.icon('ArrowLeft', 'btn__icon')}<span class="btn__text">Drehen</span></button><button class="btn btn--outline btn--sm btn--icon-left" type="button" data-action="delete-placement">${C.icon('Trash', 'btn__icon')}<span class="btn__text">Entfernen</span></button></div>
      </form>` : ''}
      ${product ? `<section class="fpe-inspector-section"><a class="btn btn--outline btn--sm btn--icon-right" href="#/app/shop/product/${encodeURIComponent(product.id)}" target="_blank" rel="noopener noreferrer">${C.icon('External', 'btn__icon')}<span class="btn__text">Im Produktkatalog öffnen</span></a></section>` : ''}`;
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
    return `<div class="fpe-app${editMode ? ' is-editing' : ''}${editMode && !structureUnlocked ? ' is-structure-locked' : ''}${leftOpen ? ' has-left' : ''}${rightOpen ? ' has-right' : ''}" id="fpe-app">
      <h1 class="sr-only" tabindex="-1">Plan-Editor — ${C.escape(floor.label)}, ${C.escape(building.name)}</h1>
      ${headerHTML()}
      <div class="fpe-workbench">
        ${leftPanelHTML()}${stageHTML()}${inspectorHTML()}
        <button class="fpe-panel-backdrop" type="button" data-action="close-panels" tabindex="-1" aria-hidden="true" aria-label="Seitenpanel schliessen"></button>
      </div>
      <div class="fpe-color-menu-host" id="fpe-color-menu-host">${colorMenuHTML()}</div>
      <div class="fpe-library-host" id="fpe-library-host">${libraryHTML()}</div>
      ${prototypeFooterHTML()}
    </div>`;
  }

  return {
    colorMenuHTML, inspectorHTML, leftPanelHTML, libraryHTML, measureResultHTML, moduleListHTML,
    rightToggleHTML,
    productListHTML, resourceListHTML, sceneContentHTML, shellHTML,
    structureMenuHTML, toolbarHTML, viewActionsHTML, viewNavigationHTML,
  };
}
