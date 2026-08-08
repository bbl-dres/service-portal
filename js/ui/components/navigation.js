import { escape, icon } from './primitives.js';

// CD back button. Anatomy copied from the design system's own detail pages
// (app/pages/detailPressRelease.vue, detailPublicationCatalog.vue):
//   <Btn variant="outline" size="sm" icon="ArrowLeft" iconPos="left"
//        class="btn--back" />
// The visible label is always the back action; `label` names its target for
// screen readers. `.back-link-row` clears the CD float.
export function backLink(href, label) {
  return `<div class="back-link-row"><a class="btn btn--outline btn--sm btn--icon-left btn--back" href="${escape(href)}"${
    label ? ` aria-label="Zurück zu ${escape(label)}"` : ''}>${
    icon('ArrowLeft', 'btn__icon')}<span class="btn__text">Zurück</span></a></div>`;
}

// Horizontal status stepper (CD steps / tenant-portal pipeline): chevron segments
// — done (green, check) · current (primary colour, clock) · open (grey). `steps`
// = [{ label }]; `currentIndex` is the current step index. Scrolls horizontally
// on mobile.
export function pipeline(steps, currentIndex = 0, { label = 'Statusverlauf' } = {}) {
  const seg = (st, i) => {
    const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'todo';
    const glyph = state === 'done' ? icon('Checkmark', 'icon--sm pipeline__glyph')
      : state === 'active' ? icon('Clock', 'icon--sm pipeline__glyph') : '';
    const sr = state === 'done' ? '<span class="sr-only">Erledigt: </span>'
      : state === 'active' ? '<span class="sr-only">Aktueller Schritt: </span>' : '';
    return `<li class="pipeline__step pipeline__step--${state}"${state === 'active' ? ' aria-current="step"' : ''}>${glyph}<span>${sr}${escape(st.label)}</span></li>`;
  };
  // Move aria-label to the wrapper so <ol> remains a pure list and retains list
  // semantics. No more `data-scroll-region`: the strip wraps instead of
  // scrolling, so there is no scroll surface requiring keyboard access.
  return `<div class="pipeline-wrap" role="group" aria-label="${escape(label)}">`
    + `<ol class="pipeline">${steps.map(seg).join('')}</ol></div>`;
}

// CD accordion (accordion.postcss): ul > li > h3 > button (.accordion__title +
// optional .accordion__meta + .accordion__arrow) + .accordion__drawer >
// .accordion__content. `items` = [{ title, meta?, body, open? }]; `title` is
// escaped, while `meta`/`body` are ready HTML. Wired through wireAccordion().
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

// Click wiring for one or more accordions in `root` (aria-expanded + show/hide
// drawer). Replaces toggle logic copied per page.
export function wireAccordion(root) {
  root.querySelectorAll('.accordion__button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      const drawer = root.querySelector('#' + CSS.escape(btn.getAttribute('aria-controls')));
      if (!drawer) return;
      // CD Accordion.js:27-43: animate max-height (300ms ease-out on
      // .accordion__drawer). Apply [hidden] only after `transitionend` so
      // measurement and transition work. `_accSeq` invalidates the completion
      // handler if a quick counter-click reverses direction. With reduced motion,
      // duration is ~0 (tokens.css), but transitionend still fires.
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
// One APG tabs implementation (roving tabindex, click + arrow/Home/End) instead
// of five slightly divergent copies, one without keyboard support (projects).
// `items` = [{ id, label, icon? }]; `id` is a developer slug that also serves as
// selector/ARIA target and is therefore not escaped; `label` is escaped.
//
// tabBar renders only the tab bar. `panelId` links ALL tabs to ONE shared panel
// (single-panel/rerender pattern, for example data portal). Without `panelId`,
// each tab points to its own `${idPrefix}-panel-${id}` (multi-panel pattern; see
// tabPanels).
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

// Multi-panel markup (Pattern A): one .tab__container per tab, inactive ones
// `hidden`. `render(id)` returns ready panel HTML. For the single-panel pattern,
// the caller supplies its own panel and lets wireTabs rerender content.
// `heading: true` prefixes every panel with an sr-only <h2> using the tab label.
// `aria-labelledby` names the panel once focus is inside it. For heading
// navigation (WCAG 2.4.10), tab-only pages previously had no level between <h1>
// and the <h3> elements in panel content.
export function tabPanels({ items, active, idPrefix = 'tab', render, heading = false }) {
  return items.map((t) =>
    `<div class="tab__container" role="tabpanel" id="${idPrefix}-panel-${t.id}"`
    + ` aria-labelledby="${idPrefix}-${t.id}" tabindex="0" data-panel="${t.id}"`
    + `${t.id === active ? '' : ' hidden'}>`
    + `${heading ? `<h2 class="sr-only">${escape(t.label || t.id)}</h2>` : ''}`
    + `${render(t.id)}</div>`).join('');
}

// Wire tab bars in `root`: click + arrow keys/Home/End, roving tabindex, and
// aria-selected. Existing [data-panel] panels switch automatically (Pattern A);
// `onSelect(id)` renders content for single-panel/rerender use (Pattern B).
// `syncHash(id)` optionally mirrors the tab into the hash query. Focus is set by
// querying again after `onSelect`, so it survives a rerender.
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
    // Query again for focus so it survives an onSelect rerender. It stays
    // invisible for mouse clicks (:focus-visible applies only for keyboard),
    // and correct for keyboard roving. No-op when the bar remains unchanged.
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
  // A tab deep-linked through `?tab=` may sit outside the viewport in a scrolling
  // bar, making the bar appear to have no active tab (Item 3.18). `nearest`
  // scrolls only when necessary.
  const cur = root.querySelector('.tab__control--active');
  if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return { activate };
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
    const id = inputId ? ` id="${escape(inputId)}-${key}"` : '';   // Focus restoration (Item 3.3).
    // Real disabled <button>, as in CD PaginationItem.vue. A <span> with
    // aria-label has role=generic (name prohibited) and is unreliable for SR.
    if (disabled) return `<li><button type="button" class="btn btn--outline btn--icon-only" disabled aria-label="${text}">${inner}</button></li>`;
    // Without an `href` builder: local state rather than hash navigation
    // (C.mountDataTable), using the same CD anatomy as <button data-page>.
    return href
      ? `<li><a class="btn btn--outline btn--icon-only"${id} href="${escape(href(target))}" aria-label="${text}">${inner}</a></li>`
      : `<li><button type="button" class="btn btn--outline btn--icon-only"${id} data-page="${target}" aria-label="${text}">${inner}</button></li>`;
  };
  return `
    <nav class="pagination-wrap${align === 'right' ? ' pagination-wrap--right' : ''}" aria-label="${escape(label)}">
      <div class="pagination">
        ${/* ONE name per control (CD Pagination.vue uses exactly one source): the
              sr-only label names the field. An additional aria-label would
              silently override it and could drift. */''}
        <label class="sr-only" for="${inputId}">Seite</label>
        <input id="${inputId}" class="pagination__input input--outline input--base" type="text" inputmode="numeric"
          value="${page}" autocomplete="off">
        <div class="pagination__text">von ${totalPages} Seiten</div>
        <ul class="pagination__items">
          ${control(page - 1, 'Vorherige Seite', 'ChevronLeft', page === 1, 'prev')}
          ${control(page + 1, 'Nächste Seite', 'ChevronRight', page === totalPages, 'next')}
        </ul>
      </div>
    </nav>`;
}

// Wires the editable page field AND the prev/next `<button data-page>` controls
// of a pagination block. `go(target)` navigates. Three explorers previously bound
// buttons themselves through a regex on the German next-page aria-label,
// which would silently break on any rename (design review A3). The data-page
// binding now lives here, and mountDataTable uses the same path.
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

// --- Action menu (kebab dropdown) -------------------------------------------
// Reusable action menu for the dashboard toolbar and every chart card (Superset
// pattern). `items` is a flat list of `{ action, label, icon }` (menu item),
// `{ heading }` (group title), or `{ separator:true }`. Behaviour comes through
// C.wireMenu; `data-action` passes the action to the caller (no inline onclick).
// `menuId` identifies the menu in the shared onAction handler.
export function menu({ menuId, items = [], label = 'Aktionen', align = 'end', triggerIcon = 'More', triggerClass = '' }) {
  const row = (it) => {
    if (it.separator) return '<div class="action-menu__sep" role="separator"></div>';
    if (it.heading) return `<div class="action-menu__heading">${escape(it.heading)}</div>`;
    return `<button type="button" role="menuitem" class="action-menu__item" data-action="${escape(it.action)}" tabindex="-1">`
      + `${it.icon ? icon(it.icon, 'action-menu__icon') : ''}<span>${escape(it.label)}</span></button>`;
  };
  // aria-controls + popup id as in CD Popover.vue:3-9. The trigger names WHAT it
  // opens (menuIds are unique per page; see callers).
  const popupId = `${menuId}-popup`;
  return `<div class="action-menu" data-menu="${escape(menuId)}">
    <button type="button" class="action-menu__trigger interactive-control${triggerClass ? ' ' + triggerClass : ''}" aria-haspopup="true" aria-expanded="false" aria-controls="${escape(popupId)}" aria-label="${escape(label)}" title="${escape(label)}">${icon(triggerIcon, 'icon--base')}</button>
    <div class="action-menu__popup action-menu__popup--${align}" id="${escape(popupId)}" role="menu" aria-label="${escape(label)}" hidden>${items.map(row).join('')}</div>
  </div>`;
}

// One global closer (clicking outside closes open menus), preventing repeated
// wireMenu() calls from accumulating listeners. Uses its own `.action-menu`
// namespace; `.menu` belongs to CD's navigation flyout component.
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

// Wire every .action-menu in `root`: open/close, arrow keys/Home/End, Escape, and
// outside click. On selection → onAction(action, menuId, triggerEl).
export function wireMenu(root, onAction) {
  ensureMenuGlobal();
  root.querySelectorAll('.action-menu').forEach((m) => {
    const trigger = m.querySelector('.action-menu__trigger');
    const popup = m.querySelector('.action-menu__popup');
    const items = [...popup.querySelectorAll('.action-menu__item')];
    const open = () => {
      document.querySelectorAll('.action-menu__popup:not([hidden])').forEach((p) => {
        if (p === popup) return;
        p.hidden = true;
        const oldTrigger = p.closest('.action-menu')?.querySelector('.action-menu__trigger');
        if (oldTrigger) oldTrigger.setAttribute('aria-expanded', 'false');
      });
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
    // APG menu pattern: close when focus leaves the menu (Tab from a menuitem or
    // click on a focusable outside target). Otherwise an open visible menu with
    // aria-expanded="true" remains; the global closer responds only to pointer
    // clicks. No preventDefault, so focus proceeds naturally (relatedTarget null
    // means the target cannot receive focus → close).
    m.addEventListener('focusout', (e) => {
      if (popup.hidden) return;
      if (!m.contains(e.relatedTarget)) close(false);
    });
  });
}
