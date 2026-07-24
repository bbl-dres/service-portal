// Gesetzliche Grundlagen und Vorgaben — Ankernavigations-Seite nach dem Muster
// von kbob.admin.ch/de/mustervertraege-und-publikationen und dem CD-Beispiel
// detailPageAnchorNav.vue: links thematische Akkordeons mit Dokumentlisten,
// rechts ein «Inhaltsverzeichnis» als klebende Navigation, die zu den
// Abschnitten springt und sie öffnet.
//
// Bewusst statisch: die Sammlung ist ein Dokumentenverzeichnis, kein
// abfragbarer Katalog. Demo-Inhalt — die Dokumente sind Platzhalter.

const GROUPS = [
  {
    id: 'bund',
    title: 'Übergeordnete Vorgaben des Bundes',
    intro: 'Bundesweit geltende Vorgaben, die für alle Verwaltungseinheiten verbindlich sind. Sie gehen den Weisungen des BBL vor.',
    items: [
      { title: 'Vorgaben zur digitalen Transformation und IKT-Lenkung der Bundesverwaltung (DTI)',
        desc: 'Vorgabensammlung der Bundeskanzlei — Architektur, Sicherheit, Projektführung.',
        href: 'https://www.bk.admin.ch/de/vorgaben', external: true, meta: ['bk.admin.ch'] },
      { title: 'Corporate Design der Schweizerischen Bundesverwaltung (CD Bund)',
        desc: 'Verbindliche Gestaltungsvorgaben für Auftritte der Bundesverwaltung.',
        href: '#', meta: ['PDF', '4.2 MB', 'Stand 2025'] },
      { title: 'P028 — Barrierefreiheit von Internetangeboten',
        desc: 'Anforderungen an die Zugänglichkeit digitaler Angebote des Bundes (WCAG 2.1 AA).',
        href: '#', meta: ['PDF', '1.1 MB', 'Stand 2024'] },
    ],
  },
  {
    id: 'gesetze',
    title: 'Gesetzliche Grundlagen',
    intro: 'Erlasse, auf denen die Tätigkeit des BBL als Bau- und Liegenschaftsorgan sowie als Beschaffungsstelle beruht.',
    items: [
      { title: 'Bundesgesetz über das öffentliche Beschaffungswesen (BöB)', desc: 'SR 172.056.1', href: '#', meta: ['PDF', '620 kB', 'Stand 2026'] },
      { title: 'Verordnung über das öffentliche Beschaffungswesen (VöB)', desc: 'SR 172.056.11', href: '#', meta: ['PDF', '480 kB', 'Stand 2026'] },
      { title: 'Verordnung über das Immobilienmanagement und die Logistik des Bundes (VILB)', desc: 'SR 172.010.21', href: '#', meta: ['PDF', '310 kB', 'Stand 2025'] },
      { title: 'Energiegesetz (EnG) — Vorbildfunktion des Bundes', desc: 'Art. 45b und 46a EnG', href: '#', meta: ['PDF', '540 kB', 'Stand 2025'] },
      { title: 'Klima- und Innovationsgesetz (KlG)', desc: 'Netto-Null-Ziel der zentralen Bundesverwaltung, Art. 10', href: '#', meta: ['PDF', '290 kB', 'Stand 2025'] },
    ],
  },
  {
    id: 'bauten',
    title: 'Bauten und Immobilien',
    intro: 'Weisungen und Standards für Planung, Realisierung und Bewirtschaftung der Bundesbauten.',
    items: [
      { title: 'Weisung Bauprojektabwicklung BBL', desc: 'Phasen nach SIA 112, Zuständigkeiten, Freigaben.', href: '#', meta: ['PDF', '1.8 MB', 'Stand 2026'] },
      { title: 'Weisung Bauwerksdokumentation', desc: 'Umfang, Struktur und Übergabe der Dokumentation.', href: '#', meta: ['PDF', '760 kB', 'Stand 2025'] },
      { title: 'BIM-Vorgaben des BBL', desc: 'Modellbasierte Planung, Common Data Environment, Übergabeformate.', href: '#', meta: ['PDF', '2.4 MB', 'Stand 2026'] },
      { title: 'Standard Nachhaltiges Bauen Schweiz (SNBS) — Anwendung im BBL', desc: 'Zertifizierungspflicht und Zielwerte.', href: '#', meta: ['PDF', '1.2 MB', 'Stand 2025'] },
    ],
  },
  {
    id: 'beschaffung',
    title: 'Beschaffung',
    intro: 'Vorgaben für Vergaben des BBL, inklusive Nachhaltigkeits- und Schwellenwertregeln.',
    items: [
      { title: 'Beschaffungsstrategie BBL 2030', desc: 'Stossrichtungen, Nachhaltigkeitskriterien, Zielwerte.', href: '#', meta: ['PDF', '3.1 MB', 'Stand 2026'] },
      { title: 'Weisung WTO-Verfahren und Schwellenwerte', desc: 'Verfahrenswahl, Fristen, Publikationspflichten.', href: '#', meta: ['PDF', '890 kB', 'Stand 2026'] },
      { title: 'Musterverträge und Vorlagen der KBOB', desc: 'Ausschreibungsvorlagen und Musterverträge entlang des Beschaffungsablaufs.',
        href: 'https://www.kbob.admin.ch/de/mustervertraege-und-publikationen', external: true, meta: ['kbob.admin.ch'] },
    ],
  },
  {
    id: 'arbeitsplatz',
    title: 'Arbeitsplatz und Logistik',
    intro: 'Vorgaben zu Flächen, Möblierung und Materialbezug.',
    items: [
      { title: 'Weisung Neue Arbeitswelten (NAW)', desc: 'Flächenstandards, Desk-Sharing-Faktor, Raumtypen.', href: '#', meta: ['PDF', '1.5 MB', 'Stand 2025'] },
      { title: 'Weisung Möblierung und Ausstattung', desc: 'Sortiment, Ersatzbeschaffung, Wiederverwendung.', href: '#', meta: ['PDF', '940 kB', 'Stand 2025'] },
    ],
  },
  {
    id: 'sicherheit',
    title: 'Informationssicherheit und Datenschutz',
    intro: 'Vorgaben zum Umgang mit klassifizierten Informationen und Personendaten.',
    items: [
      { title: 'Informationssicherheitsgesetz (ISG)', desc: 'SR 128 — Klassifizierung und Schutz von Informationen.', href: '#', meta: ['PDF', '710 kB', 'Stand 2025'] },
      { title: 'Weisung Informationssicherheit BBL', desc: 'Umsetzung im BBL, Meldewege, Zuständigkeit ISBO.', href: '#', meta: ['PDF', '820 kB', 'Stand 2026'] },
      { title: 'Sicherheits- oder Datenschutzvorfall melden', desc: 'Meldung als Vorgang erfassen — die ISBO übernimmt die Bearbeitung.',
        href: '#/services/sicherheitsvorfall-melden', meta: ['Dienstleistung'] },
    ],
  },
];

// Eine Zeile in einer Dokumentliste (CD download-item). Extern → neues Fenster;
// ohne echtes Ziel («#») ein nicht fokussierbarer, deaktivierter Ersatz.
export function docItem(C, it) {
  const inner = `${C.icon(it.icon || (it.external ? 'External' : 'Download'), 'download-item__icon')}
    <div>
      <h4 class="download-item__title">${C.escape(it.title)}</h4>
      ${it.desc ? `<p class="download-item__description">${C.escape(it.desc)}</p>` : ''}
      ${it.meta && it.meta.length ? `<p class="meta-info download-item__meta-info">${
        it.meta.map(m => `<span class="meta-info__item">${C.escape(m)}</span>`).join('')}</p>` : ''}
    </div>`;
  if (it.external) {
    return `<li><a class="download-item" href="${it.href}" target="_blank" rel="noopener external">${inner}</a></li>`;
  }
  if (it.href && it.href !== '#') {
    return `<li><a class="download-item" href="${it.href}">${inner}</a></li>`;
  }
  return `<li><span class="download-item" aria-disabled="true" title="Im Prototyp nicht verfügbar">${inner}
    <span class="sr-only">(im Prototyp nicht verfügbar)</span></span></li>`;
}

// Wiederverwendbares CD-Ankernavigations-Layout (detailPageAnchorNav.vue):
// links thematische Abschnitte mit id, rechts ein klebendes «Inhaltsverzeichnis».
// `sections` = [{ id, title, html }]. Titel/Brotkrume setzt die aufrufende Seite.
export function anchorNavPage(ctx, { title, lead, intro, sections, back }) {
  const { mount, C } = ctx;

  const sectionHtml = sections.map(s => `
    <section class="anchor-section" id="${s.id}">
      <h2 tabindex="-1" class="anchor-section__title">${C.escape(s.title)}</h2>
      ${s.html}
    </section>`).join('');

  // Inhaltsverzeichnis (CD: Card + menu). Ohne Zeilen-Icon — CD-Blattzeilen
  // tragen keines; der aktive Abschnitt wird per .menu__item--active markiert.
  const toc = `<nav class="anchor-nav sticky--top" aria-label="Inhaltsverzeichnis">
    <div class="card card--default">
      <div class="card__content"><div class="card__body">
        <h2 class="card__title">Inhaltsverzeichnis</h2>
        <ul class="menu">
          ${sections.map(s => `<li>
            <a class="menu__item menu__item--border menu__item--condensed" href="#${s.id}" data-anchor="${s.id}">
              <span>${C.escape(s.title)}</span>
            </a></li>`).join('')}
        </ul>
      </div></div>
    </div>
  </nav>`;

  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: back && back.href, backLabel: back && back.label })}
    <div class="container--grid gap--responsive">
      <div class="anchor-page__header">
        ${C.pageHeader({ title, lead })}
        ${intro ? `<p class="page-intro muted">${intro}</p>` : ''}
      </div>
      <div class="container__main vertical-spacing">${sectionHtml}</div>
      <aside class="container__aside">${toc}</aside>
    </div>
  </div>`;

  wireAnchorNav(mount);
}

// Eigenständige Seite «Gesetzliche Grundlagen und Vorgaben» — nutzt das
// generische Ankernavigations-Layout mit den thematischen Dokumentgruppen.
export function grundlagenPage(ctx, page) {
  const { C, setTitle, setCrumbs } = ctx;
  setTitle(page.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News und Wissen', href: '#/knowledge' }, { label: page.title }]);

  const sections = GROUPS.map(g => ({
    id: 'gr-' + g.id,
    title: g.title,
    html: `${g.intro ? `<p class="muted">${C.escape(g.intro)}</p>` : ''}
      <ul class="download-items">${g.items.map(it => docItem(C, it)).join('')}</ul>`,
  }));
  sections.push({
    id: 'gr-weitere',
    title: 'Weiterführende Informationen',
    html: `<ul class="list--default">
      <li><a href="https://www.bk.admin.ch/de/vorgaben" target="_blank" rel="noopener external">Vorgaben zur digitalen Transformation und IKT-Lenkung der Bundesverwaltung (DTI)</a></li>
      <li><a href="#/knowledge?tab=prozesse">Prozesse — Anleitungen, FAQ, Formulare und Vorlagen</a></li>
      <li><a href="#/data/digitalisierung">Digitalisierung — Strategie und Vorhaben des BBL</a></li>
    </ul>`,
  });

  anchorNavPage(ctx, {
    title: page.title, lead: page.lead,
    intro: 'Die Dokumente gelten in der jeweils publizierten Fassung; bei Widersprüchen gehen die Vorgaben des Bundes den Weisungen des BBL vor.',
    sections,
  });
}

// Verdrahtung: (1) Klick im Inhaltsverzeichnis scrollt zum Abschnitt und setzt
// den Fokus auf dessen Überschrift; (2) Scroll-Spy markiert den aktuellen
// Abschnitt mit .menu__item--active (CD detailPageAnchorNav JS-Beispiel);
// (3) etwaige Akkordeons im Inhalt werden aktiviert.
function wireAnchorNav(mount) {
  const links = [...mount.querySelectorAll('.anchor-nav [data-anchor]')];
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = mount.querySelector('#' + CSS.escape(link.getAttribute('data-anchor')));
      if (!target) return;
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      (target.querySelector('.anchor-section__title') || target).focus({ preventScroll: true });
    });
  });

  // Scroll-Spy: den zuletzt überschrittenen Abschnitt aktiv setzen. Der
  // window-Listener entfernt sich selbst, sobald die Seite ausgetauscht wurde.
  const sections = [...mount.querySelectorAll('.anchor-section[id]')];
  if (sections.length) {
    const OFFSET = 140;
    const onScroll = () => {
      if (!mount.querySelector('.anchor-nav')) { window.removeEventListener('scroll', onScroll); return; }
      const y = window.scrollY || document.documentElement.scrollTop;
      let current = sections[0].id;
      for (const s of sections) if (s.offsetTop - OFFSET <= y) current = s.id;
      links.forEach(a => a.classList.toggle('menu__item--active', a.getAttribute('data-anchor') === current));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Akkordeons (z. B. FAQ auf der Prozesse-Seite).
  mount.querySelectorAll('.accordion .accordion__button').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      const panel = mount.querySelector('#' + CSS.escape(btn.getAttribute('aria-controls')));
      if (panel) panel.hidden = expanded;
    });
  });
}

export default grundlagenPage;
