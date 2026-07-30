// Übersicht (Startseite) — Arbeitsfläche, keine Nachrichtenwand.
//
// Aufbau nach der Reihenfolge, in der jemand die Seite benutzt:
//   Suche → offene Vorgänge → häufige Dienstleistungen →
//   Anwendungen und Hilfsmittel → Aktuelles.
// Begründung siehe docs/design-review.md P1-1: ein Intranet dient der
// wiederholten Aufgabenerledigung, nicht der Erstorientierung — deshalb
// ausdrücklich nicht dem Aufbau öffentlicher Bundesauftritte folgend.

import { attachSuggest } from '../search-suggest.js';



// Aufschiebbare Bestände dieser Route. Der Router ruft core.ensure(needs) VOR
// render() auf — ohne die Deklaration läse ein Accessor die noch leere Liste
// und die Ansicht zeigte «keine Einträge» statt Daten (docs/code-review.md §3).
export const needs = ['news'];
const CLOSED = ['abgeschlossen', 'erledigt', 'geliefert'];

// Die Themenkacheln (Bauprojekte · Unterbringung · Objektbetrieb · Sicherheit)
// standen hier als eigener Startseiten-Block. Sie sind entfallen: die Themen
// erschliesst der Dienstleistungs-Drawer (router.js, `childrenFrom: 'themen'`)
// und die Katalogseite #/services?topic=… — die Startseite trägt dafür die
// Aufgaben, nicht die Gliederung.

export default async function render(ctx) {
  const { mount, core, engine, session, C, setTitle, setCrumbs } = ctx;
  setTitle('Übersicht');
  setCrumbs([]);

  const services = core.services();
  const news = core.news().slice(0, 3);
  const cases = engine.instances();
  const open = cases.filter(i => !CLOSED.includes(i.status));

  /* ---------------------------------------------------------- Bausteine -- */

  // CD-Muster (indexPage.vue, ServicesSection.vue): volle-Breite-Abschnitte,
  // die Weiss / secondary-50 abwechseln; Titel oben als .section__title, der
  // «Alle …»-Verweis unten rechts als .section__action mit btn--bare. Der
  // Inhalt sitzt im .container. `alt` wird beim Zusammenbau nach Reihenfolge
  // gesetzt, damit die Bänder immer sauber wechseln.
  // Derselbe Baustein wie auf den Hub-Seiten (C.pageSection) — die lokale Kopie
  // war die einzige Stelle, die CDs Section-Anatomie korrekt aufbaute.
  const section = ({ title, body, more }, alt) => C.pageSection({ title, body, more, alt });

  // Häufige Dienstleistung — Textkachel, kein Bild: hier zählt das Ziel,
  // nicht die Illustration.
  // Die Kachelbeschriftung ist eine echte <h3>: sie war ein <span> und fehlte
  // damit in der Dokumentgliederung — die Startseite bot Hilfsmitteln unter
  // «Häufig gebraucht» keinen einzigen Sprungpunkt an. <a> hat im HTML5 ein
  // transparentes Inhaltsmodell, eine Überschrift darin ist gültig.
  const serviceTile = (s) => `
    <a class="quick-tile plain-link" href="#/services/${encodeURIComponent(s.serviceId)}">
      ${C.icon(s.icon || 'ArrowRight', 'icon--md')}
      <div class="quick-tile__text">
        <h3 class="quick-tile__label">${C.escape(s.title)}</h3>
        <span class="quick-tile__meta">${C.escape(s.short)}</span>
      </div>
    </a>`;

  /* ------------------------------------------------------------- Blöcke -- */

  const blocks = [];

  // 1 · Offene Vorgänge — nur angemeldet und nur wenn es welche gibt.
  if (session.isLoggedIn() && open.length) blocks.push({
    title: 'Meine offenen Vorgänge',
    // Über C.table statt von Hand: die Startseite hatte als einzige Ansicht
    // eine eigene Tabellen-Auszeichnung und wich damit in Polster, Trennlinien
    // und Scrollhinweis von allen anderen ab.
    body: C.table({
      caption: 'Meine offenen Vorgänge', zebra: true, rowsClickable: true,
      columns: [
        { key: 'reference', label: 'Referenz', width: '10rem',
          render: (i) => `<a href="#/my-cases/${encodeURIComponent(i.instanceId)}">${C.escape(i.reference)}</a>` },
        { key: 'title', label: 'Titel', render: (i) => C.escape(i.title) },
        { key: 'updatedAt', label: 'Aktualisiert', width: '9rem', render: (i) => C.escape(i.updatedAt || i.createdAt) },
        { key: 'status', label: 'Status', width: '11rem', render: (i) => C.statusBadge(i.status, statusLabel(core, i.status)) },
      ],
      rows: open.slice(0, 5),
    }),
    more: { href: '#/my-cases', label: `Alle Vorgänge (${cases.length})` },
  });

  // 2 · Häufig gebrauchte Dienstleistungen
  // `popular` ist ein RANG (1 = erste Kachel), keine Fahne. Das Raster ist
  // gleichmässig — die Gewichtung trägt also allein die Leserichtung, und die
  // gehört in die Daten, nicht in die Dateireihenfolge von services.json.
  // Auswahl nach der echten Kundenplattform (Fusszeilen-Kurzwahl: E-Shop,
  // Reklamationsmeldung, Vorlagen, Störungsmeldungen) — also nach Häufigkeit,
  // nicht nach redaktioneller Prominenz.
  const popular = services.filter(s => s.popular).sort((a, b) => a.popular - b.popular);
  if (popular.length) blocks.push({
    title: 'Häufig gebraucht',
    body: `<div class="grid grid--responsive-cols-3">${popular.map(serviceTile).join('')}</div>`,
    more: { href: '#/services', label: 'Alle Dienstleistungen ansehen' },
  });

  // 3 · Anwendungen, Hilfsmittel und weitere Angebote — die meistgebrauchten
  //     Einstiege quer über die Plattform: zwei Anwendungen, eine Hilfsmittel-
  //     Sammlung, ein externer Shop, ein Dokumentenbestand. Bewusst gemischt und
  //     bewusst kurz: es ist eine Auswahl, kein zweites Menü.
  //     Fünf Karten im Dreierraster ergeben 3+2 — keine einzeln verwaiste Karte.
  //
  //     Anwendungen führen auf ihre LANDINGPAGE (#/applications/<appId>), nicht
  //     direkt ins System — dieselbe Regel wie im Anwendungskatalog: jede
  //     Anwendung hat eigene Einstiegspunkte, Zugriffsregeln und Ansprechstellen,
  //     und die stehen auf der Landingpage. Nur Hilfsmittel verweisen direkt auf
  //     ihre Sammlung, weil es dort nichts zu erklären gibt.
  const HIGHLIGHTS = [
    { title: 'Datenportal', href: '#/applications/datenportal', photo: '1551288049-bebda4e38f71',
      desc: 'Auswertungen und Kennzahlen des BBL — Energie, Immobilien, Beschaffung, Personal und Logistik.',
      foot: 'Anwendung' },
    { title: 'Liegenschaften Inventar', href: '#/applications/liegenschaften-inventar', photo: '1515488764276-beab7607c1e6',
      desc: 'Gebäude und Grundstücke des Bundes auf der Karte, mit Flächen, Verträgen, Kosten und Dokumenten.',
      foot: 'Anwendung' },
    { title: 'Informatik und IKT-Beschaffung', href: '#/knowledge/it', photo: '1518770660439-4636190af475',
      desc: 'Mustervorlagen, Werkzeugkasten und Vorgaben für Beschaffungen im Informatikbereich.',
      foot: 'Hilfsmittel' },
    { title: 'Bundespublikationen-Shop', href: '#/applications/bundespublikationen', photo: '1583521214690-73421a1829a9',
      desc: 'Publikationen und Drucksachen des Bundes ab Lager bestellen.',
      foot: 'Anwendung' },
    { title: 'Bauwerksdokumentation', href: '#/applications/dokumentenarchiv', photo: '1478860409698-8707f313ee8b',
      desc: 'Pläne, Dokumentationen und Berichte je Gebäude suchen und beziehen.',
      foot: 'Anwendung' },
  ];
  blocks.push({
    title: 'Anwendungen, Hilfsmittel und weitere Angebote',
    body: `<div class="grid grid--responsive-cols-3">${HIGHLIGHTS.map(h => C.card({
      title: h.title, desc: h.desc, href: h.href,
      photo: { id: h.photo, alt: '' },
      footerInfo: h.foot, footerAction: C.cardAction(),
    })).join('')}</div>`,
  });

  // 5 · Aktuelles — Galerie mit Bildern (CD TopNewsSection).
  if (news.length) blocks.push({
    title: 'Aktuelles',
    body: `<div class="grid grid--3">${news.map(n => C.card({
      title: n.title, desc: n.teaser,
      href: `#/news/${encodeURIComponent(n.id)}`,
      photo: { id: n.photo, color: n.color, alt: '' },
      footerInfo: `${C.escape(n.date)} · ${C.escape(n.source)}`, footerAction: C.cardAction(),
    })).join('')}</div>`,
    more: { href: '#/news', label: 'Alle Aktualitäten ansehen' },
  });

  // Der Hero ist weiss; danach wechseln die Bänder — erstes Band grau.
  const sections = blocks.map((b, i) => section(b, i % 2 === 0)).join('');

  mount.innerHTML = `
    <div class="container">
      ${/* CDs hero--main-image (hero.postcss:73-90): Inhalt links, Bild rechts im
            selben Raster; der Hero trägt den Abschnittsrhythmus selbst. Die
            Suchzeile ist der CTA-Slot. */''}
      <div class="hero hero--main-image">
        <div class="hero__content">
          <h1 class="hero__title" tabindex="-1">Willkommen im BBL Kundenportal</h1>
          <p class="hero__description">Dienstleistungen, Anwendungen, Dokumente und Daten des Bundesamts für Bauten und Logistik — an einem Ort.</p>
          <form class="home-search hero__cta" id="home-search" role="search">
            <label class="sr-only" for="home-q">Im Portal suchen</label>
            <input id="home-q" type="search" placeholder="Wonach suchen Sie? z. B. Störung, Raumbedarf, Bauprojekt…" autocomplete="off">
            <button class="btn btn--filled btn--lg btn--icon-left" type="submit">${C.icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span></button>
          </form>
        </div>
        <div class="hero__image">
          ${/* Das Bild misst 2048×1258, dargestellt wird es mit höchstens ~714 px
                — vorher lud jede Startseite 511 KB für rund ein Neuntel der
                Pixel (docs/code-review.md §5). `srcset` lässt den Browser die
                passende Grösse wählen; das AVIF bleibt als grösste Stufe für
                sehr breite oder hochauflösende Anzeigen. `width`/`height` geben
                das Seitenverhältnis vor, damit beim Laden nichts springt.
                Varianten erzeugt scripts/make-image-variants.mjs. */''}
          <figure class="hero__figure">
            <img src="assets/images/BBL-FE21_O-01-800.webp"
                 srcset="assets/images/BBL-FE21_O-01-800.webp 800w,
                         assets/images/BBL-FE21_O-01-1400.webp 1400w,
                         assets/images/BBL-FE21_O-01.avif 2048w"
                 sizes="(min-width:768px) 46vw, 92vw"
                 width="2048" height="1258"
                 alt="Der Hauptsitz des BBL an der Fellerstrasse 21 von aussen" loading="eager" decoding="async">
            <figcaption>Der Hauptsitz des BBL an der Fellerstrasse 21 von aussen — © BBL</figcaption>
          </figure>
        </div>
      </div>
    </div>
    ${sections}`;

  // Zeilenklick in der Vorgangstabelle (C.table `rowsClickable`).
  C.wireTableRows(mount);

  const searchForm = mount.querySelector('#home-search');
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = mount.querySelector('#home-q').value.trim();
    location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/search';
  });

  // Suchvorschläge — nur über Dienstleistungen und «Wissen und Hilfsmittel»,
  // beide ohne zusätzlichen Request (js/search-suggest.js erklärt, warum nicht
  // über den vollen Index). Aufräumen über den Unmount-Vertrag des Routers,
  // sonst bliebe die Liste beim Routenwechsel im DOM.
  const detach = attachSuggest(mount.querySelector('#home-q'), searchForm, core, C);
  if (ctx.onUnmount) ctx.onUnmount(detach);
}

function statusLabel(core, status) {
  const m = (core.ref().statusModel || []).find(s => s.id === status);
  return m ? m.label : status;
}
