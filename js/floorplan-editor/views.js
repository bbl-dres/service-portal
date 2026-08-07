// Pure HTML composition for the floor-plan workbench.
// A fresh immutable snapshot is supplied for each render operation, keeping
// presentation code independent from controller mutation and event handling.

import { EDITOR_COLOR_MODES, measurementLabel, renderEditorSvg } from './canvas.js';
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
    libraryMode, productCategory, measurement, roomDraft, placementGhost,
    camera, resourceQuery, productQuery, colorMenuOpen, moreMenuOpen,
    structureMenuOpen, structureUnlocked, expandedGroups, expandedRooms,
    leftOpen, rightOpen, liveText, returnHref: returnUrl, versionLabel,
    publishable, planBadgeHtml,
  } = context;
  const returnHref = () => returnUrl;
  const editorVersionLabel = () => versionLabel;
  const canPublish = () => publishable;
  const planBadge = () => planBadgeHtml;

  function headerHTML() {
    const versionLabel = editorVersionLabel();
    const leftPanelName = editMode ? 'Bibliothek' : 'Ressourcen';
    return `${editorHeaderHTML(C, session, editMode)}
    <div class="fpe-context">
      <nav class="fpe-breadcrumb" aria-label="Sie sind hier">
        <a href="${BASE}" data-leave>Alle Objekte</a>${C.icon('ChevronRight', 'icon--sm')}
        <a href="${returnHref()}" data-leave>${C.escape(building.name)}</a>${C.icon('ChevronRight', 'icon--sm')}
        <span aria-current="page">${C.escape(floor.label)}</span>
      </nav>
      <div class="fpe-context__panel-mobile" role="group" aria-label="Seitenpanels">
        <button class="btn btn--bare btn--sm btn--icon-only${leftOpen ? ' is-active' : ''}" id="fpe-toggle-left-mobile" type="button" data-action="toggle-left"
          aria-label="${leftPanelName} ${leftOpen ? 'schliessen' : 'öffnen'}" aria-pressed="${leftOpen}">${panelToggleIcon('left')}</button>
        <button class="btn btn--bare btn--sm btn--icon-only${rightOpen ? ' is-active' : ''}" id="fpe-toggle-right-mobile" type="button" data-action="toggle-right"
          aria-label="${rightOpen ? 'Rechtes Panel ausblenden' : 'Rechtes Panel einblenden'}" aria-pressed="${rightOpen}">${panelToggleIcon('right')}</button>
      </div>
      <span class="fpe-version">${C.escape(versionLabel)}</span>
      <span class="fpe-context__status">${planBadge()}</span>
      ${object.planning.targetDate ? `<span class="fpe-date">${C.icon('Calendar', 'icon--sm')} Stichtag ${C.escape(object.planning.targetDate.split('-').reverse().join('.'))}</span>` : ''}
      <span class="fpe-context__spacer"></span>
      <div class="fpe-more">
        <button class="btn btn--outline btn--sm" id="fpe-more-trigger" type="button" data-action="toggle-more-menu"
          aria-haspopup="menu" aria-expanded="${moreMenuOpen}"><span class="btn__text">Mehr</span>${C.icon('ChevronDown', 'btn__icon')}</button>
        <div class="fpe-more-menu" id="fpe-more-menu" role="menu" aria-label="Weitere Planaktionen"${moreMenuOpen ? '' : ' hidden'}>
          ${editMode ? '' : '<button type="button" role="menuitem" data-action="version-history">Versionsverlauf…</button>'}
          <button type="button" role="menuitem" data-action="copy-link">Link kopieren</button>
          <button type="button" role="menuitem" data-action="copy-plan-id">Plan-ID kopieren</button>
        </div>
      </div>
      ${editMode
        ? `<button class="btn btn--outline btn--sm" id="fpe-save" type="button" data-action="save" title="Speichert die Arbeitskopie nur in diesem Browser"${dirty ? '' : ' disabled'}>${C.icon('Save', 'btn__icon')}<span class="btn__text">Entwurf speichern</span></button>
           <button class="btn btn--filled btn--sm" id="fpe-publish" type="button" data-action="publish" title="Simuliert die Veröffentlichung nur in diesem Browser"${canPublish() ? '' : ' disabled'}><span class="btn__text">Veröffentlichen</span></button>
           <button class="btn btn--outline btn--sm" id="fpe-end-edit" type="button" data-action="end-edit"><span class="btn__text">Beenden</span></button>`
        : `<button class="btn btn--filled btn--sm" id="fpe-start-edit" type="button" data-action="start-edit"><span class="btn__text">Bearbeiten</span>${C.icon('ArrowRight', 'btn__icon')}</button>`}
      <span class="fpe-header__divider" aria-hidden="true"></span>
      <button class="btn btn--bare btn--sm btn--icon-only${leftOpen ? ' is-active' : ''}" id="fpe-toggle-left" type="button" data-action="toggle-left"
        aria-label="${leftPanelName} ${leftOpen ? 'schliessen' : 'öffnen'}" aria-pressed="${leftOpen}">${panelToggleIcon('left')}</button>
      <button class="btn btn--bare btn--sm btn--icon-only${rightOpen ? ' is-active' : ''}" id="fpe-toggle-right" type="button" data-action="toggle-right"
        aria-label="${rightOpen ? 'Rechtes Panel ausblenden' : 'Rechtes Panel einblenden'}" aria-pressed="${rightOpen}">${panelToggleIcon('right')}</button>
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
    const roomRow = ({ room, placements }, rowId) => {
      const roomSelected = selected?.type === 'room' && selected.id === room.spaceId;
      const open = expandedRooms.has(room.spaceId);
      const assetsId = `fpe-resource-assets-${rowId}`;
      return `<li><div class="fpe-resource-room-line${roomSelected ? ' is-selected' : ''}">
        <button type="button" class="fpe-resource-room-toggle" data-resource-room="${C.escape(room.spaceId)}" aria-expanded="${open}"
          aria-controls="${assetsId}" aria-label="Ausstattung von ${C.escape(room.roomNumber)} ${open ? 'ausblenden' : 'einblenden'}"${placements.length ? '' : ' disabled'}>${C.icon(open ? 'ChevronDown' : 'ChevronRight', 'icon--sm')}</button>
        <button type="button" class="fpe-resource-row${roomSelected ? ' is-selected' : ''}" data-select-type="room" data-select-id="${C.escape(room.spaceId)}" aria-pressed="${roomSelected}">
          <span>${C.escape(room.roomNumber)}</span><span>${Number(room.area).toLocaleString('de-CH')} m²</span></button>
      </div>
        ${placements.length ? `<ul class="fpe-resource-assets" id="${assetsId}"${open ? '' : ' hidden'}>${placements.map((placement) => {
          const active = selected?.type === 'placement' && selected.id === placement.placementId;
          return `<li><button type="button" class="fpe-resource-row fpe-resource-row--asset${active ? ' is-selected' : ''}" data-select-type="placement" data-select-id="${C.escape(placement.placementId)}" aria-pressed="${active}">${C.icon('List', 'icon--sm')}<span>${C.escape(placement.name)}</span></button></li>`;
        }).join('')}</ul>` : ''}</li>`;
    };
    if (colorMode === 'none') {
      const rooms = groups.flatMap((group) => group.rooms);
      return `<ul class="fpe-resource-tree fpe-resource-tree--flat" aria-label="Räume">${rooms.map((entry, index) => roomRow(entry, `flat-${index}`)).join('')}</ul>`;
    }
    return `<div class="fpe-resource-tree">${groups.map((group, groupIndex) => {
      const collapsed = !expandedGroups.has(group.key);
      const groupId = `fpe-resource-group-${groupIndex}`;
      return `<section class="fpe-resource-group">
      <h3><button type="button" class="fpe-resource-group__head" data-resource-group="${C.escape(group.key)}" aria-expanded="${!collapsed}" aria-controls="${groupId}">
        ${C.icon(collapsed ? 'ChevronRight' : 'ChevronDown', 'icon--sm')}<span class="fpe-swatch fpe-swatch--${C.escape(group.swatch)}" aria-hidden="true"></span>
        <span>${C.escape(group.label)}</span><span>${group.rooms.length}</span><span>${group.area.toLocaleString('de-CH', { maximumFractionDigits: 1 })} m²</span>
      </button></h3>
      <ul id="${groupId}"${collapsed ? ' hidden' : ''}>${group.rooms.map((entry, roomIndex) => roomRow(entry, `${groupIndex}-${roomIndex}`)).join('')}</ul>
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
        <span class="fpe-swatch fpe-swatch--module-${C.escape(String(item.value))}" aria-hidden="true"></span>
        <span><strong>${C.escape(item.label)}</strong><small>${counts.get(String(item.value)) || 0} Positionen im Projekt</small></span>
        <span class="fpe-module-card__action">${active ? 'Zugewiesen' : 'Raum zuweisen'}</span>
      </button>`;
    }).join('')}</div>`;
  }

  function colorMenuHTML() {
    if (editMode) return '';
    return `<div class="fpe-color-menu" id="fpe-color-menu" role="menu" aria-label="Farbe nach"${colorMenuOpen ? '' : ' hidden'}>
      <p class="fpe-overline">Farbe nach</p>${EDITOR_COLOR_MODES.map((item) => `<button type="button" role="menuitemradio" aria-checked="${item.value === colorMode}" data-color-mode="${C.escape(item.value)}">
        <span class="fpe-color-radio" aria-hidden="true"><i></i></span><span><strong>${C.escape(item.label)}</strong><small>${C.escape(COLOR_DESCRIPTIONS[item.value] || '')}</small></span>
      </button>`).join('')}
    </div>`;
  }

  function leftPanelHTML() {
    const editingProducts = editMode && libraryMode === 'products';
    const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort();
    const search = `<label class="sr-only" for="fpe-left-search">${editMode ? (editingProducts ? 'Produkte' : 'Module') : 'Ressourcen'} suchen</label>
      <div class="fpe-panel-search">${C.icon('Search', 'icon--sm')}<input id="fpe-left-search" type="search" placeholder="${editMode ? (editingProducts ? 'Produkte suchen…' : 'Module suchen…') : 'Schnellsuche…'}" value="${C.escape(editMode ? productQuery : resourceQuery)}"></div>`;
    const colorControl = `<div class="fpe-resource-tools">${search}<div class="fpe-color-picker">
      <button class="btn btn--filled btn--sm btn--icon-only" id="fpe-color-trigger" type="button" data-action="toggle-color-menu"
        aria-label="Farbe nach Attribut: ${C.escape(EDITOR_COLOR_MODES.find((item) => item.value === colorMode)?.label || '')}" aria-haspopup="menu" aria-expanded="${colorMenuOpen}" aria-controls="fpe-color-menu">${C.icon('Eyedropper', 'btn__icon')}</button>
    </div></div>`;
    return `<aside class="fpe-left" id="fpe-left" aria-label="${editMode ? 'Produktbibliothek' : 'Ressourcen'}">
      <h2 class="sr-only">${editMode ? 'Produktbibliothek' : 'Ressourcen'}</h2>
      <div class="fpe-panel-head">
        ${editMode ? `<div class="fpe-panel-title-row"><p class="fpe-overline">Bibliothek</p>
          <button class="btn btn--bare btn--sm btn--icon-only" type="button" data-action="close-library" aria-label="Bibliothek schliessen">${C.icon('Cancel', 'btn__icon')}</button></div>`
          : '<p class="fpe-overline">Ressourcen</p>'}
        ${editMode ? `<div class="fpe-library-tabs" role="tablist" aria-label="Bibliothek">
          <button type="button" role="tab" data-library="products" aria-controls="fpe-left-list" aria-selected="${libraryMode === 'products'}" tabindex="${libraryMode === 'products' ? '0' : '-1'}"${libraryMode === 'products' ? ' class="is-active"' : ''}>Produkte</button>
          <button type="button" role="tab" data-library="modules" aria-controls="fpe-left-list" aria-selected="${libraryMode === 'modules'}" tabindex="${libraryMode === 'modules' ? '0' : '-1'}"${libraryMode === 'modules' ? ' class="is-active"' : ''}>Module</button>
        </div>` : ''}
        ${editMode ? search : colorControl}
        ${editingProducts ? C.select({ id: 'fpe-product-category', label: 'Kategorie', size: 'sm', value: productCategory,
          options: [{ value: '', label: 'Alle Kategorien' }, ...categories.map((value) => ({ value, label: value }))] }) : ''}
        ${editMode ? `<p class="small muted m-0">${editingProducts
          ? 'Produkt wählen und anschliessend im Plan platzieren. Bei gewähltem Raum wird es mittig eingefügt.'
          : 'Raum wählen und ein Multispace-Modul zuweisen. Die Zuordnung ist eine Prototypannahme.'}</p>`
          : ''}
      </div>
      <div class="fpe-panel-scroll" id="fpe-left-list"${editMode ? ' role="tabpanel"' : ''}>${editMode ? (editingProducts ? productListHTML() : moduleListHTML()) : resourceListHTML()}</div>
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
      const hints = viewMode === 'walk'
        ? `<span class="fpe-toolbar__hint">${C.icon('Keyboard', 'icon--sm')}<span>WASD: bewegen</span></span>
           <span class="fpe-toolbar__hint">${C.icon('Eye', 'icon--sm')}<span>Maus: umsehen</span></span>`
        : `<span class="fpe-toolbar__hint">${C.icon('Pointer', 'icon--sm')}<span>Klick: auswählen</span></span>
           <span class="fpe-toolbar__hint">${C.icon('Move', 'icon--sm')}<span>Links: verschieben</span></span>
           <span class="fpe-toolbar__hint">${C.icon('Refresh', 'icon--sm')}<span>Rechts: drehen</span></span>`;
      return `<div class="fpe-toolbar fpe-toolbar--three" role="group" aria-label="${viewMode === 'walk' ? 'Steuerung der Begehung' : 'Steuerung der 3D-Ansicht'}">
        ${hints}<span class="fpe-tool-sep"></span>${toolButton('print', 'Ansicht drucken', 'Printer')}
      </div>`;
    }
    if (editMode) {
      const libraryActive = assetLibraryOpen || ['add', 'place'].includes(tool);
      return `<div class="fpe-toolbar" role="toolbar" aria-label="Bearbeitungswerkzeuge">
        <button class="btn ${libraryActive ? 'btn--filled' : 'btn--bare'} btn--sm fpe-tool fpe-tool--labelled${libraryActive ? ' is-active' : ''}" id="fpe-action-toggle-library"
          type="button" data-action="toggle-library" aria-label="Ausstattung hinzufügen" title="Ausstattung hinzufügen"
          aria-pressed="${libraryActive}">${C.icon('Plus', 'btn__icon')}<span class="btn__text">Hinzufügen</span></button>
        <span class="fpe-tool-sep"></span>
        ${toolButton('tool-select', 'Auswählen', 'Pointer', { active: tool === 'select', pressed: tool === 'select' })}
        ${toolButton('tool-distance', 'Strecke messen', 'Ruler', { active: tool === 'distance', pressed: tool === 'distance' })}
        ${toolButton('tool-area', 'Fläche messen', 'Crop', { active: tool === 'area', pressed: tool === 'area' })}
        <span class="fpe-tool-sep"></span>
        <button class="btn btn--bare btn--sm fpe-tool fpe-structure-trigger${tool === 'room' ? ' is-active' : ''}" id="fpe-structure-trigger"
          type="button" data-action="toggle-structure-menu" aria-haspopup="menu" aria-expanded="${structureMenuOpen}"
          title="Strukturbearbeitung ${structureUnlocked ? 'entsperrt' : 'gesperrt'}">${C.icon(structureUnlocked ? 'Building' : 'Lock', 'btn__icon')}
          <span class="btn__text">Struktur ${structureUnlocked ? 'entsperrt' : 'gesperrt'}</span>${C.icon('ChevronDown', 'btn__icon')}</button>
        <span class="fpe-tool-sep"></span>
        ${toolButton('undo', 'Rückgängig', 'ArrowLeft', { disabled: !editHistory.canUndo })}
        ${toolButton('redo', 'Wiederholen', 'ArrowRight', { disabled: !editHistory.canRedo })}
        ${toolButton('version-history', 'Versionsverlauf', 'History')}
      </div>`;
    }
    return `<div class="fpe-toolbar" role="toolbar" aria-label="Planwerkzeuge">
      ${toolButton('tool-select', 'Auswählen', 'Pointer', { active: tool === 'select', pressed: tool === 'select' })}
      ${toolButton('tool-pan', 'Plan verschieben', 'Move', { active: tool === 'pan', pressed: tool === 'pan' })}
      <span class="fpe-tool-sep"></span>
      ${toolButton('tool-distance', 'Strecke messen', 'Ruler', { active: tool === 'distance', pressed: tool === 'distance' })}
      ${toolButton('tool-area', 'Fläche messen', 'Crop', { active: tool === 'area', pressed: tool === 'area' })}
      <span class="fpe-tool-sep"></span>${toolButton('print', 'Plan drucken', 'Printer')}
    </div>`;
  }

  function structureMenuHTML() {
    if (!editMode || viewMode !== '2d') return '';
    const unavailable = ['Wand', 'Tür', 'Fenster', 'Wandöffnung', 'Einbaumöbel', 'Teeküche', 'Stütze', 'Geländer', 'Treppe', 'Raumteiler'];
    return `<div class="fpe-structure-menu" id="fpe-structure-menu" role="menu" aria-label="Strukturbearbeitung"${structureMenuOpen ? '' : ' hidden'}>
      <p class="fpe-overline">Strukturwerkzeuge</p>
      ${unavailable.map((label) => `<button type="button" role="menuitem" disabled title="In diesem Feedback-Prototyp noch nicht verfügbar">
        ${C.icon('Minus', 'icon--sm')}<span>${label}</span></button>`).join('')}
      <button type="button" role="menuitem" data-action="tool-room"${structureUnlocked ? '' : ' disabled'}>
        ${C.icon('Apps', 'icon--sm')}<span><strong>Raumfläche anlegen</strong><small>Rechteckige Fläche im Plan aufziehen</small></span></button>
      <span class="fpe-structure-menu__separator" aria-hidden="true"></span>
      <button type="button" role="menuitem" data-action="toggle-structure-lock">
        ${C.icon(structureUnlocked ? 'Lock' : 'Unlock', 'icon--sm')}<span>Strukturbearbeitung ${structureUnlocked ? 'sperren' : 'entsperren'}</span></button>
    </div>`;
  }

  function viewNavigationHTML() {
    const modes = [
      { value: '2d', label: '2D', accessible: '2D-Grundriss' },
      { value: '3d', label: '3D', accessible: '3D-Modell' },
      { value: 'walk', label: 'Begehung', accessible: 'Begehungsansicht', icon: 'Eye' },
    ];
    const modeButtons = modes.map((mode) => {
      const active = viewMode === mode.value;
      return `<button type="button" class="fpe-view-nav__mode${active ? ' is-active' : ''}" id="fpe-view-${mode.value}"
        data-action="view-${mode.value}" data-view-mode="${mode.value}" aria-label="${mode.accessible}"
        title="${mode.accessible}" aria-pressed="${active}" tabindex="${active ? '0' : '-1'}">
        ${mode.icon ? C.icon(mode.icon, 'icon--md') : ''}<span class="fpe-view-nav__label">${mode.label}</span></button>`;
    }).join('');
    return `<div class="fpe-view-nav" role="group" aria-label="Darstellung wechseln">
      <div class="fpe-view-nav__modes">${modeButtons}</div>
    </div>`;
  }

  function viewActionsHTML() {
    const navigationActions = viewMode === '2d'
      ? `${toolButton('zoom-out', 'Verkleinern', 'Minus')}${toolButton('zoom-in', 'Vergrössern', 'Plus')}${toolButton('fit', 'Plan einpassen', 'Compress')}${toolButton('fit-selection', 'Auswahl einpassen', 'Expand', { disabled: !selected })}`
      : `${viewMode === '3d' ? `${toolButton('zoom-out', '3D-Ansicht verkleinern', 'Minus')}${toolButton('zoom-in', '3D-Ansicht vergrössern', 'Plus')}` : ''}${toolButton('three-reset', `${viewMode === 'walk' ? 'Begehung' : '3D-Ansicht'} zurücksetzen`, 'Compress')}`;
    return `<div class="fpe-view-nav__actions" role="toolbar" aria-label="Ansicht navigieren">${navigationActions}</div>`;
  }

  function sceneContentHTML() {
    if (viewMode === '2d') {
      return renderEditorSvg({ floor, rooms: editorDocument.rooms, placements: editorDocument.placements,
        selected, colorMode, camera, measurement, editableRooms: editMode && structureUnlocked,
        roomDraft, placementGhost });
    }
    return `<div class="fpe-three-view${viewMode === 'walk' ? ' is-walk' : ''}">
      <div class="fpe-three-host" id="fpe-three-host"><p class="fpe-three-loading">3D-Modell wird aufgebaut…</p></div>
      ${viewMode === 'walk' ? '<span class="fpe-walk-reticle" aria-hidden="true"></span>' : ''}
    </div>`;
  }

  function stageHTML() {
    const directPan = viewMode === '2d' && (tool === 'pan' || (!editMode && tool === 'select'));
    return `<section class="fpe-stage${directPan ? ' is-pan-ready' : ''}" id="fpe-stage" aria-label="Plan-Arbeitsfläche" tabindex="-1">
      <div id="fpe-toolbar-host"${viewMode === '2d' ? '' : ' class="fpe-toolbar-host--three"'}>${toolbarHTML()}</div>
      <div id="fpe-structure-menu-host">${structureMenuHTML()}</div>
      <div class="fpe-scene${viewMode === '2d' ? '' : ' fpe-scene--three'}" id="fpe-scene">${sceneContentHTML()}</div>
      <div id="fpe-view-nav-host">${viewNavigationHTML()}</div>
      <div id="fpe-view-actions-host">${viewActionsHTML()}</div>
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
        <h3>Geometrie <span>${structureUnlocked ? 'entsperrt' : 'gesperrt'}</span></h3>
        <div class="fpe-form-grid">
          <div class="fpe-field"><label for="fpe-room-x">X (cm)</label><input id="fpe-room-x" class="input--outline input--sm" type="number" min="0" step="10" data-room-geometry="x" value="${Math.round(roomX)}"${structureUnlocked ? '' : ' disabled'}></div>
          <div class="fpe-field"><label for="fpe-room-y">Y (cm)</label><input id="fpe-room-y" class="input--outline input--sm" type="number" min="0" step="10" data-room-geometry="y" value="${Math.round(roomY)}"${structureUnlocked ? '' : ' disabled'}></div>
          <div class="fpe-field"><label for="fpe-room-width">Breite (cm)</label><input id="fpe-room-width" class="input--outline input--sm" type="number" min="100" step="10" data-room-geometry="width" value="${Math.round(roomWidth)}"${structureUnlocked ? '' : ' disabled'}></div>
          <div class="fpe-field"><label for="fpe-room-height">Tiefe (cm)</label><input id="fpe-room-height" class="input--outline input--sm" type="number" min="100" step="10" data-room-geometry="height" value="${Math.round(roomHeight)}"${structureUnlocked ? '' : ' disabled'}></div>
        </div>
        <p class="small muted m-0">${structureUnlocked ? 'Kanten im Plan ziehen oder Werte eingeben. Zugeordnete Objekte müssen innerhalb der Fläche bleiben.' : 'Im Strukturmenü entsperren, um Raumkanten und Geometriewerte zu bearbeiten.'}</p>
        ${localRoom ? `<button class="btn btn--outline btn--sm" type="button" data-action="delete-room"${structureUnlocked ? '' : ' disabled'}>${C.icon('Trash', 'btn__icon')}<span class="btn__text">Neue Fläche entfernen</span></button>` : ''}
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
    return `<div class="fpe-app${editMode ? ' is-editing' : ''}${editMode && !structureUnlocked ? ' is-structure-locked' : ''}${leftOpen ? ' has-left' : ''}${rightOpen ? ' has-right' : ''}" id="fpe-app">
      <h1 class="sr-only" tabindex="-1">Plan-Editor — ${C.escape(floor.label)}, ${C.escape(building.name)}</h1>
      ${headerHTML()}
      <div class="fpe-workbench">
        ${leftPanelHTML()}${stageHTML()}${inspectorHTML()}
        <button class="fpe-panel-backdrop" type="button" data-action="close-panels" tabindex="-1" aria-hidden="true" aria-label="Seitenpanel schliessen"></button>
      </div>
      <div id="fpe-color-menu-host">${colorMenuHTML()}</div>
      <div id="fpe-live" class="sr-only" role="status" aria-live="polite">${C.escape(liveText)}</div>
      ${prototypeFooterHTML()}
    </div>`;
  }

  return {
    colorMenuHTML, inspectorHTML, leftPanelHTML, moduleListHTML,
    productListHTML, resourceListHTML, sceneContentHTML, shellHTML,
    structureMenuHTML, toolbarHTML, viewActionsHTML, viewNavigationHTML,
  };
}
