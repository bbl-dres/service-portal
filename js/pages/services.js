// Dienstleistungen - service directory (catalog) + service detail.
import { audienceOptions, audienceLabel, audienceTags } from '../domain.js';

// Aufschiebbare Bestände dieser Route. Der Router ruft core.ensure(needs) VOR
// render() auf — ohne die Deklaration läse ein Accessor die noch leere Liste
// und die Ansicht zeigte «keine Einträge» statt Daten (docs/code-review.md §3).
export const needs = ['applications', 'contacts', 'documents'];
export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs } = ctx;
  if (params[0]) return detail(ctx, params[0]);

  setTitle('Dienstleistungen');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Dienstleistungen' }]);

  const rawQ = query.get('q') || '';
  const q = rawQ.toLowerCase();
  // Filter sind mehrwertig (Mehrfachauswahl-Checkboxen): komma-getrennt im Hash.
  const selectedAudiences = (query.get('audience') || '').split(',').map(t => t.trim()).filter(Boolean);
  const selectedTopics = (query.get('topic') || '').split(',').map(t => t.trim()).filter(Boolean);
  const view = query.get('view') === 'list' ? 'list' : 'gallery';
  const currentPage = Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1);
  const perPage = 12;
  const domains = core.ref().domains || [];
  // Der Katalog führt NUR startbare Dienstleistungen (docs/sitemap.md §2.3).
  // `type: info` sind Referenzseiten im Dienstleistungskostüm; sie sind über
  // «Wissen und Hilfsmittel» bzw. «Daten und Digitalisierung» erschlossen. Ihre
  // Detailseite bleibt erreichbar, damit geteilte Links nicht ins Leere laufen.
  const all = core.services().filter(s => s.type === 'action');

  // Sortierung (catbar): leer = Datenreihenfolge (Platzhalter «Sortieren»).
  const SORT_OPTS = [{ value: 'title', label: 'Bezeichnung (A–Z)' }, { value: 'domain', label: 'Bereich' }];
  const SORTS = {
    title: (a, b) => a.title.localeCompare(b.title, 'de'),
    domain: (a, b) => domainLabel(domains, a.domain).localeCompare(domainLabel(domains, b.domain), 'de') || a.title.localeCompare(b.title, 'de'),
  };
  const sortKey = SORT_OPTS.some(o => o.value === query.get('sort')) ? query.get('sort') : '';

  const matches = (s) => !q || (s.title + ' ' + s.short + ' ' + s.description).toLowerCase().includes(q);
  const matchesAudience = (s) => !selectedAudiences.length || selectedAudiences.some(v => (s.audience || []).includes(v));
  const matchesTopic = (s) => !selectedTopics.length || selectedTopics.includes(s.domain);
  const filtered = all.filter(s => matches(s) && matchesAudience(s) && matchesTopic(s));
  const services = sortKey ? filtered.slice().sort(SORTS[sortKey]) : filtered;
  const totalPages = Math.max(1, Math.ceil(services.length / perPage));
  const page = Math.min(currentPage, totalPages);
  const visibleServices = services.slice((page - 1) * perPage, page * perPage);

  const base = { q: rawQ, audience: selectedAudiences, topic: selectedTopics, sort: sortKey, view };
  const hash = (patch = {}) => C.catalogueHash('#/services', { ...base, ...patch });

  // also-in hint across other surfaces (services-first, then content)
  const otherHits = q ? {
    apps: core.applications().filter(a => (a.name + a.description).toLowerCase().includes(q)).length,
    docs: core.documents().filter(d => d.title.toLowerCase().includes(q)).length,
  } : null;

  const card = (s) => C.card({
    title: s.title, desc: s.short, href: `#/services/${s.serviceId}`,
    badges: [audienceTags(core, C, s.audience)],
    footerInfo: C.escape(domainLabel(domains, s.domain)), footerAction: C.cardAction(),
  });

  const listView = (list) => C.table({
    caption: 'Dienstleistungen',
    zebra: true,
    // Erste Spalte ist der Zeilenlink — wie in allen Katalog-Listenansichten
    // folgt die ganze Zeile ihm per Mausklick (einheitliche Affordanz, tbl-8).
    rowsClickable: true,
    columns: [
      { key: 'title', label: 'Dienstleistung', render: s => `<a href="#/services/${s.serviceId}">${C.escape(s.title)}</a><br><span class="small muted">${C.escape(s.short)}</span>` },
      { key: 'domain', label: 'Bereich', render: s => C.escape(domainLabel(domains, s.domain)) },
      { key: 'audience', label: 'Zielgruppe', render: s => audienceTags(core, C, s.audience) },
    ],
    rows: list,
  });

  // Active-filter pills. Each pill links to the same view minus that one value,
  // so removing a filter needs no JS and stays deep-linkable.
  const activeFilters = [
    ...(rawQ ? [{ label: `Suche: «${rawQ}»`, href: hash({ q: '' }) }] : []),
    ...selectedAudiences.map(a => ({ label: audienceLabel(core, a), href: hash({ audience: selectedAudiences.filter(x => x !== a) }) })),
    ...selectedTopics.map(t => ({ label: domainLabel(domains, t), href: hash({ topic: selectedTopics.filter(x => x !== t) }) })),
  ];
  const filterBar = C.activeFilters({ filters: activeFilters, resetHref: '#/services' });

  const relatedHits = otherHits && (otherHits.apps + otherHits.docs)
    ? `Auch in: ${[
        otherHits.apps ? `<a href="#/applications">${otherHits.apps} Anwendung(en)</a>` : '',
        otherHits.docs ? `<a href="#/app/document-archive">${otherHits.docs} Dokument(e)</a>` : '',
      ].filter(Boolean).join(' · ')}`
    : '';

  const pageInfo = totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : '';
  const filterPanel = `
    ${C.filterGroup({ dim: 'audience', legend: 'Zielgruppe', selected: selectedAudiences, options: audienceOptions(core) })}
    ${/* Themen aus den Daten ableiten — dieselbe Regel wie im Drawer (shell.js):
          ein Thema erscheint, sobald ein Vorgang dahintersteht. Vorher entschied
          die Fahne `thema` in reference-data.json, und sie war veraltet: der
          Drawer bot «Alle anzeigen» für Beschaffung oder Publizieren an, im
          Filter fehlten dieselben Themen — man konnte den Filter setzen, aber
          nicht sehen und nicht abwählen. Die Fahne ist entfallen. */''}
    ${C.filterGroup({ dim: 'topic', legend: 'Thema', selected: selectedTopics,
      options: domains.filter(d => all.some(s => s.domain === d.key)).map(d => ({ value: d.key, label: d.label })) })}
    ${C.panelReset({ href: hash({ audience: [], topic: [] }) })}`;

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({ title: 'Dienstleistungen', lead: 'Was möchten Sie tun? Als «Vorgang» gekennzeichnete Dienstleistungen starten einen Ablauf; Informationsangebote führen weiter.' })}
    ${C.catalogueBar({
      formId: 'svc-search', inputId: 'sq', searchLabel: 'Dienstleistung suchen', placeholder: 'Dienstleistung suchen…', q: rawQ,
      countId: 'svc-count', count: `<strong>${services.length}</strong> von ${all.length} Dienstleistungen${pageInfo}`,
      sort: { id: 'svc-sort', value: sortKey, options: SORT_OPTS },
      filterId: 'svc-filter', filterLabel: 'Filter', filterCount: selectedAudiences.length + selectedTopics.length,
      panelId: 'svc-filters', panel: filterPanel,
      view, views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List']],
    })}
    ${filterBar}
    ${C.catalogueResults({
      resetHref: '#/services',
      visible: visibleServices, count: services.length, total: all.length, view, page, totalPages, header: false,
      card, listView, unit: 'Dienstleistungen',
      paginationInputId: 'svc-page', paginationLabel: 'Seitennavigation Dienstleistungen',
      paginationHref: (p) => hash({ page: p }),
      available: core.available('services'), note: relatedHits || '',
    })}
  </div>`;

  C.announceCatalogue({ count: services.length, total: all.length, unit: 'Dienstleistungen', page, totalPages, view });

  // Mehrfachauswahl-Filter (Zielgruppe/Thema) verdrahtet C.wireCatalogue über das Panel.
  C.wireCatalogue(mount, {
    formId: 'svc-search', inputId: 'sq', pageInputId: 'svc-page', page, totalPages, hash,
    sortId: 'svc-sort', filterToggleId: 'svc-filter', panelId: 'svc-filters',
  });
  // Zeilenklick der Listenansicht. Abbau via onUnmount, sonst sammelt der
  // wiederverwendete mount pro Besuch einen weiteren Klick-Horcher an.
  ctx.onUnmount(C.wireTableRows(mount));
}

function detail(ctx, id) {
  const { mount, core, engine, session, C, setTitle, setCrumbs } = ctx;
  const s = core.service(id);
  if (!s) {
    C.renderNotFound(ctx, { thing: 'Diese Dienstleistung', title: 'Dienstleistung nicht gefunden',
      backHref: '#/services', backLabel: 'Dienstleistungen',
      crumbs: [{ label: 'Startseite', href: '#/' }, { label: 'Dienstleistungen', href: '#/services' }] });
    return;
  }
  setTitle(s.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Dienstleistungen', href: '#/services' }, { label: s.title }]);

  const contact = core.contacts().find(c => c.contactId === s.contact);
  // processDefId war reine Deklaration — 10 Dienstleistungen trugen das Feld, kein
  // Modul las es (H11). Hier wird die Kante benutzt: der Ablauf, den der Vorgang
  // durchläuft, steht VOR dem Absenden auf der Seite. Fehlt die Definition,
  // entfällt der Block wortlos — er ist Zusatzinformation, keine Bedingung.
  const def = s.processDefId ? engine.definition(s.processDefId) : null;
  const tgt = s.target || {};   // Informationsangebote haben kein `target` — nicht dereferenzieren (A5)
  const ext = tgt.kind === 'external';
  const ctaLabel = s.type === 'action' ? (ext ? 'Zum externen System' : 'Vorgang starten') : 'Öffnen';
  // Ein Ziel «#» ist ein Platzhalter — dann keinen toten Knopf anbieten,
  // sondern sagen, dass das System im Prototyp nicht angebunden ist.
  const hasTarget = tgt.href && tgt.href !== '#';
  // Nur das Auslösen eines Vorgangs (type=action) verlangt eine Anmeldung;
  // Informationsangebote sind frei. Inhalt wird nie versteckt — abgemeldet
  // erscheint statt des Knopfs der Login-Hinweis (AGOV / FedLogin).
  const needsLogin = s.type === 'action' && !session.isLoggedIn();

  // «Zugriff»-Karte, erste Karte der Randspalte (Nutzerentscheid 2026-08-04):
  // derselbe Ort wie auf der Anwendungs-Landingpage. Abgemeldet trägt sie die
  // Aussage des login-gate-Bands in kompakter Form (kleiner Text, sm-Knopf,
  // derselbe window.__login-Weg); ANGEMELDET den Sitzungskontext UND den
  // Primär-CTA — ohne ihn führte nach dem Login kein Weg aus der Randspalte
  // in den Vorgang (Nutzerbefund 2026-08-04). Gleicher Knopf wie im Inhalt
  // (ctaBlock), nur in Kartengrösse (sm statt lg); Informationsangebote sind
  // ausdrücklich frei zugänglich.
  const cardCta = hasTarget
    ? `<a class="btn btn--outline btn--sm btn--icon-right mt-3" href="${C.escape(tgt.href)}"${
        ext ? ' target="_blank" rel="noopener external"' : ''}>${
        C.icon(ext ? 'External' : 'ArrowRight', 'btn__icon')}<span class="btn__text">${ctaLabel}</span></a>`
    : `<p class="small muted mt-3 m-0">Im Prototyp ist kein Zielsystem angebunden.</p>`;
  const zugriffCard = `<div class="box">
      <h3>Zugriff</h3>
      ${s.type !== 'action'
        ? '<p class="small muted m-0">Frei zugänglich — keine Anmeldung erforderlich.</p>'
        : session.isLoggedIn()
          ? `<p class="small muted m-0">Angemeldet als <strong>${C.escape(session.user().name)}</strong> · ${C.escape(session.user().org)}.</p>
             ${cardCta}`
          : `<p class="small m-0">${C.icon('Lock', 'icon--base')} Zum Starten dieses Vorgangs ist eine Anmeldung erforderlich.</p>
             <button type="button" class="btn btn--outline btn--sm btn--icon-left mt-3" onclick="window.__login && window.__login()">
               ${C.icon('User', 'btn__icon')}<span class="btn__text">Anmelden mit AGOV / FedLogin</span></button>`}
    </div>`;

  const ctaBlock = needsLogin
    ? C.loginGate(`Zum Starten des Vorgangs «${C.escape(s.title)}» ist eine Anmeldung mit AGOV / FedLogin erforderlich. Alle Informationen auf dieser Seite sind frei einsehbar.`)
    : `<div class="row mt-4">
        ${/* CD Btn.vue: das Icon steht im DOM zuerst, btn--icon-right dreht die
              Reihenfolge; das Label trägt IMMER den .btn__text-Wickel. */''}
        ${hasTarget
          ? `<a class="btn btn--outline btn--lg btn--icon-right" href="${C.escape(tgt.href)}"${
              ext ? ' target="_blank" rel="noopener external"' : ''}>${
              C.icon(ext ? 'External' : 'ArrowRight', 'btn__icon')}<span class="btn__text">${ctaLabel}</span></a>`
          : `<span class="btn btn--outline btn--lg btn--icon-right" aria-disabled="true">${
              C.icon(ext ? 'External' : 'ArrowRight', 'btn__icon')}<span class="btn__text">${ctaLabel}</span></span>
             <span class="small muted">Im Prototyp ist kein Zielsystem angebunden.</span>`}
      </div>`;

  // Symbolbild je Thema (verifizierte Unsplash-ids aus dem Bestand); Fallback =
  // Farbfläche. Deckt sich mit den Themen-Bildern der Startseite/Bereiche.
  // Lokaler Heldenpool (assets/images/heroes, Nachweis im README dort) statt
  // Unsplash-Hotlinks — Bild-Screening 2026-08-04.
  const H = 'assets/images/heroes/';
  const DOMAIN_PHOTO = {
    A: H + 'domain-a.jpg', B: H + 'domain-b.jpg', U: H + 'domain-u.jpg',
    O: H + 'domain-o.jpg', G: H + 'domain-g.jpg', C: H + 'domain-c.jpg',
    D: H + 'domain-g.jpg', E: H + 'domain-o.jpg', F: H + 'domain-b.jpg',
  };
  const img = DOMAIN_PHOTO[s.domain] || H + 'domain-o.jpg';

  mount.innerHTML = `
  <div class="container section">
    ${C.detailHead({
      backHref: '#/services', backLabel: 'Dienstleistungen',
      title: s.title, lead: s.short,
      tags: `${audienceTags(core, C, s.audience)}${s.type === 'action' ? C.badge('Vorgang', 'info') : C.badge('Information', 'gray')}`,
      image: C.heroFigure({ src: img }),
    })}
    <div class="container--grid gap--responsive">
      ${/* CD-Inhaltsrhythmus (.vertical-spacing, 3/3.5rem) statt des portal-
            eigenen .stack — die Detail-Hauptspalten sollen alle dieselbe
            Rampe tragen (Review layout/main-1). */''}
      <div class="container__main vertical-spacing">
        ${/* Die Detailseite hatte ausser der <h1> keine Gliederungsstufe: ohne
              Voraussetzungen und ohne Weisungen blieb sie ganz ohne <h2>/<h3>. */''}
        <h2 class="sr-only">Beschreibung</h2>
        <p>${C.escape(s.description)}</p>
        ${s.voraussetzungen && s.voraussetzungen.length ? `<div class="box"><h3>Das brauchen Sie</h3><ul class="list--default">${s.voraussetzungen.map(v => `<li>${C.escape(v)}</li>`).join('')}</ul></div>` : ''}
        ${def && Array.isArray(def.steps) && def.steps.length ? `<div class="box"><h3>So läuft es ab</h3>
          <p class="small muted">${C.escape(def.name)} — ${def.steps.length} Schritte. Den Stand sehen Sie danach unter <a href="#/my-cases">Meine Vorgänge</a>.</p>
          ${C.pipeline(def.steps, 0, { label: `Ablauf «${def.name}»` })}</div>` : ''}
        ${ctaBlock}
      </div>
      ${/* KEIN .stack-lg hier: den CD-Abstand der Aside-Module (1.75/2rem)
            liefert bereits .container__aside > * — ein zweites Rhythmus-Utility
            überschriebe ihn mit 3rem (Review layout/aside-1). */''}
      <aside class="container__aside" aria-labelledby="svc-aside-head">
        <h2 class="sr-only" id="svc-aside-head">Zugriff, Kontakt und Grundlagen</h2>
        ${zugriffCard}
        ${C.contactBox(contact)}
        ${/* Die je Dienstleistung geltenden Weisungen wurden aus data/weisungen.json
              gelesen; der Bestand ist zurückgezogen (docs/sitemap.md §2.4). Statt
              einer erfundenen Liste steht hier der Verweis auf die Sammlung. */''}
        <div class="box">
          <h3>Gesetzliche Grundlagen</h3>
          <p class="small muted">Die für diese Dienstleistung massgebenden Erlasse, Vorgaben und Weisungen finden Sie in der Sammlung.</p>
          <a class="py-1-5 small" href="#/knowledge">Wissen und Hilfsmittel</a>
        </div>
      </aside>
    </div>
  </div>`;
}

// Bewusst die Listen-Variante (Aufrufer reicht seine Themenliste durch) — die
// core-gebundene Fassung steht in domain.js; s. Design-Review B23.
function domainLabel(domains, key) { const d = domains.find(x => x.key === key); return d ? d.label : key; }
