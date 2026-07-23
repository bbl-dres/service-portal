// Digitalisierung — Landing-Page zur Digitalisierungsstrategie des BBL.
// Aufbau nach dem CD-Muster einer Themen-Landingpage (vgl. blw.admin.ch/de/digitalisierung):
// Lead, datierte Teaser auf die Vorhaben, ein erklärender Block, Linkliste.

const TEASERS = [
  {
    title: 'Digitalisierungsstrategie BBL',
    date: '2026-04-15',
    photo: '1460925895917-afdab827c52f',
    desc: 'Die Strategie legt fest, wie das BBL seine Leistungen bis 2030 digital erbringt: durchgängige Prozesse statt PDF- und Mailformulare, ein gemeinsamer Datenkern und eine einheitliche Oberfläche nach CD Bund.',
    href: '#/knowledge?tab=weisungen',
    cta: 'Zur Strategie',
  },
  {
    title: 'Programm SUPERB — SAP S/4HANA',
    date: '2026-03-02',
    photo: '1518186285589-2f7649de83e0',
    desc: 'Mit SUPERB löst die Bundesverwaltung ihre SAP-Systeme ab. Für das BBL betrifft das Beschaffung, Logistik und Immobilienbewirtschaftung — und damit die Datenbasis vieler Fachanwendungen.',
    href: '#/applications',
    cta: 'Betroffene Anwendungen',
  },
  {
    title: 'BIM und Common Data Environment',
    date: '2026-02-10',
    photo: '1581092160562-40aa08e78837',
    desc: 'Bauprojekte des BBL werden modellbasiert geplant und übergeben. Das Common Data Environment (CDE) ist die gemeinsame Datenumgebung für Projektbeteiligte über den ganzen Lebenszyklus.',
    href: '#/applications?bereich=bauten',
    cta: 'Fachanwendungen Bauten',
  },
];

const GRUNDSAETZE = [
  ['Digital vor Papier', 'Jede Dienstleistung wird als digitales Formular angeboten; PDF- und Mailformulare werden abgelöst.'],
  ['Einmal erfassen, mehrfach nutzen', 'Gebäude-, Projekt- und Organisationsdaten werden einmal geführt und über den gemeinsamen Datenkern genutzt.'],
  ['Nachvollziehbar', 'Jeder Vorgang hat einen Status, eine zuständige Stelle und eine Historie — sichtbar unter «Meine Vorgänge».'],
  ['Barrierefrei nach CD Bund', 'Alle Oberflächen folgen dem Corporate Design des Bundes und erfüllen die Anforderungen an die Barrierefreiheit.'],
];

const WEITERE = [
  { label: 'Anleitungen und FAQ zur digitalen Zusammenarbeit', href: '#/knowledge?tab=anleitungen' },
  { label: 'Weisungen und Vorgaben', href: '#/knowledge?tab=weisungen' },
  { label: 'Datenportal — Auswertungen und Kennzahlen', href: '#/app/dataportal' },
  { label: 'Datenbezug — Datenkatalog nach DCAT-AP-CH', href: '#/data/katalog' },
];

export default function render(ctx) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  setTitle('Digitalisierung');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Digitalisierung' },
  ]);

  const teaser = (t) => `
    <a class="card card--default card--clickable" href="${t.href}">
      <div class="card__image">${C.photo({ id: t.photo, color: '#2f4356', alt: '', w: 640 })}</div>
      <div class="card__content">
        <div class="card__body">
          <span class="small muted">${C.escape(t.date)}</span>
          <div class="card__title">${C.escape(t.title)}</div>
          <p class="card__description">${C.escape(t.desc)}</p>
        </div>
        <div class="card__footer">
          <span></span><span class="btn btn--link">${C.escape(t.cta)} ${C.icon('ArrowRight', 'icon--base')}</span>
        </div>
      </div>
    </a>`;

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Digitalisierung',
      lead: 'Die Digitalisierung hat für das BBL einen hohen Stellenwert: Sie soll den Austausch mit den Verwaltungseinheiten vereinfachen, Prozesse durchgängig machen und die Datengrundlage für Bauten, Immobilien und Logistik verbessern.',
    })}

    <div class="grid grid--3 mt-8">${TEASERS.map(teaser).join('')}</div>

    <section class="mt-8">
      <h2>Grundsätze</h2>
      <div class="grid grid--2 mt-4">
        ${GRUNDSAETZE.map(([t, d]) => `<div class="box">
          <h3>${C.escape(t)}</h3>
          <p class="m-0">${C.escape(d)}</p>
        </div>`).join('')}
      </div>
    </section>

    <section class="mt-8">
      <h2>Über uns</h2>
      <p class="container__center--xs">Die Digitalisierung wird im BBL bereichsübergreifend gesteuert: Die Fachbereiche verantworten ihre Prozesse und Daten, die Informatik BBL die Plattformen und den Betrieb. Für die Vorhaben der Bundesverwaltung arbeitet das BBL mit dem Bundesamt für Informatik und Telekommunikation (BIT) und der Digitalen Verwaltung Schweiz zusammen.</p>
    </section>

    <section class="mt-8">
      <h2>Weitere Informationen</h2>
      <ul class="list--default mt-4">
        ${WEITERE.map(w => `<li><a href="${w.href}">${C.escape(w.label)}</a></li>`).join('')}
      </ul>
    </section>
  </div>`;
}
