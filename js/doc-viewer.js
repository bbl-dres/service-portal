// Dokumentvorschau — Vollbild-Lightbox mit schematischer Mock-Darstellung.
// Portiert und verschlankt aus dem BBL Mieterportal (tenant-portal). Analyse-
// Prototyp: es wird kein echtes PDF gerendert, sondern eine schematische Seite
// (Grundriss bzw. Textdokument) mit Titelblock — deutlich als «Mock-Vorschau».
//
// openDocumentViewer(doc, siblings, options): doc = Datensatz aus documents.json,
// siblings = geordnete Liste (aktuelle Trefferliste) für Vor/Zurück.

import C from './components.js';
import { dateiGroesse } from './format.js';

export function documentFileName(doc) {
  const name = String(doc?.fileName || doc?.title || doc?.docId || 'Dokument');
  if (/\.[a-z0-9]{2,8}$/i.test(name)) return name;
  const extension = String(doc?.format || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return extension ? `${name}.${extension}` : name;
}

const kbobType = (doc) => [doc?.typeCode, doc?.type].filter(Boolean).join(' · ') || '—';
const isPlan = (doc) => doc?.typeCode === 'V07102' || doc?.type === 'Grundriss';

function hash(s) { let h = 0; for (let i = 0; i < String(s).length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

const FILLER = [
  'Die vorliegende Dokumentation beschreibt den baulichen Zustand sowie die technischen Anlagen des Objekts im Eigentum oder in der Verwaltung des Bundes.',
  'Die Angaben stützen sich auf die Bestandsaufnahme und die im ERP-System geführten Stammdaten und werden bei baulichen Veränderungen nachgeführt.',
  'Für die Instandhaltung gelten die Weisungen des BBL sowie die massgebenden Normen und die Vorbildfunktion des Bundes im Bereich Energie und Nachhaltigkeit.',
  'Abweichungen zwischen Plan und Ausführung sind der zuständigen Fachstelle zu melden; die Bauwerksdokumentation wird entsprechend aktualisiert.',
];
function filler(seed, n) { return Array.from({ length: n }, (_, i) => FILLER[(seed + i) % FILLER.length]).join(' '); }

const CREST = '<img class="docpage__crest" src="assets/swiss-logo-flag.svg" alt="" aria-hidden="true">';
const PLAN_ROOMS = ['Büro', 'Sitzung', 'Lager', 'Technik', 'Archiv', 'Teeküche', 'Empfang', 'Flur'];

function pageCount(doc) { return isPlan(doc) ? 1 : 2; }

function footer(doc, n, total) {
  return `<footer class="docpage__footer">
    <span>${C.escape(doc.docId || '')}</span><span>BBL Kundenportal · Mock-Vorschau</span><span>Seite ${n} / ${total}</span>
  </footer>`;
}

function planPage(doc, n, total) {
  const h = hash((doc.docId || '') + ':' + n);
  const room = (i) => C.escape(PLAN_ROOMS[(h + i) % PLAN_ROOMS.length]);
  return `<article class="docpage docpage--plan">
    <svg class="docpage__plan" viewBox="0 0 420 594" role="img" aria-label="Schematischer Grundriss (Mock-Vorschau)">
      <rect class="plan-sheet" x="2" y="2" width="416" height="590"/>
      <g class="plan-north" transform="translate(372,52)">
        <line x1="0" y1="14" x2="0" y2="-14"/><line x1="0" y1="-14" x2="-5" y2="-6"/><line x1="0" y1="-14" x2="5" y2="-6"/>
        <text class="plan-label" x="0" y="30">N</text>
      </g>
      <rect class="plan-wall" x="34" y="40" width="300" height="300"/>
      <line class="plan-wall" x1="34" y1="190" x2="334" y2="190"/>
      <line class="plan-wall" x1="150" y1="40" x2="150" y2="190"/>
      <line class="plan-wall" x1="244" y1="40" x2="244" y2="190"/>
      <line class="plan-wall" x1="184" y1="190" x2="184" y2="340"/>
      <line class="plan-wall" x1="184" y1="265" x2="334" y2="265"/>
      <rect class="plan-room" x="44" y="50" width="96" height="130"/><text class="plan-label" x="92" y="118">${room(0)}</text>
      <rect class="plan-room" x="160" y="50" width="74" height="130"/><text class="plan-label" x="197" y="118">${room(1)}</text>
      <rect class="plan-room" x="254" y="50" width="70" height="130"/><text class="plan-label" x="289" y="118">${room(2)}</text>
      <rect class="plan-room" x="44" y="200" width="130" height="130"/><text class="plan-label" x="109" y="268">${room(3)}</text>
      <rect class="plan-room" x="194" y="200" width="130" height="55"/><text class="plan-label" x="259" y="231">${room(4)}</text>
      <rect class="plan-room" x="194" y="275" width="130" height="55"/><text class="plan-label" x="259" y="306">${room(5)}</text>
      <rect class="plan-titleblock" x="34" y="384" width="300" height="86"/>
      <text class="plan-title" x="46" y="410">${C.escape(doc.title)}</text>
      <text class="plan-meta" x="46" y="432">Massstab 1:100 · ${C.escape(String(doc.year || '—'))}</text>
      <text class="plan-meta" x="46" y="452">${C.escape(doc.docId || '')} · Mock-Vorschau</text>
    </svg>
  </article>`;
}

function textPage(doc, n, total) {
  const seed = hash(doc.docId || '') + n;
  const paras = Array.from({ length: 4 }, (_, i) => `<p class="docpage__p">${C.escape(filler(seed + i * 2, 3))}</p>`).join('');
  return `<article class="docpage docpage--text">
    ${n === 1 ? `
      <header class="docpage__letterhead">${CREST}
        <span class="docpage__org">Schweizerische Eidgenossenschaft<br>Bundesamt für Bauten und Logistik BBL</span>
      </header>
      <h1 class="docpage__title">${C.escape(doc.title)}</h1>
      <dl class="docpage__metagrid">
        <div><dt>KBOB-Typ</dt><dd>${C.escape(kbobType(doc))}</dd></div>
        <div><dt>Format</dt><dd>${C.escape(doc.format || '')}</dd></div>
        <div><dt>Jahr</dt><dd>${C.escape(String(doc.year || '—'))}</dd></div>
        <div><dt>Klassifizierung</dt><dd>${C.escape(doc.classification || '—')}</dd></div>
      </dl>` : `<h2 class="docpage__subtitle">${C.escape(doc.title)} — Fortsetzung</h2>`}
    ${paras}
    ${footer(doc, n, total)}
  </article>`;
}

function pageHTML(doc, n, total) {
  return isPlan(doc) ? planPage(doc, n, total) : textPage(doc, n, total);
}

export function openDocumentViewer(doc, siblings, options = {}) {
  if (!doc) return;
  const opener = document.activeElement;
  const list = (Array.isArray(siblings) && siblings.length) ? siblings : [doc];
  const buildingNameFor = typeof options.buildingNameFor === 'function' ? options.buildingNameFor : (id) => id;
  let pos = Math.max(0, list.findIndex(d => d.docId === doc.docId));
  let showMeta = false;

  const backdrop = document.createElement('div');
  backdrop.className = 'docviewer';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  document.body.appendChild(backdrop);
  const releaseOverlayLock = C.acquireOverlayLock();

  // Tab-Falle über das geteilte C.trapFocus statt einer eigenen Selektorliste:
  // drei abweichende Kopien der Fokusliste haben bereits einen Trap-Ausbruch
  // produziert (Review lb-trap-1). Der Listener sitzt auf dem Backdrop und
  // überlebt mount() (innerHTML ersetzt nur die Kinder); die übrigen Tasten
  // bleiben in onKeydown.
  const untrap = C.trapFocus(backdrop);

  let stage, scrollHost, pagesEl, readout, indicator, total, baseW, zoom = 1;

  function applyZoom() {
    zoom = Math.max(0.5, Math.min(3, Math.round(zoom * 100) / 100));
    if (pagesEl) pagesEl.style.setProperty('--docpage-w', Math.round(baseW * zoom) + 'px');
    if (readout) readout.textContent = Math.round(zoom * 100) + '%';
  }

  function measurePages() {
    const width = stage?.clientWidth || backdrop.clientWidth;
    baseW = Math.max(280, Math.min(820, width - 96));
    applyZoom();
  }

  function onResize() { measurePages(); }

  // Kurzer Hinweis für simulierte Aktionen (Download/Upload/Teilen). Gleiche
  // Anatomie und Dauer wie C.toast (CD toast-message: Notification im Host,
  // Einblenden, 5 s + 300 ms Ausblenden) — nur im Backdrop gehostet, weil
  // --z-viewer (200) über --z-toast (110) liegt: ein Toast auf dem <body>
  // wäre hinter dem Betrachter unerreichbar (tokens.css z-Skala).
  // .toast__message liefert die Blende, .docviewer__toast nur Position/Schatten.
  function toast(msg, variant = 'success', iconName = 'CheckmarkCircle') {
    C.announce(msg); // wie C.toast: aria-live feuert in frisch erzeugten Knoten nicht.
    const t = document.createElement('div');
    t.className = 'toast__message docviewer__toast';
    t.innerHTML = C.notification(C.escape(msg), variant, iconName);
    backdrop.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast__message--in'));
    setTimeout(() => { t.classList.remove('toast__message--in'); setTimeout(() => t.remove(), 300); }, 5000);
  }

  let closed = false;
  let unregisterOverlay = () => {};
  function close() {
    if (closed) return;
    closed = true;
    unregisterOverlay();
    document.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('resize', onResize);
    untrap();
    backdrop.remove();
    releaseOverlayLock();
    if (opener && opener.focus) opener.focus();
  }

  function go(delta) {
    if (list.length < 2) return;
    pos = (pos + delta + list.length) % list.length;
    mount();
    try { stage.focus(); } catch (e) { /* stage may be gone */ }
  }

  function onKeydown(e) {
    const typing = document.activeElement && document.activeElement.matches && document.activeElement.matches('textarea, input');
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (typing) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoom += 0.25; applyZoom(); return; }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); zoom -= 0.25; applyZoom(); return; }
    if (e.key === '0') { e.preventDefault(); zoom = 1; applyZoom(); return; }
    if (e.key === 'ArrowLeft' && list.length > 1) { e.preventDefault(); go(-1); return; }
    if (e.key === 'ArrowRight' && list.length > 1) { e.preventDefault(); go(1); return; }
  }

  function mount() {
    const d = list[pos];
    const many = list.length > 1;
    const buildingId = (d.linkedTo || [])[0] || '';
    const buildingName = buildingId ? buildingNameFor(buildingId) : '';
    total = pageCount(d);
    const pages = Array.from({ length: total }, (_, i) => pageHTML(d, i + 1, total)).join('');
    const metadata = [
      ['Dokument-ID', d.docId],
      ['Dateiname', documentFileName(d)],
      ['KBOB-Typ', kbobType(d)],
      ['Kategorie', d.category || '—'],
      ['Gebäude', buildingName || buildingId || '—'],
      ['Jahr', String(d.year || '—')],
      ['Format', d.format || '—'],
      ['Grösse', dateiGroesse(d.sizeKB)],
      ['Klassifizierung', d.classification || '—'],
      ['Taxonomie', 'KBOB/IPB Dokumenttypenkatalog 2016'],
    ];
    backdrop.classList.toggle('docviewer--meta-open', showMeta);
    backdrop.setAttribute('aria-label', 'Dokumentvorschau: ' + documentFileName(d));
    backdrop.innerHTML = `
    <div class="docviewer__bar">
      <div class="docviewer__heading">
        ${C.icon('File', 'docviewer__heading-icon icon--lg')}
        <div class="docviewer__heading-text">
          <p class="docviewer__title">${C.escape(documentFileName(d))}</p>
          <p class="docviewer__sub">${C.escape(kbobType(d))} · <span data-page-indicator>Seite 1 / ${total}</span>${many ? ` · <span class="docviewer__docnum">Dokument ${pos + 1} / ${list.length}</span>` : ''}</p>
        </div>
      </div>
      <div class="docviewer__actions">
        <button class="docviewer__btn" type="button" data-act="download" aria-label="Herunterladen" title="Herunterladen">${C.icon('Download', 'icon--md')}</button>
        <button class="docviewer__btn${showMeta ? ' is-active' : ''}" type="button" data-act="meta"
          aria-expanded="${showMeta}" aria-controls="docviewer-meta"
          aria-label="${showMeta ? 'Metadaten ausblenden' : 'Metadaten anzeigen'}" title="Metadaten">${C.icon('InfoCircle', 'icon--md')}</button>
        <button class="docviewer__btn" type="button" data-act="upload" aria-label="Neue Version hochladen" title="Neue Version hochladen">${C.icon('Upload', 'icon--md')}</button>
        <button class="docviewer__btn" type="button" data-act="share" aria-label="Dokument teilen" title="Teilen">${C.icon('Share', 'icon--md')}</button>
        <button class="docviewer__btn" type="button" data-act="comment" aria-label="Kommentieren" title="Kommentieren">${C.icon('SpeechBubble', 'icon--md')}</button>
        <button class="docviewer__btn docviewer__btn--close" type="button" data-act="close" aria-label="Vorschau schliessen" title="Schliessen">${C.icon('Cancel', 'icon--md')}</button>
      </div>
    </div>
    <div class="docviewer__body">
      <div class="docviewer__main">
        ${many ? `<button class="docviewer__nav docviewer__nav--prev" type="button" data-act="prev" aria-label="Vorheriges Dokument" title="Vorheriges Dokument">${C.icon('ChevronLeft', 'icon--lg')}</button>` : ''}
        <div class="docviewer__stage" tabindex="0" aria-label="Dokumentseiten">
          <div class="docviewer__pages">${pages}</div>
        </div>
        ${many ? `<button class="docviewer__nav docviewer__nav--next" type="button" data-act="next" aria-label="Nächstes Dokument" title="Nächstes Dokument">${C.icon('ChevronRight', 'icon--lg')}</button>` : ''}
      </div>
      <aside class="docviewer__meta" id="docviewer-meta"${showMeta ? '' : ' hidden'}>
        <h2 class="docviewer__meta-title">Metadaten</h2>
        <dl class="kv kv--tight">${metadata.map(([key, value]) => `<dt>${C.escape(key)}</dt><dd>${C.escape(value)}</dd>`).join('')}</dl>
        ${buildingId ? `<a class="btn btn--outline-negative btn--sm btn--icon-right" data-act="building"
          href="#/app/portfolio?id=${encodeURIComponent(buildingId)}"><span class="btn__text">Gebäude ansehen</span>${C.icon('ArrowRight', 'btn__icon')}</a>` : ''}
      </aside>
    </div>
    <div class="viewer-toolbar viewer-toolbar--negative viewer-toolbar--horizontal docviewer__toolbar" role="group" aria-label="Zoom-Steuerung">
      <button class="viewer-toolbar__button docviewer__zoom" type="button" data-act="zoom-out" aria-label="Verkleinern" title="Verkleinern">${C.icon('Minus', 'icon--sm')}</button>
      <button class="viewer-toolbar__button viewer-toolbar__readout docviewer__zoom docviewer__zoom--reset" type="button" data-act="zoom-reset" aria-label="Zoom zurücksetzen" title="Zoom zurücksetzen"><span data-zoom-readout>100%</span></button>
      <button class="viewer-toolbar__button docviewer__zoom" type="button" data-act="zoom-in" aria-label="Vergrössern" title="Vergrössern">${C.icon('Plus', 'icon--sm')}</button>
    </div>`;

    stage = backdrop.querySelector('.docviewer__stage');
    scrollHost = backdrop.querySelector('.docviewer__main');
    pagesEl = backdrop.querySelector('.docviewer__pages');
    readout = backdrop.querySelector('[data-zoom-readout]');
    indicator = backdrop.querySelector('[data-page-indicator]');

    zoom = 1;
    measurePages();

    const on = (act, fn) => { const el = backdrop.querySelector(`[data-act="${act}"]`); if (el) el.addEventListener('click', fn); };
    on('close', close);
    // EIN Suffix für alle Fake-Aktionen: «— im Prototyp simuliert.» — vorher
    // drei Grammatiken («simuliert:», «— simuliert.», «(Demo)») nebeneinander
    // im selben Menü (Design-Review D13).
    on('download', () => toast(`Download «${documentFileName(d)}» — im Prototyp simuliert.`));
    on('meta', () => {
      showMeta = !showMeta;
      const meta = backdrop.querySelector('#docviewer-meta');
      const button = backdrop.querySelector('[data-act="meta"]');
      if (meta) meta.hidden = !showMeta;
      if (button) {
        button.setAttribute('aria-expanded', String(showMeta));
        button.setAttribute('aria-label', showMeta ? 'Metadaten ausblenden' : 'Metadaten anzeigen');
        button.classList.toggle('is-active', showMeta);
      }
      backdrop.classList.toggle('docviewer--meta-open', showMeta);
      requestAnimationFrame(measurePages);
      C.announce(showMeta ? 'Metadaten eingeblendet.' : 'Metadaten ausgeblendet.');
    });
    on('upload', () => toast('Neue Version hochladen — im Prototyp simuliert.'));
    on('share', () => toast('Link kopieren — im Prototyp simuliert.'));
    // «nicht verfügbar» ist kein Erfolg — als Info-Notification, nicht mit Häkchen.
    on('comment', () => toast('Kommentare sind im Prototyp nicht verfügbar.', 'info', 'InfoCircle'));
    on('zoom-in', () => { zoom += 0.25; applyZoom(); });
    on('zoom-out', () => { zoom -= 0.25; applyZoom(); });
    on('zoom-reset', () => { zoom = 1; applyZoom(); });
    on('prev', () => go(-1));
    on('next', () => go(1));
    on('building', close);

    // Die Dokumentfläche ist der Scroll-Host. Sie wird beim Blättern ersetzt,
    // deshalb gehört auch der Listener an die jeweils neue Instanz.
    let raf = null;
    scrollHost?.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const ps = backdrop.querySelectorAll('.docpage');
        const mid = window.innerHeight / 2;
        let idx = 0;
        ps.forEach((page, i) => { if (page.getBoundingClientRect().top <= mid) idx = i; });
        if (indicator) indicator.textContent = `Seite ${idx + 1} / ${total}`;
      });
    });
  }

  document.addEventListener('keydown', onKeydown, true);
  window.addEventListener('resize', onResize);
  unregisterOverlay = C.registerOverlay(close);
  mount();
  requestAnimationFrame(() => { try { stage.focus(); } catch (e) { /* noop */ } });
  return close;
}

export default openDocumentViewer;
