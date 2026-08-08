// Federal shell: CD-Bund header (top bar + brand row + main nav + mobile drawer)
// and footer. Structure follows app/components/stories/implementation/HtmlStructure.mdx.

import { NAV } from './router.js';
import { core } from './core.js';
import { session } from './session.js';
import { icon, escape as escapeHtml, select } from './components.js';

// renderHeader() läuft bei jedem Login/Logout erneut. Pro Render ein
// AbortController, der die globalen document/window/matchMedia-Listener der
// Vorrunde abbricht — sonst akkumulieren sie (code-review A3).
let shellAbort = null;

// Zeilen eines navy-Menüs (CD-Anatomie). external → neues Fenster + External-Icon.
// Kein menu__item--condensed: der Modifier ist in CD eine EIGENE Variante
// (menu.postcss:87-93), die navy nicht verwendet — die Zeilen tragen CDs
// Basis-Polsterung aus dem Blatt (Review nav/drawer-2).
function navyRow(child) {
  return `<li class="menu__item menu__item--border">
    <a class="menu__item__flex" href="${child.href}"${
      child.external ? ' target="_blank" rel="noopener external"' : ' data-navsub="' + escapeHtml(child.href) + '"'}>
      <span>${escapeHtml(child.label)}</span>
      ${child.external ? icon('External', 'menu__item__icon') : ''}
    </a></li>`;
}

// Der Dienstleistungs-Drawer wird AUS DEN DATEN abgeleitet: jedes Thema mit
// mindestens einer startbaren Dienstleistung wird ein aufklappbarer Zweig
// (CD navy multi-level), Level 2 listet dessen Dienstleistungen.
//
// Vorher steuerte ein handgepflegtes Feld `thema` die Auswahl — und war
// veraltet: Büroausrüstung, Informatik und Publizieren trugen echte Vorgänge,
// standen aber nicht im Menü, während Beschaffung und Personal ohne einen
// einzigen Vorgang gelistet gewesen wären. Eine Kennzeichnung, die man pflegen
// muss, driftet; eine abgeleitete kann es nicht. Die ~30 Links ins BBL-Intranet
// sind ersatzlos entfallen — ihr Inhalt liegt in «Dienstleistungen» (Vorgänge)
// und «Wissen und Hilfsmittel» (Vorlagen, Werkzeugkasten, BKB-Dokumente).
function themenMitVorgaengen() {
  const svcs = core.services().filter(s => s.type === 'action');
  return (core.ref().domains || []).filter(d => svcs.some(s => s.domain === d.key));
}

function themaBranchRows() {
  return themenMitVorgaengen().map(d => branchRow(`dom:${d.key}`, d.label)).join('');
}

// Ein aufklappbarer Zweig-Knopf (Übersicht/Themen/Bereiche teilen dieselbe Anatomie).
function branchRow(branchKey, label) {
  return `<li class="menu__item menu__item--border">
    <button class="menu__item__flex navy-branch" type="button" data-branch="${escapeHtml(branchKey)}">
      <span>${escapeHtml(label)}</span>${icon('ChevronRight', 'menu__item__icon')}
    </button></li>`;
}

// Registry der nav-Zweige (Kinder mit branchKey, z. B. «Digitalisierung») —
// fillBranch schlägt darüber die L2-Kinder eines Zweigs nach.
const NAV_BRANCHES = {};
NAV.forEach(item => (item.children || []).forEach(c => {
  if (c.branchKey) NAV_BRANCHES[c.branchKey] = { label: c.label, children: c.branches || [] };
}));

// Site-owned utilities live in the white brand row (meta-navigation);
// Confederation-wide ones live in the navy top bar (top-bar-navigation).
const META_LINKS = [
  { href: '#/services/sicherheitsvorfall-melden', label: 'Notfall & Vorfälle' },
  // «Hilfe» zeigt auf die Anleitungen und Schulungen — DAS ist Hilfe-Inhalt.
  // Vorher zielte der Eintrag auf die Wissens-Übersicht, die in der Haupt-
  // navigation gleichzeitig «Wissen und Hilfsmittel» hiess: zwei Namen für
  // dieselbe Seite im selben Header (Design-Review D16).
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
    // Drill-down bekommen: der Dienstleistungen-Drawer (Themen + Intranet-Bereiche)
    // sowie jeder Drawer mit als Zweig markierten Kindern (child.branchKey, z. B.
    // «Digitalisierung» im Daten-Drawer). Ebene 0 mischt Direktlinks und Zweige.
    const hasNavBranch = (item.children || []).some(c => c.branchKey);
    const withBranches = item.base === 'services' || hasNavBranch;
    let level0;
    if (item.base === 'services') {
      // Flache Liste — CDs Drawer kennt KEINE Zwischentitel (die Klasse
      // `menu__item--title` existiert in menu.postcss, wird aber von keiner
      // CD-Komponente verwendet). Die Unterscheidung «bleibt im Portal» vs.
      // «führt ins BBL-Intranet» trägt die Ebene 2, wo die externen Ziele das
      // External-Symbol führen.
      level0 = `<ul class="menu navy__level-0">${
        (item.children || []).map(navyRow).join('')}${themaBranchRows()}</ul>`;
    } else if (hasNavBranch) {
      level0 = `<ul class="menu navy__level-0">${(item.children || [])
        .map(c => c.branchKey ? branchRow('nav:' + c.branchKey, c.label) : navyRow(c)).join('')}</ul>`;
    } else {
      // `childrenFrom: 'themen'` steht nur am Services-Eintrag, und der wird oben
      // abgefangen — hier bleiben nur statisch deklarierte Kinder übrig.
      level0 = `<ul class="menu navy__level-0">${(item.children || []).map(navyRow).join('')}</ul>`;
    }

    // Drawer-Titel als <h2> wie in CDs kanonischem Markup (MainNavigation.vue:41,
    // 62, 85): der Titel gibt AT Struktur. Geschlossene Drawer sind `hidden`,
    // die Überschriften belasten die Seitengliederung also nicht; tabindex="-1"
    // am Zweigtitel bleibt für den Fokus beim Drill-down (Review nav/drawer-3).
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

    // Der Schliessen-Knopf ist per CD ein Desktop-Element (desktop-menu.postcss:57
    // «hidden lg:block»). Im mobilen Baum wurde er bisher gerendert und nur per
    // CSS versteckt — ihn gar nicht zu erzeugen hält den AT-Baum sauber und
    // erspart das desktop-benannte Element im Mobilmenü (Review nav/mob-3).
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
      // icon--md statt --sm: CDs Drawer-Chevron ist 20px (navy.postcss:47-51); mit
      // 12px war die Aufklapp-Affordanz kaum sichtbar (Item 4.6). Die Rotation beim
      // Öffnen kommt aus der CSS-Hälfte in Item 2.9c.
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

  // Anmeldestatus (AGOV / FedLogin). Abgemeldet: ein «Anmelden»-Knopf.
  // Angemeldet: Name plus «Abmelden». Kein Rollen-/Rechtekonzept.
  const user = session.user();
  // Item 4.2: das User-Icon war `icon--sm` (12px) und las sich neben dem Text wie
  // ein verrutschtes Diakritikum; angemeldet trennte eine nackte Haarlinie Name
  // und «Abmelden» und wirkte wie ein Tippfehler. Jetzt CDs md-Grösse und ein
  // echtes .separator--vertical. Die 44px-Höhe kommt aus Item 2.5b.
  const authNav = user
    ? `<li class="meta-navigation__user"><span class="meta-navigation__name">${icon('User', 'icon--md')} ${escapeHtml(user.name)}</span>
        <span class="separator separator--vertical" aria-hidden="true"></span>
        <button type="button" class="meta-navigation__item meta-navigation__auth" onclick="window.__logout && window.__logout()">Abmelden</button></li>`
    // Kein Ziel: die Kopfzeile weiss nicht, was der Nutzer vorhat — sie zeichnet
    // die aktuelle Seite neu. Ein Ziel tragen nur die Knöpfe, die AN der Stelle
    // stehen, an der sonst der Vorgang ausgelöst würde (C.loginGate/accessCard).
    : `<li><button type="button" class="meta-navigation__item meta-navigation__auth" data-login>${icon('User', 'icon--md')} Anmelden</button></li>`;

  // Item 4.11: das Steuerelement war bedienbar, aber jede Option außer DE war
  // `disabled` — es öffnete also eine Liste, in der nichts wählbar ist. Ein
  // deaktiviertes Feld mit nur einer Option sagt dasselbe ehrlicher, und das
  // Label nennt den Grund (statt ihn nur im Titel zu verstecken).
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
      <!-- icon--md statt --base: unter 640 ist das Symbol die EINZIGE sichtbare
           Affordanz dieses Links (die Beschriftung ist dann sr-only, Item 2.4). -->
      <a class="top-bar__btn" href="https://www.admin.ch/de/bundesverwaltung" target="_blank" rel="noopener external"><span>Alle Schweizer Bundesbehörden</span>${icon('External', 'icon--md')}</a>
      <div class="top-bar__right">
        <span class="demo-chip" title="Prototyp mit Demo-Daten — Login, Prozess-Engine, Datenkern und Schnittstellen sind simuliert">Prototyp<span class="sr-only"> — Prototyp mit Demo-Daten; Login, Prozess-Engine, Datenkern und Schnittstellen sind simuliert</span></span>
        <nav class="top-bar-navigation" aria-label="Bundesangebote"><ul>${topBarNav}</ul></nav>
        ${langSwitcher}
      </div>
    </div>
  </div>

  <!-- CD verbirgt den langen Amtstitel unter 480 absichtlich (logo.postcss:76) und
       kompensiert ihn mit diesem getönten Band (top-header.postcss:13-31,
       TopHeader.vue:3-8). Ohne das Band bestand die sichtbare Marke bei 320/390
       nur aus «BBL» plus Intranet-Pille — weder Amt noch Produkt waren zu lesen.
       aria-hidden, weil .logo__title denselben Text für AT bereits trägt. -->
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
    <!-- CD integriert die Suche in das offene Mobilmenü (search--mobile,
         detailPageSimpleMenuV2.vue:19-38): volle Breite zuoberst im Panel;
         die Lupe der Kopfzeile ist bei offenem Menü ausgeblendet. -->
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

function footerHTML() {
  const fLink = (href, label, ext) =>
    `<a class="footer__link footer-information__link--icon-right" href="${href}"${ext ? ' target="_blank" rel="noopener external"' : ''}>${icon(ext ? 'External' : 'ArrowRight', 'footer-information__icon')}${escapeHtml(label)}</a>`;

  return `
  <!-- Kein inneres .container mehr (Item 4.12): der Container richtete den
       klebenden Knopf an der Inhaltsspalte aus, sodass er bei 1440 mitten auf dem
       «Öffnen»-Link der dritten Karte lag. CD platziert ihn im Seitengraben
       (back-to-top-btn.postcss:11-13, right-3). Kein inline-onclick mehr —
       verdrahtet in renderFooter() mit preventDefault, weil href="#main-header"
       sonst die Route überschreibt (Item 4.3). -->
  <div class="back-to-top-rail">
    <div class="back-to-top-track">
      <a class="back-to-top-btn back-to-top-btn--outline interactive-control" href="#main-header" aria-label="Nach oben">
        ${icon('ChevronUp', 'back-to-top-btn__icon')}
      </a>
    </div>
  </div>
  <div class="bg--secondary-600">
    <div class="container">
      <div class="footer-information">
        <div class="footer-information__entry">
          <!-- Ohne das nachgestellte «BBL» bricht die Überschrift in der schmalen
               ersten Spalte nicht mehr auf drei Zeilen; das Akronym steht in der
               Adresszeile darunter (Item 4.13). -->
          <h3>Bundesamt für Bauten und Logistik</h3>
          <!-- Fliesstext in Basisgrösse wie CD (FooterInformation.vue:7-13 rendert
               nackte <p>) — kein .small (Review nav/ft-1). -->
          <p>Das Kundenportal bündelt Dienstleistungen, Anwendungen, Dokumente und Daten des BBL an einem Ort. Dies ist ein <strong>Prototyp mit Demo-Daten</strong>.</p>
          <p>BBL · Fellerstrasse 21, 3003 Bern</p>
        </div>
        <div class="footer-information__entry">
          <h3>Prototyp</h3>
          <div class="footer-information__links">
            <div class="footer-information__links-column">
              ${fLink('https://github.com/bbl-dres/service-portal', 'Quellcode auf GitHub', true)}${fLink('#/app/api-docs', 'API-Dokumentation')}${fLink('https://www.bk.admin.ch/de/webauftritt-der-bundesverwaltung', 'Webauftritt der Bundesverwaltung', true)}
            </div>
          </div>
        </div>
        <div class="footer-information__entry footer-information__entry--big">
          <h3>Weitere Informationen</h3>
          <div class="footer-information__links">
            <div class="footer-information__links-column">
              ${fLink('#/knowledge', 'Wissen und Hilfsmittel')}${fLink('#/news', 'News')}${fLink('#/applications', 'Anwendungen')}${fLink('#/data', 'Daten und Digitalisierung')}
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

  // Vorherige globale Listener abwerfen, dann eine frische Runde: `signal` hängt
  // an jedem document/window/matchMedia-Listener unten (element-scoped Listener
  // fallen mit dem ersetzten innerHTML ohnehin weg).
  shellAbort?.abort();
  shellAbort = new AbortController();
  const { signal } = shellAbort;
  updateShopCartButton(el);
  window.__updateShopCart = () => updateShopCartButton(document);
  window.addEventListener('hashchange', () => updateShopCartButton(el), { signal });
  window.addEventListener('shop:cartchange', () => updateShopCartButton(el), { signal });

  // Skip link (CD: <a href="#main-content">) — preventDefault, damit der Hash-Router
  // das Fragment nicht als Route sieht; wir setzen den Fokus selbst (#main-content
  // trägt tabindex="-1").
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
    // Verdeckten Inhalt bei offenem Drawer inaktiv schalten (WCAG 2.4.3) — sonst
    // bleiben ~48 fokussierbare Elemente hinter dem Overlay in der Tab-Reihenfolge.
    const main = document.getElementById('main-content');
    const foot = document.getElementById('main-footer');
    if (main) main.inert = open;
    if (foot) foot.inert = open;
    if (open) {
      // CD-Slide (global.postcss:34-38): der Body rückt um die Top-Bar-Höhe nach
      // oben, der Mobil-Titelstreifen klappt zu. Nach dem Einschwingen steht die
      // Kopfzeile also bei Viewport-0 und der Drawer beginnt exakt bei ihrer
      // Höhe — deshalb WIRD GERECHNET statt gemessen: getBoundingClientRect
      // mitten in der 700ms-Transition lieferte einen Zwischenstand.
      const top = el.querySelector('#top-header-id');
      const bar = el.querySelector('.top-bar');
      if (bar) document.documentElement.style.setProperty('--topbar-h', `${bar.offsetHeight}px`);
      if (top) document.documentElement.style.setProperty('--shell-top', `${top.offsetHeight}px`);
    }
  };
  burger.addEventListener('click', () =>
    setMobileMenu(!document.body.classList.contains('body--mobile-menu-is-open')));
  // Suche im offenen Menü: absenden navigiert und schliesst den Drawer.
  const mForm = el.querySelector('#mobile-search-form');
  if (mForm) mForm.addEventListener('submit', (e) => {
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
    // CD desktop-menu.postcss:33 (.with-offset): die Innenpolsterung des Panels
    // herausrechnen, damit die erste Menüzeile mit dem Trigger-Label fluchtet —
    // vorher war der Drawer-Inhalt rund 49px nach rechts versetzt (Item 4.9).
    const pad = parseFloat(getComputedStyle(panel).paddingLeft || '0') + 12;
    let left = buttonRect.left - navRect.left - pad;
    if (navRect.left + left < 0) left = -navRect.left;                            // nicht aus dem Viewport
    if (left + panelWidth > navRect.width - 12) left = Math.max(-navRect.left, navRect.width - panelWidth - 12);
    panel.style.left = `${left}px`;
    panel.style.right = 'auto';
    // Gemessener Höhendeckel (Item 4.7): die CSS-Regel aus 2.9d nimmt --shell-top
    // als Schätzung; hier steht die echte Position, also exakt rechnen. Auf
    // 1440x800 und 1366x768 waren sonst die letzten Einträge unerreichbar.
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

  // --- Drill-down-Unterzweige (Thema → seine Dienstleistungen) ---
  const fillBranch = (drill, key) => {
    let title, rows;
    if (key.startsWith('dom:')) {
      // Thema → seine startbaren Dienstleistungen. «Alle anzeigen» führt auf den
      // gefilterten Katalog — dieselbe Menge, nur mit Suche, Sortierung und
      // Zielgruppenfilter. Informationsangebote (`type: info`) stehen nicht im
      // Katalog und deshalb auch nicht hier (docs/sitemap.md §2.3).
      const dk = key.slice(4);
      const dom = (core.ref().domains || []).find(d => d.key === dk);
      if (!dom) return;
      const svcs = core.services().filter(s => s.domain === dk && s.type === 'action');
      title = dom.label;
      rows = [{ href: `#/services?topic=${encodeURIComponent(dk)}`, label: 'Alle anzeigen' },
        ...svcs.map(s => ({ href: `#/services/${encodeURIComponent(s.serviceId)}`, label: s.title }))];
    } else {
      // Nav-Zweig (z. B. «Digitalisierung») → seine L2-Kinder (intern).
      const b = NAV_BRANCHES[key.replace(/^nav:/, '')];
      if (!b) return;
      title = b.label;
      rows = b.children.map(c => ({ href: c.href, label: c.label }));
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
      // Fokus auf die Zweigüberschrift → Screenreader liest an, in welchen
      // Zweig gewechselt wurde (statt eines nackten «Zurück»).
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

  // Ein Klick auf einen echten Link im Drawer schliesst ihn (Delegation, damit
  // auch die per Drill-down nachgeladenen Links erfasst werden).
  el.querySelectorAll('.desktop-menu__drawer, .mobile-menu__drawer').forEach((drawer) => {
    drawer.addEventListener('click', (e) => { if (e.target.closest('a')) closeNavMenus(); });
  });
  overlay?.addEventListener('click', () => closeNavMenus());
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // APG: Escape schliesst zuerst das aufgeklappte Untermenü (eine Ebene),
    // erst der zweite Escape schliesst das Flyout.
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
  const sinput = el.querySelector('#global-search');
  const openSearch = (open) => {
    // CDs eigener Haken (search.postcss:99-103): unter lg klappt das Suchfeld als
    // eigene Zeile UNTER den Kopf und das Logo blendet aus — sonst lag das Feld
    // quer über der Bundesmarke (gemessen 64/173/176px Überlappung). Item 4.5;
    // die zugehörigen Regeln kamen mit Item 2.8.
    document.body.classList.toggle('body--search-is-open', open);
    searchWrap.classList.toggle('open', open);
    searchToggle.setAttribute('aria-expanded', String(open));
    if (open) setTimeout(() => sinput.focus(), 60);
  };
  searchToggle.addEventListener('click', () => openSearch(true));
  // Nur per Klick/Tastatur öffnen — reines Fokussieren darf den Kontext nicht
  // ändern (WCAG 3.2.1). Kein «focusin»-Öffner mehr.
  searchToggle.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSearch(true); } });
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
  }, { signal });
}

function renderFooter(el) {
  el.innerHTML = footerHTML();
  // `href="#main-header"` ist die zugängliche Sprungmarke, darf aber nicht in die
  // Adresse geschrieben werden: der Hash IST hier die Route, also hätte ein Klick
  // die aktuelle Seite durch «#main-header» ersetzt und den Deep-Link zerstört
  // (der Router ignoriert Nicht-`#/`-Hashes, die Adresse blieb aber falsch und
  // Neuladen/Teilen landete auf der Startseite). Item 4.3.
  const btn = el.querySelector('.back-to-top-btn');
  if (btn) btn.addEventListener('click', (e) => {
    e.preventDefault();
    const h = document.getElementById('main-header');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    window.scrollTo({ top: 0 });   // html{scroll-behavior} respektiert reduced-motion
  });
}

export const shell = { renderHeader, renderFooter };
export default shell;
