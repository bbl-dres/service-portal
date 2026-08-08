// Read-only federal-property transaction overview.

import { APPLICATIONS, trail } from '../crumbs.js';
import { portfolioItem } from '../links.js';

export const needs = ['buildings'];
export default async function render(ctx) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;

  setTitle('Veräusserung von Bundesliegenschaften');
  setCrumbs(trail(APPLICATIONS, { label: 'Veräusserung von Bundesliegenschaften' }));

  const LIFECYCLE = [
    { label: 'Neuer Auftrag', desc: 'Veräusserungsauftrag erfasst' },
    { label: 'Auftrag geprüft', desc: 'Formelle und rechtliche Prüfung' },
    { label: 'Repriorisiert', desc: 'Einordnung in die Verkaufsplanung' },
    { label: 'Zum Verkauf freigegeben', desc: 'Freigabe durch Portfoliomanagement' },
    { label: 'Vermarktung', desc: 'Exposé, Makler, Inserate' },
    { label: 'Bieterverfahren beendet', desc: 'Höchstbietende:r ermittelt' },
    { label: 'Objekt verkauft', desc: 'Beurkundung und Eigentumsübergang' },
  ];

  const CURRENT_STEP = 4;

  const FICTIVE = [
    { id: '1080/4850/AG', status: 'In Vermarktung', variant: 'warning' },
    { id: '1080/2800/AD', status: 'Zum Verkauf freigegeben', variant: 'info' },
    { id: '1080/5320/AA', status: 'Auftrag in Prüfung', variant: 'gray' },
  ];

  let objects = FICTIVE
    .map(f => ({ ...f, building: core.building(f.id) }))
    .filter(o => o.building);
  if (objects.length < 2) {
    const fallback = core.buildings().slice(0, 3);
    objects = fallback.map((building, i) => ({
      building,
      status: ['In Vermarktung', 'Zum Verkauf freigegeben', 'Auftrag in Prüfung'][i % 3],
      variant: ['warning', 'info', 'gray'][i % 3],
    }));
  }

  const stepsBar = C.pipeline(LIFECYCLE, CURRENT_STEP, { label: 'Verkaufslebenszyklus' });

  const timeline = `<ul class="timeline">${LIFECYCLE.map((s, idx) => {
    const cls = idx < CURRENT_STEP ? 'done' : idx === CURRENT_STEP ? 'current' : '';
    return `<li class="${cls}"><strong>${C.escape(s.label)}</strong><br><span class="small muted">${C.escape(s.desc)}</span></li>`;
  }).join('')}</ul>`;

  const tableHtml = C.table({
    zebra: true,
    caption: 'Positionen',

    rowsClickable: true,
    columns: [
      { key: 'property', label: 'Objekt', render: r => `<a href="${portfolioItem(r.building.bbl_id)}">${C.escape(r.building.name)}</a><br><span class="small muted">${C.escape(r.building.bbl_id)}</span>` },
      { key: 'location', label: 'Standort', render: r => `${C.escape(r.building.street)}<br><span class="small muted">${C.escape(r.building.zip)} ${C.escape(r.building.city)}</span>` },
      { key: 'status', label: 'Fiktiver Status', render: r => C.badge(r.status, r.variant) },
    ],
    rows: objects,
  });

  mount.innerHTML = `
  <div class="container section">
    ${''
}
    ${C.pageHeader({
      title: 'Veräusserung von Bundesliegenschaften',
      lead: 'Transaktionsplattform für die Veräusserung von Bundesliegenschaften (Divestment) — koordiniert die Zusammenarbeit zwischen Portfoliomanagement, internen Stellen und beauftragten Maklerinnen und Maklern.',
    })}

    ${C.notificationHtml('Dieses Modul ist im Prototyp ein <strong>Stub</strong>: Die hier gezeigten Objekte, Status und Schritte sind fiktive Demo-Daten. Die produktive Anbindung an die Transaktionsplattform (Auftragsverwaltung, Bieterverfahren, Beurkundung) ist noch nicht umgesetzt.', 'warning', 'WarningCircle')}

    ${''
}
    <section class="detail-section">
      <h2 class="detail-section__title">${C.icon('ShoppingCart', 'icon--base')} Verkaufslebenszyklus</h2>
      <p class="muted">Sieben Phasen vom Veräusserungsauftrag bis zum vollzogenen Verkauf. Hervorgehoben ist der aktuelle Demo-Stand.</p>
      ${stepsBar}
      <div class="box measure mt-4">
        <h3>Phasen im Detail</h3>
        ${timeline}
      </div>
    </section>

    <section class="detail-section">
      <h2 class="detail-section__title">${C.icon('Building', 'icon--base')} Objekte in Veräusserung</h2>
      <p class="muted">Beispielhafte Auswahl von Liegenschaften im Verkaufsprozess (Demo-Daten).</p>
      <div class="mt-4">${tableHtml}</div>
    </section>

    <section class="detail-section">
      <div class="box measure">
        <h3>Beteiligte</h3>
        ${''
}<ul class="list--default small">
          <li><strong>Portfoliomanagement BBL</strong> — Priorisierung und Verkaufsfreigabe</li>
          <li><strong>Recht / Beurkundung</strong> — Prüfung, Verträge, Eigentumsübergang</li>
          <li><strong>Externe Maklerinnen und Makler</strong> — Vermarktung und Bieterverfahren</li>
        </ul>
      </div>
    </section>
  </div>`;

  C.wireTableRows(mount.querySelector('.container.section'));
}
