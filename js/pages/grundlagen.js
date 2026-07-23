// Gesetzliche Grundlagen und Vorgaben — statische Landing-Page mit Akkordeons.
// Aufbau nach dem Muster von kbob.admin.ch/de/mustervertraege-und-publikationen:
// kurze Einleitung, danach thematische Akkordeons mit Dokumentlisten
// (Titel, Dateityp, Grösse, Stand) und Verweisen auf übergeordnete Vorgaben.
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

export function grundlagenPanel(ctx) {
  const { C } = ctx;

  const item = (it) => {
    const inner = `${C.icon(it.external ? 'External' : 'Download', 'download-item__icon')}
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
  };

  return `
    <p class="page-intro muted">Die für das BBL massgebenden Erlasse, übergeordneten Vorgaben des Bundes und internen Weisungen — thematisch gegliedert. Die Dokumente gelten in der jeweils publizierten Fassung; bei Widersprüchen gehen die Vorgaben des Bundes den Weisungen des BBL vor.</p>

    <div class="accordion mt-6" id="grundlagen-acc">
      ${GROUPS.map((g, i) => `
        <div class="accordion__item">
          <h3 style="margin:0">
            <button class="accordion__button" type="button" aria-expanded="${i === 0}" aria-controls="gr-p-${g.id}" id="gr-b-${g.id}">
              <span class="accordion__title">${C.escape(g.title)}</span>${C.icon('ChevronDown', 'icon--base')}
            </button>
          </h3>
          <div class="accordion__content" id="gr-p-${g.id}" role="region" aria-labelledby="gr-b-${g.id}"${i === 0 ? '' : ' hidden'}>
            ${g.intro ? `<p class="muted">${C.escape(g.intro)}</p>` : ''}
            <ul class="download-items">${g.items.map(item).join('')}</ul>
          </div>
        </div>`).join('')}
    </div>

    <section class="mt-8">
      <h2>Weiterführende Informationen</h2>
      <ul class="list--default mt-4">
        <li><a href="https://www.bk.admin.ch/de/vorgaben" target="_blank" rel="noopener external">Vorgaben zur digitalen Transformation und IKT-Lenkung der Bundesverwaltung (DTI)</a></li>
        <li><a href="#/knowledge?tab=prozesse">Prozesse — Anleitungen, FAQ, Formulare und Vorlagen</a></li>
        <li><a href="#/data/digitalisierung">Digitalisierung — Strategie und Vorhaben des BBL</a></li>
      </ul>
    </section>`;
}

export default grundlagenPanel;
