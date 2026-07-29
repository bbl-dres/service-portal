// Übersicht (Startseite) — Arbeitsfläche, keine Nachrichtenwand.
//
// Aufbau nach der Reihenfolge, in der jemand die Seite benutzt:
//   Suche → offene Vorgänge → häufige Dienstleistungen →
//   Anwendungen und Hilfsmittel → Aktuelles.
// Begründung siehe docs/design-review.md P1-1: ein Intranet dient der
// wiederholten Aufgabenerledigung, nicht der Erstorientierung — deshalb
// ausdrücklich nicht dem Aufbau öffentlicher Bundesauftritte folgend.


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
    body: `<div class="table-wrapper" tabindex="0" role="region" aria-label="Meine offenen Vorgänge">
      <table class="table table--zebra table--compact">
        <caption class="sr-only">Meine offenen Vorgänge</caption>
        <thead><tr><th scope="col">Referenz</th><th scope="col">Titel</th>
          <th scope="col">Aktualisiert</th><th scope="col">Status</th></tr></thead>
        <tbody>${open.slice(0, 5).map(i => `<tr>
          <th scope="row"><a href="#/my-cases/${encodeURIComponent(i.instanceId)}">${C.escape(i.reference)}</a></th>
          <td>${C.escape(i.title)}</td>
          <td>${C.escape(i.updatedAt || i.createdAt)}</td>
          <td>${C.statusBadge(i.status, statusLabel(core, i.status))}</td>
        </tr>`).join('')}</tbody>
      </table></div>`,
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
  const HIGHLIGHTS = [
    { title: 'Datenportal', href: '#/app/dataportal', photo: '1551288049-bebda4e38f71',
      desc: 'Auswertungen und Kennzahlen des BBL — Energie, Immobilien, Beschaffung, Personal und Logistik.',
      foot: 'Anwendung' },
    { title: 'Liegenschaften Inventar', href: '#/app/portfolio', photo: '1515488764276-beab7607c1e6',
      desc: 'Gebäude und Grundstücke des Bundes auf der Karte, mit Flächen, Verträgen, Kosten und Dokumenten.',
      foot: 'Anwendung' },
    { title: 'Informatik und IKT-Beschaffung', href: '#/knowledge/it', photo: '1518770660439-4636190af475',
      desc: 'Mustervorlagen, Werkzeugkasten und Vorgaben für Beschaffungen im Informatikbereich.',
      foot: 'Hilfsmittel' },
    { title: 'Bundespublikationen-Shop', href: '#', photo: '1583521214690-73421a1829a9', external: true,
      desc: 'Publikationen und Drucksachen des Bundes ab Lager bestellen.',
      foot: 'Externes System' },
    { title: 'Bauwerksdokumentation', href: '#/app/document-archive', photo: '1478860409698-8707f313ee8b',
      desc: 'Pläne, Dokumentationen und Berichte je Gebäude suchen und beziehen.',
      foot: 'Anwendung' },
  ];
  blocks.push({
    title: 'Anwendungen, Hilfsmittel und weitere Angebote',
    body: `<div class="grid grid--responsive-cols-3">${HIGHLIGHTS.map(h => C.card({
      title: h.title, desc: h.desc, href: h.href, external: h.external,
      photo: { id: h.photo, alt: '' },
      footerInfo: h.foot, footerAction: C.cardAction({ external: !!h.external }),
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
    <section class="section section--default">
      <div class="container">
        <div class="home-hero">
          <div class="home-hero__content">
            <h1 tabindex="-1">Willkommen im BBL Kundenportal</h1>
            <p class="lead">Dienstleistungen, Anwendungen, Dokumente und Daten des Bundesamts für Bauten und Logistik — an einem Ort.</p>
            <form class="home-search" id="home-search" role="search">
              <label class="sr-only" for="home-q">Im Portal suchen</label>
              <input id="home-q" type="search" placeholder="Wonach suchen Sie? z. B. Störung, Raumbedarf, Bauprojekt…" autocomplete="off">
              <button class="btn btn--filled btn--lg" type="submit">${C.icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span></button>
            </form>
          </div>
          <figure class="home-hero__figure">
            <img src="assets/images/BBL-FE21_O-01.avif" alt="Der Hauptsitz des BBL an der Fellerstrasse 21 von aussen" loading="eager" decoding="async">
            <figcaption>Der Hauptsitz des BBL an der Fellerstrasse 21 von aussen — © BBL</figcaption>
          </figure>
        </div>
      </div>
    </section>
    ${sections}`;

  mount.querySelector('#home-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = mount.querySelector('#home-q').value.trim();
    location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/search';
  });
}

function statusLabel(core, status) {
  const m = (core.ref().statusModel || []).find(s => s.id === status);
  return m ? m.label : status;
}
