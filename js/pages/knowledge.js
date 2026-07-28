import { grundlagenPage, anchorNavPage } from './grundlagen.js';

// News und Wissen — Abschnitts-Übersicht plus eigenständige Unterseiten: News,
// Prozesse, Gesetzliche Grundlagen und Vorgaben, Anleitungen. Diese sind echte
// Seiten (eigenes h1, Brotkrume, Zurück-Link) und deshalb über einen Pfad
// adressiert — `#/knowledge/<abschnitt>` — nicht über einen `?tab=`-Parameter
// (der bleibt echten In-Page-Tabs vorbehalten, siehe docs/sitemap.md). Ein
// weiteres Pfadsegment öffnet ein Detail: `#/knowledge/grundlagen/<id>` (Weisung),
// `#/knowledge/news/<id>` (Meldung).
const PAGES = {
  news:        { title: 'News', lead: 'Aktuelle Mitteilungen rund um das BBL, das Kundenportal und die Bundesverwaltung.' },
  prozesse:    { title: 'Prozessdokumentation', lead: 'Die Prozesslandschaft des BBL im Prozessportal Archimap sowie häufige Fragen zur Zusammenarbeit.' },
  grundlagen:  { title: 'Gesetzliche Grundlagen und Vorgaben', lead: 'Die für das BBL massgebenden Erlasse, übergeordneten Vorgaben des Bundes und internen Weisungen — thematisch gegliedert.' },
  anleitungen: { title: 'Anleitungen und Schulungsunterlagen', lead: 'Kurzanleitungen, Schulungsunterlagen und Lernvideos zur Nutzung des Kundenportals und seiner Dienstleistungen.' },
};

export default async function render(ctx) {
  const { mount, params, core, C, setTitle, setCrumbs } = ctx;
  const section = params[0];
  const id = params[1] ? C.safeDecode(params[1]) : '';

  if (!section || !PAGES[section]) return overview(ctx);

  // Detailseiten mit eigener Identität (h1, Titel, Brotkrume) — Review P1-6.
  if (section === 'news' && id) return newsDetail(ctx, id);
  if (section === 'grundlagen' && id) {
    const w = core.weisung(id);
    if (w) return weisungPage(ctx, w);
  }
  // Grundlagen und Prozesse teilen das CD-Ankernavigations-Layout (Abschnitte
  // links, Inhaltsverzeichnis rechts, KBOB-/detailPageAnchorNav-Muster).
  if (section === 'grundlagen') return grundlagenPage(ctx, PAGES.grundlagen);
  if (section === 'prozesse') return prozessePage(ctx, PAGES.prozesse);
  if (section === 'anleitungen') return anleitungenPage(ctx, PAGES.anleitungen);

  // Verbleibt: News-Liste.
  const page = PAGES[section];
  setTitle(page.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News und Wissen', href: '#/knowledge' }, { label: page.title }]);
  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/knowledge', 'News und Wissen')}
    ${C.pageHeader({ title: page.title, lead: page.lead })}
    ${newsList(ctx)}
  </div>`;
}

/* ============================ WEISUNGEN & VORGABEN ======================== */

// Section overview — CD pattern: lead + cards onto everything the section holds.
function overview(ctx) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  setTitle('News und Wissen');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News und Wissen' }]);

  const news = core.news();

  const entries = [
    { title: 'Gesetzliche Grundlagen und Vorgaben', icon: 'Book', href: '#/knowledge/grundlagen',
      desc: 'Erlasse, übergeordnete Vorgaben des Bundes und die internen Weisungen des BBL — thematisch gegliedert.',
      meta: 'Gesetze, Vorgaben & Weisungen' },
    { title: 'News', icon: 'Bell', href: '#/knowledge/news',
      desc: 'Aktuelle Mitteilungen rund um das BBL, das Kundenportal und die Bundesverwaltung.',
      meta: `${news.length} Meldungen` },
    { title: 'Prozessdokumentation', icon: 'InfoCircle', href: '#/knowledge/prozesse',
      desc: 'Die Prozesslandschaft des BBL im Prozessportal Archimap sowie häufige Fragen (FAQ).',
      meta: 'Prozessportal & FAQ' },
    { title: 'Anleitungen und Schulungsunterlagen', icon: 'Desktop', href: '#/knowledge/anleitungen',
      desc: 'Kurzanleitungen, Schulungsunterlagen und Lernvideos zur Nutzung der Plattform.',
      meta: 'Anleitungen & Schulung' },
  ].map(C.domainTile).join('');

  // Wie data.js: Kopfband weiss, Kachelband getönt (Item 7.7). Die vormals
  // sr-only-Überschrift trägt jetzt sichtbar das zweite Band.
  mount.innerHTML = `
    ${C.pageSection({
      body: C.pageHeader({
        title: 'News und Wissen',
        lead: 'Aktuelles aus dem BBL, die Prozesse und Vorlagen für die Zusammenarbeit sowie die geltenden Weisungen und Vorgaben.',
      }),
    })}
    ${C.pageSection({ title: 'Bereiche', alt: true, body: `<div class="grid grid--2">${entries}</div>` })}`;
}

function typeVariant(type) {
  const m = { Weisung: 'info', Verordnung: 'blue', Richtlinie: 'gray', Vorgabe: 'gray' };
  return m[type] || 'gray';
}
function forceBadge(C, f) {
  return f === 'verbindlich' ? C.badge('verbindlich', 'red') : C.badge('empfehlend', 'gray');
}
function statusBadge(C, s) {
  return s === 'in_kraft' ? C.badge('In Kraft', 'success') : C.badge('Aufgehoben', 'gray');
}



function weisungPage(ctx, w) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  const related = (w.relatedServices || []).map(sid => ({ sid, s: core.service(sid) })).filter(x => x.s);
  const successor = w.supersededBy ? core.weisung(w.supersededBy) : null;

  setTitle(w.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News und Wissen', href: '#/knowledge' },
    { label: 'Gesetzliche Grundlagen und Vorgaben', href: '#/knowledge/grundlagen' }, { label: w.title }]);

  mount.innerHTML = `
  <div class="container section">
    ${C.detailHead({
      backHref: '#/knowledge/grundlagen', backLabel: 'Gesetzliche Grundlagen und Vorgaben',
      title: w.title, lead: w.summary,
      tags: `<code class="badge badge--gray" style="font-family:ui-monospace,Consolas,monospace">${C.escape(w.code)}</code>${C.badge(w.type, typeVariant(w.type))}${forceBadge(C, w.bindingForce)}${statusBadge(C, w.status)}`,
      image: C.photo({ id: '1522071820081-009f0129c71c', alt: '', w: 800 }),
    })}
    ${w.status === 'aufgehoben' && successor
      ? C.notification(`Diese Weisung ist <strong>aufgehoben</strong>. Abgelöst durch <a href="#/knowledge/grundlagen/${encodeURIComponent(successor.directiveId)}">${C.escape(successor.code)} — ${C.escape(successor.title)}</a>.`, 'warning', 'WarningCircle')
      : w.status === 'aufgehoben'
        ? C.notification('Diese Weisung ist <strong>aufgehoben</strong>.', 'warning', 'WarningCircle')
        : ''}
    <div class="container--grid gap--responsive mt-6">
      <div class="container__main stack">
        ${w.scope ? `<div><h3>Geltungsbereich</h3><p style="margin:0">${C.escape(w.scope)}</p></div>` : ''}
        ${w.legalBasis && w.legalBasis !== '—' ? `<div><h3>Rechtsgrundlage</h3><p style="margin:0">${C.escape(w.legalBasis)}</p></div>` : ''}
        <div class="row gap-sm mt-2">
          <a class="btn btn--outline" href="${w.documentUrl || '#'}">${C.icon('Download', 'icon--base')} Dokument herunterladen</a>
        </div>
      </div>
      <aside class="container__aside stack-lg">
        <div class="box">
          <h3>Eckdaten</h3>
          <dl class="kv" style="margin:0">
            <dt>Code</dt><dd>${C.escape(w.code)}</dd>
            <dt>Typ</dt><dd>${C.escape(w.type)}</dd>
            <dt>Thema</dt><dd>${C.escape(w.topic || '—')}</dd>
            <dt>Erlassen von</dt><dd>${C.escape(w.issuingBody)}</dd>
            <dt>Status</dt><dd>${w.status === 'in_kraft' ? 'In Kraft' : 'Aufgehoben'}</dd>
            <dt>Verbindlichkeit</dt><dd>${C.escape(w.bindingForce)}</dd>
            <dt>Gültig ab</dt><dd>${C.escape(w.validFrom)}</dd>
            <dt>Version</dt><dd>${C.escape(w.version)}</dd>
            <dt>Geltungsbereich</dt><dd>${C.escape(w.scope || '—')}</dd>
          </dl>
        </div>
        ${related.length ? `<div class="box">
          <h3>Zugehörige Dienstleistungen</h3>
          ${related.map(x => `<a class="row gap-sm" style="padding:.35rem 0" href="#/services/${encodeURIComponent(x.sid)}">${C.icon('Briefcase', 'icon--base')}<span class="small">${C.escape(x.s.title)}</span></a>`).join('')}
        </div>` : ''}
      </aside>
    </div>
  </div>`;
}


/* ================================ AKTUELLES =============================== */

// Einzelne Meldung als eigene Seite (eigener Titel, h1, Brotkrume).
function newsDetail(ctx, id) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  const n = core.newsItem(id);
  if (!n) {
    setTitle('Meldung nicht gefunden');
    setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News und Wissen', href: '#/knowledge' }, { label: 'News', href: '#/knowledge/news' }]);
    mount.innerHTML = C.notFound({ backHref: '#/knowledge/news', backLabel: 'News',
      title: 'Meldung nicht gefunden',
      body: 'Diese Meldung existiert nicht. <a href="#/knowledge/news">Zur Übersicht «News»</a>' });
    return;
  }
  setTitle(n.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News und Wissen', href: '#/knowledge' },
    { label: 'News', href: '#/knowledge/news' }, { label: n.title }]);
  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/knowledge/news', 'News')}
    ${/* Die einzige lange Lesefläche der App. Mass und Rhythmus kamen bisher aus
          einem Inline-`max-width:60rem` und `.stack` (1rem zwischen JEDEM Kind):
          Datumszeile, Titel, Bild, Lead, Trenner und Fliesstext standen alle
          gleich weit auseinander — die vertikale Achse trug keine Hierarchie,
          und bei 1440px mass der Text 107 Zeichen pro Zeile. CDs Antwort für
          genau diese Seite ist container__center--xs + .vertical-spacing.
          Datumszeile und Titel bleiben als <header> eng beieinander. */''}
    <div class="container--grid">
      <article class="container__center--xs vertical-spacing mt-4">
        <header>
          <p class="small muted">${C.escape(n.date)} · ${C.escape(n.source)}</p>
          <h1 tabindex="-1">${C.escape(n.title)}</h1>
        </header>
        ${C.photo({ id: n.photo, color: n.color, alt: '', w: 1200, style: 'aspect-ratio:21/9;max-height:20rem;border-radius:var(--radius-lg)' })}
        <p class="lead">${C.escape(n.teaser)}</p>
        <div class="separator separator--md"></div>
        <p>${C.escape(n.body)}</p>
      </article>
    </div>
  </div>`;
}

// Meldungsliste als Seiteninhalt (Kopf setzt die Aufrufseite).
function newsList(ctx) {
  const { core, C } = ctx;
  const items = [...core.news()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return `
    <h2 class="sr-only">Aktualitäten</h2>
    <div class="grid grid--3 mt-6">
      ${/* Eine Quelle für die Nachrichtenkarte: C.card liefert das Stretched-Link-
            Muster (echte <h3> für die Gliederung) und den CD-Kartenfuss. Die
            bisherige Handverdrahtung hatte einen <div class="card__title">, keinen
            .card__content-Rahmen und einen leeren <span> als Info-Slot. */''}
      ${items.map(n => C.card({
        title: n.title, desc: n.teaser,
        href: `#/knowledge/news/${encodeURIComponent(n.id)}`,
        photo: { id: n.photo, color: n.color, alt: '' },
        footerInfo: `${C.escape(n.date)} · ${C.escape(n.source)}`, footerAction: C.cardAction(),
      })).join('')}
    </div>`;
}

/* =========================== PROZESSDOKUMENTATION ======================= */

// Prozessdokumentation: Verweis auf das Prozessportal (Archimap) plus häufige
// Fragen — im selben Ankernavigations-Layout wie die übrigen Wissens-Seiten.
function prozessePage(ctx, page) {
  const { C, setTitle, setCrumbs } = ctx;
  setTitle(page.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News und Wissen', href: '#/knowledge' }, { label: page.title }]);

  const faqs = [
    { q: 'Wie melde ich zusätzlichen Raumbedarf an?', a: 'Öffnen Sie unter «Dienstleistungen» den Service «Raumbedarf melden» und folgen Sie dem geführten Antrag. Nach dem Absenden entsteht ein Vorgang, den Sie unter «Meine Vorgänge» verfolgen.' },
    { q: 'Welche Weisung gilt für die Flächenstandards?', a: 'Massgebend ist die Weisung «Neue Arbeitswelten (NAW)». Sie finden sie unter «Gesetzliche Grundlagen und Vorgaben».' },
    { q: 'Wo finde ich Bauwerksdokumentationen zu einem Gebäude?', a: 'Unter «Daten und Digitalisierung» bzw. im Dokumentenarchiv lassen sich Pläne und Dokumentationen pro Gebäude suchen und herunterladen.' },
    { q: 'Wie melde ich einen Sicherheits- oder Datenschutzvorfall?', a: 'Nutzen Sie den Service «Sicherheitsvorfall melden». Grundlagen sind das Informationssicherheitsgesetz (ISG) und das Datenschutzmerkblatt (DSG).' },
    { q: 'An wen wende ich mich bei Rückfragen zu einem Vorgang?', a: 'Verwenden Sie die Referenznummer (Format BBL-JJJJ-XXXX) aus der Detailansicht Ihres Vorgangs für Rückfragen.' },
  ];

  const faqHtml = C.accordion(faqs.map(f => ({ title: f.q, body: `<p style="margin:0">${C.escape(f.a)}</p>` })), { id: 'faq' });

  const portalHtml = `
    <p>Die vollständige Prozesslandschaft des BBL — Abläufe, Rollen und Zuständigkeiten — wird im Prozessportal Archimap gepflegt.</p>
    <div class="row mt-4">
      <a class="btn btn--outline btn--lg" href="https://prozesse-archimap.admin.ch" target="_blank" rel="noopener external">Zum Prozessportal (Archimap) ${C.icon('External', 'icon--base')}</a>
    </div>`;

  anchorNavPage(ctx, {
    title: page.title, lead: page.lead,
    intro: 'Viele Anliegen können Sie direkt unter <a href="#/services">Dienstleistungen</a> als Vorgang starten.',
    sections: [
      { id: 'pr-portal', title: 'Prozessportal', html: portalHtml },
      { id: 'pr-faq', title: 'Häufige Fragen (FAQ)', html: faqHtml },
    ],
    back: { href: '#/knowledge', label: 'News und Wissen' },
  });
}

/* ==================== ANLEITUNGEN & SCHULUNGSUNTERLAGEN ================== */

// Eigene Ankernavigations-Seite: Kurzanleitungen und Schulungsmaterial.
function anleitungenPage(ctx, page) {
  const { C, setTitle, setCrumbs } = ctx;
  setTitle(page.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News und Wissen', href: '#/knowledge' }, { label: page.title }]);

  const guides = [
    { title: 'Erste Schritte im Kundenportal', desc: 'Überblick über Dienstleistungen, Anwendungen, Dokumente und Daten.', meta: ['Anleitung'] },
    { title: 'Einen Vorgang starten und verfolgen', desc: 'Wie Sie einen Service auslösen und den Status unter «Meine Vorgänge» einsehen.', meta: ['Anleitung'] },
    { title: 'Gebäude und Dokumente finden', desc: 'Suche im Portfolio sowie im Dokumenten- und Medienarchiv.', meta: ['Anleitung'] },
  ];
  const schulung = [
    { title: 'Einführung ins Kundenportal', desc: 'Geführter Rundgang durch die wichtigsten Funktionen.', icon: 'Desktop', meta: ['Video', '8 Min'] },
    { title: 'Schulung Vorgangsbearbeitung', desc: 'Foliensatz zur Erfassung und Verfolgung von Vorgängen.', meta: ['PDF', '2.1 MB'] },
    { title: 'Webinar-Aufzeichnung: Dienstleistungen des BBL', desc: 'Aufzeichnung des Einführungswebinars für neue Verwaltungseinheiten.', icon: 'Desktop', meta: ['Video', '45 Min'] },
    { title: 'Schnellstart-Kurzreferenz', desc: 'Einseitige Übersicht der häufigsten Aufgaben und Wege.', meta: ['PDF', '480 kB'] },
  ];

  const sections = [
    { id: 'an-anleitungen', title: 'Anleitungen',
      html: `<ul class="download-items">${guides.map(g => C.downloadItem({ ...g, icon: 'Book', href: '#', wrapLi: true })).join('')}</ul>` },
    { id: 'an-schulung', title: 'Schulungsunterlagen und Lernvideos',
      html: `<ul class="download-items">${schulung.map(s => C.downloadItem({ ...s, href: '#', wrapLi: true })).join('')}</ul>` },
  ];

  anchorNavPage(ctx, {
    title: page.title, lead: page.lead,
    intro: 'Kurzanleitungen sowie Schulungsunterlagen und Lernvideos zur Nutzung des Kundenportals. Die Materialien sind im Prototyp Platzhalter.',
    sections,
    back: { href: '#/knowledge', label: 'News und Wissen' },
  });
}
