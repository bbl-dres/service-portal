import { icon, escape as escapeHtml } from '../../components.js';

function footerHTML() {
  const fLink = (href, label, ext) =>
    `<a class="footer__link footer-information__link--icon-right" href="${href}"${ext ? ' target="_blank" rel="noopener noreferrer external"' : ''}>${icon(ext ? 'External' : 'ArrowRight', 'footer-information__icon')}${escapeHtml(label)}</a>`;

  return `
  <!-- No inner .container (item 4.12): it aligned the sticky button with the
       content column, putting it over the third card's «Öffnen» link at 1440.
       CD places it in the page gutter (back-to-top-btn.postcss:11-13, right-3).
       No inline onclick; renderFooter() wires preventDefault because
       href="#main-header" would otherwise overwrite the route (item 4.3). -->
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
          <!-- Without the trailing «BBL», the heading no longer wraps to three
               lines in the narrow first column; the acronym appears in the
               address line below (item 4.13). -->
          <h3>Bundesamt für Bauten und Logistik</h3>
          <!-- Body text at the CD base size (FooterInformation.vue:7-13 renders
               bare <p>); no .small (review nav/ft-1). -->
          <p>Das Kundenportal bündelt Dienstleistungen, Anwendungen, Dokumente und Daten des BBL an einem Ort. Dies ist ein <strong>Prototyp mit Demo-Daten</strong>.</p>
          <p>BBL · Fellerstrasse 21, 3003 Bern</p>
        </div>
        <div class="footer-information__entry">
          <h3>Prototyp</h3>
          <div class="footer-information__links">
            <div class="footer-information__links-column">
              ${fLink('https://github.com/bbl-dres/service-portal', 'Quellcode auf GitHub', true)}${fLink('#/app/api-docs', 'API-Dokumentation')}${fLink('https://www.bk.admin.ch/de/webauftritt-der-bundesverwaltung', 'Webauftritt der Bundesverwaltung', true)}${fLink('https://bbl-dres.github.io/tenant-portal/', 'Variante Mieterportal', true)}
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
        <li><a class="footer__link" href="https://www.admin.ch/gov/de/start/rechtliches/impressum.html" target="_blank" rel="noopener noreferrer external">Impressum</a></li>
        <li><a class="footer__link" href="https://www.admin.ch/gov/de/start/rechtliches.html" target="_blank" rel="noopener noreferrer external">Rechtliches</a></li>
        <li><a class="footer__link" href="https://www.admin.ch/gov/de/start/rechtliches/datenschutzerklaerung.html" target="_blank" rel="noopener noreferrer external">Datenschutz</a></li>
        <li><a class="footer__link" href="https://www.admin.ch/gov/de/start/rechtliches/barrierefreiheit-bund.html" target="_blank" rel="noopener noreferrer external">Barrierefreiheit</a></li>
      </ul>
    </nav>
  </div>`;
}

export function renderFooter(el) {
  el.innerHTML = footerHTML();
  // `href="#main-header"` is the accessible jump target but must not be written
  // into the address. Here the hash IS the route, so a click would replace the
  // current page with «#main-header» and destroy the deep link. The router ignores
  // non-`#/` hashes, but the address would remain wrong and reload/share would
  // reach the home page. Item 4.3.
  const button = el.querySelector('.back-to-top-btn');
  if (button) button.addEventListener('click', (e) => {
    e.preventDefault();
    const h = document.getElementById('main-header');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    window.scrollTo({ top: 0 });   // html{scroll-behavior} respects reduced motion.
  });
}
