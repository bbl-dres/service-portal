// Shared UI component helpers — all return HTML strings (pages compose via templates).
// Class names follow the CD Bund design system; see docs/cd-gap-analysis.md.

const ICON_BASE = 'assets/icons/';

// CD's own chevron path (Select.vue:19 — identical to assets/icons/ChevronDown.svg)
const CHEVRON_SVG = '<svg role="presentation" aria-hidden="true" viewBox="0 0 24 24">'
  + '<path d="m5.706 10.015 6.669 3.85 6.669-3.85.375.649-7.044 4.067-7.044-4.067z"/></svg>';

// --- Placeholder photography -------------------------------------------------
// Demo images come from Unsplash (data/*.json carry a `photo` = Unsplash photo id).
// The id is only ever interpolated after a strict charset check; the `color` of
// the record stays behind the image, so a failed/offline fetch degrades to CD's
// image-not-available placeholder over the plain colour block.
const PHOTO_BASE = 'https://images.unsplash.com/photo-';
const PHOTO_ID = /^[A-Za-z0-9_-]+$/;

export function photoUrl(id, { w = 800, h = 0, q = 70, gray = false } = {}) {
  if (!id || !PHOTO_ID.test(id)) return '';
  let u = `${PHOTO_BASE}${id}?auto=format&fit=crop&w=${w}&q=${q}`;
  if (h) u += `&h=${h}`;
  if (gray) u += '&sat=-100';   // historic material reads as archival b/w
  return u;
}

export function photo(o = {}) {
  const src = photoUrl(o.id, { w: o.w, h: o.h, q: o.q, gray: o.gray });
  const img = src
    ? `<img src="${src}" alt="${escape(o.alt || '')}" loading="lazy" decoding="async" onerror="this.remove()">`
    : '';
  return `<div class="photo${o.cls ? ' ' + o.cls : ''}" style="background-color:${escape(o.color || '#2f4356')}${o.style ? ';' + o.style : ''}">${img}${o.overlay || ''}</div>`;
}

export function icon(name, cls = 'icon--base') {
  const u = ICON_BASE + name + '.svg';
  return `<span class="icon ${cls}" style="-webkit-mask-image:url('${u}');mask-image:url('${u}')" aria-hidden="true"></span>`;
}

export function escape(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// decodeURIComponent, das bei malformten Sequenzen (roh getippter Hash wie
// `#/applications/%`) nicht wirft, sondern den Rohwert zurückgibt (code-review A6).
export function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// Wiederkehrende englische Fachbegriffe im sonst deutschen Text. Für WCAG 3.1.2
// (Sprache von Teilen) werden sie inline mit lang="en" ausgezeichnet, damit
// Screenreader sie englisch aussprechen.
const EN_TERMS = ['Digital by Design', 'Digital First', 'Digital Only', 'Once-Only', 'Common Data Environment'];

// Escaped den Text und zeichnet bekannte fremdsprachige Phrasen mit lang aus.
// Längere Phrasen zuerst, damit Teilphrasen nicht vorzeitig umschlossen werden.
export function markLang(text, terms = EN_TERMS) {
  let out = escape(text);
  for (const phrase of [...terms].sort((a, b) => b.length - a.length)) {
    const e = escape(phrase);
    if (out.includes(e)) out = out.split(e).join(`<span lang="en">${e}</span>`);
  }
  return out;
}

// --- Badges (badge.postcss) --------------------------------------------------
export function badge(text, variant = 'gray', size = '') {
  return `<span class="badge badge--${variant}${size ? ' badge--' + size : ''}">${escape(text)}</span>`;
}

export function audienceTag(a) {
  const map = { internal: ['blue', 'Intern'], external: ['green', 'Extern'], both: ['gray', 'Intern + Extern'] };
  const [v, l] = map[a] || map.both;
  return badge(l, v);
}

const STATUS_VARIANT = {
  entwurf: 'gray', eingereicht: 'info', in_pruefung: 'warning', in_pruefung_gs: 'warning',
  in_pruefung_pfm: 'warning', rueckfrage: 'warning', in_arbeit: 'warning', triage: 'info',
  genehmigt: 'success', in_projekt: 'info', abgeschlossen: 'success', erledigt: 'success',
  geliefert: 'success', abgelehnt: 'error', zurueckgezogen: 'gray', in_bearbeitung: 'warning',
};
export function statusBadge(status, label) {
  return badge(label || status, STATUS_VARIANT[status] || 'gray');
}

// --- Tag items — CD's filter control (tag-item.postcss) ----------------------
export function tagItem({ label, active = false, size = '', iconName = '', attrs = '' }) {
  const cls = ['tag-item', active ? 'tag-item--active' : '', size ? 'tag-item--' + size : ''].filter(Boolean).join(' ');
  return `<button type="button" class="${cls}" aria-pressed="${active}"${attrs ? ' ' + attrs : ''}>`
    + `<span class="tag-item__inner">${iconName ? icon(iconName, 'icon--sm') : ''}`
    + `<span class="tag-item__text">${escape(label)}</span></span></button>`;
}

export function pageHeader({ title, lead }) {
  return `<div class="page-header"><h1 tabindex="-1">${escape(title)}</h1>${lead ? `<p class="lead">${escape(lead)}</p>` : ''}</div>`;
}

// Flat CD card (card--flat) — used for compact text-led teasers.
export function tile({ title, desc, href, extra = '' }) {
  return `<a class="card card--flat card--clickable" href="${escape(href)}">
    <div class="card__content"><div class="card__body">
      <span class="card__title">${escape(title)}</span>
      ${desc ? `<span class="card__description">${escape(desc)}</span>` : ''}${extra}
    </div></div></a>`;
}

// --- Cards (card.postcss) ----------------------------------------------------
export function card(o) {
  const media = o.photo
    ? `<div class="card__image">${photo({ ...o.photo, alt: o.photo.alt || '', w: 640 })}</div>`
    : o.image ? `<div class="card__image"><img src="${escape(o.image)}" alt="${escape(o.imageAlt || '')}" loading="lazy"></div>`
    : o.placeholder ? `<div class="card__image"><div class="photo image__not-available">${icon('Image')}<p class="image__not-available-text">${escape(o.placeholder === true ? 'Bild folgt' : o.placeholder)}</p></div></div>`
    : '';
  // CD: `card--default` is the plain shadow card (with or without image);
  // `card--universal` is the variant whose image is letterboxed (object-contain),
  // so it stays opt-in via o.variant — image-less cards are default, not universal.
  const variant = o.variant || 'default';
  const inner = `${media}
    <div class="card__content">
      <div class="card__body">
        <div class="card__title">${escape(o.title)}</div>
        ${o.badges ? `<div class="pill-row">${o.badges.join('')}</div>` : ''}
        ${o.desc ? `<p class="card__description">${escape(o.desc)}</p>` : ''}
      </div>
      ${o.footer ? `<div class="card__footer">${o.footer}</div>` : ''}
    </div>`;
  const cls = `card card--${variant}${o.href ? ' card--clickable' : ''}`;
  const ext = o.external ? ' target="_blank" rel="noopener external"' : '';
  return o.href ? `<a class="${cls}" href="${escape(o.href)}"${ext}>${inner}</a>` : `<div class="${cls}">${inner}</div>`;
}

// --- Tables (table.postcss) --------------------------------------------------
// columns: [{ key, label, render?(row) }]; rows: object[]; caption names the table.
// `foot` = fertiges <tr>…</tr>-HTML für eine <tfoot>-Zeile (z. B. eine Summenzeile);
// der Aufrufer escaped den Inhalt.
export function table({ columns, rows, zebra, caption, showCaption, foot }) {
  const head = columns.map(c => `<th scope="col">${escape(c.label)}</th>`).join('');
  const body = (rows || []).map(r =>
    `<tr>${columns.map((c, i) => {
      const cell = c.render ? c.render(r) : escape(r[c.key]);
      return i === 0 ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`;
    }).join('')}</tr>`
  ).join('');
  const cls = ['table', zebra ? 'table--zebra' : '', showCaption ? 'table--caption' : ''].filter(Boolean).join(' ');
  return `<div class="table-wrapper" tabindex="0" role="region" aria-label="${escape(caption || 'Tabelle')}">
    <table class="${cls}">
    ${caption ? `<caption>${escape(caption)}</caption>` : ''}
    <thead><tr>${head}</tr></thead>
    <tbody>${body || `<tr><td colspan="${columns.length}" class="muted">Keine Einträge</td></tr>`}</tbody>
    ${foot ? `<tfoot>${foot}</tfoot>` : ''}
  </table></div>`;
}

// Leerer Zustand. `unavailable: true` (P0-4) markiert «Daten nicht verfügbar»
// (Ladefehler) statt «keine Einträge» — mit Warnsymbol und error-Tönung.
// `hint` ergänzt einen zweiten, helfenden Satz (z. B. «Suche/Filter anpassen»).
export function empty(msg, opts = {}) {
  if (opts.unavailable) {
    return `<div class="empty empty--unavailable">${icon('WarningCircle', 'icon--base')}<span>${escape(msg)}</span></div>`;
  }
  // Angereicherter Leerzustand nur mit Hinweis; ohne bleibt es die schlichte Variante.
  return opts.hint
    ? `<div class="empty"><p class="empty__title">${escape(msg)}</p><p class="empty__hint">${opts.hint}</p></div>`
    : `<div class="empty">${escape(msg)}</div>`;
}

// Standard-«nicht gefunden»-Block für Detailrouten (zuvor mehrfach kopiert).
// Titel/Brotkrume setzt die aufrufende Seite; `body` ist HTML (mit Rück-Link).
export function notFound({ backHref, backLabel, title, body }) {
  return `<div class="container section">
    ${backLink(backHref, backLabel)}
    <div class="page-header mt-4"><h1 tabindex="-1">${escape(title)}</h1></div>
    <p class="muted">${body}</p>
  </div>`;
}

// Aktive-Filter-Pillenreihe (zuvor in services/applications/katalog kopiert).
// filters = [{ label, href }] — href = dieselbe Ansicht ohne diesen einen Filter.
// Zwei Modi, gleiche Optik (`.active-filters` / `.active-filter`): Katalogseiten
// geben `href` je Pille + `resetHref` (Hash-Navigation, teilbar); JS-State-Seiten
// (Portfolio) geben stattdessen `remove` (Daten-Token je Pille) — dann werden die
// Pillen zu <button data-remove> und der Reset zu <button data-reset>, die der
// Aufrufer verdrahtet. `label` überschreibt den Vorspann «Aktive Filter:».
export function activeFilters({ filters, resetHref, resetLabel = 'Alle Filter zurücksetzen', label = 'Aktive Filter:' }) {
  if (!filters || !filters.length) return '';
  const pill = (f) => f.href != null
    ? `<a class="badge badge--gray active-filter" href="${escape(f.href)}" aria-label="Filter „${escape(f.label)}“ entfernen">${escape(f.label)}${icon('Cancel', 'icon--sm')}</a>`
    : `<button type="button" class="badge badge--gray active-filter" data-remove="${escape(f.remove == null ? '' : f.remove)}" aria-label="Filter „${escape(f.label)}“ entfernen">${escape(f.label)}${icon('Cancel', 'icon--sm')}</button>`;
  const reset = resetHref != null
    ? `<a class="btn btn--link" href="${escape(resetHref)}">${escape(resetLabel)}</a>`
    : `<button type="button" class="btn btn--link" data-reset>${escape(resetLabel)}</button>`;
  return `<div class="active-filters mt-4" role="group" aria-label="Aktive Filter">
    <span class="small muted">${escape(label)}</span>
    ${filters.map(pill).join('')}
    ${reset}
  </div>`;
}

// Ansage in die persistente Live-Region (#live in index.html) — für Trefferzahl-,
// Ansichts- und Seitenwechsel, die sonst still wären (WCAG 4.1.3). Nur Text
// mutieren, nie den Knoten neu erzeugen, sonst feuert aria-live nicht.
export function announce(msg) {
  const n = document.getElementById('live');
  if (n) n.textContent = msg;
}

// Icon-Kachel (domain-tile): bildlose Karte mit grossem Icon, Titel, Text und
// «Öffnen»-Fuss. Eine Quelle für die Übersichtskarten (Daten, Wissen,
// Digitalisierung) — bildlose Karten sind card--default (CD, nicht --universal).
export function domainTile({ icon: ic, title, desc, meta = '', href, external = false }) {
  const ext = external ? ' target="_blank" rel="noopener external"' : '';
  return `<a class="card card--default card--clickable" href="${escape(href)}"${ext}>
    <div class="card__content">
      <div class="card__body">
        <span class="domain-tile__icon">${icon(ic, 'icon--2xl')}</span>
        <div class="card__title">${escape(title)}</div>
        <p class="card__description">${escape(desc)}</p>
      </div>
      <div class="card__footer">
        <span>${escape(meta)}</span>
        <span class="btn btn--link">Öffnen ${icon(external ? 'External' : 'ArrowRight', 'icon--base')}</span>
      </div>
    </div>
  </a>`;
}

// Share-Bar (share-bar.postcss) — nach der Brotkrume auf Detailseiten: Drucken
// und Link kopieren. Rechtsbündig (flex-row-reverse) wie im CD.
export function shareBar() {
  // CD: nur Icons (aria-label), keine sichtbaren Beschriftungen, grosse Icons (ShareBar.vue, SvgIcon size="xl").
  return `<div class="share-bar">
    <div class="share-container">
      <button class="btn btn--bare share-bar__btn" type="button" onclick="window.print()" aria-label="Seite drucken" title="Drucken">${icon('Printer', 'icon--xl')}</button>
      <button class="btn btn--bare share-bar__btn" type="button" aria-label="Link kopieren" title="Teilen"
        onclick="try{navigator.clipboard.writeText(location.href)}catch(e){}">${icon('Share', 'icon--xl')}</button>
    </div>
  </div>`;
}

// Kopfleiste einer Detailseite: Zurück-Link links, Share-Bar rechts — in EINER
// Zeile (CD: .back-bar + .share-bar auf derselben Höhe nach der Brotkrume).
export function detailBar({ backHref, backLabel } = {}) {
  return `<div class="detail-bar">${
    backHref ? backLink(backHref, backLabel) : '<span></span>'}${shareBar()}</div>`;
}

// Vereinheitlichter Detailseiten-Kopf (CD detailPage*-Muster): detailBar (Zurück +
// Share) und danach ein Hero mit Titel, Lead, Auszeichnungen und optionalem
// Kontextbild (hero--main-image). Ohne `image` fällt der Hero auf die schmale
// Variante zurück. `tags`/`image` sind fertiges HTML; `title`/`lead` werden escaped.
export function detailHead({ backHref, backLabel, title, lead = '', tags = '', image = '' } = {}) {
  const content = `<div class="hero__content">
        <h1 class="hero__title" tabindex="-1">${escape(title)}</h1>
        ${lead ? `<p class="hero__description">${escape(lead)}</p>` : ''}
        ${tags ? `<div class="pill-row">${tags}</div>` : ''}
      </div>`;
  const hero = image
    ? `<div class="hero hero--main-image">${content}<div class="hero__image">${image}</div></div>`
    : `<div class="hero">${content}</div>`;
  return `${detailBar({ backHref, backLabel })}
    ${hero}`;
}

// Horizontaler Status-Stepper (CD steps / tenant-portal pipeline): Chevron-Segmente
// — erledigt (grün, Haken) · aktuell (Primärfarbe, Uhr) · offen (grau). `steps` =
// [{ label }]; `currentIndex` = Index des aktuellen Schritts. Scrollt horizontal auf Mobil.
export function pipeline(steps, currentIndex = 0, { label = 'Statusverlauf' } = {}) {
  const seg = (st, i) => {
    const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'todo';
    const glyph = state === 'done' ? icon('Checkmark', 'icon--sm pipeline__glyph')
      : state === 'active' ? icon('Clock', 'icon--sm pipeline__glyph') : '';
    const sr = state === 'done' ? '<span class="sr-only">Erledigt: </span>'
      : state === 'active' ? '<span class="sr-only">Aktueller Schritt: </span>' : '';
    return `<li class="pipeline__step pipeline__step--${state}"${state === 'active' ? ' aria-current="step"' : ''}>${glyph}<span>${sr}${escape(st.label)}</span></li>`;
  };
  return `<ol class="pipeline" aria-label="${escape(label)}">${steps.map(seg).join('')}</ol>`;
}

// Ein Detailseiten-Abschnitt: H2-Titel + Inhalt. `body` ist fertiges HTML.
export function detailSection({ title, body = '' }) {
  return `<section class="detail-section">
      <h2 class="detail-section__title">${escape(title)}</h2>
      ${body}
    </section>`;
}

// CD-Akkordeon (accordion.postcss): ul > li > h3 > button (.accordion__title +
// optionale .accordion__meta + .accordion__arrow) + .accordion__drawer >
// .accordion__content. `items` = [{ title, meta?, body, open? }]; `title` wird
// escaped, `meta`/`body` sind fertiges HTML. Verdrahtung über wireAccordion().
export function accordion(items, { id = 'acc' } = {}) {
  const li = ({ title, meta = '', body = '', open = false }, i) => {
    const bid = `${id}-b-${i}`, pid = `${id}-p-${i}`;
    return `<li class="accordion__item">
      <h3 class="accordion__heading">
        <button class="accordion__button" type="button" id="${bid}" aria-expanded="${open}" aria-controls="${pid}">
          <span class="accordion__title">${escape(title)}</span>
          <span class="accordion__meta">${meta}${icon('ChevronDown', 'icon--base accordion__arrow')}</span>
        </button>
      </h3>
      <div class="accordion__drawer" id="${pid}" role="region" aria-labelledby="${bid}"${open ? '' : ' hidden'}>
        <div class="accordion__content">${body}</div>
      </div>
    </li>`;
  };
  return `<ul class="accordion" id="${id}-acc">${items.map(li).join('')}</ul>`;
}

// Klick-Verdrahtung für ein oder mehrere Akkordeons in `root` (aria-expanded +
// Drawer ein-/ausblenden). Ersetzt die je Seite kopierte Toggle-Logik.
export function wireAccordion(root) {
  root.querySelectorAll('.accordion__button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      const drawer = root.getElementById
        ? root.getElementById(btn.getAttribute('aria-controls'))
        : root.querySelector('#' + CSS.escape(btn.getAttribute('aria-controls')));
      if (drawer) drawer.hidden = open;
    });
  });
}

// --- Tabs (tab.postcss) ------------------------------------------------------
// Eine APG-Tab-Implementierung (roving tabindex, Klick + Pfeil/Home/End) statt
// fünf leicht abweichender Kopien — davon eine ohne Tastatur (projects). `items`
// = [{ id, label, icon? }]; `id` ist ein Entwickler-Slug (dient zugleich als
// Selektor-/aria-Ziel, daher nicht escaped), `label` wird escaped.
//
// tabBar rendert nur die Registerkarten-Leiste. `panelId` verlinkt ALLE Tabs auf
// EIN gemeinsames Panel (Einzel-Panel-/Neurender-Muster, z. B. dataportal); ohne
// `panelId` zeigt jeder Tab auf sein eigenes `${idPrefix}-panel-${id}` (Mehr-
// Panel-Muster, s. tabPanels).
export function tabBar({ items, active, idPrefix = 'tab', ariaLabel = '', panelId = '', controlsClass = '' } = {}) {
  const btns = items.map((t) => {
    const on = t.id === active;
    const controls = panelId || `${idPrefix}-panel-${t.id}`;
    return `<button type="button" role="tab" id="${idPrefix}-${t.id}" aria-controls="${controls}"`
      + ` class="tab__control${on ? ' tab__control--active' : ''}" aria-selected="${on}"`
      + ` tabindex="${on ? '0' : '-1'}" data-tab="${t.id}">`
      + `${t.icon ? icon(t.icon, 'icon--base') + ' ' : ''}${escape(t.label)}</button>`;
  }).join('');
  return `<div class="tab__controls-container"><div class="tab__controls${controlsClass ? ' ' + controlsClass : ''}"`
    + ` role="tablist"${ariaLabel ? ` aria-label="${escape(ariaLabel)}"` : ''}>${btns}</div></div>`;
}

// Mehr-Panel-Markup (Pattern A): ein .tab__container je Tab, inaktive `hidden`.
// `render(id)` liefert das fertige Panel-HTML. Für das Einzel-Panel-Muster stellt
// der Aufrufer sein eigenes Panel und lässt wireTabs den Inhalt neu rendern.
export function tabPanels({ items, active, idPrefix = 'tab', render }) {
  return items.map((t) =>
    `<div class="tab__container" role="tabpanel" id="${idPrefix}-panel-${t.id}"`
    + ` aria-labelledby="${idPrefix}-${t.id}" tabindex="0" data-panel="${t.id}"`
    + `${t.id === active ? '' : ' hidden'}>${render(t.id)}</div>`).join('');
}

// Verdrahtet die Tab-Leiste(n) in `root`: Klick + Pfeiltasten/Home/End, roving
// tabindex, aria-selected. Vorhandene [data-panel]-Panels werden automatisch
// umgeblendet (Pattern A); `onSelect(id)` rendert bei Einzel-Panel/Neurender den
// Inhalt (Pattern B). `syncHash(id)` spiegelt optional den Tab in die Hash-Query.
// Fokus wird nach `onSelect` per Neuabfrage gesetzt, überlebt also ein Neurender.
export function wireTabs(root, { onSelect, syncHash } = {}) {
  const btns = [...root.querySelectorAll('.tab__control')];
  const panels = [...root.querySelectorAll('[data-panel]')];
  const single = root.querySelectorAll('[role="tabpanel"]');
  const activate = (id) => {
    let activeBtn = null;
    btns.forEach((b) => {
      const on = b.dataset.tab === id;
      if (on) activeBtn = b;
      b.classList.toggle('tab__control--active', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p) => { p.hidden = p.dataset.panel !== id; });
    if (single.length === 1 && activeBtn) single[0].setAttribute('aria-labelledby', activeBtn.id);
    if (onSelect) onSelect(id);
    if (syncHash) syncHash(id);
    // Fokus per Neuabfrage — überlebt ein Neurender durch onSelect; für Maus-
    // Klicks unsichtbar (:focus-visible greift nur bei Tastatur), für die Tastatur
    // korrekt (roving). No-op, wenn die Leiste unverändert bleibt.
    (root.querySelector(`.tab__control[data-tab="${id}"]`) || activeBtn)?.focus();
  };
  btns.forEach((btn, i) => {
    btn.addEventListener('click', () => activate(btn.dataset.tab));
    btn.addEventListener('keydown', (e) => {
      let ni = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') ni = (i + 1) % btns.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ni = (i - 1 + btns.length) % btns.length;
      else if (e.key === 'Home') ni = 0;
      else if (e.key === 'End') ni = btns.length - 1;
      if (ni !== null) { e.preventDefault(); activate(btns[ni].dataset.tab); }
    });
  });
  return { activate };
}

// --- Notifications (notification.postcss) ------------------------------------
// variant: info | success | warning | error | hint | alert
export function notification(text, variant = 'info', iconName = 'InfoCircle') {
  return `<div class="notification notification--${variant}">${icon(iconName, 'notification__icon')}<div class="notification__content">${text}</div></div>`;
}

// Blendet einen Fehler oben in der Seite ein und sagt ihn an — für clientseitige
// Aktionsfehler (z. B. localStorage-Speichern fehlgeschlagen, code-review C1).
export function flashError(mount, msg) {
  announce(msg);
  const host = mount && mount.querySelector('.container');
  if (host) host.insertAdjacentHTML('afterbegin', notification(escape(msg), 'error', 'WarningCircle'));
}

// CD back button. Anatomy copied from the design system's own detail pages
// (app/pages/detailPressRelease.vue, detailPublicationCatalog.vue):
//   <Btn variant="outline" size="sm" icon="ArrowLeft" iconPos="left"
//        label="Zurück" class="btn--back" />
// The visible label is always «Zurück»; `label` names the target for screen
// readers ("Zurück zu Datenbezug"). `.back-link-row` clears the CD float.
export function backLink(href, label) {
  return `<div class="back-link-row"><a class="btn btn--outline btn--sm btn--icon-left btn--back" href="${escape(href)}"${
    label ? ` aria-label="Zurück zu ${escape(label)}"` : ''}>${
    icon('ArrowLeft', 'btn__icon')}<span class="btn__text">Zurück</span></a></div>`;
}

// --- Forms (form.postcss + input.postcss + select.postcss) -------------------
// CD select: label + .select wrapper + native <select> + .select__icon chevron.
export function select(o = {}) {
  const id = o.id;
  const size = o.size || 'base';
  const variant = o.variant || 'outline';
  const msgType = o.messageType || 'error';
  const isError = Boolean(o.message) && msgType === 'error';
  const hintId = o.hint ? `${id}-hint` : '';
  const msgId = o.message ? `${id}-msg` : '';
  const described = [hintId, msgId, o.describedBy].filter(Boolean).join(' ');

  const ctrl = [`input--${variant}`, `input--${size}`];
  if (isError) ctrl.push('input--error');

  const lbl = [];
  if (variant === 'negative') lbl.push('text--negative');
  if (o.hideLabel) lbl.push('sr-only');
  if (o.required) lbl.push('text--asterisk');

  const opts = (o.options || []).map((x) => {
    const v = (x && typeof x === 'object') ? x.value : x;
    const t = (x && typeof x === 'object') ? (x.label != null ? x.label : x.text) : x;
    const sel = String(v) === String(o.value == null ? '' : o.value) ? ' selected' : '';
    const dis = (x && typeof x === 'object' && x.disabled) ? ' disabled' : '';
    return `<option value="${escape(v)}"${sel}${dis}>${escape(t)}</option>`;
  }).join('');

  return `<div class="form__group__select${o.wrapClass ? ' ' + o.wrapClass : ''}">
  ${o.label ? `<label for="${escape(id)}"${lbl.length ? ` class="${lbl.join(' ')}"` : ''}>${escape(o.label)}${
      o.required ? '<span class="sr-only"> Pflichtfeld</span>' : ''}</label>` : ''}
  <div class="select${o.bare ? ' select--bare' : ''}">
    <select id="${escape(id)}" name="${escape(o.name || id)}" class="${ctrl.join(' ')}"${
      o.required ? ' required aria-required="true"' : ''}${
      o.disabled ? ' disabled' : ''}${
      isError ? ' aria-invalid="true"' : ''}${
      described ? ` aria-describedby="${escape(described)}"` : ''}${o.attrs ? ' ' + o.attrs : ''}>${opts}</select>
    <div class="select__icon">${CHEVRON_SVG}</div>
  </div>
  ${o.hint ? `<div class="badge badge--sm badge--info" id="${escape(hintId)}">${escape(o.hint)}</div>` : ''}
  ${o.message ? `<div class="badge badge--sm badge--${escape(msgType)}" id="${escape(msgId)}" role="${
      isError ? 'alert' : 'status'}">${escape(o.message)}</div>` : ''}
</div>`;
}

// Bare CD select chrome: the `.select` positioning box plus the chevron in its
// `.select__icon` divider. Use when the label/message layer is supplied elsewhere.
export const chevron = CHEVRON_SVG;

export function selectBox(inner, extraCls = '', style = '') {
  return `<div class="select${extraCls ? ' ' + extraCls : ''}"${style ? ` style="${style}"` : ''}>${inner}<div class="select__icon">${CHEVRON_SVG}</div></div>`;
}

// CD field wrapper for input/textarea. `control` receives (classes, attributes)
// so required/aria-describedby/aria-invalid land on the control itself.
export function field(o = {}) {
  const id = o.id;
  const msgType = o.messageType || 'error';
  const isError = Boolean(o.message) && msgType === 'error';
  const hintId = o.hint ? `${id}-hint` : '';
  const msgId = o.message ? `${id}-msg` : '';
  const described = [hintId, msgId].filter(Boolean).join(' ');
  const lbl = o.required ? ' class="text--asterisk"' : '';
  const attrs = `${o.required ? ' required aria-required="true"' : ''}`
    + `${isError ? ' aria-invalid="true"' : ''}`
    + `${described ? ` aria-describedby="${escape(described)}"` : ''}`;
  const cls = `input--outline input--base${isError ? ' input--error' : ''}`;
  return `<div class="form__group__input">
    <label for="${escape(id)}"${lbl}>${escape(o.label)}${o.required ? '<span class="sr-only"> Pflichtfeld</span>' : ''}</label>
    ${o.control(cls, attrs)}
    ${o.hint ? `<div class="badge badge--sm badge--info" id="${escape(hintId)}">${escape(o.hint)}</div>` : ''}
    ${o.message ? `<div class="badge badge--sm badge--${escape(msgType)}" id="${escape(msgId)}" role="alert">${escape(o.message)}</div>` : ''}
  </div>`;
}

// Formularwert aus `mount` lesen (ersetzt das 3× kopierte lokale val()); '' wenn
// das Feld fehlt.
export function val(mount, id) { const el = mount.querySelector('#' + id); return el ? el.value : ''; }

// Mehrere Felder in ein Objekt lesen. `map` = { zielSchlüssel: feldId }. Fehlende
// Felder liefern ''; Coercion (Zahlen) und `|| alt`-Fallbacks macht der Aufrufer.
// Typisch: Object.assign(state, C.readForm(mount, { buildingId: 'bld', ort: 'ort' })).
export function readForm(mount, map) {
  const out = {};
  for (const [key, id] of Object.entries(map)) out[key] = val(mount, id);
  return out;
}

// --- Download items (download-item.postcss) ----------------------------------
// Eine CD-download-item-Zeile für alle Fälle (Dokument, App-Einstieg, Ressource,
// Anhang). Ein echtes externes Ziel öffnet ein neues Fenster; `#` degradiert zu
// einem deaktivierten Ersatz. `note`/`desc` sind austauschbar (Datenobjekte tragen
// `desc`, App-Einträge `note`); `icon` überschreibt das Standardsymbol (extern →
// External, sonst Download). `wrapLi` umschliesst mit `<li>` für `.download-items`.
export function downloadItem({ href, title, note = '', desc = '', meta = [], icon: iconName,
  external = false, heading = 'h4', wrapLi = false, download = false } = {}) {
  const text = note || desc;
  const sym = iconName || (external ? 'External' : 'Download');
  const inner = `${icon(sym, 'download-item__icon')}
    <div>
      <${heading} class="download-item__title">${escape(title)}</${heading}>
      ${text ? `<p class="download-item__description">${escape(text)}</p>` : ''}
      ${meta.length ? `<p class="meta-info download-item__meta-info">${
        meta.filter(Boolean).map(m => `<span class="meta-info__item">${escape(m)}</span>`).join('')}</p>` : ''}
    </div>`;
  const real = href && href !== '#';
  const attrs = external ? ' target="_blank" rel="noopener external"' : (download ? ' download' : '');
  const el = real
    ? `<a class="download-item" href="${escape(href)}"${attrs}>${inner}</a>`
    : `<span class="download-item" aria-disabled="true" title="Im Prototyp nicht verfügbar">${inner}
       <span class="sr-only">(im Prototyp nicht verfügbar)</span></span>`;
  return wrapLi ? `<li>${el}</li>` : el;
}

// CD-Kontaktkasten (.box): Name/Rolle/E-Mail(mailto)/Telefon, alle escaped —
// ersetzt die je Seite kopierte Kontaktmarkup und schliesst die unescapten
// mailto-Stellen (code-review B4).
export function contactBox(contact, { title = 'Kontakt', heading = 'h3' } = {}) {
  if (!contact) return '';
  const lines = [
    contact.name ? `<strong>${escape(contact.name)}</strong>` : '',
    contact.role ? escape(contact.role) : '',
    contact.email ? `<a href="mailto:${escape(contact.email)}">${escape(contact.email)}</a>` : '',
    contact.phone ? escape(contact.phone) : '',
  ].filter(Boolean);
  return `<div class="box"><${heading}>${escape(title)}</${heading}>
    <p class="small" style="margin:0">${lines.join('<br>')}</p></div>`;
}

// Link for a demo download that has no real target yet.
export function downloadLink(url, label, iconName = 'Download') {
  const real = url && url !== '#';
  return real
    ? `<a class="btn btn--link" href="${escape(url)}">${icon(iconName, 'btn__icon')} ${escape(label)}</a>`
    : `<span class="btn btn--link" aria-disabled="true" title="Im Prototyp nicht verfügbar">${icon(iconName, 'btn__icon')} ${escape(label)}<span class="sr-only"> (im Prototyp nicht verfügbar)</span></span>`;
}

// --- Pagination (pagination.postcss) -----------------------------------------
// CD anatomy: an editable current-page field, "von N Seiten", then prev/next as
// icon-only outline buttons (disabled at the ends). `href(page)` builds the
// target hash so the caller keeps its own filters; `inputId` is wired by the
// caller for typed page jumps.
export function pagination({ page, totalPages, href, inputId, label = 'Seitennavigation' }) {
  if (totalPages <= 1) return '';
  const control = (target, text, iconName, disabled) => {
    const inner = `${icon(iconName, 'btn__icon')}<span class="btn__text">${text}</span>`;
    return disabled
      ? `<li><span class="btn btn--outline btn--icon-only" aria-disabled="true" aria-label="${text}">${inner}</span></li>`
      : `<li><a class="btn btn--outline btn--icon-only" href="${escape(href(target))}" aria-label="${text}">${inner}</a></li>`;
  };
  return `
    <nav class="pagination-wrap" aria-label="${escape(label)}">
      <div class="pagination">
        <label class="sr-only" for="${inputId}">Seite</label>
        <input id="${inputId}" class="pagination__input input--outline input--base" type="text" inputmode="numeric"
          value="${page}" aria-label="Seite" autocomplete="off">
        <div class="pagination__text">von ${totalPages} Seiten</div>
        <ul class="pagination_items">
          ${control(page - 1, 'Vorherige Seite', 'ChevronLeft', page === 1)}
          ${control(page + 1, 'Nächste Seite', 'ChevronRight', page === totalPages)}
        </ul>
      </div>
    </nav>`;
}

// Wires the editable page field of a pagination block. `go(target)` navigates.
export function wirePagination(mount, inputId, page, totalPages, go) {
  const input = mount.querySelector('#' + inputId);
  if (!input) return;
  const jump = () => {
    const parsed = Number.parseInt(input.value, 10);
    const target = Math.min(totalPages, Math.max(1, Number.isFinite(parsed) ? parsed : page));
    if (target === page) { input.value = String(page); return; }
    go(target);
  };
  input.addEventListener('change', jump);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); jump(); } });
}

// --- Ergebniskopf (search.postcss:208-234) ----------------------------------
// Die Leiste über der Trefferliste: Anzahl links, Steuerung rechts. Der
// Ansichtswechsel steht als Icon-Gruppe rechts, abgetrennt durch einen Strich.
export function resultsHeader({ count, total, unit, page = 1, totalPages = 1, view = 'galerie' }) {
  const pageInfo = totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : '';
  return `
    <div class="search-results__header">
      <div class="search-results__header__left">
        <strong>${escape(String(count))}</strong> von ${escape(String(total))} ${escape(unit)}${pageInfo}
      </div>
      <div class="search-results__header__right">${viewSwitch(view)}</div>
    </div>`;
}

// Gemeinsamer Ergebnisblock der Katalogseiten (Dienstleistungen/Anwendungen/
// Datensätze) — bisher 3× kopiert (P1-7). Filterung/Sortierung/Slicing bleibt in
// der Seite (unterschiedlich); hier vereinheitlicht: Kopf (Trefferzahl + Ansicht),
// Galerie-/Listenumschaltung, Paginierung und der Leer-/Nicht-verfügbar-Zustand.
// `visible` = die aktuell sichtbare (bereits geschnittene) Seite; `count` = Anzahl
// gefilterter Treffer gesamt; `card(item)`/`listView(items)` rendern die Ansicht.
export function catalogueResults({
  visible, count, total, view = 'galerie', page = 1, totalPages = 1,
  card, listView, unit, gridCls = 'grid grid--3',
  paginationHref, paginationInputId, paginationLabel,
  available = true, emptyMsg, unavailableMsg, note = '', header = true,
}) {
  const body = count
    ? `${view === 'liste'
        ? listView(visible)
        : `<div class="${gridCls} mt-4">${visible.map(card).join('')}</div>`}${
      paginationHref ? pagination({ page, totalPages, inputId: paginationInputId, label: paginationLabel, href: paginationHref }) : ''}`
    : available
      ? empty(emptyMsg || `Keine ${escape(unit)} gefunden.`, { hint: 'Passen Sie Ihre Suche oder die Filter an — oben lassen sich aktive Filter zurücksetzen.' })
      : empty(unavailableMsg || `${unit} konnten nicht geladen werden (Ladefehler).`, { unavailable: true });
  // header:false, wenn die Seite bereits eine C.catalogueBar rendert (die Trefferzahl
  // + Ansichtswechsel selbst enthält) — dann nur Hinweis + Trefferkörper.
  return `<section class="mt-6">
      ${header ? resultsHeader({ count, total, unit, page, totalPages, view }) : ''}
      ${note ? `<p class="muted small mt-4">${note}</p>` : ''}
      ${body}
    </section>`;
}

// Standard-Ansage für die Live-Region der Katalogseiten (Trefferzahl · Seite · Ansicht).
export function announceCatalogue({ count, total, unit, page = 1, totalPages = 1, view = 'galerie' }) {
  announce(`${count} von ${total} ${unit}${totalPages > 1 ? `, Seite ${page} von ${totalPages}` : ''}, Ansicht ${view === 'liste' ? 'Liste' : 'Galerie'}`);
}

// Icon-Umschalter Galerie/Liste — keine Beschriftung, der Zustand steht in
// aria-pressed und im aria-label.
// CD-Ansichtsschalter (Icon-Umschaltgruppe, aria-pressed). `items` erlaubt andere
// Ansichtspaare (z. B. Karten/Liste bei Projekten) statt harter btn--filled-Betonung.
export function viewSwitch(view = 'galerie', items = [['galerie', 'Galerieansicht', 'Apps'], ['liste', 'Listenansicht', 'List']]) {
  const btn = ([key, label, iconName]) => {
    const on = view === key;
    return `<button type="button" class="view-switch__btn" data-view="${key}"
      aria-pressed="${on}" aria-label="${escape(label)}" title="${escape(label)}">${icon(iconName, 'icon--md')}</button>`;
  };
  return `<div class="view-switch" role="group" aria-label="Ansicht">
    ${items.map(btn).join('')}
  </div>`;
}

// --- Katalog-Trio (services / applications / katalog teilen dieses Muster) -----
// Ein Katalog-Hash: q/page/view einheitlich, alle weiteren Filter aus `filters`
// als Query-Parameter (String → gesetzt wenn truthy; Array → komma-verbunden wenn
// nicht leer). Default-Werte (page 1, view 'galerie') bleiben aus der URL, damit
// sie kurz und teilbar bleibt. Schlüssel = Parametername (z. B. `topic`, `tag`).
export function catalogueHash(base, { q = '', page = 1, view = '', ...filters } = {}) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  for (const [k, v] of Object.entries(filters)) {
    if (Array.isArray(v)) { if (v.length) p.set(k, v.join(',')); }
    else if (v) p.set(k, String(v));
  }
  if (page > 1) p.set('page', String(page));
  if (view === 'liste') p.set('view', view);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

// Katalog-Suchleiste (service-controls): Suchfeld + Submit + Filter-Slot. `filters`
// ist fertiges HTML (i. d. R. mehrere C.select(...)) — RAW HTML, der Aufrufer escaped.
export function catalogueControls({ formId, inputId, searchLabel, placeholder = 'Suchen…', q = '', filtersLabel = '', filters = '' }) {
  return `<form class="service-controls" id="${formId}" role="search">
    <div class="service-controls__search">
      <label class="sr-only" for="${inputId}">${escape(searchLabel)}</label>
      <input id="${inputId}" type="search" placeholder="${escape(placeholder)}" value="${escape(q)}" autocomplete="off">
      <button class="btn btn--bare btn--icon-only service-controls__submit" type="submit" aria-label="Suchen" title="Suchen">${icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span></button>
    </div>
    ${filters ? `<div class="service-controls__filters"${filtersLabel ? ` aria-label="${escape(filtersLabel)}"` : ''}>${filters}</div>` : ''}
  </form>`;
}

// Verdrahtet die gemeinsamen Katalog-Interaktionen: Suchformular (Submit → Seite 1),
// einfache Filter-Dropdowns (`filters: [{id, param}]` → Wert setzen, Seite 1),
// Ansichtswechsel (behält die Seite) und Pagination. `hash(patch)` baut den Ziel-
// Hash aus Basiszustand + patch (Aufrufer bäckt die Basis ein). Mehrwertige Filter
// (z. B. Themen bei services) verdrahtet der Aufrufer separat.
export function wireCatalogue(mount, { formId, inputId, pageInputId, page = 1, totalPages = 1, hash, filters = [],
  sortId, sortParam = 'sort', filterToggleId, panelId }) {
  const form = mount.querySelector('#' + formId);
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = mount.querySelector('#' + inputId);
    location.hash = hash({ q: input ? input.value.trim() : '', page: 1 });
  });
  filters.forEach(({ id, param }) => {
    const el = mount.querySelector('#' + id);
    if (el) el.addEventListener('change', (e) => { location.hash = hash({ [param]: e.target.value, page: 1 }); });
  });
  // Sortierung (catbar): Wert → Hash, Seite 1.
  if (sortId) {
    const s = mount.querySelector('#' + sortId);
    if (s) s.addEventListener('change', (e) => { location.hash = hash({ [sortParam]: e.target.value, page: 1 }); });
  }
  // Filter-Umschalter (catbar): Panel ein-/ausblenden (rein clientseitig, kein Hash)
  // + Mehrfachauswahl-Checkboxen: bei Änderung alle angehakten Werte der Dimension
  // (data-fdim = Parametername) komma-verbunden in den Hash, Seite 1.
  if (filterToggleId && panelId) {
    const btn = mount.querySelector('#' + filterToggleId), panel = mount.querySelector('#' + panelId);
    if (btn && panel) btn.addEventListener('click', () => { const open = !panel.hidden; panel.hidden = open; btn.setAttribute('aria-expanded', String(!open)); });
    if (panel) panel.addEventListener('change', (e) => {
      const cb = e.target.closest('input[data-fdim]'); if (!cb) return;
      const dim = cb.dataset.fdim;
      const values = [...panel.querySelectorAll('input[data-fdim="' + dim + '"]:checked')].map((x) => x.value);
      location.hash = hash({ [dim]: values, page: 1 });
    });
  }
  mount.querySelectorAll('.view-switch__btn').forEach((btn) => {
    btn.addEventListener('click', () => { location.hash = hash({ page, view: btn.getAttribute('data-view') }); });
  });
  if (pageInputId) wirePagination(mount, pageInputId, page, totalPages, (target) => { location.hash = hash({ page: target }); });
}

// --- Kompakte Katalogleiste (catbar) ----------------------------------------
// Einzeilige, wiederverwendbare Toolbar für alle Katalogansichten (Portfolio,
// Dienstleistungen, Datenbezug, Anwendungen): Suche + Trefferzahl links; dann —
// hinter EINER Trennlinie rechts — Sortierung, Filter-Umschalter (mit Aktiv-Zähler)
// und der Ansichtswechsel. Der Filter öffnet ein einklappbares Panel darunter, das
// die früher fest sichtbaren Filter-Dropdowns aufnimmt. Reines Markup; jede Seite
// verdrahtet Suche/Sort/Filter/Ansicht selbst (Portfolio: JS-State, Katalogseiten:
// Hash). `countId` benennt den (per JS gefüllten) Trefferzähler; `sort` = optionales
// Dropdown {id,name,label,value,options:[{value,label}]}; `views` = viewSwitch-Items;
// `panel` = fertiges Filter-HTML (RAW, der Aufrufer escaped).
export function catalogueBar({
  formId, inputId, searchLabel, placeholder = 'Suchen…', q = '', countId = 'cat-count', count = '',
  sort = null, filterId = '', filterLabel = 'Filter', filterCount = 0,
  panelId = '', panel = '', panelHidden = true,
  view = 'galerie', views,
}) {
  // Sortierung: bare Select, KEIN sichtbares Label (CD-Muster, vgl. indexPage.vue) —
  // eine deaktivierte «Sortieren»-Option dient als In-Control-Hinweis, ein sr-only-
  // Label als Zugänglichkeit. Passt keine Option (kein/leerer Sortierwert), zeigt die
  // Platzhalter-Option «Sortieren»; sonst ist die aktuelle Sortierung selected.
  const sortHtml = sort ? (() => {
    const cur = sort.value == null ? '' : String(sort.value);
    const hasSel = (sort.options || []).some((o) => String(o.value) === cur);
    return `
      <label class="sr-only" for="${escape(sort.id)}">${escape(sort.label || 'Sortierung')}</label>
      <div class="select select--bare catbar__sort">
        <select id="${escape(sort.id)}" name="${escape(sort.name || 'sort')}" class="input--outline input--sm">
          <option disabled${hasSel ? '' : ' selected'}>${escape(sort.placeholder || 'Sortieren')}</option>${
          (sort.options || []).map((o) => `<option value="${escape(o.value)}"${String(o.value) === cur ? ' selected' : ''}>${escape(o.label)}</option>`).join('')}</select>
        <div class="select__icon">${CHEVRON_SVG}</div>
      </div>`;
  })() : '';
  // Filter-Umschalter: bare Button mit Chevron, der beim Öffnen kippt (CD .search__filters__actions).
  const filterHtml = filterId ? `
      <button type="button" class="btn btn--bare btn--sm catbar__filter" id="${escape(filterId)}" aria-expanded="${!panelHidden}"${panelId ? ` aria-controls="${escape(panelId)}"` : ''}>
        ${icon('Filter', 'btn__icon')}<span class="btn__text">${escape(filterLabel)}</span><span class="catbar__fcount"${filterCount ? '' : ' hidden'}>${filterCount ? `(${filterCount})` : ''}</span>${icon('ChevronDown', 'catbar__chev')}
      </button>` : '';
  return `
    <div class="catbar">
      <form class="catbar__search" id="${escape(formId)}" role="search">
        <label class="sr-only" for="${escape(inputId)}">${escape(searchLabel)}</label>
        <input id="${escape(inputId)}" type="search" placeholder="${escape(placeholder)}" value="${escape(q)}" autocomplete="off">
        <button class="btn btn--bare btn--icon-only catbar__submit" type="submit" aria-label="Suchen" title="Suchen">${icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span></button>
      </form>
      <div class="catbar__count" id="${escape(countId)}">${count}</div>
      <div class="catbar__controls">${sortHtml}${filterHtml}${viewSwitch(view, views)}</div>
    </div>${filterId ? `
    <div class="catbar__panel" id="${escape(panelId)}"${panelHidden ? ' hidden' : ''}>${panel}</div>` : ''}`;
}

// Mehrfachauswahl-Filtergruppe (Checkboxen) — dieselbe Optik wie das Portfolio-
// Panel (.filter-group / .filter-check). `dim` = Hash-Parametername (steht auf jeder
// Checkbox als data-fdim), `selected` = aktuell angehakte Werte. Verdrahtet über
// C.wireCatalogue: Panel-Change → alle angehakten Werte der Dimension → Hash.
export function filterGroup({ dim, legend, options = [], selected = [] }) {
  return `<fieldset class="filter-group"><legend class="filter-group__legend">${escape(legend)}</legend>${
    options.map((o) => `<label class="filter-check"><input type="checkbox" data-fdim="${escape(dim)}" value="${escape(o.value)}"${
      selected.includes(o.value) ? ' checked' : ''}><span>${escape(o.label)}</span></label>`).join('')}</fieldset>`;
}

// --- Aktionsmenü (Kebab-Dropdown) --------------------------------------------
// Ein wiederverwendbares Aktionsmenü für die Dashboard-Toolbar und jede Chart-
// Karte (Superset-Muster). `items` = flache Liste aus `{ action, label, icon }`
// (Menüpunkt), `{ heading }` (Gruppentitel) oder `{ separator:true }`. Verhalten
// via C.wireMenu; die Aktion wird per `data-action` an den Aufrufer gereicht (kein
// inline onclick). `menuId` identifiziert das Menü im gemeinsamen onAction-Handler.
export function menu({ menuId, items = [], label = 'Aktionen', align = 'end', triggerIcon = 'More', triggerClass = '' }) {
  const row = (it) => {
    if (it.separator) return '<div class="action-menu__sep" role="separator"></div>';
    if (it.heading) return `<div class="action-menu__heading">${escape(it.heading)}</div>`;
    return `<button type="button" role="menuitem" class="action-menu__item" data-action="${escape(it.action)}" tabindex="-1">`
      + `${it.icon ? icon(it.icon, 'action-menu__icon') : ''}<span>${escape(it.label)}</span></button>`;
  };
  return `<div class="action-menu" data-menu="${escape(menuId)}">
    <button type="button" class="action-menu__trigger${triggerClass ? ' ' + triggerClass : ''}" aria-haspopup="true" aria-expanded="false" aria-label="${escape(label)}" title="${escape(label)}">${icon(triggerIcon, 'icon--base')}</button>
    <div class="action-menu__popup action-menu__popup--${align}" role="menu" aria-label="${escape(label)}" hidden>${items.map(row).join('')}</div>
  </div>`;
}

// Ein einmaliger globaler Schliesser (Klick ausserhalb schliesst offene Menüs),
// damit wiederholtes wireMenu() keine Listener anhäuft. Eigener `.action-menu`-
// Namensraum — `.menu` gehört der CD-Navigations-Flyout-Komponente.
let menuGlobalWired = false;
function ensureMenuGlobal() {
  if (menuGlobalWired || typeof document === 'undefined') return;
  menuGlobalWired = true;
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.action-menu__trigger')) return;
    const inPopup = e.target.closest && e.target.closest('.action-menu__popup');
    document.querySelectorAll('.action-menu__popup:not([hidden])').forEach((pop) => {
      if (pop === inPopup) return;
      pop.hidden = true;
      const trg = pop.closest('.action-menu') && pop.closest('.action-menu').querySelector('.action-menu__trigger');
      if (trg) trg.setAttribute('aria-expanded', 'false');
    });
  });
}

// Verdrahtet alle .action-menu in `root`: Öffnen/Schliessen, Pfeiltasten/Home/End,
// Escape, Klick ausserhalb. Bei Auswahl → onAction(action, menuId, triggerEl).
export function wireMenu(root, onAction) {
  ensureMenuGlobal();
  root.querySelectorAll('.action-menu').forEach((m) => {
    const trigger = m.querySelector('.action-menu__trigger');
    const popup = m.querySelector('.action-menu__popup');
    const items = [...popup.querySelectorAll('.action-menu__item')];
    const open = () => {
      document.querySelectorAll('.action-menu__popup:not([hidden])').forEach((p) => { if (p !== popup) p.hidden = true; });
      popup.hidden = false; trigger.setAttribute('aria-expanded', 'true'); items[0] && items[0].focus();
    };
    const close = (focusTrigger) => { popup.hidden = true; trigger.setAttribute('aria-expanded', 'false'); if (focusTrigger) trigger.focus(); };
    trigger.addEventListener('click', (e) => { e.stopPropagation(); popup.hidden ? open() : close(false); });
    items.forEach((it, i) => {
      it.addEventListener('click', () => { const action = it.dataset.action; close(true); if (onAction) onAction(action, m.dataset.menu, trigger); });
      it.addEventListener('keydown', (e) => {
        let ni = null;
        if (e.key === 'ArrowDown') ni = (i + 1) % items.length;
        else if (e.key === 'ArrowUp') ni = (i - 1 + items.length) % items.length;
        else if (e.key === 'Home') ni = 0;
        else if (e.key === 'End') ni = items.length - 1;
        if (ni !== null) { e.preventDefault(); items[ni].focus(); }
      });
    });
    m.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !popup.hidden) { e.stopPropagation(); close(true); } });
  });
}

// Kurze, selbst-verschwindende Statusmeldung (für simulierte/erledigte Aktionen).
export function toast(msg) {
  if (typeof document === 'undefined') return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast--in'));
  setTimeout(() => { t.classList.remove('toast--in'); setTimeout(() => t.remove(), 300); }, 2800);
}

// --- Login-Hinweis (AGOV / FedLogin) -----------------------------------------
// Kein Inhalt wird versteckt; abgemeldet erscheint nur dieser Hinweis dort, wo
// ein Vorgang ausgelöst würde. Der Button ruft window.__login() (in app.js
// verdrahtet), das die Session setzt und die Seite neu zeichnet.
export function loginGate(text = 'Zum Starten dieses Vorgangs ist eine Anmeldung erforderlich.') {
  return `<div class="notification notification--hint login-gate">
    ${icon('Lock', 'notification__icon')}
    <div class="notification__content">
      <p style="margin:0 0 .75rem">${text}</p>
      <button type="button" class="btn btn--outline login-gate__btn" onclick="window.__login && window.__login()">
        ${icon('User', 'btn__icon')}<span class="btn__text">Anmelden mit AGOV / FedLogin</span>
      </button>
    </div>
  </div>`;
}

export const C = {
  icon, escape, badge, audienceTag, statusBadge, pageHeader, tile, card, table, empty, shareBar, domainTile, announce,
  notFound, activeFilters, detailBar, detailHead, detailSection, markLang, accordion, wireAccordion,
  catalogueResults, announceCatalogue, catalogueHash, catalogueControls, catalogueBar, filterGroup, wireCatalogue, pipeline,
  tabBar, tabPanels, wireTabs, menu, wireMenu, toast,
  notification, flashError, safeDecode, backLink, photo, photoUrl, select, selectBox, chevron, field, val, readForm, tagItem, downloadItem, contactBox, downloadLink,
  pagination, wirePagination, resultsHeader, viewSwitch, loginGate,
};
export default C;
