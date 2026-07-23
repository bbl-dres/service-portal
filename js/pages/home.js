// Übersicht (Startseite) — Arbeitsfläche, keine Nachrichtenwand.
//
// Aufbau nach der Reihenfolge, in der jemand die Seite benutzt:
//   Suche → offene Vorgänge → Themen → häufige Dienstleistungen →
//   Anwendungen und Daten → Aktuelles.
// Begründung siehe docs/design-review.md P1-1: ein Intranet dient der
// wiederholten Aufgabenerledigung, nicht der Erstorientierung — deshalb
// ausdrücklich nicht dem Aufbau öffentlicher Bundesauftritte folgend.

import { INTRANET_AREAS } from '../intranet-areas.js';

const CLOSED = ['abgeschlossen', 'erledigt', 'geliefert'];

export default async function render(ctx) {
  const { mount, core, engine, session, C, setTitle, setCrumbs } = ctx;
  setTitle('Übersicht');
  setCrumbs([]);

  const services = core.services();
  const apps = core.applications();
  const news = core.news().slice(0, 3);
  const cases = engine.instances();
  const open = cases.filter(i => !CLOSED.includes(i.status));

  /* ---------------------------------------------------------- Bausteine -- */

  // CD-Muster (indexPage.vue, ServicesSection.vue): volle-Breite-Abschnitte,
  // die Weiss / secondary-50 abwechseln; Titel oben als .section__title, der
  // «Alle …»-Verweis unten rechts als .section__action mit btn--bare. Der
  // Inhalt sitzt im .container. `alt` wird beim Zusammenbau nach Reihenfolge
  // gesetzt, damit die Bänder immer sauber wechseln.
  const section = ({ title, body, more }, alt) => `
    <section class="section section--default${alt ? ' bg--secondary-50' : ''}">
      <div class="container">
        <h2 class="section__title">${C.escape(title)}</h2>
        ${body}
        ${more ? `<div class="section__action">
          <a class="btn btn--bare" href="${more.href}">${C.escape(more.label)} ${C.icon('ArrowRight', 'icon--base')}</a>
        </div>` : ''}
      </div>
    </section>`;

  // Häufige Dienstleistung — Textkachel, kein Bild: hier zählt das Ziel,
  // nicht die Illustration.
  const serviceTile = (s) => `
    <a class="quick-tile plain-link" href="#/services/${encodeURIComponent(s.serviceId)}">
      ${C.icon(s.icon || 'ArrowRight', 'icon--md')}
      <span>
        <span class="quick-tile__label">${C.escape(s.title)}</span>
        <span class="quick-tile__meta">${C.escape(s.short)}</span>
      </span>
    </a>`;

  const linkTile = (o) => `
    <a class="quick-tile plain-link" href="${o.href}">
      ${C.icon(o.icon, 'icon--md')}
      <span>
        <span class="quick-tile__label">${C.escape(o.label)}</span>
        <span class="quick-tile__meta">${C.escape(o.meta)}</span>
      </span>
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
  const popular = services.filter(s => s.popular);
  if (popular.length) blocks.push({
    title: 'Häufig gebraucht',
    body: `<div class="quick-grid">${popular.map(serviceTile).join('')}</div>`,
    more: { href: '#/services', label: 'Alle Dienstleistungen ansehen' },
  });

  // 3 · Anwendungen und Daten — Schlüsselanwendungen plus die Einstiege.
  const heroApps = apps.filter(a => a.hero).map(a => ({
    icon: a.icon || 'Apps', label: a.name, meta: a.group,
    href: `#/applications/${encodeURIComponent(a.appId)}`,
  }));
  const dataEntries = [
    { icon: 'ChartBar', label: 'Datenportal', meta: '6 Themen mit Auswertungen', href: '#/app/dataportal' },
    { icon: 'FileDatabase', label: 'Datenbezug', meta: `${core.datasets().length} Datensätze`, href: '#/data/katalog' },
    { icon: 'Apps', label: 'Alle Anwendungen', meta: `${apps.length} Anwendungen`, href: '#/applications' },
  ];
  blocks.push({
    title: 'Anwendungen und Daten',
    body: `<div class="quick-grid">${[...heroApps, ...dataEntries].map(linkTile).join('')}</div>`,
    more: { href: '#/data', label: 'Daten und Digitalisierung ansehen' },
  });

  // 4 · Bestellen und weitere Angebote — Bildergalerie mit Verweisen auf die
  //     Aufgabenbereiche im BBL-Intranet (extern).
  const areaCard = (a) => C.card({
    title: a.label, desc: a.desc, href: a.overview, external: true,
    photo: { id: a.photo, alt: '' },
    footer: `<span>BBL-Intranet</span><span class="btn btn--link">Öffnen ${C.icon('External', 'icon--base')}</span>`,
  });
  blocks.push({
    title: 'Bestellen und weitere Angebote',
    body: `<div class="grid grid--3">${INTRANET_AREAS.map(areaCard).join('')}</div>`,
  });

  // 5 · Aktuelles — Galerie mit Bildern (CD TopNewsSection).
  if (news.length) blocks.push({
    title: 'Aktuelles',
    body: `<div class="grid grid--3">${news.map(n => C.card({
      title: n.title, desc: n.teaser,
      href: `#/knowledge?tab=news&id=${encodeURIComponent(n.id)}`,
      photo: { id: n.photo, color: n.color, alt: '' },
      footer: `<span>${C.escape(n.date)} · ${C.escape(n.source)}</span>
        <span class="btn btn--link">Weiterlesen ${C.icon('ArrowRight', 'icon--base')}</span>`,
    })).join('')}</div>`,
    more: { href: '#/knowledge?tab=news', label: 'Alle Aktualitäten ansehen' },
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
