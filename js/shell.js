// Federal shell: CD-Bund header (confederation bar + brand row + main nav) and footer.

import { NAV } from './router.js';
import { icon, escape as escapeHtml } from './components.js';

function headerHTML() {
  const currentHash = location.hash || '#/';
  const isActiveSub = (href) => currentHash === href || currentHash.startsWith(`${href}?`) || currentHash.startsWith(`${href}/`);
  const renderNavMenu = (item, scope) => {
    const menuId = scope === 'desktop' ? 'desktop-menu__drawer' : `mobile-menu__drawer-${item.base}`;
    const drawerClass = scope === 'desktop' ? 'desktop-menu__drawer' : 'mobile-menu__drawer';
    const closeId = scope === 'desktop' ? ' id="desktop-menu-closer"' : '';
    return `
    <div class="${drawerClass}" id="${menuId}" role="region" aria-label="${escapeHtml(item.label)}" hidden>
      <button${closeId} class="desktop-menu__close" type="button" data-menu-close="${menuId}" aria-label="${escapeHtml(item.label)} schliessen">
          <span>Schliessen</span>${icon('Cancel', 'icon--sm')}
      </button>
      <div class="navy">
        <ul class="navy__level-0">
          <li><h2 class="navy__title">${escapeHtml(item.label)}</h2></li>
          ${(item.children || []).map(child => {
            const active = isActiveSub(child.href);
            return `
            <li>
              <a class="${active ? 'active' : ''}" href="${child.href}">
                <span class="menu__item__text">
                  <span class="menu__item__label">${escapeHtml(child.label)}</span>
                  ${child.desc ? `<span class="menu__item__description">${escapeHtml(child.desc)}</span>` : ''}
                </span>
                ${active ? '' : icon('ArrowRight', 'icon--sm')}
              </a>
            </li>`;
          }).join('')}
        </ul>
      </div>
    </div>`;
  };

  const renderNavItem = (item, scope) => {
    if (item.children?.length) {
      const menuId = scope === 'desktop' ? 'desktop-menu__drawer' : `mobile-menu__drawer-${item.base}`;
      const childIcon = scope === 'mobile' ? icon('ChevronSmallRight', 'icon--sm') : '';
      return `<li>
        <button class="navy__has-children" type="button" data-nav="${item.base}" data-menu="${menuId}" aria-expanded="false" aria-haspopup="menu" aria-controls="${menuId}">
          <span>${escapeHtml(item.label)}</span>${childIcon}
        </button>
        ${renderNavMenu(item, scope)}
      </li>`;
    }
    return `<li><a href="${item.path}" data-nav="${item.base}"><span>${escapeHtml(item.label)}</span></a></li>`;
  };

  const desktopNavItems = NAV.map(item => renderNavItem(item, 'desktop')).join('');
  const mobileNavItems = NAV.map(item => renderNavItem(item, 'mobile')).join('');

  return `
  <a href="#main-content" class="skip-to-content skip-link">Zum Inhalt springen</a>
  <div class="top-bar">
    <div class="container container--flex">
      <a class="top-bar__btn" href="https://www.admin.ch/de/bundesverwaltung" target="_blank" rel="noopener"><span>Alle Schweizer Bundesbehörden</span>${icon('External', 'icon--sm')}</a>
      <div class="top-bar__right">
        <span class="demo-chip" role="status" aria-label="Prototyp mit Demo-Daten — Login, Prozess-Engine, Datenkern und Schnittstellen sind simuliert">Prototyp</span>
        <a href="#/services/sicherheitsvorfall-melden" title="Notfall &amp; Vorfälle">${icon('WarningCircle', 'icon--sm')} Notfall</a>
        <a href="https://www.egate.admin.ch/" target="_blank" rel="noopener" title="eGate (extern, Demo)">eGate ${icon('External', 'icon--sm')}</a>
        <label class="sr-only" for="lang">Sprache wählen</label>
        <select class="lang-select" id="lang" title="Nur DE im Prototyp">
          <option selected>DE</option><option>FR</option><option>IT</option><option disabled>RM</option><option>EN</option>
        </select>
      </div>
    </div>
  </div>

  <div class="top-header">
    <div class="container container--flex">
      <a class="logo" href="#/" aria-label="Startseite — Bundesamt für Bauten und Logistik">
        <img class="logo__flag" src="assets/swiss-logo-flag.svg" alt="" aria-hidden="true">
        <img class="logo__name" src="assets/swiss-logo-name.svg" alt="Schweizerische Eidgenossenschaft" aria-hidden="true">
        <span class="logo__sep" aria-hidden="true"></span>
        <span class="logo__title">Bundesamt für Bauten und Logistik <span>Service-Plattform</span></span>
      </a>
      <div class="top-header__right">
        <div class="search--main" id="header-search">
          <button class="search__toggle" type="button" id="search-toggle" aria-expanded="false" aria-controls="header-search-form" aria-label="Suche öffnen">
            <span class="label">Suche</span>${icon('Search', 'icon--lg')}
          </button>
          <form class="search__form" role="search" id="header-search-form">
            <label class="sr-only" for="global-search">Suche auf der Plattform</label>
            <input type="search" id="global-search" placeholder="Suche…" autocomplete="off">
            <button class="search__submit" type="submit" aria-label="Suchen">${icon('Search', 'icon--sm')}</button>
          </form>
        </div>
      </div>
    </div>
  </div>

  <div id="desktop-menu" class="desktop-menu">
    <div id="desktop-menu__overlay" class="desktop-menu__overlay hidden" aria-hidden="true"></div>
    <div id="desktop-navigation-id">
      <div class="container container--flex">
        <nav id="main-navigation" class="main-navigation main-navigation--desktop" aria-label="Hauptnavigation">
      <button class="nav-toggle" id="nav-toggle" aria-expanded="false">${icon('Apps', 'icon--sm')} Menü</button>
          <ul>${desktopNavItems}</ul>
        </nav>
      </div>
    </div>
  </div>

  <div id="mobile-menu-id" class="mobile-menu">
    <div class="container">
      <button class="nav-toggle" id="nav-toggle-mobile" aria-expanded="false" aria-controls="main-navigation-mobile-list">${icon('Apps', 'icon--sm')} Menu</button>
      <nav id="main-navigation-mobile" class="main-navigation main-navigation--mobile" aria-label="Hauptnavigation Mobil">
        <ul id="main-navigation-mobile-list">${mobileNavItems}</ul>
      </nav>
    </div>
  </div>

  <div id="breadcrumb-wrap" class="breadcrumb container container--flex" hidden>
    <nav aria-label="Sie sind hier"><ol id="breadcrumb"></ol></nav>
    <div id="breadcrumb__drawer" class="breadcrumb__drawer" hidden></div>
  </div>`;
}

function footerHTML() {
  return `
  <div class="footer-information">
    <div class="container">
      <div class="grid grid--3">
        <div class="footer-information__entry">
          <h3>Bundesamt für Bauten und Logistik BBL</h3>
          <p class="small">Die Service-Plattform bündelt Dienstleistungen, Anwendungen, Dokumente und Daten des BBL an einem Ort. Dies ist ein <strong>Prototyp mit Demo-Daten</strong>.</p>
          <p class="small">Fellerstrasse 21, 3003 Bern</p>
        </div>
        <div class="footer-information__entry">
          <h3>Weitere Informationen</h3>
          <ul style="list-style:none">
            <li><a href="#/knowledge">Wissen &amp; Weisungen</a></li>
            <li><a href="#/applications">Anwendungen</a></li>
            <li><a href="#/data">Datenkatalog</a></li>
            <li><a href="#/my-cases">Meine Vorgänge</a></li>
          </ul>
        </div>
        <div class="footer-information__entry">
          <h3>Bleiben Sie informiert</h3>
          <ul style="list-style:none">
            <li><a href="https://www.instagram.com/bundesbauten/" target="_blank" rel="noopener">Instagram ${icon('External', 'icon--sm')}</a></li>
            <li><a href="#/services/sicherheitsvorfall-melden">Notfall &amp; Vorfälle</a></li>
            <li><a href="#">Kontakt</a></li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  <div class="footer-navigation">
    <nav class="container" aria-label="Rechtliches">
      <ul>
        <li><a href="https://www.admin.ch/gov/de/start/rechtliches/impressum.html" target="_blank" rel="noopener">Impressum</a></li>
        <li><a href="https://www.admin.ch/gov/de/start/rechtliches.html" target="_blank" rel="noopener">Rechtliches</a></li>
        <li><a href="https://www.admin.ch/gov/de/start/rechtliches/datenschutzerklaerung.html" target="_blank" rel="noopener">Datenschutz</a></li>
        <li><a href="https://www.admin.ch/gov/de/start/rechtliches/barrierefreiheit-bund.html" target="_blank" rel="noopener">Barrierefreiheit</a></li>
      </ul>
    </nav>
  </div>`;
}

function renderHeader(el) {
  el.innerHTML = headerHTML();
  // mobile nav
  const toggle = el.querySelector('#nav-toggle-mobile');
  const list = el.querySelector('#main-navigation-mobile-list');
  toggle.addEventListener('click', () => {
    const open = list.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  list.addEventListener('click', (e) => { if (e.target.closest('a')) list.classList.remove('open'); });

  const menuButtons = Array.from(el.querySelectorAll('[data-menu]'));
  const overlay = el.querySelector('.desktop-menu__overlay');
  const desktopQuery = window.matchMedia('(min-width: 1024px)');
  const setOverlayOpen = (open) => {
    if (!overlay) return;
    if (open) {
      const menu = el.querySelector('#desktop-menu');
      if (menu) overlay.style.top = `${menu.getBoundingClientRect().bottom}px`;
    }
    overlay.classList.toggle('hidden', !(open && desktopQuery.matches));
  };
  const positionPanel = (button, panel) => {
    if (!desktopQuery.matches) {
      panel.style.left = '';
      panel.style.right = '';
      return;
    }
    const nav = button.closest('.main-navigation');
    if (!nav) return;
    const navRect = nav.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const panelWidth = panel.offsetWidth || 480;
    let left = buttonRect.left - navRect.left;
    if (left + panelWidth > navRect.width - 12) {
      left = Math.max(12, navRect.width - panelWidth - 12);
    }
    panel.style.left = `${left}px`;
    panel.style.right = 'auto';
  };
  const closeNavMenus = (exceptId = '') => {
    menuButtons.forEach((button) => {
      const panelId = button.getAttribute('aria-controls');
      if (panelId === exceptId) return;
      const panel = el.querySelector(`#${panelId}`);
      if (!panel) return;
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      button.classList.remove('clicked');
    });
    setOverlayOpen(Boolean(exceptId));
  };
  const setMenuOpen = (button, open) => {
    const panelId = button.getAttribute('aria-controls');
    const panel = el.querySelector(`#${panelId}`);
    if (!panel) return;
    closeNavMenus(open ? panelId : '');
    panel.hidden = !open;
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
  el.querySelectorAll('.desktop-menu__drawer a, .mobile-menu__drawer a').forEach((link) => {
    link.addEventListener('click', () => closeNavMenus());
  });
  overlay?.addEventListener('click', () => closeNavMenus());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNavMenus();
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
  // Header search — CD focus search: collapsed magnifier, expand on click.
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
  sinput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { openSearch(false); searchToggle.focus(); } });
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = sinput.value.trim();
    location.hash = q ? `#/services?q=${encodeURIComponent(q)}` : '#/services';
    openSearch(false);
  });
  document.addEventListener('click', (e) => {
    if (!searchWrap.classList.contains('open')) return;
    if (e.target.closest('#header-search')) return;
    openSearch(false);
  });
  // language dropdown (stub — DE only in prototype)
  el.querySelector('#lang').addEventListener('change', (e) => { e.target.value = 'DE'; });
}

function renderFooter(el) { el.innerHTML = footerHTML(); }

export const shell = { renderHeader, renderFooter };
export default shell;
