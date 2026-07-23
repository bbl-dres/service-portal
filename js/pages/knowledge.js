import { grundlagenPage } from './grundlagen.js';

// News und Wissen — Abschnitts-Übersicht plus drei eigenständige Unterseiten:
// News, Prozesse, Gesetzliche Grundlagen und Vorgaben. Diese sind KEINE Tabs
// (kein tab__controls-Streifen mehr), sondern echte Seiten mit eigenem h1,
// eigener Brotkrume und Zurück-Link — über ?tab=… verlinkbar. Ein optionales
// ?id=… öffnet ein Detail (Weisung / News) als eigene Seite.
const PAGES = {
  news:       { title: 'News', lead: 'Aktuelle Mitteilungen rund um das BBL, das Kundenportal und die Bundesverwaltung.' },
  prozesse:   { title: 'Prozesse', lead: 'Anleitungen, FAQ sowie Formulare und Vorlagen für die Zusammenarbeit mit dem BBL.' },
  grundlagen: { title: 'Gesetzliche Grundlagen und Vorgaben', lead: 'Die für das BBL massgebenden Erlasse, übergeordneten Vorgaben des Bundes und internen Weisungen — thematisch gegliedert.' },
};

export default async function render(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  const tab = query.get('tab');
  const id = query.get('id') || '';

  if (!tab || !PAGES[tab]) return overview(ctx);

  // Detailseiten mit eigener Identität (h1, Titel, Brotkrume) — Review P1-6.
  if (tab === 'news' && id) return newsDetail(ctx, id);
  if (tab === 'grundlagen' && id) {
    const w = core.weisung(id);
    if (w) return weisungPage(ctx, w);
  }
  // Grundlagen ist eine eigene Ankernavigations-Seite (KBOB-Muster).
  if (tab === 'grundlagen') return grundlagenPage(ctx, PAGES.grundlagen);

  const page = PAGES[tab];
  setTitle(page.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News und Wissen', href: '#/knowledge' }, { label: page.title }]);

  const body = tab === 'news' ? newsList(ctx) : anleitungenPanel(ctx) + formularePanel(ctx);
  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/knowledge', 'News und Wissen')}
    ${C.pageHeader({ title: page.title, lead: page.lead })}
    ${body}
  </div>`;

  if (tab === 'prozesse') wireAccordion(mount);
}

/* ============================ WEISUNGEN & VORGABEN ======================== */

// Section overview — CD pattern: lead + cards onto everything the section holds.
function overview(ctx) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  setTitle('News und Wissen');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News und Wissen' }]);

  const news = core.news();

  const entry = (o) => `
    <a class="card card--universal card--clickable" href="${o.href}"${o.external ? ' target="_blank" rel="noopener external"' : ''}>
      <div class="card__content">
        <div class="card__body">
          <span class="domain-tile__icon">${C.icon(o.icon, 'icon--2xl')}</span>
          <div class="card__title">${C.escape(o.title)}</div>
          <p class="card__description">${C.escape(o.desc)}</p>
        </div>
        <div class="card__footer">
          <span>${C.escape(o.meta)}</span>
          <span class="btn btn--link">Öffnen ${C.icon(o.external ? 'External' : 'ArrowRight', 'icon--base')}</span>
        </div>
      </div>
    </a>`;

  const entries = [
    { title: 'News', icon: 'Bell', href: '#/knowledge?tab=news',
      desc: 'Aktuelle Mitteilungen rund um das BBL, das Kundenportal und die Bundesverwaltung.',
      meta: `${news.length} Meldungen` },
    { title: 'Prozesse', icon: 'InfoCircle', href: '#/knowledge?tab=prozesse',
      desc: 'Anleitungen, FAQ sowie Formulare und Vorlagen für die Zusammenarbeit mit dem BBL.',
      meta: 'Anleitungen & Vorlagen' },
    { title: 'Gesetzliche Grundlagen und Vorgaben', icon: 'Book', href: '#/knowledge?tab=grundlagen',
      desc: 'Erlasse, übergeordnete Vorgaben des Bundes und die internen Weisungen des BBL — thematisch gegliedert.',
      meta: 'Gesetze, Vorgaben & Weisungen' },
  ].map(entry).join('');

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'News und Wissen',
      lead: 'Aktuelles aus dem BBL, die Prozesse und Vorlagen für die Zusammenarbeit sowie die geltenden Weisungen und Vorgaben.',
    })}
    <div class="grid grid--2 mt-8">${entries}</div>
  </div>`;
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
    { label: 'Gesetzliche Grundlagen und Vorgaben', href: '#/knowledge?tab=grundlagen' }, { label: w.title }]);

  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/knowledge?tab=grundlagen', 'Gesetzliche Grundlagen und Vorgaben')}
    <div class="split mt-4">
      <div class="stack">
        <div class="row gap-sm" style="align-items:baseline">
          <code class="badge badge--gray" style="font-family:ui-monospace,Consolas,monospace">${C.escape(w.code)}</code>
          ${C.badge(w.type, typeVariant(w.type))}
          ${forceBadge(C, w.bindingForce)}
          ${statusBadge(C, w.status)}
        </div>
        <h1 tabindex="-1" style="margin-bottom:0">${C.escape(w.title)}</h1>
        ${w.status === 'aufgehoben' && successor
          ? C.notification(`Diese Weisung ist <strong>aufgehoben</strong>. Abgelöst durch <a href="#/knowledge?tab=grundlagen&id=${encodeURIComponent(successor.directiveId)}">${C.escape(successor.code)} — ${C.escape(successor.title)}</a>.`, 'warning', 'WarningCircle')
          : w.status === 'aufgehoben'
            ? C.notification('Diese Weisung ist <strong>aufgehoben</strong>.', 'warning', 'WarningCircle')
            : ''}
        <div>
          <h3>Zusammenfassung</h3>
          <p>${C.escape(w.summary)}</p>
        </div>
        ${w.scope ? `<div><h3>Geltungsbereich</h3><p style="margin:0">${C.escape(w.scope)}</p></div>` : ''}
        ${w.legalBasis && w.legalBasis !== '—' ? `<div><h3>Rechtsgrundlage</h3><p style="margin:0">${C.escape(w.legalBasis)}</p></div>` : ''}
        <div class="row gap-sm mt-2">
          <a class="btn btn--outline" href="${w.documentUrl || '#'}">${C.icon('Download', 'icon--base')} Dokument herunterladen</a>
        </div>
      </div>
      <aside class="stack-lg">
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
    setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News und Wissen', href: '#/knowledge' }, { label: 'News', href: '#/knowledge?tab=news' }]);
    mount.innerHTML = `<div class="container section">
      ${C.backLink('#/knowledge?tab=news', 'News')}
      <div class="page-header mt-4"><h1 tabindex="-1">Meldung nicht gefunden</h1></div>
      <p class="muted">Diese Meldung existiert nicht. <a href="#/knowledge?tab=news">Zur Übersicht «News»</a></p>
    </div>`;
    return;
  }
  setTitle(n.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News und Wissen', href: '#/knowledge' },
    { label: 'News', href: '#/knowledge?tab=news' }, { label: n.title }]);
  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/knowledge?tab=news', 'News')}
    <article class="stack mt-4" style="max-width:60rem">
      <div class="row gap-sm small muted">
        <span>${C.escape(n.date)} · ${C.escape(n.source)}</span>
      </div>
      <h1 tabindex="-1">${C.escape(n.title)}</h1>
      ${C.photo({ id: n.photo, color: n.color, alt: '', w: 1200, style: 'aspect-ratio:21/9;max-height:20rem;border-radius:var(--radius-lg)' })}
      <p class="lead">${C.escape(n.teaser)}</p>
      <div class="separator separator--md"></div>
      <p>${C.escape(n.body)}</p>
    </article>
  </div>`;
}

// Meldungsliste als Seiteninhalt (Kopf setzt die Aufrufseite).
function newsList(ctx) {
  const { core, C } = ctx;
  const items = [...core.news()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return `
    <div class="grid grid--3 mt-6">
      ${items.map(n => `
        <a class="card card--clickable" href="#/knowledge?tab=news&id=${encodeURIComponent(n.id)}">
          <div class="card__image">${C.photo({ id: n.photo, color: n.color, alt: n.title, w: 640, style: 'height:100%' })}</div>
          <div class="card__body">
            <div class="row gap-sm small muted">
              <span>${C.escape(n.date)} · ${C.escape(n.source)}</span>
            </div>
            <div class="card__title">${C.escape(n.title)}</div>
            <p class="card__description">${C.escape(n.teaser)}</p>
          </div>
          <div class="card__footer"><span></span><span class="btn btn--link">Weiterlesen ${C.icon('ArrowRight', 'icon--base')}</span></div>
        </a>`).join('')}
    </div>`;
}

/* ========================= FORMULARE & VORLAGEN ========================== */

function formularePanel(ctx) {
  const { C } = ctx;
  const items = [
    { title: 'Antragsformular Raumbedarf', desc: 'Strukturierte Bedarfsmeldung für zusätzliche Flächen und Arbeitsplätze.', fmt: 'PDF' },
    { title: 'Vorlage Beschaffung (BANF)', desc: 'Bedarfsanforderung für IKT- und Güterbeschaffungen inkl. Pflichtfelder.', fmt: 'DOCX' },
    { title: 'Checkliste WTO-Verfahren', desc: 'Schwellenwerte, Verfahrenswahl und Fristen für öffentliche Beschaffungen.', fmt: 'PDF' },
    { title: 'Vorlage Störungsmeldung Gebäude', desc: 'Erfassung von Störungen, Schäden und Reinigungsbedarf je Standort.', fmt: 'PDF' },
    { title: 'Vorlage Sicherheitsvorfall', desc: 'Meldung von Informationssicherheits- und Datenschutzvorfällen (ISG/DSG).', fmt: 'PDF' },
    { title: 'Antrag Publikation / Drucksache', desc: 'Bestellung von Publikationen nach Corporate Design des Bundes.', fmt: 'DOCX' },
  ];

  return `
    <p class="page-intro muted">Häufig benötigte Formulare und Vorlagen für Anträge, Meldungen und Bestellungen. Viele Anliegen können Sie direkt unter <a href="#/services">Dienstleistungen</a> als Vorgang starten.</p>
    <div class="grid grid--3 mt-6">
      ${items.map(it => C.card({
        title: it.title, desc: it.desc,
        badges: [C.badge(it.fmt, 'gray')],
        // downloadLink rendert ohne echtes Ziel einen nicht fokussierbaren
        // span statt eines toten Links (docs/design-review.md P0-1).
        footer: `<span>Vorlage</span>${C.downloadLink('#', `${it.title} herunterladen`)}`,
      })).join('')}
    </div>`;
}

/* ============================ ANLEITUNGEN / FAQ ========================== */

function anleitungenPanel(ctx) {
  const { C } = ctx;

  const guides = [
    { title: 'Erste Schritte im Kundenportal', desc: 'Überblick über Dienstleistungen, Anwendungen, Dokumente und Daten.' },
    { title: 'Einen Vorgang starten und verfolgen', desc: 'Wie Sie einen Service auslösen und den Status unter «Meine Vorgänge» einsehen.' },
    { title: 'Gebäude und Dokumente finden', desc: 'Suche im Portfolio sowie im Dokumenten- und Medienarchiv.' },
  ];

  const faqs = [
    { q: 'Wie melde ich zusätzlichen Raumbedarf an?', a: 'Öffnen Sie unter «Dienstleistungen» den Service «Raumbedarf melden» und folgen Sie dem geführten Antrag. Nach dem Absenden entsteht ein Vorgang, den Sie unter «Meine Vorgänge» verfolgen.' },
    { q: 'Welche Weisung gilt für die Flächenstandards?', a: 'Massgebend ist die Weisung «Raum- und Flächenstandards der Bundesverwaltung» (W-BBL-001). Sie finden sie im Tab «Weisungen & Vorgaben».' },
    { q: 'Wo finde ich Bauwerksdokumentationen zu einem Gebäude?', a: 'Unter «Daten und Digitalisierung» bzw. im Dokumentenarchiv lassen sich Pläne und Dokumentationen pro Gebäude suchen und herunterladen.' },
    { q: 'Wie melde ich einen Sicherheits- oder Datenschutzvorfall?', a: 'Nutzen Sie den Service «Sicherheitsvorfall melden». Grundlagen sind das Informationssicherheitsgesetz (ISG) und das Datenschutzmerkblatt (DSG).' },
    { q: 'An wen wende ich mich bei Rückfragen zu einem Vorgang?', a: 'Verwenden Sie die Referenznummer (Format BBL-JJJJ-XXXX) aus der Detailansicht Ihres Vorgangs für Rückfragen.' },
  ];

  return `
    <p class="page-intro muted">Kurzanleitungen und häufige Fragen zur Nutzung der Plattform und ihrer Dienstleistungen.</p>

    <h2 class="mt-6">Anleitungen</h2>
    <div class="grid grid--3 mt-4">
      ${guides.map(g => C.card({ title: g.title, desc: g.desc,
        footer: `<span>Anleitung</span><span class="btn btn--link" aria-disabled="true"
          title="Im Prototyp nicht verfügbar">${g.title} öffnen ${C.icon('ArrowRight', 'icon--base')}<span class="sr-only"> (im Prototyp nicht verfügbar)</span></span>` })).join('')}
    </div>

    <h2 class="mt-8">Häufige Fragen (FAQ)</h2>
    <div class="accordion mt-4" id="faq-acc">
      ${faqs.map((f, i) => `
        <div class="accordion__item">
          <h3 style="margin:0">
            <button class="accordion__button" type="button" aria-expanded="false" aria-controls="faq-p-${i}" id="faq-b-${i}">
              <span>${C.escape(f.q)}</span>${C.icon('ChevronDown', 'icon--base')}
            </button>
          </h3>
          <div class="accordion__content" id="faq-p-${i}" role="region" aria-labelledby="faq-b-${i}" hidden>
            <p style="margin:0">${C.escape(f.a)}</p>
          </div>
        </div>`).join('')}
    </div>`;
}

// Accordion wiring — runs after the panel markup is in the DOM. Wires every
// accordion in the panel (FAQ, Grundlagen), not just one by id.
function wireAccordion(mount) {
  mount.querySelectorAll('.accordion .accordion__button').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      const panel = mount.querySelector('#' + btn.getAttribute('aria-controls'));
      if (panel) panel.hidden = expanded;
    });
  });
}
