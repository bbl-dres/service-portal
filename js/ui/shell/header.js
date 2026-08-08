// Federal shell: CD-Bund header (top bar + brand row + main nav + mobile drawer)
// and footer. Structure follows app/components/stories/implementation/HtmlStructure.mdx.

import { NAV } from '../../routing/routes.js';
import { core } from '../../core/index.js';
import { session } from '../../core/session.js';
import { icon, escape as escapeHtml, select } from '../../components.js';

// renderHeader() runs again on every login/logout. Each render gets an
// AbortController that removes the previous global document/window/matchMedia
// listeners; otherwise they accumulate (code-review A3).
let shellAbort = null;

// Navy-menu rows (CD anatomy). external → new window + External icon. Do not use
// menu__item--condensed: in CD it is a SEPARATE variant (menu.postcss:87-93) not
// used by navy. Rows carry CD's base padding from the stylesheet
// (review nav/drawer-2).
function navyRow(child) {
  return `<li class="menu__item menu__item--border">
    <a class="menu__item__flex" href="${child.href}"${
      child.external ? ' target="_blank" rel="noopener external"' : ' data-navsub="' + escapeHtml(child.href) + '"'}>
      <span>${escapeHtml(child.label)}</span>
      ${child.external ? icon('External', 'menu__item__icon') : ''}
    </a></li>`;
}

// The service drawer is DERIVED FROM DATA: each domain with at least one
// startable service becomes an expandable branch (CD navy multi-level), whose
// level 2 lists its services.
//
// A manually maintained raw `thema` field previously controlled selection and
// had become stale: office equipment, IT and publishing had real cases but were
// absent from the menu, while procurement and HR would have appeared without a
// single case. Maintained flags drift; derived ones do not. Roughly 30 BBL
// intranet links were removed without replacement because their content lives in
// services (cases) and knowledge/resources (templates, toolkits,
// BKB documents).
function domainsWithStartableServices() {
  const services = core.services().filter((service) => service.type === 'action');
  return (core.ref().domains || []).filter((domain) => services.some((service) => service.domain === domain.key));
}

function serviceDomainBranchRows() {
  return domainsWithStartableServices().map((domain) => branchRow(`dom:${domain.key}`, domain.label)).join('');
}

// Expandable branch button; overview, domains and areas share the same anatomy.
function branchRow(branchKey, label) {
  return `<li class="menu__item menu__item--border">
    <button class="menu__item__flex navy-branch" type="button" data-branch="${escapeHtml(branchKey)}">
      <span>${escapeHtml(label)}</span>${icon('ChevronRight', 'menu__item__icon')}
    </button></li>`;
}

// Registry of navigation branches (children with branchKey, for example
// «Digitalisierung»); fillBranch uses it to find a branch's L2 children.
const NAV_BRANCHES = {};
NAV.forEach(item => (item.children || []).forEach(c => {
  if (c.branchKey) NAV_BRANCHES[c.branchKey] = { label: c.label, children: c.branches || [] };
}));

// Site-owned utilities live in the white brand row (meta-navigation);
// Confederation-wide ones live in the navy top bar (top-bar-navigation).
const META_LINKS = [
  { href: '#/services/sicherheitsvorfall-melden', label: 'Notfall & Vorfälle' },
  // «Hilfe» points to guidance and training; THAT is help content. It previously
  // targeted the knowledge overview, which main navigation simultaneously named
  // knowledge/resources: two names for one page in the same header
  // (design review D16).
  { href: '#/knowledge/guides', label: 'Hilfe' },
];
const TOP_BAR_LINKS = [
  { href: 'https://www.egate.admin.ch/', label: 'eGate', icon: 'External', external: true },
];
const SHOP_CART_KEY = 'bbl_shop_cart_v1';

function shopCartCount() {
  try {
    const rows = JSON.parse(localStorage.getItem(SHOP_CART_KEY) || '[]');
    return Array.isArray(rows)
      ? rows.reduce((n, r) => n + Math.max(0, Number.parseInt(r.qty, 10) || 0), 0)
      : 0;
  } catch { return 0; }
}

function shoppingCartButton() {
  return `<a class="shopping-cart__button" href="#/app/shop/cart" data-shop-cart-button-link>
    <p class="shopping-cart__button-label">Warenkorb</p>
    <div class="shopping-cart__icon-group">
      ${icon('ShoppingCart', 'shopping-cart__icon')}
      <span class="shopping__cart-amount-indicator" data-cart-count-indicator hidden><span data-cart-count>0</span></span>
    </div>
  </a>`;
}

function updateShopCartButton(root = document) {
  const count = shopCartCount();
  root.querySelectorAll('[data-shop-cart-button]').forEach((el) => { el.hidden = false; });
  root.querySelectorAll('[data-shop-cart-button-link]').forEach((el) => {
    el.setAttribute('aria-label', `Warenkorb: Es hat ${count} Artikel in Ihrem Warenkorb.`);
  });
  root.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = String(count); });
  root.querySelectorAll('[data-cart-count-indicator]').forEach((el) => { el.hidden = count <= 0; });
}

function headerHTML() {
  const renderNavMenu = (item, scope) => {
    const menuId = `${scope}-menu__drawer-${item.base}`;
    const drawerClass = scope === 'desktop' ? 'desktop-menu__drawer' : 'mobile-menu__drawer';
    // Drill-down applies to the service drawer (domains + intranet areas) and any
    // drawer with children marked as branches (child.branchKey, for example
    // «Digitalisierung» in the data drawer). Level 0 mixes direct links and
    // branches.
    const hasNavBranch = (item.children || []).some(c => c.branchKey);
    const withBranches = item.base === 'services' || hasNavBranch;
    let level0;
    if (item.base === 'services') {
      // Flat list: the CD drawer has NO intermediate headings. The class
      // `menu__item--title` exists in menu.postcss but no CD component uses it.
      // Level 2 conveys the distinction between staying in the portal and going
      // to the BBL intranet, where external targets carry the External icon.
      level0 = `<ul class="menu navy__level-0">${
        (item.children || []).map(navyRow).join('')}${serviceDomainBranchRows()}</ul>`;
    } else if (hasNavBranch) {
      level0 = `<ul class="menu navy__level-0">${(item.children || [])
        .map(c => c.branchKey ? branchRow('nav:' + c.branchKey, c.label) : navyRow(c)).join('')}</ul>`;
    } else {
      // `childrenFrom: 'topics'` is used only on the services entry handled
      // above; only statically declared children remain.
      level0 = `<ul class="menu navy__level-0">${(item.children || []).map(navyRow).join('')}</ul>`;
    }

    // Drawer title as <h2>, matching CD canonical markup (MainNavigation.vue:41,
    // 62, 85), gives assistive technology structure. Closed drawers are `hidden`,
    // so headings do not burden the page outline; tabindex="-1" remains on the
    // branch title for drill-down focus (review nav/drawer-3).
    const inner = withBranches
      ? `<div class="navy navy--drill" data-level="0">
          <div class="navy__slider">
            <div class="navy__pane" data-pane="0">
              <h2 class="navy__title">${escapeHtml(item.label)}</h2>
              ${level0}
            </div>
            <div class="navy__pane" data-pane="1">
              <button class="navy__back" type="button" data-back>${icon('ChevronLeft', 'icon--sm')}<span>Zurück</span></button>
              <h2 class="navy__title" data-branch-title tabindex="-1"></h2>
              <ul class="menu" data-branch-list></ul>
            </div>
          </div>
        </div>`
      : `<div class="navy">
          <h2 class="navy__title">${escapeHtml(item.label)}</h2>
          ${level0}
        </div>`;

    // CD defines the close button as a desktop element (desktop-menu.postcss:57,
    // «hidden lg:block»). It was previously rendered and merely hidden by CSS in
    // the mobile tree. Omitting it keeps the accessibility tree clean and avoids
    // a desktop-named element in the mobile menu (review nav/mob-3).
    const closeBtn = scope === 'desktop'
      ? `<button class="desktop-menu__close" type="button" data-menu-close="${menuId}" aria-label="${escapeHtml(item.label)} schliessen">
          <span>Schliessen</span>${icon('Cancel', 'icon--sm')}
      </button>`
      : '';
    return `
    <div class="${drawerClass}" id="${menuId}" role="group" aria-label="${escapeHtml(item.label)}" hidden>
      ${closeBtn}
      ${inner}
    </div>`;
  };

  const renderNavItem = (item, scope) => {
    if (item.children?.length || item.childrenFrom) {
      const menuId = `${scope}-menu__drawer-${item.base}`;
      // icon--md rather than --sm: CD's drawer chevron is 20px
      // (navy.postcss:47-51). At 12px the expand affordance was barely visible
      // (item 4.6). Its open rotation comes from the CSS half of item 2.9c.
      const childIcon = scope === 'mobile' ? icon('ChevronSmallRight', 'icon--md') : '';
      return `<li>
        <button class="navy__has-children" type="button" data-nav="${item.base}" data-menu="${menuId}" aria-expanded="false" aria-controls="${menuId}">
          <span>${escapeHtml(item.label)}</span>${childIcon}
        </button>
        ${renderNavMenu(item, scope)}
      </li>`;
    }
    return `<li><a href="${item.path}" data-nav="${item.base}"><span>${escapeHtml(item.label)}</span></a></li>`;
  };

  const desktopNavItems = NAV.map(item => renderNavItem(item, 'desktop')).join('');
  const mobileNavItems = NAV.map(item => renderNavItem(item, 'mobile')).join('');

  const topBarNav = TOP_BAR_LINKS.map(l =>
    `<li><a href="${l.href}"${l.external ? ' target="_blank" rel="noopener external"' : ''}><span>${escapeHtml(l.label)}</span>${icon(l.icon, 'icon--base')}</a></li>`
  ).join('');
  const metaNav = META_LINKS.map(l =>
    `<li><a class="meta-navigation__item" href="${l.href}">${escapeHtml(l.label)}</a></li>`
  ).join('');

  // Authentication state (AGOV / FedLogin). Logged out: one «Anmelden» button.
  // Logged in: name plus «Abmelden». No role/permissions model.
  const user = session.user();
  // Item 4.2: the user icon was `icon--sm` (12px) and looked like a misplaced
  // diacritic beside the text. When logged in, a bare hairline separated the name
  // and «Abmelden», resembling a typo. It now uses CD's md size and a real
  // .separator--vertical. The 44px height comes from item 2.5b.
  const authNav = user
    ? `<li class="meta-navigation__user"><span class="meta-navigation__name">${icon('User', 'icon--md')} ${escapeHtml(user.name)}</span>
        <span class="separator separator--vertical" aria-hidden="true"></span>
        <button type="button" class="meta-navigation__item meta-navigation__auth" onclick="window.__logout && window.__logout()">Abmelden</button></li>`
    // No target: the header does not know the user's intent, so it redraws the
    // current page. Only buttons located WHERE a case would otherwise start carry
    // a target (C.loginGate/accessCard).
    : `<li><button type="button" class="meta-navigation__item meta-navigation__auth" data-login>${icon('User', 'icon--md')} Anmelden</button></li>`;

  // Item 4.11: the control was operable but every option except DE was disabled,
  // opening a list with nothing to choose. A disabled field with one option says
  // the same thing honestly, and its label explains why instead of hiding the
  // reason in a title.
  const langSwitcher = `<div class="language-switcher">${select({
    id: 'lang', label: 'Sprache: Deutsch — weitere Sprachen sind im Prototyp nicht verfügbar',
    hideLabel: true, bare: true, variant: 'negative', size: 'sm', value: 'DE',
    disabled: true, attrs: 'title="Im Prototyp ist nur Deutsch verfügbar"',
    options: ['DE'],
  })}</div>`;

  return `
  <a class="skip-to-content" id="skip-link" href="#main-content">Zum Inhalt springen</a>
  <div class="top-bar">
    <div class="container container--flex">
      <!-- icon--md rather than --base: below 640, the icon is this link's ONLY
           visible affordance (the label is then sr-only, item 2.4). -->
      <a class="top-bar__btn" href="https://www.admin.ch/de/bundesverwaltung" target="_blank" rel="noopener external"><span>Alle Schweizer Bundesbehörden</span>${icon('External', 'icon--md')}</a>
      <div class="top-bar__right">
        <span class="demo-chip" title="Prototyp mit Demo-Daten — Login, Prozess-Engine, Datenkern und Schnittstellen sind simuliert">Prototyp<span class="sr-only"> — Prototyp mit Demo-Daten; Login, Prozess-Engine, Datenkern und Schnittstellen sind simuliert</span></span>
        <nav class="top-bar-navigation" aria-label="Bundesangebote"><ul>${topBarNav}</ul></nav>
        ${langSwitcher}
      </div>
    </div>
  </div>

  <!-- CD deliberately hides the long office name below 480 (logo.postcss:76)
       and compensates with this tinted strip (top-header.postcss:13-31,
       TopHeader.vue:3-8). Without it, the visible brand at 320/390 consisted only
       of «BBL» plus the intranet pill, naming neither office nor product.
       aria-hidden because .logo__title already carries the same accessible text. -->
  <div class="top-header__mobile-title" aria-hidden="true">
    <div class="container">Bundesamt für Bauten und Logistik — Kundenportal</div>
  </div>

  <div class="top-header" id="top-header-id">
    <div class="container container--flex">
      <a class="logo" href="#/">
        <img class="logo__flag" src="assets/swiss-logo-flag.svg" alt="" aria-hidden="true">
        <img class="logo__name" src="assets/swiss-logo-name.svg" alt="" aria-hidden="true">
        <span class="logo__separator" aria-hidden="true"></span>
        <span class="logo-title__container">
          <span class="logo__accronym" aria-hidden="true">BBL</span>
          <span class="logo__title">Bundesamt für Bauten und Logistik <span>Kundenportal</span></span>
        </span>
        <span class="sr-only"> — Startseite</span>
      </a>
      <div class="top-header__right">
        <nav class="meta-navigation meta-navigation--desktop" aria-label="Meta"><ul>${metaNav}${authNav}</ul></nav>
        <div class="top-header__shopping-cart-button-mobile" data-shop-cart-button>
          ${shoppingCartButton()}
        </div>
        <div class="top-header__container-flex">
          <div class="search search--main" id="header-search">
            <div class="search__group">
              <button class="search__button" type="button" id="search-toggle" aria-expanded="false" aria-controls="header-search-form" aria-label="Suche öffnen">
                <span class="search__button__title">Suche</span>${icon('Search', 'icon--lg')}
              </button>
              <form class="search__form" role="search" id="header-search-form" aria-label="Suche auf der Plattform">
                <label class="sr-only" for="global-search">Suche auf der Plattform</label>
                <input type="search" id="global-search" placeholder="Suchen…" autocomplete="off">
                <button class="search__submit" type="submit" aria-label="Suchen">${icon('Search', 'icon--base')}</button>
              </form>
            </div>
          </div>
          <div class="top-header__shopping-cart-button-desktop" data-shop-cart-button>
            ${shoppingCartButton()}
          </div>
          <button class="burger" type="button" id="burger" aria-label="Menü öffnen" aria-expanded="false" aria-controls="mobile-menu-id">
            <span class="burger__icon">
              <span class="burger__bar"></span><span class="burger__bar"></span><span class="burger__bar"></span>
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <div id="desktop-menu" class="desktop-menu">
    <div id="desktop-menu__overlay" class="desktop-menu__overlay hidden" aria-hidden="true"></div>
    <div id="desktop-navigation-id">
      <div class="container container--flex">
        <nav id="main-navigation" class="main-navigation main-navigation--desktop" aria-label="Hauptnavigation">
          <ul>${desktopNavItems}</ul>
        </nav>
      </div>
    </div>
  </div>

  <div id="mobile-menu-id" class="mobile-menu">
    <!-- CD integrates search into the open mobile menu (search--mobile,
         detailPageSimpleMenuV2.vue:19-38): full width at the top of the panel;
         the header search icon is hidden while the menu is open. -->
    <div class="mobile-menu__search">
      <form class="mobile-menu__search-form" id="mobile-search-form" role="search">
        <label class="sr-only" for="mobile-q">Suche auf der Plattform</label>
        <input type="search" id="mobile-q" placeholder="Suchen…" autocomplete="off">
        <button class="btn btn--bare btn--icon-only mobile-menu__search-submit" type="submit" aria-label="Suchen">${icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span></button>
      </form>
    </div>
    <nav class="main-navigation main-navigation--mobile" aria-label="Hauptnavigation Mobil">
      <ul>${mobileNavItems}</ul>
    </nav>
    <nav class="meta-navigation meta-navigation--mobile" aria-label="Meta Mobil"><ul>${metaNav}${authNav}</ul></nav>
    <nav class="top-bar-navigation--mobile" aria-label="Bundesangebote Mobil">
      <ul>
        ${TOP_BAR_LINKS.map(l => `<li><a href="${l.href}" target="_blank" rel="noopener external">${escapeHtml(l.label)}</a></li>`).join('')}
        <li><a href="https://www.admin.ch/de/bundesverwaltung" target="_blank" rel="noopener external">Alle Schweizer Bundesbehörden</a></li>
      </ul>
    </nav>
  </div>

  <div id="breadcrumb" class="breadcrumb container container--flex" hidden>
    <nav class="breadcrumb-navigation" aria-label="Sie sind hier"><ul id="breadcrumb-list"></ul></nav>
  </div>`;
}

export function renderHeader(el) {
  // renderHeader() replaces the complete header on login/logout. If that
  // happens while the mobile drawer is open, the old burger disappears before
  // its close handler can release the page. Normalise the state first and move
  // focus to the equivalent trigger in the new header until the caller selects
  // its final post-login/logout focus target.
  const mobileWasOpen = document.body.classList.contains('body--mobile-menu-is-open');
  const restoreMobileFocus = mobileWasOpen && el.contains(document.activeElement);
  const oldBurger = el.querySelector('#burger');
  if (oldBurger) {
    oldBurger.setAttribute('aria-expanded', 'false');
    oldBurger.setAttribute('aria-label', 'Menü öffnen');
  }
  document.body.classList.remove('body--mobile-menu-is-open');
  const oldMain = document.getElementById('main-content');
  const oldFoot = document.getElementById('main-footer');
  if (oldMain) oldMain.inert = false;
  if (oldFoot) oldFoot.inert = false;

  el.innerHTML = headerHTML();
  if (restoreMobileFocus) el.querySelector('#burger')?.focus({ preventScroll: true });

  // Remove previous global listeners, then start fresh. `signal` is attached to
  // every document/window/matchMedia listener below; element-scoped listeners
  // disappear with replaced innerHTML anyway.
  shellAbort?.abort();
  shellAbort = new AbortController();
  const { signal } = shellAbort;
  updateShopCartButton(el);
  window.__updateShopCart = () => updateShopCartButton(document);
  window.addEventListener('hashchange', () => updateShopCartButton(el), { signal });
  window.addEventListener('shop:cartchange', () => updateShopCartButton(el), { signal });

  // Skip link (CD: <a href="#main-content">): preventDefault keeps the hash router
  // from treating the fragment as a route; set focus explicitly (#main-content
  // carries tabindex="-1").
  el.querySelector('#skip-link').addEventListener('click', (e) => {
    const main = document.getElementById('main-content');
    if (!main) return;
    e.preventDefault();
    main.focus();
    main.scrollIntoView({ block: 'start' });
  });

  // --- Mobile drawer (CD burger + .mobile-menu) ---
  const burger = el.querySelector('#burger');
  const drawer = el.querySelector('#mobile-menu-id');
  const setMobileMenu = (open) => {
    document.body.classList.toggle('body--mobile-menu-is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Menü schliessen' : 'Menü öffnen');
    // Make covered content inert while the drawer is open (WCAG 2.4.3), otherwise
    // ~48 focusable elements remain in tab order behind the overlay.
    const main = document.getElementById('main-content');
    const foot = document.getElementById('main-footer');
    if (main) main.inert = open;
    if (foot) foot.inert = open;
    if (open) {
      // CD slide (global.postcss:34-38): the body moves up by the top-bar height
      // and the mobile title strip collapses. After settling, the header sits at
      // viewport 0 and the drawer starts exactly at its height. CALCULATE rather
      // than measure because getBoundingClientRect during the 700ms transition
      // returned an intermediate state.
      const top = el.querySelector('#top-header-id');
      const bar = el.querySelector('.top-bar');
      if (bar) document.documentElement.style.setProperty('--topbar-h', `${bar.offsetHeight}px`);
      if (top) document.documentElement.style.setProperty('--shell-top', `${top.offsetHeight}px`);
    }
  };
  burger.addEventListener('click', () =>
    setMobileMenu(!document.body.classList.contains('body--mobile-menu-is-open')));
  // Search in the open menu: submit navigates and closes the drawer.
  const mobileSearchForm = el.querySelector('#mobile-search-form');
  if (mobileSearchForm) mobileSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = el.querySelector('#mobile-q').value.trim();
    setMobileMenu(false);
    location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/search';
  });
  drawer.addEventListener('click', (e) => { if (e.target.closest('a')) setMobileMenu(false); });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) setMobileMenu(false); }, { signal });

  // --- Flyout drawers (desktop + mobile) ---
  const menuButtons = Array.from(el.querySelectorAll('[data-menu]'));
  const overlay = el.querySelector('.desktop-menu__overlay');
  const desktopQuery = window.matchMedia('(min-width: 1024px)');
  const setOverlayOpen = (open) => {
    if (!overlay) return;
    overlay.classList.toggle('hidden', !(open && desktopQuery.matches));
  };
  const positionPanel = (button, panel) => {
    if (!desktopQuery.matches) { panel.style.left = ''; panel.style.right = ''; return; }
    const nav = button.closest('.main-navigation');
    if (!nav) return;
    const navRect = nav.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const panelWidth = panel.offsetWidth || 450;
    // CD desktop-menu.postcss:33 (.with-offset): subtract panel padding so the
    // first menu row aligns with the trigger label. Drawer content was previously
    // shifted about 49px right (item 4.9).
    const pad = parseFloat(getComputedStyle(panel).paddingLeft || '0') + 12;
    let left = buttonRect.left - navRect.left - pad;
    if (navRect.left + left < 0) left = -navRect.left;                            // Keep within the viewport.
    if (left + panelWidth > navRect.width - 12) left = Math.max(-navRect.left, navRect.width - panelWidth - 12);
    panel.style.left = `${left}px`;
    panel.style.right = 'auto';
    // Measured height cap (item 4.7): the CSS rule from 2.9d uses --shell-top as
    // an estimate; the real position is available here, so calculate exactly.
    // Otherwise the final entries were unreachable at 1440x800 and 1366x768.
    const rect = panel.getBoundingClientRect();
    panel.style.maxHeight = `${Math.max(240, window.innerHeight - rect.top - 24)}px`;
  };
  const closeNavMenus = (exceptId = '', restoreFocus = false) => {
    let toRestore = null;
    menuButtons.forEach((button) => {
      const panelId = button.getAttribute('aria-controls');
      if (panelId === exceptId) return;
      const panel = el.querySelector(`#${panelId}`);
      if (!panel) return;
      if (button.getAttribute('aria-expanded') === 'true' && panel.contains(document.activeElement)) toRestore = button;
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      button.classList.remove('clicked');
    });
    setOverlayOpen(Boolean(exceptId));
    if (restoreFocus && toRestore) toRestore.focus();
  };
  const setMenuOpen = (button, open) => {
    const panelId = button.getAttribute('aria-controls');
    const panel = el.querySelector(`#${panelId}`);
    if (!panel) return;
    closeNavMenus(open ? panelId : '');
    panel.hidden = !open;
    // Reset drill-down to its top level when opening or closing.
    panel.querySelectorAll('.navy--drill').forEach(d => d.setAttribute('data-level', '0'));
    button.setAttribute('aria-expanded', String(open));
    button.classList.toggle('clicked', open);
    if (open) positionPanel(button, panel);
  };
  menuButtons.forEach((button) => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      setMenuOpen(button, button.getAttribute('aria-expanded') !== 'true');
    });
  });
  el.querySelectorAll('[data-menu-close]').forEach((button) => {
    button.addEventListener('click', () => {
      const panel = el.querySelector(`#${button.dataset.menuClose}`);
      const trigger = panel ? el.querySelector(`[aria-controls="${panel.id}"]`) : null;
      if (trigger) setMenuOpen(trigger, false);
      trigger?.focus();
    });
  });

  // --- Drill-down sub-branches (domain → its services) ---
  const fillBranch = (drill, key) => {
    let title, rows;
    if (key.startsWith('dom:')) {
      // Domain → its startable services. The “show all” action opens the filtered
      // catalogue: the same set with search, sorting and audience filters.
      // Information offerings (`type: info`) are absent from the catalogue and
      // therefore from this branch (docs/sitemap.md §2.3).
      const domainKey = key.slice(4);
      const domain = (core.ref().domains || []).find((entry) => entry.key === domainKey);
      if (!domain) return;
      const services = core.services().filter((service) => service.domain === domainKey && service.type === 'action');
      title = domain.label;
      rows = [{ href: `#/services?topic=${encodeURIComponent(domainKey)}`, label: 'Alle anzeigen' },
        ...services.map((service) => ({ href: `#/services/${encodeURIComponent(service.serviceId)}`, label: service.title }))];
    } else {
      // Navigation branch (for example «Digitalisierung») → internal L2 children.
      const branch = NAV_BRANCHES[key.replace(/^nav:/, '')];
      if (!branch) return;
      title = branch.label;
      rows = branch.children.map((child) => ({ href: child.href, label: child.label }));
    }
    drill.querySelector('[data-branch-title]').textContent = title;
    drill.querySelector('[data-branch-list]').innerHTML = rows.map(navyRow).join('');
    drill.dataset.openBranch = key;
    drill.setAttribute('data-level', '1');
  };
  el.querySelectorAll('.navy-branch').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const drill = btn.closest('.navy--drill');
      fillBranch(drill, btn.getAttribute('data-branch'));
      // Focus the branch heading so screen readers announce which branch was
      // entered rather than a bare back action.
      drill.querySelector('[data-branch-title]')?.focus();
    });
  });
  el.querySelectorAll('[data-back]').forEach(back => {
    back.addEventListener('click', (e) => {
      e.stopPropagation();
      const drill = back.closest('.navy--drill');
      drill.setAttribute('data-level', '0');
      drill.querySelector(`[data-branch="${drill.dataset.openBranch}"]`)?.focus();
    });
  });

  // Clicking a real drawer link closes it. Delegation also covers links inserted
  // by drill-down.
  el.querySelectorAll('.desktop-menu__drawer, .mobile-menu__drawer').forEach((drawer) => {
    drawer.addEventListener('click', (e) => { if (e.target.closest('a')) closeNavMenus(); });
  });
  overlay?.addEventListener('click', () => closeNavMenus());
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // APG: Escape first closes the expanded submenu by one level; only the
    // second Escape closes the flyout.
    const drill = el.querySelector('.navy--drill[data-level="1"]');
    if (drill && drill.offsetParent !== null) {
      drill.setAttribute('data-level', '0');
      drill.querySelector(`[data-branch="${drill.dataset.openBranch}"]`)?.focus();
      return;
    }
    closeNavMenus('', true);                       // Escape restores focus to the trigger
    if (document.body.classList.contains('body--mobile-menu-is-open')) { setMobileMenu(false); burger.focus(); }
  }, { signal });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#main-header .navy__has-children, #main-header .desktop-menu__drawer, #main-header .mobile-menu__drawer')) closeNavMenus();
  }, { signal });
  window.addEventListener('resize', () => {
    const openButton = menuButtons.find(button => button.getAttribute('aria-expanded') === 'true');
    if (!openButton) return;
    const panel = el.querySelector(`#${openButton.getAttribute('aria-controls')}`);
    if (panel) positionPanel(openButton, panel);
    setOverlayOpen(true);
  }, { signal });

  // --- Header search (CD focus search) ---
  const searchWrap = el.querySelector('#header-search');
  const searchToggle = el.querySelector('#search-toggle');
  const searchForm = el.querySelector('#header-search-form');
  const searchInput = el.querySelector('#global-search');
  const openSearch = (open) => {
    // CD's own hook (search.postcss:99-103): below lg, the search field expands
    // into its own row BELOW the header and hides the logo. Otherwise it covered
    // the federal mark (measured overlap 64/173/176px). Item 4.5; related rules
    // came with item 2.8.
    document.body.classList.toggle('body--search-is-open', open);
    searchWrap.classList.toggle('open', open);
    searchToggle.setAttribute('aria-expanded', String(open));
    if (open) setTimeout(() => searchInput.focus(), 60);
  };
  searchToggle.addEventListener('click', () => openSearch(true));
  // Open only through click/keyboard. Focusing alone must not change context
  // (WCAG 3.2.1); there is no longer a focusin opener.
  searchToggle.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSearch(true); } });
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { openSearch(false); searchToggle.focus(); } });
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/search';
    openSearch(false);
  });
  document.addEventListener('click', (e) => {
    if (!searchWrap.classList.contains('open')) return;
    if (e.target.closest('#header-search')) return;
    openSearch(false);
  }, { signal });
}
