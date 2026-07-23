// Federal shell: CD-Bund header (top bar + brand row + main nav + mobile drawer)
// and footer. Structure follows app/components/stories/implementation/HtmlStructure.mdx.

import { NAV } from './router.js';
import { core } from './core.js';
import { session } from './session.js';
import { INTRANET_AREAS } from './intranet-areas.js';
import { icon, escape as escapeHtml, select } from './components.js';

// Zeilen eines navy-Menüs (CD-Anatomie). external → neues Fenster + External-Icon.
function navyRow(child) {
  return `<li class="menu__item menu__item--border menu__item--condensed">
    <a class="menu__item__flex" href="${child.href}"${
      child.external ? ' target="_blank" rel="noopener external"' : ' data-navsub="' + escapeHtml(child.href) + '"'}>
      <span>${escapeHtml(child.label)}</span>
      ${icon(child.external ? 'External' : 'ArrowAngleBottomLeft', 'menu__item__icon')}
    </a></li>`;
}

// Drill-down-Unterzweige für den Dienstleistungen-Drawer (CD navy multi-level):
// die fünf Intranet-Aufgabenbereiche als aufklappbare Zweige. Level 1 wird beim
// Klick befüllt (js/shell.js renderHeader), die Kinder stammen aus INTRANET_AREAS.
function areaBranchRows() {
  return INTRANET_AREAS.map(a => `<li class="menu__item menu__item--border menu__item--condensed">
    <button class="menu__item__flex navy-branch" type="button" data-branch="${escapeHtml(a.key)}" aria-haspopup="true">
      <span>${escapeHtml(a.label)}</span>${icon('ChevronRight', 'menu__item__icon')}
    </button></li>`).join('');
}

// Some nav items take their children from the data core (loaded before the shell
// renders), so the menu always matches the catalogue.
function resolveChildren(item) {
  if (item.childrenFrom !== 'themen') return item.children || [];
  const services = core.services();
  const themen = (core.ref().domains || [])
    .filter(d => services.some(s => s.domain === d.key))
    .map(d => ({ href: `#/services?topic=${encodeURIComponent(d.key)}`, label: d.label }));
  return [...(item.children || []), ...themen];
}

// Site-owned utilities live in the white brand row (meta-navigation);
// Confederation-wide ones live in the navy top bar (top-bar-navigation).
const META_LINKS = [
  { href: '#/services/sicherheitsvorfall-melden', label: 'Notfall & Vorfälle' },
  { href: '#/knowledge', label: 'Hilfe' },
];
const TOP_BAR_LINKS = [
  { href: 'https://www.egate.admin.ch/', label: 'eGate', icon: 'External', external: true },
];

function headerHTML() {
  const renderNavMenu = (item, scope) => {
    const menuId = `${scope}-menu__drawer-${item.base}`;
    const drawerClass = scope === 'desktop' ? 'desktop-menu__drawer' : 'mobile-menu__drawer';
    // Nur der Dienstleistungen-Drawer bekommt die Drill-down-Unterzweige.
    const withBranches = item.base === 'services';
    const level0 = `
      <ul class="menu navy__level-0">${resolveChildren(item).map(navyRow).join('')}</ul>
      ${withBranches ? `
        <p class="navy__group-title">Bestellen und weitere Angebote</p>
        <ul class="menu">${areaBranchRows()}</ul>` : ''}`;

    const inner = withBranches
      ? `<div class="navy navy--drill" data-level="0">
          <div class="navy__slider">
            <div class="navy__pane" data-pane="0">
              <h2 class="navy__title">${escapeHtml(item.label)}</h2>
              ${level0}
            </div>
            <div class="navy__pane" data-pane="1">
              <button class="navy__back" type="button" data-back>${icon('ChevronLeft', 'icon--sm')}<span>Zurück</span></button>
              <h2 class="navy__title" data-branch-title></h2>
              <ul class="menu" data-branch-list></ul>
            </div>
          </div>
        </div>`
      : `<div class="navy">
          <h2 class="navy__title">${escapeHtml(item.label)}</h2>
          ${level0}
        </div>`;

    return `
    <div class="${drawerClass}" id="${menuId}" aria-label="${escapeHtml(item.label)}" hidden>
      <button class="desktop-menu__close" type="button" data-menu-close="${menuId}" aria-label="${escapeHtml(item.label)} schliessen">
          <span>Schliessen</span>${icon('Cancel', 'icon--sm')}
      </button>
      ${inner}
    </div>`;
  };

  const renderNavItem = (item, scope) => {
    if (item.children?.length || item.childrenFrom) {
      const menuId = `${scope}-menu__drawer-${item.base}`;
      const childIcon = scope === 'mobile' ? icon('ChevronSmallRight', 'icon--sm') : '';
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

  // Anmeldestatus (AGOV / FedLogin). Abgemeldet: ein «Anmelden»-Knopf.
  // Angemeldet: Name plus «Abmelden». Kein Rollen-/Rechtekonzept.
  const user = session.user();
  const authNav = user
    ? `<li class="meta-navigation__user"><span class="meta-navigation__name">${icon('User', 'icon--sm')} ${escapeHtml(user.name)}</span>
        <button type="button" class="meta-navigation__item meta-navigation__auth" onclick="window.__logout && window.__logout()">Abmelden</button></li>`
    : `<li><button type="button" class="meta-navigation__item meta-navigation__auth" onclick="window.__login && window.__login()">${icon('User', 'icon--sm')} Anmelden</button></li>`;

  const langSwitcher = `<div class="language-switcher">${select({
    id: 'lang', label: 'Sprache wählen — im Prototyp nur Deutsch', hideLabel: true,
    bare: true, variant: 'negative', size: 'sm', value: 'DE',
    options: ['DE', { value: 'FR', label: 'FR', disabled: true }, { value: 'IT', label: 'IT', disabled: true },
              { value: 'RM', label: 'RM', disabled: true }, { value: 'EN', label: 'EN', disabled: true }],
  })}</div>`;

  return `
  <button type="button" class="skip-to-content" id="skip-link">Zum Inhalt springen</button>
  <div class="top-bar">
    <div class="container container--flex">
      <a class="top-bar__btn" href="https://www.admin.ch/de/bundesverwaltung" target="_blank" rel="noopener external"><span>Alle Schweizer Bundesbehörden</span>${icon('External', 'icon--base')}</a>
      <div class="top-bar__right">
        <span class="demo-chip" title="Prototyp mit Demo-Daten — Login, Prozess-Engine, Datenkern und Schnittstellen sind simuliert">Prototyp<span class="sr-only"> — Prototyp mit Demo-Daten; Login, Prozess-Engine, Datenkern und Schnittstellen sind simuliert</span></span>
        <nav class="top-bar-navigation" aria-label="Bundesangebote"><ul>${topBarNav}</ul></nav>
        ${langSwitcher}
      </div>
    </div>
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
        <div class="top-header__container-flex">
          <div class="search search--main" id="header-search">
            <div class="search__group">
              <button class="search__button" type="button" id="search-toggle" aria-expanded="false" aria-controls="header-search-form" aria-label="Suche öffnen">
                <span class="search__button__title">Suche</span>${icon('Search', 'icon--lg')}
              </button>
              <form class="search__form" role="search" id="header-search-form" aria-label="Suche auf der Plattform">
                <label class="sr-only" for="global-search">Suche auf der Plattform</label>
                <input type="search" id="global-search" placeholder="Suche…" autocomplete="off">
                <button class="search__submit" type="submit" aria-label="Suchen">${icon('Search', 'icon--base')}</button>
              </form>
            </div>
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

function footerHTML() {
  const fLink = (href, label, ext) =>
    `<a class="footer__link footer-information__link--icon-right" href="${href}"${ext ? ' target="_blank" rel="noopener external"' : ''}>${icon(ext ? 'External' : 'ArrowRight', 'footer-information__icon')}${escapeHtml(label)}</a>`;

  return `
  <div class="bg--secondary-600">
    <div class="container">
      <div class="footer-information">
        <div class="footer-information__entry">
          <h3>Bundesamt für Bauten und Logistik BBL</h3>
          <p class="small">Das Kundenportal bündelt Dienstleistungen, Anwendungen, Dokumente und Daten des BBL an einem Ort. Dies ist ein <strong>Prototyp mit Demo-Daten</strong>.</p>
          <p class="small">Fellerstrasse 21, 3003 Bern</p>
        </div>
        <div class="footer-information__entry">
          <h3>Prototyp</h3>
          <div class="footer-information__links">
            <div class="footer-information__links-column">
              ${fLink('https://github.com/bbl-dres/service-portal', 'Quellcode auf GitHub', true)}${fLink('https://www.bk.admin.ch/de/webauftritt-der-bundesverwaltung', 'Webauftritt der Bundesverwaltung', true)}
            </div>
          </div>
        </div>
        <div class="footer-information__entry footer-information__entry--big">
          <h3>Weitere Informationen</h3>
          <div class="footer-information__links">
            <div class="footer-information__links-column">
              ${fLink('#/knowledge', 'Wissen & Weisungen')}${fLink('#/applications', 'Anwendungen')}${fLink('#/data', 'Datenkatalog')}
            </div>
            <div class="footer-information__links-column">
              ${fLink('#/my-cases', 'Meine Vorgänge')}${fLink('#/services/sicherheitsvorfall-melden', 'Notfall & Vorfälle')}${fLink('#/services', 'Dienstleistungen')}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="bg--secondary-700">
    <nav class="container" aria-label="Rechtliches">
      <ul class="footer-navigation">
        <li><a class="footer__link" href="https://www.admin.ch/gov/de/start/rechtliches/impressum.html" target="_blank" rel="noopener external">Impressum</a></li>
        <li><a class="footer__link" href="https://www.admin.ch/gov/de/start/rechtliches.html" target="_blank" rel="noopener external">Rechtliches</a></li>
        <li><a class="footer__link" href="https://www.admin.ch/gov/de/start/rechtliches/datenschutzerklaerung.html" target="_blank" rel="noopener external">Datenschutz</a></li>
        <li><a class="footer__link" href="https://www.admin.ch/gov/de/start/rechtliches/barrierefreiheit-bund.html" target="_blank" rel="noopener external">Barrierefreiheit</a></li>
      </ul>
    </nav>
  </div>`;
}

function renderHeader(el) {
  el.innerHTML = headerHTML();

  // Skip link: move focus rather than navigate, so the router never sees the fragment.
  el.querySelector('#skip-link').addEventListener('click', () => {
    const main = document.getElementById('main-content');
    if (!main) return;
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
    if (open) {
      // the drawer starts below the shell; measure it rather than hard-coding
      const top = el.querySelector('#top-header-id');
      if (top) document.documentElement.style.setProperty('--shell-top', `${top.getBoundingClientRect().bottom}px`);
    }
  };
  burger.addEventListener('click', () =>
    setMobileMenu(!document.body.classList.contains('body--mobile-menu-is-open')));
  drawer.addEventListener('click', (e) => { if (e.target.closest('a')) setMobileMenu(false); });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) setMobileMenu(false); });

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
    let left = buttonRect.left - navRect.left;
    if (left + panelWidth > navRect.width - 12) left = Math.max(12, navRect.width - panelWidth - 12);
    panel.style.left = `${left}px`;
    panel.style.right = 'auto';
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
    // Beim Öffnen/Schliessen den Drill-down wieder auf die oberste Ebene setzen.
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

  // --- Drill-down-Unterzweige (Dienstleistungen → Intranet-Bereiche) ---
  const fillBranch = (drill, key) => {
    const a = INTRANET_AREAS.find(x => x.key === key);
    if (!a) return;
    const rows = [{ href: a.overview, label: 'Übersicht', external: true },
      ...(a.children || []).map(c => ({ href: c.href, label: c.label, external: true }))];
    drill.querySelector('[data-branch-title]').textContent = a.label;
    drill.querySelector('[data-branch-list]').innerHTML = rows.map(navyRow).join('');
    drill.dataset.openBranch = key;
    drill.setAttribute('data-level', '1');
  };
  el.querySelectorAll('.navy-branch').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const drill = btn.closest('.navy--drill');
      fillBranch(drill, btn.getAttribute('data-branch'));
      drill.querySelector('[data-back]')?.focus();
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

  // Ein Klick auf einen echten Link im Drawer schliesst ihn (Delegation, damit
  // auch die per Drill-down nachgeladenen Links erfasst werden).
  el.querySelectorAll('.desktop-menu__drawer, .mobile-menu__drawer').forEach((drawer) => {
    drawer.addEventListener('click', (e) => { if (e.target.closest('a')) closeNavMenus(); });
  });
  overlay?.addEventListener('click', () => closeNavMenus());
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeNavMenus('', true);                       // Escape restores focus to the trigger
    if (document.body.classList.contains('body--mobile-menu-is-open')) { setMobileMenu(false); burger.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#main-header .navy__has-children, #main-header .desktop-menu__drawer, #main-header .mobile-menu__drawer')) closeNavMenus();
  });
  window.addEventListener('resize', () => {
    const openButton = menuButtons.find(button => button.getAttribute('aria-expanded') === 'true');
    if (!openButton) return;
    const panel = el.querySelector(`#${openButton.getAttribute('aria-controls')}`);
    if (panel) positionPanel(openButton, panel);
    setOverlayOpen(true);
  });

  // --- Header search (CD focus search) ---
  const searchWrap = el.querySelector('#header-search');
  const searchToggle = el.querySelector('#search-toggle');
  const searchForm = el.querySelector('#header-search-form');
  const sinput = el.querySelector('#global-search');
  const openSearch = (open) => {
    searchWrap.classList.toggle('open', open);
    searchToggle.setAttribute('aria-expanded', String(open));
    if (open) setTimeout(() => sinput.focus(), 60);
  };
  searchToggle.addEventListener('click', () => openSearch(true));
  searchWrap.addEventListener('focusin', () => { if (!searchWrap.classList.contains('open')) openSearch(true); });
  sinput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { openSearch(false); searchToggle.focus(); } });
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = sinput.value.trim();
    location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/search';
    openSearch(false);
  });
  document.addEventListener('click', (e) => {
    if (!searchWrap.classList.contains('open')) return;
    if (e.target.closest('#header-search')) return;
    openSearch(false);
  });
}

function renderFooter(el) { el.innerHTML = footerHTML(); }

export const shell = { renderHeader, renderFooter };
export default shell;
