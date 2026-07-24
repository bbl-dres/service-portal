// Digitalisierung — Themenbereich mit Übersicht (Karten) und Detailseiten.
// Unterseiten: Digitalisierungsstrategie, Vision, Prinzipien (Ankernavigation)
// sowie Info-Landingpages zu Programm SUPERB und BIM/CDE. Inhalte der Strategie
// stammen aus der «Gesamtstrategie Digitale Immobilien» (BBL Bauten / DRES,
// Arbeitsentwurf, Stand 15.07.2026); für den Prototyp gekürzt.

import { anchorNavPage, docItem } from './grundlagen.js';

const CRUMB = [
  { label: 'Startseite', href: '#/' },
  { label: 'Daten und Digitalisierung', href: '#/data' },
  { label: 'Digitalisierung', href: '#/data/digitalisierung' },
];

export default function render(ctx) {
  const sub = ctx.params[1];
  if (!sub) return uebersicht(ctx);
  if (sub === 'strategie') return strategiePage(ctx);
  if (sub === 'vision') return visionPage(ctx);
  if (sub === 'prinzipien') return prinzipienPage(ctx);
  if (sub === 'superb') return superbPage(ctx);
  if (sub === 'bim') return bimPage(ctx);
  return notFound(ctx);
}

/* ================================ ÜBERSICHT ============================== */

const CARDS = [
  { icon: 'Book', title: 'Digitalisierungsstrategie', href: '#/data/digitalisierung/strategie',
    desc: 'Gesamtstrategie «Digitale Immobilien» des BBL Bauten — Ziele, Handlungsfelder und Steuerung bis 2030.', meta: 'Strategie 2026–2030' },
  { icon: 'Compass', title: 'Vision', href: '#/data/digitalisierung/vision',
    desc: 'Vision, Mission und Zielbild der digitalen Weiterentwicklung des Immobilienmanagements.', meta: 'Vision & Mission' },
  { icon: 'Balance', title: 'Prinzipien', href: '#/data/digitalisierung/prinzipien',
    desc: 'Die acht handlungsleitenden Prinzipien der digitalen Bundesverwaltung, angewandt im BBL.', meta: '8 Prinzipien' },
  { icon: 'Database', title: 'Programm SUPERB — SAP S/4HANA', href: '#/data/digitalisierung/superb',
    desc: 'Migration der SAP-Systeme der Bundesverwaltung auf SAP S/4HANA und ihre Bedeutung für das BBL.', meta: 'Vorhaben' },
  { icon: 'Building', title: 'BIM und Common Data Environment', href: '#/data/digitalisierung/bim',
    desc: 'Modellbasierte Planung und die gemeinsame Datenumgebung (CDE) über den Bauwerkslebenszyklus.', meta: 'Vorhaben' },
];

function uebersicht(ctx) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  setTitle('Digitalisierung');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Daten und Digitalisierung', href: '#/data' }, { label: 'Digitalisierung' }]);

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Digitalisierung',
      lead: 'Die Digitalisierung hat für das BBL einen hohen Stellenwert: Sie vereinfacht den Austausch mit den Verwaltungseinheiten, macht Prozesse durchgängig und verbessert die Datengrundlage für Bauten, Immobilien und Logistik.',
    })}
    <div class="grid grid--3 mt-8">${CARDS.map(C.domainTile).join('')}</div>

    <section class="mt-8">
      <h2>Über uns</h2>
      <p class="container__center--xs">Die Digitalisierung wird im BBL bereichsübergreifend gesteuert: Die Fachbereiche verantworten ihre Prozesse und Daten, die Informatik BBL die Plattformen und den Betrieb. Für die digitale Weiterentwicklung des Immobilienmanagements koordiniert die Organisationseinheit Digital Real Estate und Support (DRES) Strategie und Umsetzung. Für die bundesweiten Vorhaben arbeitet das BBL mit der Bundeskanzlei (Bereich DTI), dem BIT und der Digitalen Verwaltung Schweiz zusammen.</p>
    </section>

    <section class="mt-8">
      <h2>Weitere Informationen</h2>
      <ul class="list--default mt-4">
        <li><a href="#/data/ikt-vorhaben">IKT-Vorhaben — laufende und geplante Informatik-Vorhaben des BBL</a></li>
        <li><a href="#/knowledge?tab=grundlagen">Gesetzliche Grundlagen und Vorgaben</a></li>
        <li><a href="https://www.bk.admin.ch/de/digitale-bundesverwaltung" target="_blank" rel="noopener external">Strategie Digitale Bundesverwaltung (Bundeskanzlei)</a></li>
        <li><a href="#/app/dataportal">Datenportal — Auswertungen und Kennzahlen</a></li>
        <li><a href="#/data/katalog">Datenbezug — Datenkatalog nach DCAT-AP-CH</a></li>
      </ul>
    </section>
  </div>`;
}

/* =========================== STRATEGIE (Ankernav) ======================= */

function strategiePage(ctx) {
  const { C, setTitle, setCrumbs } = ctx;
  setTitle('Digitalisierungsstrategie');
  setCrumbs([...CRUMB, { label: 'Digitalisierungsstrategie' }]);

  const handlungsfelder = [
    ['Durchgängige und nutzerorientierte digitale Behördenleistungen',
      'Die wesentlichen Behördenleistungen des BBL Bauten sind nutzerorientiert gestaltet, durchgängig digital unterstützt und über Organisationsgrenzen hinweg nachvollziehbar. Mehrfacherfassungen und manuelle Übertragungen werden schrittweise reduziert.'],
    ['Verlässliche und mehrfach nutzbare Daten und Informationen',
      'Relevante Daten und Informationen sind eindeutig verantwortet, qualitätsgesichert, auffindbar und für berechtigte Aufgaben mehrfach nutzbar. Daten werden dort erfasst und gepflegt, wo sie fachlich entstehen.'],
    ['Interoperable, sichere und wirtschaftliche digitale Lösungen',
      'Fachapplikationen, Plattformen und Schnittstellen bilden ein interoperables, sicheres und wirtschaftlich tragfähiges Ökosystem. Gemeinsame Bundesdienste und Standards haben Vorrang vor Einzellösungen.'],
    ['Verbindliche Architektur und wirksame Steuerung',
      'Eine verbindliche Referenzarchitektur, klare Entscheidungswege und risikogerechte Prüfpunkte (Architekturprüfungen, Quality Gates) richten Vorhaben auf das gemeinsame Zielbild aus und sichern die rechtskonforme, sichere, wirtschaftliche und nachhaltige Betriebsfähigkeit.'],
  ];

  const sections = [
    { id: 'st-auftrag', title: 'Auftrag und Zweck',
      html: `<p>Das BBL nimmt als Bau- und Liegenschaftsorgan des Bundes Querschnittsaufgaben für die zivile Bundesverwaltung wahr (Verordnung über das Immobilienmanagement und die Logistik des Bundes, VILB). Die Gesamtstrategie «Digitale Immobilien» legt Ziele und Leitplanken für die digitale Weiterentwicklung des Bereichs Bauten fest und übersetzt die Vorgaben der digitalen Bundesverwaltung in einen gemeinsamen Rahmen.</p>
        <p>Der Handlungsbedarf entsteht weniger aus fehlenden Einzelwerkzeugen als aus der ungenügenden Abstimmung von Leistungen, Daten, Lösungen und Verantwortlichkeiten. Ziel ist keine neue Systemlandschaft auf der grünen Wiese, sondern die gezielte und schrittweise Weiterentwicklung des Bestehenden.</p>` },
    { id: 'st-handlungsfelder', title: 'Vier Handlungsfelder mit Zielzustand 2030',
      html: `<p class="muted">Bis 2030 verfolgt das BBL Bauten vier Handlungsfelder mit je einem Zielzustand.</p>
        <div class="grid grid--2 mt-4">${handlungsfelder.map(([t, d], i) => `<div class="box">
          <h3>${i + 1}. ${C.escape(t)}</h3><p class="m-0">${C.escape(d)}</p></div>`).join('')}</div>` },
    { id: 'st-umsetzung', title: 'Umsetzung und Steuerung',
      html: `<p>Die Strategie gibt die Ausrichtung bis 2030 vor; die konkrete Umsetzung erfolgt über einen jährlich aktualisierten Umsetzungsplan «Digitale Immobilien» mit Massnahmen, Verantwortlichkeiten, Ressourcen, Abhängigkeiten und wenigen geeigneten Indikatoren. Die Wirkungsmessung stützt sich vorrangig auf amtsbezogene Indikatoren übergeordneter Bundesstrategien.</p>
        <p>Die fachliche Verantwortung verbleibt bei den zuständigen Organisationseinheiten; die Organisationseinheit Digital Real Estate und Support (DRES) koordiniert Strategie und Umsetzungsplan und pflegt die Referenzarchitektur. Der Programmhorizont reicht bis 2034.</p>` },
    { id: 'st-dokumente', title: 'Dokumente',
      html: `<ul class="download-items">
        ${docItem(C, { title: 'Gesamtstrategie «Digitale Immobilien»', desc: 'Vollständige Strategie des BBL Bauten (Arbeitsentwurf).', href: '#', meta: ['PDF', 'Stand 15.07.2026'] })}
        ${docItem(C, { title: 'Umsetzungsplan «Digitale Immobilien»', desc: 'Jährlich aktualisierter Umsetzungsplan mit Massnahmen und Indikatoren.', href: '#', meta: ['PDF', 'jährlich'] })}
      </ul>` },
  ];

  anchorNavPage(ctx, {
    title: 'Digitalisierungsstrategie',
    lead: 'Gesamtstrategie «Digitale Immobilien» des BBL Bauten — wie das Immobilienmanagement der zivilen Bundesverwaltung digital, datenbasiert, sicher und wirtschaftlich weiterentwickelt wird.',
    intro: 'Strategiezeitraum 2026–2030, Programmhorizont bis 2034. Im Prototyp gekürzte Fassung eines Arbeitsentwurfs (Stand 15. Juli 2026).',
    sections,
    back: { href: '#/data/digitalisierung', label: 'Digitalisierung' },
  });
}

/* ============================= VISION (Ankernav) ======================== */

function visionPage(ctx) {
  const { setTitle, setCrumbs } = ctx;
  setTitle('Vision');
  setCrumbs([...CRUMB, { label: 'Vision' }]);

  const sections = [
    { id: 'vi-vision', title: 'Vision',
      html: `<p>Das BBL Bauten erfüllt seinen Auftrag im Immobilienmanagement digital unterstützt, nutzerorientiert, durchgängig und nachvollziehbar. Relevante Informationen sind für die jeweilige Aufgabe auffindbar und verlässlich. Die digitale Infrastruktur ist interoperabel, sicher, nachhaltig und an bundesweite Standards und Dienste anschlussfähig.</p>
        <p>«Digitale Immobilien» stehen nicht für eine maximale Erfassung von Daten, sondern für eine zweckmässige, wirtschaftliche und lebenszyklusorientierte Informationsführung.</p>` },
    { id: 'vi-mission', title: 'Mission',
      html: `<p>Wir gestalten die digitale Weiterentwicklung des Immobilienmanagements des Bundes als fachlich verantwortliches Bau- und Liegenschaftsorgan. Dazu entwickeln wir Leistungen, Daten, Prozesse, Lösungen und Kompetenzen als integriertes Ganzes weiter.</p>
        <p>Digitale Methoden sind kein Selbstzweck: Sie werden dort eingesetzt, wo sie die Aufgabenerfüllung verbessern, Medienbrüche reduzieren, Entscheide unterstützen und die Zusammenarbeit über den Immobilienlebenszyklus stärken.</p>` },
    { id: 'vi-zielbild', title: 'Zielbild «Digitale Immobilien»',
      html: `<p>Das Zielbild verbindet den gesetzlichen Auftrag und die fachliche Wertschöpfung des BBL Bauten mit den Voraussetzungen der digitalen Verwaltung. Innerhalb des Rahmens aus Gesetzen, Vorgaben und Strategien unterstützt die digitale Weiterentwicklung den gesamten Immobilienkreislauf:</p>
        <ul class="list--default">
          <li>Portfolio steuern und entwickeln</li>
          <li>Vorhaben realisieren</li>
          <li>Immobilien nutzen und betreiben</li>
          <li>Immobilien erneuern, rückbauen oder verkaufen</li>
        </ul>
        <p>Im Zentrum stehen digitale Behördenleistungen sowie die beteiligten Kunden und Nutzenden, Partner und Lieferanten; Immobilien und Daten bilden die gemeinsame fachliche Grundlage.</p>` },
  ];

  anchorNavPage(ctx, {
    title: 'Vision',
    lead: 'Vision, Mission und Zielbild der Strategie «Digitale Immobilien» des BBL Bauten.',
    sections,
    back: { href: '#/data/digitalisierung', label: 'Digitalisierung' },
  });
}

/* =========================== PRINZIPIEN (Ankernav) ====================== */

const PRINZIPIEN = [
  ['pr-1', 'Digital by Design', 'Digitale Möglichkeiten werden von Beginn an in Leistungen und Prozessen berücksichtigt (auch Digital First und Digital Only).'],
  ['pr-2', 'Datengetrieben', 'Daten und Informationen werden verantwortungsvoll bewirtschaftet und, soweit sinnvoll, mehrfach genutzt (Once-Only).'],
  ['pr-3', 'Verwaltung als Plattform', 'Gemeinsame Dienste, Standards und wiederverwendbare Lösungen haben Vorrang vor isolierten Einzellösungen (Interoperabilität).'],
  ['pr-4', 'Offenheit', 'Daten, Standards, Schnittstellen und Lösungen werden soweit möglich offen, nachvollziehbar und anschlussfähig gestaltet (Transparenz).'],
  ['pr-5', 'Nutzerzentriert', 'Leistungen orientieren sich an den Aufgaben und Bedürfnissen der Nutzenden und berücksichtigen Barrierefreiheit (Inklusion).'],
  ['pr-6', 'Proaktivität', 'Neue Anforderungen, Risiken und technische Entwicklungen werden früh erkannt und zweckmässig aufgenommen (Innovation).'],
  ['pr-7', 'Sicherheit', 'Informationssicherheit, Datenschutz, Vertrauenswürdigkeit und digitale Souveränität werden von Beginn an berücksichtigt.'],
  ['pr-8', 'Nachhaltigkeit', 'Digitale Lösungen werden wirtschaftlich, ökologisch und sozial nachhaltig gestaltet und betrieben.'],
];

function prinzipienPage(ctx) {
  const { C, setTitle, setCrumbs } = ctx;
  setTitle('Prinzipien');
  setCrumbs([...CRUMB, { label: 'Prinzipien' }]);

  const sections = PRINZIPIEN.map(([id, titel, text], i) => ({
    id, title: `${i + 1}. ${titel}`, html: `<p>${C.escape(text)}</p>`,
  }));
  sections.push({
    id: 'pr-leitplanken', title: 'Verbindliche Leitplanken',
    html: `<p>Die handlungsleitenden Prinzipien bestimmen die strategische Ausrichtung. Verbindlich sind die Rechtsgrundlagen sowie die anwendbaren Vorgaben der digitalen Transformation und IKT-Lenkung — insbesondere zu Architektur, Daten und Interoperabilität, Informationssicherheit, Datenschutz, digitaler Souveränität und nachhaltiger digitaler Transformation.</p>
      <p>Das BBL übersetzt diese Vorgaben in verständliche Checklisten, Architekturvorgaben und risikogerechte Prüfpunkte. Kann eine verbindliche Vorgabe nicht eingehalten werden, wird die Abweichung nachvollziehbar begründet und auf der zuständigen Führungsebene entschieden.</p>` });

  anchorNavPage(ctx, {
    title: 'Prinzipien',
    lead: 'Die acht handlungsleitenden Prinzipien der Strategie Digitale Bundesverwaltung, angewandt im Immobilienkontext des BBL.',
    sections,
    back: { href: '#/data/digitalisierung', label: 'Digitalisierung' },
  });
}

/* ===================== INFO-LANDINGPAGES (Platzhalter) ================== */

function infoPage(ctx, { title, lead, note, photo }) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  setTitle(title);
  setCrumbs([...CRUMB, { label: title }]);
  const head = photo
    ? `<div class="hero hero--main-image">
         <div class="hero__content">
           <h1 class="hero__title" tabindex="-1">${C.escape(title)}</h1>
           <p class="hero__description">${C.escape(lead)}</p>
         </div>
         <div class="hero__image"><figure>
           ${C.photo({ id: photo, color: '#2f4356', alt: '', w: 800 })}
           <figcaption class="small muted">Symbolbild — © Unsplash</figcaption>
         </figure></div>
       </div>`
    : C.pageHeader({ title, lead });
  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: '#/data/digitalisierung', backLabel: 'Digitalisierung' })}
    ${head}
    <div class="mt-6" style="max-width:60rem">
      ${C.notification(note, 'info', 'InfoCircle')}
    </div>
  </div>`;
}

function superbPage(ctx) {
  return infoPage(ctx, {
    title: 'Programm SUPERB — SAP S/4HANA',
    lead: 'Mit dem Programm SUPERB migriert die Bundesverwaltung ihre bisherigen SAP-Systeme (ECC) auf die neue Generation SAP S/4HANA. Für das BBL betrifft das Finanzen, Beschaffung, Logistik und die Immobilienbewirtschaftung — und damit die Datenbasis vieler Fachanwendungen.',
    note: 'Diese Info-Landingpage ist im Prototyp ein Platzhalter — der ausführliche Inhalt zum Programm SUPERB folgt.',
    photo: '1522071820081-009f0129c71c',
  });
}

function bimPage(ctx) {
  return infoPage(ctx, {
    title: 'BIM und Common Data Environment',
    lead: 'Bauprojekte des BBL werden modellbasiert geplant und übergeben. Das Common Data Environment (CDE) ist die gemeinsame Datenumgebung für alle Projektbeteiligten über den ganzen Bauwerkslebenszyklus.',
    note: 'Diese Info-Landingpage ist im Prototyp ein Platzhalter — der ausführliche Inhalt zu BIM und CDE folgt.',
    photo: '1541888946425-d81bb19240f5',
  });
}

/* ---------------------------------------------------------------------- */

function notFound(ctx) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  setTitle('Seite nicht gefunden');
  setCrumbs([...CRUMB, { label: 'Nicht gefunden' }]);
  mount.innerHTML = C.notFound({ backHref: '#/data/digitalisierung', backLabel: 'Digitalisierung',
    title: 'Seite nicht gefunden',
    body: 'Diese Seite existiert nicht. <a href="#/data/digitalisierung">Zur Übersicht «Digitalisierung»</a>' });
}
