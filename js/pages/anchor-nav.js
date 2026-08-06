// Wiederverwendbares CD-Ankernavigations-Layout (detailPageAnchorNav.vue):
// links thematische Abschnitte mit id, rechts ein klebendes «Inhaltsverzeichnis»,
// das zu ihnen springt. Geteilt von den Fachgebietsseiten unter «Wissen und
// Hilfsmittel» (js/pages/knowledge.js) und den Digitalisierungs-Unterseiten.

// `ctx.query.get('section')` springt beim Rendern direkt zu einem Abschnitt.
// Warum ein Query-Parameter und keine Sprungmarke: die App ist hash-geroutet,
// ein zweites `#` im Hash (`#/knowledge/it#wi-vorlagen`) zerlegt der Router nicht
// — er sähe das Segment «it#wi-vorlagen» und zeigte 404. Der Abschnitt ist
// ausserdem Zustand INNERHALB der Seite, nicht ein eigener Ort (sitemap §1.1).
export function anchorNavPage(ctx, { title, lead, intro, sections, back }) {
  const { mount, C } = ctx;

  const sectionHtml = sections.map(s => `
    <section class="anchor-section" id="${s.id}">
      <h2 tabindex="-1" class="anchor-section__title">${C.markLang(s.title)}</h2>
      ${s.html}
    </section>`).join('');

  // Inhaltsverzeichnis (CD: Card + menu). Ohne Zeilen-Icon — CD-Blattzeilen
  // tragen keines; der aktive Abschnitt wird per .menu__item--active markiert.
  // Unter 768px ist das Verzeichnis eine eingeklappte <details>: dort steht es
  // (mit container--reverse-mobile) VOR dem Inhalt und kostet so ~48px statt
  // ~260px. Ab 768px blendet die CSS die <summary> aus und klappt den Inhalt
  // dauerhaft auf — das Verzeichnis steht dann wie bisher offen in der Randspalte.
  const toc = `<nav class="anchor-nav sticky--top" aria-label="Inhaltsverzeichnis">
    <div class="card card--default">
      <div class="card__content"><div class="card__body">
        <details class="anchor-nav__disclosure">
          <summary class="anchor-nav__summary">
            <h2 class="card__title">Inhaltsverzeichnis</h2>
            ${C.icon('ChevronDown', 'anchor-nav__chev')}
          </summary>
          <div class="anchor-nav__body">
            <ul class="menu">
              ${sections.map(s => `<li>
                <a class="menu__item menu__item--border menu__item--condensed" href="#${s.id}" data-anchor="${s.id}">
                  <span>${C.markLang(s.title)}</span>
                </a></li>`).join('')}
            </ul>
          </div>
        </details>
      </div></div>
    </div>
  </nav>`;

  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: back && back.href, backLabel: back && back.label })}
    ${/* container--reverse-mobile: unter 768px stand das Inhaltsverzeichnis am
          Seitenende, direkt über dem Footer — also erst NACHDEM man an allem
          vorbeigescrollt ist, was es indexiert (CD container.postcss:100-101). */''}
    <div class="container--grid gap--responsive container--reverse-mobile">
      <div class="anchor-page__header">
        ${C.pageHeader({ title, lead })}
        ${intro ? `<p class="page-intro muted">${intro}</p>` : ''}
      </div>
      <div class="container__main vertical-spacing">${sectionHtml}</div>
      <aside class="container__aside">${toc}</aside>
    </div>
  </div>`;

  wireAnchorNav(mount, ctx);

  // Direktsprung aus einem Kurzlink («Häufig gebraucht»). Nach dem Fokus-Setzen
  // des Routers ausführen, sonst zieht dessen h1-Fokus die Seite zurück nach oben.
  const want = ctx.query && ctx.query.get('section');
  if (want) {
    const target = mount.querySelector('#' + CSS.escape(want));
    if (target) requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
      (target.querySelector('.anchor-section__title') || target).focus({ preventScroll: true });
    });
  }
}

// Verdrahtung: (1) Klick im Inhaltsverzeichnis scrollt zum Abschnitt und setzt
// den Fokus auf dessen Überschrift; (2) Scroll-Spy markiert den aktuellen
// Abschnitt mit .menu__item--active (CD detailPageAnchorNav JS-Beispiel);
// (3) etwaige Akkordeons im Inhalt werden aktiviert.
// `ctx` wird durchgereicht, damit die globalen Horcher beim Verlassen der Route
// wieder abgemeldet werden. Ohne das sammelte jede Ankernavigations-Seite pro
// Besuch je einen matchMedia- und einen scroll-Listener an — gemessen +1/+1 pro
// Aufruf, ohne Obergrenze, und der matchMedia-Horcher hielt über seine Closure
// den ausgetauschten `mount`-Teilbaum am Leben (docs/code-review.md §4).
// Diese Seiten sind die meistbesuchten der App: sechs Wissens- und fünf
// Digitalisierungs-Seiten teilen sich dieses Layout.
function wireAnchorNav(mount, ctx) {
  // Ein AbortController je Render — dasselbe Muster wie in js/shell.js. Alle
  // Listener werden mit `signal` registriert und mit einem `abort()` gelöst.
  const ac = new AbortController();
  const { signal } = ac;
  if (ctx && ctx.onUnmount) ctx.onUnmount(() => ac.abort());

  // Das Inhaltsverzeichnis ist NUR unter 768px ein Ausklapper. Der Zustand muss
  // vom JS kommen: Browser klappen <details> heute über
  // `::details-content { content-visibility:hidden }` ein, und dagegen kommt
  // keine display-Regel auf dem Kind an. Ab 768px also `open` setzen (die CSS
  // blendet dort die <summary> aus), darunter zuklappen.
  const details = mount.querySelector('.anchor-nav__disclosure');
  if (details && window.matchMedia) {
    const wide = window.matchMedia('(min-width:768px)');
    const sync = () => { details.open = wide.matches; };
    sync();
    // Beim Breitenwechsel nachziehen; auf `change` statt Resize-Sturm.
    wide.addEventListener('change', sync, { signal });
  }

  const links = [...mount.querySelectorAll('.anchor-nav [data-anchor]')];
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = mount.querySelector('#' + CSS.escape(link.getAttribute('data-anchor')));
      if (!target) return;
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      (target.querySelector('.anchor-section__title') || target).focus({ preventScroll: true });
    }, { signal });
  });

  // Scroll-Spy: den zuletzt überschrittenen Abschnitt aktiv setzen. Die
  // Selbstabmeldung beim ersten Scroll nach dem Seitenwechsel bleibt als Netz
  // bestehen — sie griff aber nur, WENN nach dem Verlassen überhaupt noch
  // gescrollt wurde. Der Controller räumt jetzt unabhängig davon auf.
  const sections = [...mount.querySelectorAll('.anchor-section[id]')];
  if (sections.length) {
    const OFFSET = 140;
    const onScroll = () => {
      if (!mount.querySelector('.anchor-nav')) { ac.abort(); return; }
      const y = window.scrollY || document.documentElement.scrollTop;
      let current = sections[0].id;
      // `offsetTop` ist hier relativ zum positionierten #main-content, `y`
      // dagegen dokumentrelativ. Die Viewportposition plus Scrollwert liegt im
      // selben Koordinatensystem und bleibt auch bei vorgeschalteter Shell korrekt.
      for (const s of sections) {
        const top = s.getBoundingClientRect().top + y;
        if (top - OFFSET <= y) current = s.id;
      }
      links.forEach(a => a.classList.toggle('menu__item--active', a.getAttribute('data-anchor') === current));
    };
    window.addEventListener('scroll', onScroll, { passive: true, signal });
    onScroll();
  }

  // Akkordeons (z. B. FAQ auf der Prozesse-Seite): gemeinsame Verdrahtung statt
  // der früher hier kopierten Toggle-Logik — so landen Verhaltensänderungen
  // (etwa die CD-Animation) an EINER Stelle. Kein `signal` nötig: die Horcher
  // hängen an Knoten innerhalb von `mount` und verschwinden mit dem DOM-Tausch.
  ctx.C.wireAccordion(mount);
}
