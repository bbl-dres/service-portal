// Verkauf / Divestment — Transaktionsplattform (STUB / Prototyp).
// Bildet den Veräusserungsprozess von Bundesliegenschaften ab (intern + Makler).

// Aufschiebbare Bestände dieser Route. Der Router ruft core.ensure(needs) VOR
// render() auf — ohne die Deklaration läse ein Accessor die noch leere Liste
// und die Ansicht zeigte «keine Einträge» statt Daten (docs/code-review.md §3).
export const needs = ['buildings'];
export default async function render(ctx) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;

  setTitle('Verkauf / Divestment');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' }, { label: 'Anwendungen', href: '#/applications' },
    { label: 'Verkauf / Divestment' },
  ]);

  // 7-stufiger Verkaufslebenszyklus.
  const LIFECYCLE = [
    { label: 'Neuer Auftrag', desc: 'Veräusserungsauftrag erfasst' },
    { label: 'Auftrag geprüft', desc: 'Formelle und rechtliche Prüfung' },
    { label: 'Repriorisiert', desc: 'Einordnung in die Verkaufsplanung' },
    { label: 'Zum Verkauf freigegeben', desc: 'Freigabe durch Portfoliomanagement' },
    { label: 'Vermarktung', desc: 'Exposé, Makler, Inserate' },
    { label: 'Bieterverfahren beendet', desc: 'Höchstbietende:r ermittelt' },
    { label: 'Objekt verkauft', desc: 'Beurkundung und Eigentumsübergang' },
  ];

  // Aktueller (fiktiver) Stand der Demo-Pipeline für die Schrittanzeige.
  const CURRENT_STEP = 4; // 0-basiert -> "Vermarktung" laufend

  // Fiktive Status-Zuordnung je Objekt (Demo).
  const FICTIVE = [
    { id: '1080/4850/AG', status: 'In Vermarktung', variant: 'warning' },       // Ehem. Verwaltungsgebäude Bern Nord (Abgang · Verkauft)
    { id: '1080/2800/AD', status: 'Zum Verkauf freigegeben', variant: 'info' },  // Wohnliegenschaft Basel
    { id: '1080/5320/AA', status: 'Auftrag in Prüfung', variant: 'gray' },       // Generalkonsulat New York (Miete)
  ];

  // Auf vorhandene Gebäude abbilden; nicht gefundene auslassen, bei Bedarf auffüllen.
  let objects = FICTIVE
    .map(f => ({ ...f, b: core.building(f.id) }))
    .filter(o => o.b);
  if (objects.length < 2) {
    const fallback = core.buildings().slice(0, 3);
    objects = fallback.map((b, i) => ({
      b,
      status: ['In Vermarktung', 'Zum Verkauf freigegeben', 'Auftrag in Prüfung'][i % 3],
      variant: ['warning', 'info', 'gray'][i % 3],
    }));
  }

  // Eine gemeinsame Schrittanzeige (C.stepIndicator) statt der lokalen Kopie —
  // trägt CDs .step__indicator-Wrapper und die sr-only-Zustandswörter (Item 3.10).
  const stepsBar = C.stepIndicator(LIFECYCLE.map((s) => s.label), CURRENT_STEP, { label: 'Verkaufslebenszyklus' });

  const timeline = `<ul class="timeline">${LIFECYCLE.map((s, idx) => {
    const cls = idx < CURRENT_STEP ? 'done' : idx === CURRENT_STEP ? 'current' : '';
    return `<li class="${cls}"><strong>${C.escape(s.label)}</strong><br><span class="small muted">${C.escape(s.desc)}</span></li>`;
  }).join('')}</ul>`;

  const tableHtml = C.table({
    zebra: true,
    caption: 'Positionen',
    // Erste Zelle ist der Zeilenlink → Zeilenklick wie in den übrigen
    // Listen des Portals (Portal-Standard, einheitliche Affordanz).
    rowsClickable: true,
    columns: [
      { key: 'objekt', label: 'Objekt', render: r => `<a href="#/app/portfolio?id=${encodeURIComponent(r.b.bbl_id)}">${C.escape(r.b.name)}</a><br><span class="small muted">${C.escape(r.b.bbl_id)}</span>` },
      { key: 'standort', label: 'Standort', render: r => `${C.escape(r.b.street)}<br><span class="small muted">${C.escape(r.b.zip)} ${C.escape(r.b.city)}</span>` },
      { key: 'status', label: 'Fiktiver Status', render: r => C.badge(r.status, r.variant) },
    ],
    rows: objects,
  });

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Verkauf / Divestment',
      lead: 'Transaktionsplattform für die Veräusserung von Bundesliegenschaften — koordiniert die Zusammenarbeit zwischen Portfoliomanagement, internen Stellen und beauftragten Maklerinnen und Maklern.',
    })}

    ${C.notification('Dieses Modul ist im Prototyp ein <strong>Stub</strong>: Die hier gezeigten Objekte, Status und Schritte sind fiktive Demo-Daten. Die produktive Anbindung an die Transaktionsplattform (Auftragsverwaltung, Bieterverfahren, Beurkundung) ist noch nicht umgesetzt.', 'warning', 'WarningCircle')}

    <section class="mt-8">
      <h2>${C.icon('ShoppingCart', 'icon--base')} Verkaufslebenszyklus</h2>
      <p class="muted">Sieben Phasen vom Veräusserungsauftrag bis zum vollzogenen Verkauf. Hervorgehoben ist der aktuelle Demo-Stand.</p>
      ${stepsBar}
      <div class="box measure mt-4">
        <h3>Phasen im Detail</h3>
        ${timeline}
      </div>
    </section>

    <section class="mt-8">
      <h2>${C.icon('Building', 'icon--base')} Objekte in Veräusserung</h2>
      <p class="muted">Beispielhafte Auswahl von Liegenschaften im Verkaufsprozess (Demo-Daten).</p>
      <div class="mt-4">${tableHtml}</div>
    </section>

    <section class="mt-8">
      <div class="box measure">
        <h3>Beteiligte</h3>
        ${''/* Kanonisches Listenrezept statt Inline-Einzug (1.1rem wich vom
              1.25rem-Standard in .list--default ab). */}<ul class="list--default small">
          <li><strong>Portfoliomanagement BBL</strong> — Priorisierung und Verkaufsfreigabe</li>
          <li><strong>Recht / Beurkundung</strong> — Prüfung, Verträge, Eigentumsübergang</li>
          <li><strong>Externe Maklerinnen und Makler</strong> — Vermarktung und Bieterverfahren</li>
        </ul>
      </div>
    </section>
  </div>`;

  // Zeilenklick (C.table rowsClickable): am pro Render neu erzeugten Container
  // verdrahtet — ein Horcher direkt auf #main-content überlebte jeden
  // Seitenwechsel und sammelte sich an (vgl. js/apps/media-library.js).
  C.wireTableRows(mount.querySelector('.container.section'));
}
