import { anchorNavPage } from './anchor-nav.js';
// Der Inhalt liegt seit der Suchüberarbeitung in js/knowledge-content.js: er hat
// zwei Leser (diese Seite rendert ihn, die Suche indexiert ihn) und gehört
// deshalb nicht mehr in das Seitenmodul.
import { AREAS, FAQS, sectionDomId } from '../knowledge-content.js';

// Wissen und Hilfsmittel — die Referenzschicht des Portals.
//
// GEGLIEDERT NACH FACHGEBIET (L2), innerhalb dessen nach Materialart (L3).
// Nicht umgekehrt. Begründung aus dem Altbestand (docs/legacy-analysis.md):
// die Kundenplattform hat Hilfsmittel NIE gepoolt — der Werkzeugkasten und die
// Mustervorlagen liegen unter «Informatik», die BKB-Dokumente unter «Beschaffen».
// Material hängt am Fachgebiet, in dem man gerade arbeitet. Und der Bedarf ist
// stark konzentriert: von 91 Referenzdokumenten entfallen 40 auf Informatik und
// Beschaffung. Wer Möbel bestellt, kommt nie hierher — er braucht eine
// Dienstleistung, kein Hilfsmittel.
//
// L3 sind Abschnitte INNERHALB der Fachgebietsseite, keine eigenen Routen: es
// sind Facetten einer Sammlung, und das CD-Ankernavigations-Layout
// (detailPageAnchorNav) trägt sie mit klebendem Inhaltsverzeichnis. Eigene
// Routen ergäben Seiten mit drei Dokumenten.
//
// Alle Seiten sind BEWUSST statisch: Dokumentenverzeichnisse zum Nachlesen und
// Herunterladen, keine abfragbaren Bestände (docs/sitemap.md §2.4).

export default async function render(ctx) {
  const area = ctx.params[0];
  if (!area) return overview(ctx);
  if (!AREAS[area]) return notFound(ctx);
  return areaPage(ctx, AREAS[area]);
}

/* ================================ ÜBERSICHT =============================== */

function overview(ctx) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  setTitle('Wissen und Hilfsmittel');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Wissen und Hilfsmittel' }]);

  const count = (k) => AREAS[k].sections.reduce((n, s) => n + s.items.length, 0);
  const areaTiles = [
    { title: AREAS.it.title, icon: 'Desktop', href: '#/knowledge/it',
      desc: 'Vorgaben, Mustervorlagen, Werkzeugkasten und Rahmenverträge für IKT-Beschaffungen.', meta: `${count('it')} Unterlagen` },
    { title: AREAS.procurement.title, icon: 'Balance', href: '#/knowledge/procurement',
      desc: 'BöB, VöB und WTO-Verfahren, Dokumente der BKB sowie Gesuche und Delegationen.', meta: `${count('procurement')} Unterlagen` },
    { title: AREAS.accommodation.title, icon: 'Building', href: '#/knowledge/accommodation',
      desc: 'Flächenstandards, Nachhaltigkeit, Preise und Formulare rund um Gebäude und Betrieb.', meta: `${count('accommodation')} Unterlagen` },
    { title: AREAS.publishing.title, icon: 'Printer', href: '#/knowledge/publishing',
      desc: 'Auftragsformulare, Preise und Merkblätter der Produktion und der Publikationen.', meta: `${count('publishing')} Unterlagen` },
    { title: AREAS.guides.title, icon: 'Book', href: '#/knowledge/guides',
      desc: 'Kurzanleitungen, Schulungsunterlagen und Lernvideos zur Nutzung des Portals.', meta: `${count('guides')} Unterlagen` },
    { title: AREAS.processes.title, icon: 'InfoCircle', href: '#/knowledge/processes',
      desc: 'Die Prozesslandschaft des BBL im Prozessportal Archimap sowie häufige Fragen (FAQ).',
      meta: 'Prozessportal & FAQ' },
  ].map(C.domainTile).join('');

  mount.innerHTML = `
    ${C.pageSection({
      body: C.pageHeader({
        title: 'Wissen und Hilfsmittel',
        lead: 'Die geltenden Vorgaben, Vorlagen und Formulare — gegliedert nach Fachgebiet, weil Unterlagen dort gebraucht werden, wo man gerade arbeitet.',
      }),
    })}
    ${C.pageSection({ title: 'Fachgebiete', alt: true, body: `<div class="grid grid--responsive-cols-2">${areaTiles}</div>` })}`;
}

/* ============================== FACHGEBIETSSEITE ========================== */

// Eine Seite je Fachgebiet, innerhalb nach Materialart gegliedert (L3). Das
// klebende Inhaltsverzeichnis der Ankernavigation IST die L3-Navigation.
function areaPage(ctx, area) {
  const { C, setTitle, setCrumbs } = ctx;
  setTitle(area.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Wissen und Hilfsmittel', href: '#/knowledge' }, { label: area.title }]);

  // Ein Abschnitt ist entweder eine Dokumentliste (`items`), freier Inhalt
  // (`html`) oder das FAQ-Akkordeon (`faq`) — die Prozessseite braucht alle drei
  // Formen nicht als Liste.
  const sections = area.sections.map(s => ({
    id: sectionDomId(s.id),
    title: s.title,
    html: [
      s.intro ? `<p class="muted">${C.escape(s.intro)}</p>` : '',
      typeof s.html === 'function' ? s.html(C) : (s.html || ''),
      // KEIN `icon` vorgeben: C.downloadItem wählt selbst — «Download» für eine
      // Datei, «External» für ein Ziel ausserhalb des Portals. Genau diese
      // Unterscheidung macht das CD (DownloadItem.vue trägt fix das
      // Download-Symbol; externe Ziele tragen External). Ein pauschales
      // Datei-Symbol hätte beide gleich aussehen lassen.
      s.items ? `<ul class="download-items">${s.items.map(it => C.downloadItem({
        href: '#', ...it, download: !it.external, wrapLi: true,
      })).join('')}</ul>` : '',
      s.faq ? C.accordion(FAQS.map(f => ({ title: f.q, body: `<p class="m-0">${C.escape(f.a)}</p>` })), { id: 'faq' }) : '',
    ].join(''),
  }));

  anchorNavPage(ctx, {
    title: area.title, lead: area.lead, intro: area.intro,
    sections,
    back: { href: '#/knowledge', label: 'Wissen und Hilfsmittel' },
  });
}

function notFound(ctx) {
  ctx.C.renderNotFound(ctx, { thing: 'Dieses Fachgebiet', title: 'Seite nicht gefunden',
    backHref: '#/knowledge', backLabel: 'Wissen und Hilfsmittel',
    crumbs: [{ label: 'Startseite', href: '#/' }, { label: 'Wissen und Hilfsmittel', href: '#/knowledge' }] });
}
