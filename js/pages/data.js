// Daten — interne Datenplattform: «Datenbezug» (nach Domäne) + «Datenkatalog (DCAT)».
// Modelliert nach BLW Datenbezug + i14y. DataProducts sind DCAT-AP-CH-förmig
// (Dataset / DataService / Concept). Detail via params[0] = dataProduct id.

const DCAT_LABEL = { Dataset: 'Datensatz', DataService: 'Datendienst', Concept: 'Konzept / Codeliste' };
const DCAT_VARIANT = { Dataset: 'blue', DataService: 'info', Concept: 'gray' };

export default async function render(ctx) {
  const { params } = ctx;
  if (!params.length) return overview(ctx);
  if (params[0] === 'katalog') return katalog(ctx);
  if (params[0] === 'digitalisierung') return (await import('./digitalisierung.js')).default(ctx);
  return detail(ctx, params[0]);
}

// Section overview — the CD pattern for a top-level area: a short lead plus
// cards onto everything the section contains. (bbl.admin.ch, swisstopo.admin.ch)
function overview(ctx) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  setTitle('Daten und Digitalisierung');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Daten und Digitalisierung' }]);

  const products = core.dataProducts();
  const apps = core.applications();
  const count = (b) => apps.filter(a => a.bereich === b).length;
  const datasets = products.filter(p => p.dcatClass === 'Dataset').length;
  const services = products.filter(p => p.dcatClass === 'DataService').length;

  const entry = (o) => `
    <a class="card card--universal card--clickable" href="${o.href}">
      <div class="card__content">
        <div class="card__body">
          <span class="domain-tile__icon">${C.icon(o.icon, 'icon--2xl')}</span>
          <div class="card__title">${C.escape(o.title)}</div>
          <p class="card__description">${C.escape(o.desc)}</p>
        </div>
        <div class="card__footer">
          <span>${C.escape(o.meta)}</span>
          <span class="btn btn--link">Öffnen ${C.icon('ArrowRight', 'icon--base')}</span>
        </div>
      </div>
    </a>`;

  const entries = [
    { title: 'Datenportal', icon: 'ChartBar', href: '#/app/dataportal',
      desc: 'Auswertungen und Dashboards zu den Kennzahlen des BBL — Energie, Immobilien, Beschaffung, Personal.',
      meta: '6 Themen' },
    { title: 'Datenbezug', icon: 'FileDatabase', href: '#/data/katalog',
      desc: 'Datenkatalog nach DCAT-AP-CH: Datensätze, Datendienste und Codelisten mit Bezugswegen.',
      meta: `${datasets} Datensätze · ${services} Datendienste` },
    { title: 'Fachanwendungen Bauten', icon: 'Building', href: '#/applications?bereich=bauten',
      desc: 'Fachanwendungen für Immobilien, Bauprojekte und Bauwerksdokumentation.',
      meta: `${count('bauten')} Anwendungen` },
    { title: 'Fachanwendungen Logistik', icon: 'ShoppingCart', href: '#/applications?bereich=logistik',
      desc: 'Fachanwendungen für Arbeitsplatz, Beschaffung und Logistik.',
      meta: `${count('logistik')} Anwendungen` },
    { title: 'Alle Anwendungen', icon: 'Apps', href: '#/applications',
      desc: 'Der vollständige Anwendungskatalog, inklusive der zentralen Systeme der Bundesverwaltung.',
      meta: `${apps.length} Anwendungen` },
    { title: 'Digitalisierung', icon: 'Book', href: '#/data/digitalisierung',
      desc: 'Strategie, Vorhaben und Grundsätze der Digitalisierung im BBL.',
      meta: 'Strategie & Vorhaben' },
  ].map(entry).join('');

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Daten und Digitalisierung',
      lead: 'Auswertungen, Datenbezug und die Fachanwendungen des BBL — an einem Ort.',
    })}
    <div class="grid grid--3 mt-8">${entries}</div>
  </div>`;
}

// Datenbezug — der DCAT-Katalog (früher direkt unter #/data).
function katalog(ctx) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  setTitle('Datenbezug');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Datenbezug' },
  ]);

  const products = core.dataProducts();
  const tiers = core.ref().classificationTiers || [];

  // ---- (a) Datenbezug — gruppiert nach Domäne ----
  const byDomain = groupBy(products, 'domain');
  const domainKeys = Object.keys(byDomain).sort((a, b) => a.localeCompare(b, 'de'));

  const domainCards = domainKeys.map(dk => {
    const list = byDomain[dk];
    const datasets = list.filter(p => p.dcatClass === 'Dataset').length;
    const services = list.filter(p => p.dcatClass === 'DataService').length;
    const concepts = list.filter(p => p.dcatClass === 'Concept').length;
    const parts = [];
    if (datasets) parts.push(`${datasets} Datensatz${datasets > 1 ? '/-sätze' : ''}`);
    if (services) parts.push(`${services} Datendienst${services > 1 ? 'e' : ''}`);
    if (concepts) parts.push(`${concepts} Konzept${concepts > 1 ? 'e' : ''}`);
    return `<div class="card">
      <div class="card__body">
        <div class="card__title">${C.escape(dk)}</div>
        <p class="card__description">${C.escape(parts.join(' · '))}</p>
        <div class="pill-row">${list.slice(0, 4).map(p =>
          `<a class="badge badge--${DCAT_VARIANT[p.dcatClass]}" href="#/data/${encodeURIComponent(p.id)}">${C.escape(p.title)}</a>`
        ).join('')}</div>
      </div>
    </div>`;
  }).join('');

  // ---- (b) Datenkatalog (DCAT) — Filter-Chips nach dcatClass ----
  const classes = ['Alle', 'Dataset', 'DataService', 'Concept'];
  let activeClass = 'Alle';

  const counts = {
    Alle: products.length,
    Dataset: products.filter(p => p.dcatClass === 'Dataset').length,
    DataService: products.filter(p => p.dcatClass === 'DataService').length,
    Concept: products.filter(p => p.dcatClass === 'Concept').length,
  };

  function tierBadge(id) {
    const t = tiers.find(x => x.id === id);
    return t ? C.badge(t.label, t.variant) : (id ? C.badge(id, 'gray') : '');
  }

  function productCard(p) {
    const isRoadmap = !!p.note;
    const dists = (p.distributions || []).length
      ? `<div class="pill-row mt-2">${p.distributions.map(d =>
          `<a class="btn btn--link" href="${C.escape(d.href || '#')}">${C.icon('Download', 'icon--base')} ${C.escape(d.format)}</a>`
        ).join('')}</div>`
      : '';

    // DataService: Spezifikationsstatus ehrlich anzeigen
    const specBadge = p.dcatClass === 'DataService'
      ? (p.specStatus === 'vorhanden'
          ? C.badge('Spezifikation vorhanden', 'success')
          : C.badge(p.specNote ? short(p.specNote) : 'Spezifikation offen', 'warning'))
      : '';

    const conceptRefs = (p.conceptRefs || []).length
      ? `<div class="pill-row mt-2">${p.conceptRefs.map(cid => {
          const c = core.dataProduct(cid);
          return `<a class="badge badge--gray" href="#/data/${encodeURIComponent(cid)}">${C.icon('Book', 'icon--base')} ${C.escape(c ? c.title : cid)}</a>`;
        }).join('')}</div>`
      : '';

    const badges = [
      `<span class="badge badge--${DCAT_VARIANT[p.dcatClass]}">${C.escape(DCAT_LABEL[p.dcatClass] || p.dcatClass)}</span>`,
      tierBadge(p.classification),
    ];
    if (isRoadmap) badges.push(C.badge('Roadmap', 'gray'));
    if (specBadge) badges.push(specBadge);

    return `<article class="card" data-class="${C.escape(p.dcatClass)}">
      <div class="card__body">
        <div class="pill-row">${badges.filter(Boolean).join('')}</div>
        <a class="card__title" href="#/data/${encodeURIComponent(p.id)}" style="color:inherit">${C.escape(p.title)}</a>
        <p class="card__description">${C.escape(p.description)}</p>
        <dl class="kv mt-2">
          <dt>Domäne</dt><dd>${C.escape(p.domain)}</dd>
          <dt>Datenverantw.</dt><dd>${C.escape(p.ownerLabel)}</dd>
          ${(p.format || []).length ? `<dt>Format</dt><dd>${C.escape(p.format.join(', '))}</dd>` : ''}
          <dt>Aktualisiert</dt><dd>${C.escape(p.updated || '—')}</dd>
        </dl>
        ${isRoadmap ? `<p class="small muted mt-2">${C.icon('InfoCircle', 'icon--base')} ${C.escape(p.note)}</p>` : ''}
        ${dists}
        ${conceptRefs}
      </div>
      <div class="card__footer">
        <a class="btn btn--link" href="#/data/${encodeURIComponent(p.id)}">Details ${C.icon('ArrowRight', 'icon--base')}</a>
      </div>
    </article>`;
  }

  function catalogChips() {
    return `<div class="list list--flex list--wrap" id="dcat-chips">${classes.map(c =>
      `<button type="button" class="tag-item${c === activeClass ? " tag-item--active" : ""}" aria-pressed="${!!(c === activeClass)}" data-class="${c}"><span class="tag-item__inner"><span class="tag-item__text">${C.escape(c === 'Alle' ? 'Alle' : DCAT_LABEL[c])} <span class="muted">${counts[c]}</span></span></span></button>`
    ).join('')}</div>`;
  }

  function catalogGrid() {
    const list = activeClass === 'Alle' ? products : products.filter(p => p.dcatClass === activeClass);
    return list.length
      ? `<div class="grid grid--2 mt-4">${list.map(productCard).join('')}</div>`
      : C.empty('Keine Datenprodukte in dieser Kategorie.');
  }

  function drawCatalog() {
    const host = mount.querySelector('#dcat-grid');
    if (host) host.innerHTML = catalogGrid();
    mount.querySelectorAll('#dcat-chips .tag-item').forEach(b =>
      b.classList.toggle('tag-item--active', b.getAttribute('data-class') === activeClass));
  }

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({ title: 'Daten', lead: 'Interner Datenkatalog des BBL: Datensätze, Datendienste (APIs) und Konzepte/Codelisten — DCAT-AP-CH-förmig beschrieben und nach Domäne beziehbar.' })}

    ${C.notification('Demo mit Mock-Daten. Alle Datenprodukte sind <strong>intern</strong> klassifiziert (ISG: INTERN). Der Datenkatalog folgt dem Modell von «Datenbezug» (BLW) und «I14Y».', 'info')}

    <section class="mt-8">
      <h2>${C.icon('FileDatabase', 'icon--base')} Datenbezug nach Domäne</h2>
      <p class="page-intro muted">Datenprodukte nach Fachdomäne. Wählen Sie ein Datenprodukt, um die enthaltenen Datensätze, Dienste und Konzepte zu sehen.</p>
      <div class="grid grid--3 mt-4">${domainCards || C.empty('Keine Datenprodukte vorhanden.')}</div>
    </section>

    <section class="mt-8">
      <h2>${C.icon('Database', 'icon--base')} Datenkatalog (DCAT)</h2>
      <p class="page-intro muted">Filtern Sie nach DCAT-Klasse: <strong>Datensatz</strong> (Dataset), <strong>Datendienst</strong> (DataService) oder <strong>Konzept</strong> (Concept).</p>
      <div class="mt-4">${catalogChips()}</div>
      <div id="dcat-grid">${catalogGrid()}</div>
    </section>
  </div>`;

  const chipBar = mount.querySelector('#dcat-chips');
  if (chipBar) chipBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tag-item');
    if (!btn) return;
    activeClass = btn.getAttribute('data-class');
    drawCatalog();
  });
}

// ============================== DETAIL ==============================

function detail(ctx, id) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  const p = core.dataProduct(id);
  if (!p) {
    mount.innerHTML = `<div class="container section">${C.backLink('#/data/katalog', 'Datenbezug')}${C.empty('Datenprodukt nicht gefunden.')}</div>`;
    return;
  }
  setTitle(p.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Daten und Digitalisierung', href: '#/data' }, { label: 'Datenbezug', href: '#/data/katalog' }, { label: p.title }]);

  const tiers = core.ref().classificationTiers || [];
  const tier = tiers.find(t => t.id === p.classification);
  const tierBadge = tier ? C.badge(tier.label, tier.variant) : (p.classification ? C.badge(p.classification, 'gray') : '');
  const isRoadmap = !!p.note;

  const headBadges = [
    `<span class="badge badge--${DCAT_VARIANT[p.dcatClass]}">${C.escape(DCAT_LABEL[p.dcatClass] || p.dcatClass)}</span>`,
    tierBadge,
  ];
  if (isRoadmap) headBadges.push(C.badge('Roadmap', 'gray'));

  // Distributionen
  const distRows = (p.distributions || []).length
    ? `<ul class="stack" style="list-style:none">${p.distributions.map(d =>
        `<li class="row row--between" style="border:1px solid var(--color-border);border-radius:var(--radius);padding:.6rem .85rem;background:#fff">
          <span class="row gap-sm">${C.icon('File', 'icon--base')} <strong>${C.escape(d.format)}</strong></span>
          <a class="btn btn--outline btn--sm" href="${C.escape(d.href || '#')}">${C.icon('Download', 'icon--base')} Beziehen</a>
        </li>`
      ).join('')}</ul>`
    : `<p class="muted">${C.icon('InfoCircle', 'icon--base')} Keine Distribution verfügbar${isRoadmap ? ' (Roadmap)' : ''}.</p>`;

  // DataService Spezifikation
  const specBlock = p.dcatClass === 'DataService'
    ? `<div class="box">
        <h3>Spezifikation</h3>
        <div class="pill-row">${p.specStatus === 'vorhanden'
          ? C.badge('Spezifikation vorhanden', 'success')
          : C.badge('Noch nicht verfügbar', 'warning')}</div>
        ${p.specNote ? `<p class="small muted mt-2" style="margin-bottom:0">${C.escape(p.specNote)}</p>` : ''}
      </div>`
    : '';

  // Konzeptverweise
  const conceptBlock = (p.conceptRefs || []).length
    ? `<div class="box">
        <h3>Verwendete Konzepte</h3>
        <div class="stack" style="--space:.4rem">${p.conceptRefs.map(cid => {
          const c = core.dataProduct(cid);
          return `<a class="row gap-sm" style="padding:.25rem 0" href="#/data/${encodeURIComponent(cid)}">${C.icon('Book', 'icon--base')} <span class="small">${C.escape(c ? c.title : cid)}</span></a>`;
        }).join('')}</div>
      </div>`
    : '';

  // Wo dieses Konzept referenziert wird (für Concept-Produkte)
  const usedByBlock = p.dcatClass === 'Concept'
    ? (() => {
        const users = core.dataProducts().filter(x => (x.conceptRefs || []).includes(p.id));
        if (!users.length) return '';
        return `<div class="box">
          <h3>Verwendet in</h3>
          <div class="stack" style="--space:.4rem">${users.map(u =>
            `<a class="row gap-sm" style="padding:.25rem 0" href="#/data/${encodeURIComponent(u.id)}">${C.icon('FileDatabase', 'icon--base')} <span class="small">${C.escape(u.title)}</span></a>`
          ).join('')}</div>
        </div>`;
      })()
    : '';

  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/data/katalog', 'Datenbezug')}
    <div class="split mt-4">
      <div class="stack-lg">
        <div>
          <div class="pill-row">${headBadges.filter(Boolean).join('')}</div>
          <h1 tabindex="-1">${C.escape(p.title)}</h1>
          <p class="lead">${C.escape(p.description)}</p>
        </div>

        ${isRoadmap ? C.notification(C.escape(p.note), 'warning', 'WarningCircle') : ''}

        <div>
          <h2>Distributionen</h2>
          ${distRows}
        </div>

        <div>
          <h2>Metadaten</h2>
          <dl class="kv">
            <dt>DCAT-Klasse</dt><dd>${C.escape(DCAT_LABEL[p.dcatClass] || p.dcatClass)} <span class="muted">(${C.escape(p.dcatClass)})</span></dd>
            <dt>Domäne</dt><dd>${C.escape(p.domain)}</dd>
            <dt>Datenverantwortung</dt><dd>${C.escape(p.ownerLabel)}</dd>
            ${(p.format || []).length ? `<dt>Format</dt><dd>${C.escape(p.format.join(', '))}</dd>` : ''}
            ${typeof p.recordCount === 'number' ? `<dt>Datensätze</dt><dd>${Number(p.recordCount).toLocaleString('de-CH')}</dd>` : ''}
            <dt>Zugriffsstufe</dt><dd>${C.escape(p.accessLevel || '—')}</dd>
            <dt>Klassifizierung</dt><dd>${tierBadge || C.escape(p.classification || '—')}</dd>
            <dt>Aktualisiert</dt><dd>${C.escape(p.updated || '—')}</dd>
            <dt>ID</dt><dd><code>${C.escape(p.id)}</code></dd>
          </dl>
        </div>
      </div>

      <aside class="stack-lg">
        <div class="box">
          <h3>Datenverantwortung</h3>
          <p class="small" style="margin:0">${C.icon('User', 'icon--base')} <strong>${C.escape(p.ownerLabel)}</strong></p>
          <p class="small muted" style="margin:.35rem 0 0">Fragen zu diesem Datenprodukt richten Sie an die zuständige Stelle.</p>
        </div>
        ${specBlock}
        ${conceptBlock}
        ${usedByBlock}
        <div class="box">
          <h3>Klassifizierung</h3>
          <div class="pill-row">${tierBadge || C.escape(p.classification || '—')}</div>
          <p class="small muted" style="margin:.5rem 0 0">Informationsschutz nach ISG. Nur für berechtigte interne Nutzende.</p>
        </div>
      </aside>
    </div>
  </div>`;
}

// ============================== Helpers ==============================

function groupBy(arr, key) {
  const out = {};
  for (const x of arr) { (out[x[key]] = out[x[key]] || []).push(x); }
  return out;
}

function short(s) {
  const str = String(s || '');
  if (/zu erstellen/i.test(str)) return 'Zu erstellen';
  if (/designphase/i.test(str)) return 'Designphase';
  return str.length > 40 ? str.slice(0, 38) + '…' : str;
}
