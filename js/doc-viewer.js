// Dokumentvorschau — Vollbild-Lightbox mit schematischer Mock-Darstellung.
// Portiert und verschlankt aus dem BBL Mieterportal (tenant-portal). Analyse-
// Prototyp: es wird kein echtes PDF gerendert, sondern eine schematische Seite
// (Grundriss bzw. Textdokument) mit Titelblock — deutlich als «Mock-Vorschau».
//
// openDocumentViewer(doc, siblings, C): doc = Datensatz aus documents.json,
// siblings = geordnete Liste (aktuelle Trefferliste) für Vor/Zurück, C = Komponenten.

import C from './components.js';

const TYPE_LABEL = {
  Bauwerksdokumentation: 'Bauwerksdokumentation', Grundriss: 'Grundriss',
  Bericht: 'Bericht', Gutachten: 'Gutachten',
};

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

function pageCount(doc) { return doc.type === 'Grundriss' ? 1 : 2; }

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
        <div><dt>Typ</dt><dd>${C.escape(TYPE_LABEL[doc.type] || doc.type)}</dd></div>
        <div><dt>Format</dt><dd>${C.escape(doc.format || '')}</dd></div>
        <div><dt>Jahr</dt><dd>${C.escape(String(doc.year || '—'))}</dd></div>
        <div><dt>Klassifizierung</dt><dd>${C.escape(doc.classification || '—')}</dd></div>
      </dl>` : `<h2 class="docpage__subtitle">${C.escape(doc.title)} — Fortsetzung</h2>`}
    ${paras}
    ${footer(doc, n, total)}
  </article>`;
}

function pageHTML(doc, n, total) {
  return doc.type === 'Grundriss' ? planPage(doc, n, total) : textPage(doc, n, total);
}

export function openDocumentViewer(doc, siblings) {
  if (!doc) return;
  const opener = document.activeElement;
  const list = (Array.isArray(siblings) && siblings.length) ? siblings : [doc];
  let pos = Math.max(0, list.findIndex(d => d.docId === doc.docId));

  const backdrop = document.createElement('div');
  backdrop.className = 'docviewer';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  document.body.appendChild(backdrop);
  document.body.classList.add('docviewer-open');

  let stage, pagesEl, readout, indicator, total, baseW, zoom = 1;

  function applyZoom() {
    zoom = Math.max(0.5, Math.min(3, Math.round(zoom * 100) / 100));
    if (pagesEl) pagesEl.style.setProperty('--docpage-w', Math.round(baseW * zoom) + 'px');
    if (readout) readout.textContent = Math.round(zoom * 100) + '%';
  }

  // Kurzer Hinweis für simulierte Aktionen (Download/Upload/Teilen).
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'docviewer__toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    backdrop.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  function close() {
    document.removeEventListener('keydown', onKeydown, true);
    backdrop.remove();
    document.body.classList.remove('docviewer-open');
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
    if (e.key !== 'Tab') return;
    const f = Array.from(backdrop.querySelectorAll('button, [tabindex]:not([tabindex="-1"])')).filter(el => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function mount() {
    const d = list[pos];
    const many = list.length > 1;
    total = pageCount(d);
    const pages = Array.from({ length: total }, (_, i) => pageHTML(d, i + 1, total)).join('');
    backdrop.setAttribute('aria-label', 'Dokumentvorschau: ' + (d.title || ''));
    backdrop.innerHTML = `
    <div class="docviewer__bar">
      <div class="docviewer__heading">
        ${C.icon('File', 'docviewer__heading-icon icon--lg')}
        <div class="docviewer__heading-text">
          <p class="docviewer__title">${C.escape(d.title)}</p>
          <p class="docviewer__sub">${C.escape(TYPE_LABEL[d.type] || d.type)} · ${C.escape(d.format || '')} · <span data-page-indicator>Seite 1 / ${total}</span>${many ? ` · <span class="docviewer__docnum">Dokument ${pos + 1} / ${list.length}</span>` : ''}</p>
        </div>
      </div>
      <div class="docviewer__actions">
        <button class="docviewer__btn" type="button" data-act="download" aria-label="Herunterladen" title="Herunterladen">${C.icon('Download', 'icon--md')}</button>
        <button class="docviewer__btn" type="button" data-act="upload" aria-label="Neue Version hochladen" title="Neue Version hochladen">${C.icon('Upload', 'icon--md')}</button>
        <button class="docviewer__btn" type="button" data-act="share" aria-label="Dokument teilen" title="Teilen">${C.icon('Share', 'icon--md')}</button>
        <button class="docviewer__btn" type="button" data-act="comment" aria-label="Kommentieren" title="Kommentieren">${C.icon('SpeechBubble', 'icon--md')}</button>
        <button class="docviewer__btn docviewer__btn--close" type="button" data-act="close" aria-label="Vorschau schliessen" title="Schliessen">${C.icon('Cancel', 'icon--md')}</button>
      </div>
    </div>
    <div class="docviewer__main">
      ${many ? `<button class="docviewer__nav docviewer__nav--prev" type="button" data-act="prev" aria-label="Vorheriges Dokument" title="Vorheriges Dokument">${C.icon('ChevronLeft', 'icon--lg')}</button>` : ''}
      <div class="docviewer__stage" tabindex="0" aria-label="Dokumentseiten">
        <div class="docviewer__pages">${pages}</div>
      </div>
      ${many ? `<button class="docviewer__nav docviewer__nav--next" type="button" data-act="next" aria-label="Nächstes Dokument" title="Nächstes Dokument">${C.icon('ChevronRight', 'icon--lg')}</button>` : ''}
    </div>
    <div class="docviewer__toolbar" role="group" aria-label="Zoom-Steuerung">
      <button class="docviewer__zoom" type="button" data-act="zoom-out" aria-label="Verkleinern" title="Verkleinern">${C.icon('Minus', 'icon--sm')}</button>
      <button class="docviewer__zoom docviewer__zoom--reset" type="button" data-act="zoom-reset" aria-label="Zoom zurücksetzen" title="Zurücksetzen"><span data-zoom-readout>100%</span></button>
      <button class="docviewer__zoom" type="button" data-act="zoom-in" aria-label="Vergrössern" title="Vergrössern">${C.icon('Plus', 'icon--sm')}</button>
    </div>`;

    stage = backdrop.querySelector('.docviewer__stage');
    pagesEl = backdrop.querySelector('.docviewer__pages');
    readout = backdrop.querySelector('[data-zoom-readout]');
    indicator = backdrop.querySelector('[data-page-indicator]');

    baseW = Math.max(280, Math.min(820, backdrop.clientWidth - 96));
    zoom = 1;
    applyZoom();

    // Seitenanzeige folgt der Seite nahe der Fenstermitte.
    let raf = null;
    backdrop.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const ps = backdrop.querySelectorAll('.docpage');
        const mid = window.innerHeight / 2;
        let idx = 0;
        ps.forEach((p, i) => { if (p.getBoundingClientRect().top <= mid) idx = i; });
        if (indicator) indicator.textContent = `Seite ${idx + 1} / ${total}`;
      });
    });

    const on = (act, fn) => { const el = backdrop.querySelector(`[data-act="${act}"]`); if (el) el.addEventListener('click', fn); };
    on('close', close);
    on('download', () => toast('Download simuliert: ' + d.title));
    on('upload', () => toast('Neue Version hochladen — simuliert.'));
    on('share', () => toast('Link kopiert (Demo).'));
    on('comment', () => toast('Kommentare sind im Prototyp nicht verfügbar.'));
    on('zoom-in', () => { zoom += 0.25; applyZoom(); });
    on('zoom-out', () => { zoom -= 0.25; applyZoom(); });
    on('zoom-reset', () => { zoom = 1; applyZoom(); });
    on('prev', () => go(-1));
    on('next', () => go(1));
  }

  document.addEventListener('keydown', onKeydown, true);
  mount();
  requestAnimationFrame(() => { try { stage.focus(); } catch (e) { /* noop */ } });
}

export default openDocumentViewer;
