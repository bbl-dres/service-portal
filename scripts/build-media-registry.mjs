// Baut data/media.json als EINZIGES Bildregister neu auf und hinterlegt in
// buildings.geojson / parcels.geojson / projects.json nur noch eine Auswahl
// («Favoriten») als Liste von mediaId.
//
//   node scripts/build-media-registry.mjs --pruefen
//   node scripts/build-media-registry.mjs
//
// Anlass: nach dem Umhängen der Demo-Objekte auf echte Bauten passten die
// Medientitel nicht mehr zum Objekt — «Bundeshaus Ost — Innenhof» hing an der
// Botschaft Berlin, «Campus Guisanplatz» an der Botschaft Tokio. Ein Register,
// das aus den Objekten selbst erzeugt wird, kann nicht mehr auseinanderlaufen.
//
// Dateinamen sind sprechend: <bbl-id>_<objekt-slug>_<inhalt>.jpg
//
// ECHT vs. PLATZHALTER: `file` zeigt auf eine tatsächlich vorhandene, geprüfte
// Aufnahme (mit Urheber und Lizenz). Wo es keine gibt, bleibt `file` null und
// `photo` trägt eine Unsplash-Kennung — im Portal als Platzhalter gekennzeichnet.

import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';

const pruefen = process.argv.includes('--pruefen');
const ROOT = 'c:/Users/david/Documents/GitHub/service-portal/';
const BILD = 'assets/images/buildings/';
const J = (f) => JSON.parse(readFileSync(ROOT + f, 'utf8'));

const slug = (s) => String(s).toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 46);
const idSlug = (id) => String(id).replace(/\//g, '-');

// Geprüfte Aufnahmen: Datei (bisheriger Name) → Inhalt + Rechte.
// «inhalt» beschreibt NUR, was der Commons-Titel belegt — ich habe die Bilder
// nicht gesichtet, also keine erfundenen Bildinhalte.
const ECHT = {
  '1000/4840/AF': { alt: '1000-4840-AF.jpg', inhalt: 'aussenansicht', jahr: '2019',
    autor: 'Arkhein Drakenov', lizenz: 'CC BY-SA 4.0',
    quelle: 'https://commons.wikimedia.org/wiki/File:Bundeshaus_West_(2019-06-23).jpg' },
  '1000/3120/AB': { alt: '1000-3120-AB.jpg', inhalt: 'drohnenaufnahme', jahr: '2022',
    autor: 'Schweizerisches Nationalmuseum', lizenz: 'CC BY-SA 4.0',
    quelle: 'https://commons.wikimedia.org/wiki/File:Sammlungszentrum_Affoltern_am_Albis._Drohnenaufnahme.jpg' },
  '1000/5210/AA': { alt: '1000-5210-AA.jpg', inhalt: 'aussenansicht', jahr: '2022',
    autor: 'Lukas Beck', lizenz: 'CC BY-SA 4.0',
    quelle: 'https://commons.wikimedia.org/wiki/File:Schweizerische_Botschaft_in_Berlin.jpg' },
  '1000/5410/AA': { alt: '1000-5410-AA.jpg', inhalt: 'aussenansicht', jahr: '2020',
    autor: 'Syced', lizenz: 'CC0 1.0 (gemeinfrei)',
    quelle: 'https://commons.wikimedia.org/wiki/File:Embassy_of_Switzerland,_Tokyo.jpg' },
  '1000/5620/AA': { alt: '1000-5620-AA.jpg', inhalt: 'aussenansicht', jahr: '2015',
    autor: 'Nomisztif', lizenz: 'CC BY-SA 4.0',
    quelle: 'https://commons.wikimedia.org/wiki/File:Embassy_of_Switzerland_in_Canberra.jpg' },
};

// Platzhalter je Nutzungsart — alle Kennungen einzeln gegen images.unsplash.com
// geprüft (eine erfundene lieferte 404 und wäre stumm ausgefallen).
const PLATZ = {
  Verwaltung: '1486406146926-c627a92ad1ab', Zoll: '1449157291145-7efd050a4d0e',
  Ausbildung: '1564501049412-61c2a3083791', Sport: '1461896836934-ffe607ba8211',
  Kultur: '1503152394-c571994fd383', Bildung: '1568667256549-094345857637',
  Lager: '1553413077-190dd305871c', Justiz: '1589829545856-d10d557cf95f',
  Infrastruktur: '1558494949-ef010cbdcc31', Produktion: '1581092160562-40aa08e78837',
  Wohnen: '1502005229762-cf1b2da7c5d6', Grundstueck: '1500382017468-9049fed747ef',
};

const bg = J('data/buildings.geojson');
const pc = J('data/parcels.geojson');
const pj = J('data/projects.json');

const medien = [];
const umbenennen = [];
let n = 0;
const neueId = () => 'MED-' + String(++n).padStart(3, '0');

function eintrag({ objektId, objektName, kind, inhalt, echt, lat, lon, typ = 'photo', epoche = 'aktuell', datum, kat }) {
  const name = `${idSlug(objektId)}_${slug(objektName)}_${inhalt}`;
  const id = neueId();
  const datei = echt ? `${BILD}${name}.jpg` : null;
  if (echt) umbenennen.push([BILD + echt.alt, `${BILD}${name}.jpg`]);
  return {
    mediaId: id,
    mediaType: typ,
    title: `${objektName} — ${inhalt.replace(/-/g, ' ')}`,
    slug: name,
    buildingId: kind === 'building' ? objektId : null,
    parcelId: kind === 'parcel' ? objektId : null,
    projectId: kind === 'project' ? objektId : null,
    date: datum || (echt ? echt.jahr : '2025'),
    historicPeriod: epoche,
    photographer: echt ? echt.autor : 'Platzhalter (Unsplash)',
    copyright: echt ? `${echt.autor} · ${echt.lizenz}` : 'Unsplash-Lizenz — Platzhalterbild, zeigt nicht das reale Objekt',
    license: echt ? echt.lizenz : 'Unsplash',
    sourceUrl: echt ? echt.quelle : null,
    isPlaceholder: !echt,
    accessLevel: 'öffentlich',
    color: '#2f4356',
    url: '#',
    file: datei,
    photo: echt ? '' : (PLATZ[kat] || PLATZ.Verwaltung),
    lat: lat ?? null, lon: lon ?? null,
  };
}

// --- Gebäude ---------------------------------------------------------------
for (const f of bg.features) {
  const p = f.properties;
  const echt = ECHT[p.bbl_id];
  const favoriten = [];
  const basis = { objektId: p.bbl_id, objektName: p.bbl_bez, kind: 'building',
    lat: p.wgs84_lat, lon: p.wgs84_lon, kat: p.bbl_gbda1 };

  const haupt = eintrag({ ...basis, inhalt: echt ? echt.inhalt : 'aussenansicht', echt });
  medien.push(haupt); favoriten.push(haupt.mediaId);

  // Das Bildmosaik der Detailseite zeigt eine Hauptkachel und vier Nebenkacheln
  // und blendet auf der letzten «Alle Bilder anzeigen» ein — dafür braucht ein
  // Objekt mehr als fünf Aufnahmen. In der Produktion hat jedes Objekt ohnehin
  // Dutzende.
  for (const inhalt of ['umgebung', 'innenansicht', 'fassadendetail', 'eingangsbereich', 'lageplan']) {
    const e = eintrag({ ...basis, inhalt, echt: null });
    medien.push(e); favoriten.push(e.mediaId);
  }

  // Historische Aufnahme nur, wo das Objekt alt genug ist.
  if (p.bbl_bjahr && p.bbl_bjahr < 1960) {
    const hist = eintrag({ ...basis, inhalt: 'historische-aufnahme', echt: null,
      epoche: 'historisch', datum: String(p.bbl_bjahr + 10) });
    medien.push(hist); favoriten.push(hist.mediaId);
  }

  p.media = favoriten;          // Auswahl; das Register steht in media.json
  delete p.img_url; delete p.img_local; delete p.img_credit; delete p.img_quelle;
}

// --- Grundstücke -----------------------------------------------------------
for (const f of pc.features) {
  const p = f.properties;
  const basis = { objektId: p.bbl_id, objektName: p.bbl_bez, kind: 'parcel',
    lat: p.wgs84_lat, lon: p.wgs84_lon, kat: 'Grundstueck' };
  const luft = eintrag({ ...basis, inhalt: 'luftbild', echt: null });
  medien.push(luft);
  p.media = [luft.mediaId];
}

// --- Bauprojekte -----------------------------------------------------------
for (const pr of pj) {
  const name = pr.name || pr.projectId;
  const b = bg.features.find((f) => f.properties.bbl_id === pr.buildingId);
  const bp = b ? b.properties : {};
  const basis = { objektId: pr.projectId, objektName: name, kind: 'project',
    lat: bp.wgs84_lat ?? null, lon: bp.wgs84_lon ?? null, kat: 'Verwaltung' };
  const bau = eintrag({ ...basis, inhalt: 'baustelle', echt: null });
  medien.push(bau);
  pr.media = [bau.mediaId];
}

console.log(`Register: ${medien.length} Medien`);
console.log(`  echt:        ${medien.filter((m) => m.file).length}`);
console.log(`  Platzhalter: ${medien.filter((m) => m.isPlaceholder).length}`);
console.log(`Favoriten: ${bg.features.length} Gebäude · ${pc.features.length} Grundstücke · ${pj.length} Projekte`);
console.log('\nBeispiele:');
for (const m of medien.filter((x) => x.file)) console.log(`  ${m.mediaId}  ${m.slug}.jpg`);
for (const m of medien.filter((x) => !x.file).slice(0, 3)) console.log(`  ${m.mediaId}  ${m.slug}  (Platzhalter)`);

if (pruefen) { console.log('\n(--pruefen: nichts geschrieben)'); process.exit(0); }

for (const [von, nach] of umbenennen) {
  if (existsSync(ROOT + von) && von !== nach) renameSync(ROOT + von, ROOT + nach);
}
writeFileSync(ROOT + 'data/media.json', JSON.stringify(medien, null, 1));
writeFileSync(ROOT + 'data/buildings.geojson', JSON.stringify(bg, null, 1));
writeFileSync(ROOT + 'data/parcels.geojson', JSON.stringify(pc, null, 1));
writeFileSync(ROOT + 'data/projects.json', JSON.stringify(pj, null, 1));
console.log('\n→ media.json, buildings.geojson, parcels.geojson, projects.json geschrieben');
