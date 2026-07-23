// News und Wissen — Übersicht (Karten), News, Prozesse und Weisungen.
// Tabs sind über ?tab=… verlinkbar; ein optionales ?id=… öffnet ein Detail
// (Weisung / News). Ohne ?tab= erscheint die Abschnitts-Übersicht (CD-Muster).
export default async function render(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;

  const TABS = [
    { id: 'news',      label: 'News',                 icon: 'Bell' },
    { id: 'prozesse',  label: 'Prozesse',             icon: 'InfoCircle' },
    { id: 'weisungen', label: 'Weisungen & Vorgaben', icon: 'Book' },
  ];
  const tabFromQuery = query.get('tab');
  const active = TABS.some(t => t.id === tabFromQuery) ? tabFromQuery : '';
  const id = query.get('id') || '';

  if (!active) return overview(ctx);

  setTitle('News und Wissen');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News und Wissen', href: '#/knowledge' },
    { label: TABS.find(t => t.id === active).label }]);

  const tabHref = (t) => `#/knowledge?tab=${t}`;

  const controls = `<div class="tab__controls" role="tablist" aria-label="Wissensbereiche">
    ${TABS.map(t => `<a class="tab__control${t.id === active ? " tab__control--active" : ""}" role="tab"
        aria-selected="${t.id === active}" href="${tabHref(t.id)}">${C.icon(t.icon, 'icon--base')} ${C.escape(t.label)}</a>`).join('')}
  </div>`;

  const panels = TABS.map(t => `<div class="tab__container" data-tab="${t.id}"${t.id === active ? '' : ' hidden'}>
      ${t.id === active ? panelHtml(t.id) : ''}
    </div>`).join('');

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({ title: 'News und Wissen', lead: 'Aktuelles aus dem BBL, die Prozesse und Vorlagen für die Zusammenarbeit sowie die geltenden Weisungen und Vorgaben.' })}
    ${controls}
    ${panels}
  </div>`;

  // Tabs are plain <a href="#/knowledge?tab=…"> links: the hash router re-renders
  // this module on hashchange, so the active tab is always derived from ?tab.
  // Only the active panel needs interactivity wired up.
  if (active === 'weisungen') wireWeisungen(ctx);
  if (active === 'prozesse')  wireAccordion(mount);

  function panelHtml(tab) {
    // "Prozesse" bündelt Anleitungen/FAQ und die Formulare & Vorlagen —
    // beides beschreibt, wie ein Ablauf im BBL funktioniert.
    if (tab === 'prozesse') return anleitungenPanel(ctx) + formularePanel(ctx);
    if (tab === 'weisungen')   return weisungenPanel(ctx, id);
    if (tab === 'formulare')   return formularePanel(ctx);
    if (tab === 'anleitungen') return anleitungenPanel(ctx);
    if (tab === 'news')        return newsPanel(ctx, id);
    return '';
  }
}

/* ============================ WEISUNGEN & VORGABEN ======================== */

// Section overview — CD pattern: lead + cards onto everything the section holds.
function overview(ctx) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  setTitle('News und Wissen');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News und Wissen' }]);

  const news = core.news();
  const weisungen = core.weisungen();

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
    { title: 'Weisungen & Vorgaben', icon: 'Book', href: '#/knowledge?tab=weisungen',
      desc: 'Die geltenden Weisungen des BBL mit Geltungsbereich, Verbindlichkeit und Rechtsgrundlage.',
      meta: `${weisungen.length} Weisungen` },
    { title: 'Vorgaben der Bundeskanzlei', icon: 'External', href: 'https://www.bk.admin.ch/de/vorgaben', external: true,
      desc: 'Bundesweit geltende Vorgaben der Bundeskanzlei — Grundlage für die Weisungen des BBL.',
      meta: 'bk.admin.ch' },
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

function weisungenPanel(ctx, id) {
  const { core, C } = ctx;
  const all = core.weisungen();

  if (id) {
    const w = core.weisung(id);
    if (w) return weisungDetail(ctx, w);
    // unknown id → fall through to the list, with a hint below
  }

  const topics = [...new Set(all.map(w => w.topic).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));

  return `
    ${id ? C.notification('Diese Weisung wurde nicht gefunden. Hier finden Sie alle Weisungen und Vorgaben.', 'warning', 'WarningCircle') : ''}
    <p class="page-intro muted">Verbindliche Weisungen, Verordnungen und Richtlinien sowie empfehlende Vorgaben, die für die Dienstleistungen des BBL gelten.</p>

    <div class="stack mt-4">
      <div>
        <div class="small muted mb-4">Status</div>
        <div class="list list--flex list--wrap" id="w-status">
          ${['alle', 'in_kraft', 'aufgehoben'].map(s =>
            `<button type="button" class="tag-item${s === 'alle' ? " tag-item--active" : ""}" aria-pressed="${!!(s === 'alle')}" data-status="${s}"><span class="tag-item__inner"><span class="tag-item__text">${
              s === 'alle' ? 'Alle' : s === 'in_kraft' ? 'In Kraft' : 'Aufgehoben'}</span></span></button>`).join('')}
        </div>
      </div>
      <div>
        <div class="small muted mb-4">Thema</div>
        <div class="list list--flex list--wrap" id="w-topic">
          <button type="button" class="tag-item tag-item--active" aria-pressed="true" data-topic="__all"><span class="tag-item__inner"><span class="tag-item__text">Alle Themen</span></span></button>
          ${topics.map(t => `<button type="button" class="tag-item" data-topic="${C.escape(t)}"><span class="tag-item__inner"><span class="tag-item__text">${C.escape(t)}</span></span></button>`).join('')}
        </div>
      </div>
    </div>

    <p class="small muted mt-6" id="w-count" aria-live="polite"></p>
    <div class="stack mt-2" id="w-list"></div>`;
}

function weisungCard(ctx, w) {
  const { core, C } = ctx;
  const related = (w.relatedServices || [])
    .map(sid => ({ sid, s: core.service(sid) }))
    .filter(x => x.s);

  return `
  <article class="card">
    <div class="card__body" style="gap:.6rem">
      <div class="row gap-sm" style="align-items:baseline">
        <code class="badge badge--gray" style="font-family:ui-monospace,Consolas,monospace">${C.escape(w.code)}</code>
        <strong style="font-size:var(--fs-lg);line-height:1.25">${C.escape(w.title)}</strong>
      </div>
      <div class="pill-row">
        ${C.badge(w.type, typeVariant(w.type))}
        ${forceBadge(C, w.bindingForce)}
        ${statusBadge(C, w.status)}
      </div>
      <p class="card__description" style="flex:none">${C.escape(w.summary)}</p>
      <dl class="kv" style="margin:0">
        <dt>Erlassen von</dt><dd>${C.escape(w.issuingBody)}</dd>
        <dt>Gültig ab</dt><dd>${C.escape(w.validFrom)} · Version ${C.escape(w.version)}</dd>
        ${w.legalBasis && w.legalBasis !== '—' ? `<dt>Rechtsgrundlage</dt><dd>${C.escape(w.legalBasis)}</dd>` : ''}
      </dl>
      <div class="row gap-sm mt-2" style="row-gap:.4rem">
        <a class="btn btn--outline btn--sm" href="#/knowledge?tab=weisungen&id=${encodeURIComponent(w.directiveId)}">Details ${C.icon('ArrowRight', 'icon--base')}</a>
        <a class="btn btn--bare btn--sm" href="${w.documentUrl || '#'}">${C.icon('Download', 'icon--base')} Download (PDF)</a>
      </div>
      ${related.length ? `<div class="small muted mt-2">Gilt für: ${related.map(x =>
        `<a href="#/services/${encodeURIComponent(x.sid)}">${C.escape(x.s.title)}</a>`).join(' · ')}</div>` : ''}
    </div>
  </article>`;
}

function weisungDetail(ctx, w) {
  const { core, C } = ctx;
  const related = (w.relatedServices || []).map(sid => ({ sid, s: core.service(sid) })).filter(x => x.s);
  const successor = w.supersededBy ? core.weisung(w.supersededBy) : null;

  return `
    ${C.backLink('#/knowledge?tab=weisungen', 'Alle Weisungen & Vorgaben')}
    <div class="split mt-4">
      <div class="stack">
        <div class="row gap-sm" style="align-items:baseline">
          <code class="badge badge--gray" style="font-family:ui-monospace,Consolas,monospace">${C.escape(w.code)}</code>
          ${C.badge(w.type, typeVariant(w.type))}
          ${forceBadge(C, w.bindingForce)}
          ${statusBadge(C, w.status)}
        </div>
        <h2 tabindex="-1" style="margin-bottom:0">${C.escape(w.title)}</h2>
        ${w.status === 'aufgehoben' && successor
          ? C.notification(`Diese Weisung ist <strong>aufgehoben</strong>. Abgelöst durch <a href="#/knowledge?tab=weisungen&id=${encodeURIComponent(successor.directiveId)}">${C.escape(successor.code)} — ${C.escape(successor.title)}</a>.`, 'warning', 'WarningCircle')
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
    </div>`;
}

function wireWeisungen(ctx) {
  const { mount, core, C } = ctx;
  const list = mount.querySelector('#w-list');
  if (!list) return; // detail view: nothing to filter
  const all = core.weisungen();
  const state = { status: 'alle', topic: '__all' };
  const countEl = mount.querySelector('#w-count');

  function draw() {
    const rows = all.filter(w =>
      (state.status === 'alle' || w.status === state.status) &&
      (state.topic === '__all' || w.topic === state.topic));
    if (countEl) countEl.textContent = `${rows.length} Eintrag${rows.length === 1 ? '' : 'e'}`;
    list.innerHTML = rows.length
      ? rows.map(w => weisungCard(ctx, w)).join('')
      : C.empty('Keine Weisungen für diese Auswahl.');
  }

  mount.querySelector('#w-status').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-status]');
    if (!btn) return;
    state.status = btn.dataset.status;
    mount.querySelectorAll('#w-status .tag-item').forEach(c => c.classList.toggle('tag-item--active', c === btn));
    draw();
  });
  mount.querySelector('#w-topic').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-topic]');
    if (!btn) return;
    state.topic = btn.dataset.topic;
    mount.querySelectorAll('#w-topic .tag-item').forEach(c => c.classList.toggle('tag-item--active', c === btn));
    draw();
  });

  draw();
}

/* ================================ AKTUELLES =============================== */

function newsPanel(ctx, id) {
  const { core, C } = ctx;
  const items = [...core.news()].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  if (id) {
    const n = core.newsItem(id);
    if (n) {
      return `
        ${C.backLink('#/knowledge?tab=news', 'Alle Meldungen')}
        <article class="stack mt-4" style="max-width:60rem">
          <div class="row gap-sm small muted">
            <span>${C.escape(n.date)} · ${C.escape(n.source)}</span>
          </div>
          <h2 tabindex="-1">${C.escape(n.title)}</h2>
          ${C.photo({ id: n.photo, color: n.color, alt: n.title, w: 1200, style: 'aspect-ratio:21/9;max-height:20rem;border-radius:var(--radius-lg)' })}
          <p class="lead">${C.escape(n.teaser)}</p>
          <div class="separator separator--md"></div>
          <p>${C.escape(n.body)}</p>
        </article>`;
    }
  }

  return `
    ${id ? C.notification('Diese Meldung wurde nicht gefunden. Hier finden Sie alle Meldungen.', 'warning', 'WarningCircle') : ''}
    <p class="page-intro muted">Aktuelle Mitteilungen rund um das BBL, das Kundenportal und die Bundesverwaltung.</p>
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
        footer: `<span>Vorlage</span><a class="btn btn--link" href="#">${C.icon('Download', 'icon--base')} Herunterladen</a>`,
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
    { q: 'Wo finde ich Bauwerksdokumentationen zu einem Gebäude?', a: 'Im Bereich «Dokumente & Medien» bzw. im Dokumentenarchiv lassen sich Pläne und Dokumentationen pro Gebäude suchen und herunterladen.' },
    { q: 'Wie melde ich einen Sicherheits- oder Datenschutzvorfall?', a: 'Nutzen Sie den Service «Sicherheitsvorfall melden». Grundlagen sind das Informationssicherheitsgesetz (ISG) und das Datenschutzmerkblatt (DSG).' },
    { q: 'An wen wende ich mich bei Rückfragen zu einem Vorgang?', a: 'Verwenden Sie die Referenznummer (Format BBL-JJJJ-XXXX) aus der Detailansicht Ihres Vorgangs für Rückfragen.' },
  ];

  return `
    <p class="page-intro muted">Kurzanleitungen und häufige Fragen zur Nutzung der Plattform und ihrer Dienstleistungen.</p>

    <h2 class="mt-6">Anleitungen</h2>
    <div class="grid grid--3 mt-4">
      ${guides.map(g => C.card({ title: g.title, desc: g.desc,
        footer: `<span>Anleitung</span><a class="btn btn--link" href="#">Öffnen ${C.icon('ArrowRight', 'icon--base')}</a>` })).join('')}
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

// Accordion wiring — runs after the panel markup is in the DOM (called from
// the main render only when the «Anleitungen / FAQ» tab is active).
function wireAccordion(mount) {
  const acc = mount.querySelector('#faq-acc');
  if (!acc) return;
  acc.querySelectorAll('.accordion__button').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      const panel = mount.querySelector('#' + btn.getAttribute('aria-controls'));
      if (panel) panel.hidden = expanded;
    });
  });
}
