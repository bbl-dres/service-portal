// Business architecture — the signpost, not the model.
//
// The BBL models its processes and business objects in the architecture
// repository that IKT-Vorgabe A736 prescribes (Innovator for modelling,
// smartfacts for web publication). This page does NOT republish that model. It
// is a DIRECTORY over it, and answers exactly three questions per entry:
// what is it, who is responsible, where is the original.
//
// The reason for that scope is a decision (user, 2026-08-13): products get
// re-tendered and replaced, while schemas, standards and metadata outlive them.
// So the portal keeps a stable, product-neutral entry — see the `source` block
// in data/processes.json and data/business-objects.json, whose `role` is a key
// resolved through reference-data, never a product name. Replacing the
// repository is then one reference row and a set of URLs, not a migration.
//
// The counts are DERIVED, never written down. A hard-coded «18 Prozesse» is a
// claim that stops being true the first time the file grows, and this page is
// specifically about not making claims it has stopped checking.

const CRUMBS = [
  { label: 'Startseite', href: '#/' },
  { label: 'Daten und Digitalisierung', href: '#/data' },
  { label: 'Prozesse und Geschäftsobjekte' },
];

// NOTE: the repository's own URL is not linked from this page. Each record
// carries its own deep link in `source.url` (data/processes.json etc.), which is
// where a reader needs it; a second, page-level link to the repository root
// would be a third thing to keep current for no added reach.

// The collections the layer table counts. Loaded through the parent contract in
// data.js, so this module declares no `needs` of its own.
export function layers(core) {
  const processes = core.processes();
  const objects = core.businessObjects();
  const tables = core.dataTables();
  const datasets = core.datasets();
  const attributes = objects.reduce((n, o) => n + (o.attributes || []).length, 0);
  const fields = tables.reduce((n, t) => n + (t.fields || []).length, 0);
  const areas = [...new Set(processes.map((p) => p.areaLabel).filter(Boolean))];
  return [
    {
      key: 'prozesse', icon: 'Share', title: 'Prozesse',
      href: '#/app/process-docs',
      count: `${processes.length} Prozesse`,
      detail: areas.length === 1 ? areas[0] : `${areas.length} Bereiche`,
      desc: 'Wie das BBL arbeitet: Prozesslandkarte mit Ablauf, Verantwortung, beteiligten Systemen '
        + 'und den Standards, die je Prozess gelten.',
      sourceRole: 'architektur-repository',
    },
    {
      key: 'geschaeftsobjekte', icon: 'Stack', title: 'Geschäftsobjekte',
      href: '#/app/metadata-catalog',
      count: `${objects.length} Objekte`,
      detail: `${attributes} Attribute`,
      desc: 'Worüber das BBL spricht: die fachlichen Begriffe mit Definition, Domäne und '
        + 'Datenverantwortung — und je Attribut die Realisierung im Führungssystem.',
      sourceRole: 'architektur-repository',
    },
    {
      key: 'datentabellen', icon: 'Database', title: 'Datentabellen und Felder',
      href: '#/app/metadata-catalog?kind=tabellen',
      count: `${tables.length} Tabellen`,
      detail: `${fields} Felder`,
      desc: 'Wo die Begriffe physisch liegen: Tabellen und Felder der Quellsysteme mit Format '
        + 'und Constraint.',
      sourceRole: 'quellsystem',
    },
    {
      key: 'datensaetze', icon: 'FileDatabase', title: 'Datensätze',
      href: '#/data/catalog',
      count: `${datasets.length} Datensätze`,
      detail: 'DCAT-AP-CH',
      desc: 'Was davon beziehbar ist: der Datensatzkatalog mit Bezugswegen, Klassifizierung und '
        + 'Datenverantwortung.',
      sourceRole: 'portal',
    },
  ];
}

export default function render(ctx) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  setTitle('Prozesse und Geschäftsobjekte');
  setCrumbs(CRUMBS);

  const rows = layers(core);
  const roleOf = (key) => (core.ref().sourceRoles || []).find((r) => r.key === key) || {};

  // Section-overview anatomy, as on #/data and #/data/digitalisation: page header,
  // then one card per entry in a three-column grid (user decision, 2026-08-13).
  //
  // An earlier draft put a layer TABLE next to these cards. It listed the same
  // four rows with the same four facts — the cards already carry them — and a
  // reader had to work out whether the second list said anything new. The
  // digitalisation overview made the same cut for the same reason and recorded
  // it: the cards are what the page is for.
  //
  // `meta` carries scale AND the leading system, which is the one fact the other
  // overviews have no need for and this page cannot omit.
  const tiles = rows.map((r) => {
    const role = roleOf(r.sourceRole);
    return C.domainTile({
      title: r.title, icon: r.icon, href: r.href, desc: r.desc,
      meta: [r.count, r.detail, role.product || role.label].filter(Boolean).join(' · '),
    });
  }).join('');

  // Header plus one card band, and nothing else (user decision, 2026-08-13).
  // Two further bands were drafted — a layer table and a provenance panel naming
  // A736 and the repository. The table repeated the cards outright; the
  // provenance is genuinely new information but not what someone opening an
  // overview came for. Where the leading version of a record lives is still
  // stated where it is actually needed: on the record, via C.sourceBox.
  mount.innerHTML = `
    ${C.pageSection({
      body: C.pageHeader({
        title: 'Prozesse und Geschäftsobjekte',
        lead: 'Dokumentation der Geschäftsarchitektur des BBL — was es gibt, wer dafür verantwortlich '
          + 'ist und wo das Original steht.',
      }),
    })}
    ${C.pageSection({ title: 'Ebenen', alt: true, body: `<div class="grid grid--responsive-cols-3">${tiles}</div>` })}`;
}
