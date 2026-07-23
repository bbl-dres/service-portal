// Bauwerksdokumentation — Bauwerksdokumentation als abfragbares, pro Gebäude filterbares Archiv.
// Ersetzt statische PDF-Listen durch eine durchsuchbare, filterbare Ansicht.
import { openDocumentViewer } from '../doc-viewer.js';

export default async function render(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;

  setTitle('Bauwerksdokumentation');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Bauwerksdokumentation' },
  ]);

  const all = core.documents();
  const buildings = core.buildings();
  const tiers = core.ref().classificationTiers || [];

  // Distinct facets
  const types = [...new Set(all.map(d => d.type))].sort((a, b) => a.localeCompare(b, 'de'));
  const years = [...new Set(all.map(d => d.year))].sort((a, b) => b - a);

  // Filter state — seed from query string so links can deep-link a building.
  const state = {
    building: query.get('building') || '',
    type: query.get('type') || '',
    year: query.get('year') || '',
    q: query.get('q') || '',
    page: 1,
    _focusSearch: false,
  };
  const PER_PAGE = 10;

  const tierVariant = (id) => {
    const t = tiers.find(x => x.id === id);
    return t ? t.variant : 'gray';
  };

  const fmtSize = (kb) => {
    const n = Number(kb) || 0;
    return n >= 1024
      ? (n / 1024).toLocaleString('de-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MB'
      : n.toLocaleString('de-CH') + ' KB';
  };

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return all.filter(d => {
      if (state.building && !(d.linkedTo || []).includes(state.building)) return false;
      if (state.type && d.type !== state.type) return false;
      if (state.year && String(d.year) !== String(state.year)) return false;
      if (q && !d.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function selectControl(id, label, value, options) {
    return `<div class="field" style="margin:0">
      <label for="${id}">${C.escape(label)}</label>
      <div class="select">
        <select id="${id}" class="input--outline input--base">${options.map(o =>
          `<option value="${C.escape(o.value)}"${String(o.value) === String(value) ? ' selected' : ''}>${C.escape(o.label)}</option>`
        ).join('')}</select><div class="select__icon">${C.chevron}</div>
      </div>
    </div>`;
  }

  function filterBar() {
    const buildingOpts = [{ value: '', label: 'Alle Gebäude' }]
      .concat(buildings.map(b => ({ value: b.bbl_id, label: b.name })));
    const typeOpts = [{ value: '', label: 'Alle Typen' }]
      .concat(types.map(t => ({ value: t, label: t })));
    const yearOpts = [{ value: '', label: 'Alle Jahre' }]
      .concat(years.map(y => ({ value: y, label: String(y) })));

    // CD-Muster: Das Suchfeld steht in der Filterleiste immer an erster (linker)
    // Stelle, danach die Facetten-Selects.
    return `<div class="grid grid--4 mt-6">
      <div class="field" style="margin:0">
        <label for="flt-q">Titel durchsuchen</label>
        <input id="flt-q" type="search" placeholder="z. B. Grundriss…" value="${C.escape(state.q)}" autocomplete="off">
      </div>
      ${selectControl('flt-building', 'Gebäude', state.building, buildingOpts)}
      ${selectControl('flt-type', 'Dokumenttyp', state.type, typeOpts)}
      ${selectControl('flt-year', 'Jahr', state.year, yearOpts)}
    </div>`;
  }

  function resultTable(rows) {
    return C.table({
      zebra: true,
      columns: [
        {
          key: 'title', label: 'Dokument',
          // Titel öffnet die Vorschau (Mock-Viewer) statt eines statischen PDFs.
          render: r => `<button type="button" class="doc-open" data-doc="${C.escape(r.docId)}">${C.icon('File', 'icon--base')} <span>${C.escape(r.title)}</span></button>`,
        },
        {
          key: 'type', label: 'Typ',
          render: r => C.badge(r.type, 'gray'),
        },
        {
          key: 'building', label: 'Gebäude',
          render: r => {
            const bid = (r.linkedTo || [])[0];
            const b = bid ? core.building(bid) : null;
            return b
              ? `<a href="#/app/portfolio/${C.escape(b.bbl_id)}">${C.escape(b.name)}</a>`
              : '<span class="muted">—</span>';
          },
        },
        { key: 'year', label: 'Jahr', render: r => C.escape(r.year) },
        { key: 'size', label: 'Grösse', render: r => fmtSize(r.sizeKB) },
        {
          key: 'classification', label: 'Klassifizierung',
          render: r => C.badge(r.classification, tierVariant(r.classification)),
        },
        {
          key: 'preview', label: 'Vorschau',
          render: r => `<button type="button" class="btn btn--link doc-open" data-doc="${C.escape(r.docId)}" aria-label="Vorschau ${C.escape(r.title)}">${C.icon('File', 'icon--base')} Öffnen</button>`,
        },
      ],
      rows,
    });
  }

  function draw() {
    const rows = filtered();
    const active = state.building || state.type || state.year || state.q.trim();
    const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const visible = rows.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);

    mount.innerHTML = `
    <div class="container section">
      ${C.pageHeader({
        title: 'Bauwerksdokumentation',
        lead: 'Bauwerksdokumentation neu gedacht: Statt statischer PDF-Listen ein pro Gebäude abfragbares, filterbares Archiv — nach Gebäude, Dokumenttyp, Jahr und Titel durchsuchbar.',
      })}
      ${filterBar()}
      <div class="row row--between mt-6">
        <p class="muted" style="margin:0"><strong>${rows.length}</strong> von ${all.length} Dokument(en)${active ? ' (gefiltert)' : ''}${totalPages > 1 ? ` · Seite ${state.page} von ${totalPages}` : ''}</p>
        ${active ? `<button class="btn btn--bare" id="flt-reset" type="button">${C.icon('Cancel', 'icon--base')} Filter zurücksetzen</button>` : ''}
      </div>
      <div class="mt-4">${rows.length
        ? resultTable(visible) + C.pagination({ page: state.page, totalPages, inputId: 'doc-page', label: 'Seitennavigation Bauwerksdokumentation', href: () => '#' })
        : C.empty('Keine Dokumente für die gewählten Filter gefunden.')}</div>
    </div>`;

    wire(totalPages);
  }

  function wire(totalPages) {
    const bind = (id, key) => {
      const el = mount.querySelector('#' + id);
      if (el) el.addEventListener('change', () => { state[key] = el.value; state.page = 1; draw(); });
    };
    bind('flt-building', 'building');
    bind('flt-type', 'type');
    bind('flt-year', 'year');

    // Pagination (In-Memory): Vor/Zurück-Links abfangen, Seiteneingabe verdrahten.
    mount.querySelector('.pagination_items a[aria-label="Vorherige Seite"]')
      ?.addEventListener('click', (e) => { e.preventDefault(); if (state.page > 1) { state.page--; draw(); } });
    mount.querySelector('.pagination_items a[aria-label="Nächste Seite"]')
      ?.addEventListener('click', (e) => { e.preventDefault(); if (state.page < totalPages) { state.page++; draw(); } });
    C.wirePagination(mount, 'doc-page', state.page, totalPages, (t) => { state.page = t; draw(); });

    // Titel/Vorschau öffnet den Dokument-Viewer mit der aktuellen Trefferliste
    // als Blätter-Kontext (Vor/Zurück im Viewer).
    const rows = filtered();
    mount.querySelectorAll('.doc-open').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = rows.find(x => x.docId === btn.getAttribute('data-doc'));
        if (d) openDocumentViewer(d, rows);
      });
    });

    const qEl = mount.querySelector('#flt-q');
    if (qEl) {
      qEl.addEventListener('input', () => { state.q = qEl.value; state.page = 1; state._focusSearch = true; draw(); });
      // Fokus/Cursor nur nach Tippen zurückholen — nicht beim Blättern.
      if (state._focusSearch) {
        const pos = qEl.value.length;
        qEl.focus();
        try { qEl.setSelectionRange(pos, pos); } catch (e) { /* search inputs may not support setSelectionRange */ }
        state._focusSearch = false;
      }
    }

    const reset = mount.querySelector('#flt-reset');
    if (reset) reset.addEventListener('click', () => {
      state.building = ''; state.type = ''; state.year = ''; state.q = ''; state.page = 1;
      draw();
    });
  }

  draw();
}
