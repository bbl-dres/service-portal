// Holt zu Schweizer Adressen die amtlichen Angaben aus den keylosen Diensten des
// Bundes und der Kantone — Koordinaten, EGID, EGRID, Parzellennummer, amtliche
// Fläche und die echte Parzellengeometrie.
//
// Das Rezept steht in docs/swisstopo-api.md; dort ist jeder Aufruf mit einer
// echten Antwort belegt. Dieses Skript ist die ausführbare Fassung davon.
//
//   node scripts/fetch-swisstopo.mjs                          → die drei Testadressen
//   node scripts/fetch-swisstopo.mjs "Bundesplatz 3 Bern" …   → beliebige Adressen
//   node scripts/fetch-swisstopo.mjs --datei adressen.json    → [{bbl_id, adresse}, …]
//
// Ergebnis nach stdout und (mit --aus <pfad>) in eine Datei.
//
// QUELLENANGABE: © Data: swisstopo (BGDI) · amtliche Vermessung der Kantone
// (geodienste.ch). Beides ist ohne Schlüssel nutzbar, verlangt aber die Nennung
// der Quelle — siehe docs/swisstopo-api.md Kap. 8.

const BGDI = 'https://api3.geo.admin.ch/rest/services';
const WFS = 'https://geodienste.ch/db/av_0/deu';

// Fair Use: BGDI 40 Anfragen/Minute, geodienste.ch nur 10/Minute bei 1 MB.
// Der WFS ist der Engpass — darum die grosszügige Pause vor jedem WFS-Aufruf.
const PAUSE_BGDI = 400;
const PAUSE_WFS = 6500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, was) {
  const res = await fetch(url, { headers: { 'User-Agent': 'bbl-kundenportal-prototyp/1.0 (Demodaten)' } });
  if (!res.ok) throw new Error(`${was}: HTTP ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`${was}: keine JSON-Antwort (${text.slice(0, 120)})`); }
}

// (A) Adresse → Koordinaten. ACHTUNG: attrs.x ist der NORDwert, attrs.y der
// OSTwert — in der Antwort vertauscht gegenüber der üblichen Lesart.
async function geocode(adresse) {
  const url = `${BGDI}/api/SearchServer?searchText=${encodeURIComponent(adresse)}`
    + '&type=locations&origins=address&sr=2056&limit=1';
  const j = await getJSON(url, 'SearchServer');
  const hit = (j.results || [])[0];
  if (!hit) return null;
  const a = hit.attrs;
  const label = String(a.label || '').replace(/<[^>]+>/g, '').trim();
  // «Bundesplatz 3 3011 Bern» → Strasse / Nr. / PLZ / Ort
  const m = label.match(/^(.*?)\s+(\d+[a-zA-Z]?)\s+(\d{4})\s+(.+)$/);
  return {
    label,
    strasse: m ? m[1] : label, hausnummer: m ? m[2] : '',
    plz: m ? m[3] : '', ort: m ? m[4] : '',
    lat: a.lat, lon: a.lon,
    lv95_e: a.y, lv95_n: a.x,
    egid_aus_suche: String(a.featureId || '').split('_')[0] || null,
  };
}

// (B) Gebäude- und Wohnungsregister → EGID und Gebäudemerkmale.
async function gwr(lat, lon) {
  // tolerance > 0 verlangt mapExtent UND imageDisplay — ohne die beiden antwortet
  // der Dienst mit HTTP 400. Nur bei tolerance=0 sind sie weglassbar.
  const d = 0.0005;   // ~50 m Suchfenster um den Punkt
  const extent = `${lon - d},${lat - d},${lon + d},${lat + d}`;
  const url = `${BGDI}/api/MapServer/identify?geometry=${lon},${lat}`
    + '&geometryType=esriGeometryPoint&layers=all:ch.bfs.gebaeude_wohnungs_register'
    + `&sr=4326&tolerance=5&returnGeometry=false&mapExtent=${extent}&imageDisplay=100,100,96`;
  const j = await getJSON(url, 'GWR');
  const r = (j.results || [])[0];
  if (!r) return null;
  const a = r.attributes || r.properties || {};
  return {
    egid: a.egid || null, baujahr: a.gbauj || null, geschosse: a.gastw || null,
    grundflaeche: a.garea || null, kategorie: a.gkat || null, status: a.gstat || null,
    egrid_aus_gwr: a.egrid || null, parzelle_aus_gwr: a.lparz || null, gemeindenr: a.ggdenr || null,
  };
}

// (C1) Amtliche Vermessung → EGRID, Parzellennummer, BFS-Nr., Polygon (WGS 84).
async function parzelle(lat, lon) {
  const url = `${BGDI}/all/MapServer/identify?geometry=${lon},${lat}`
    + '&geometryType=esriGeometryPoint&layers=all:ch.swisstopo-vd.amtliche-vermessung'
    + '&sr=4326&tolerance=0&returnGeometry=true&geometryFormat=geojson';
  const j = await getJSON(url, 'Amtliche Vermessung');
  const r = (j.results || [])[0];
  if (!r) return null;
  const p = r.properties || r.attributes || {};
  return {
    egrid: p.egris_egrid || null, nummer: p.number || p.name || null,
    bfsnr: p.bfsnr || null, kanton: p.ak || null, identnd: p.identnd || null,
    geometrie: r.geometry || null,
  };
}

// (C2) Amtliche FLÄCHE — die fehlt in der BGDI und kommt nur aus dem WFS der
// Kantone. Filter über den EGRID, damit genau eine Liegenschaft zurückkommt.
async function flaeche(egrid) {
  const filter = `<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0">`
    + `<fes:PropertyIsEqualTo><fes:ValueReference>EGRIS_EGRID</fes:ValueReference>`
    + `<fes:Literal>${egrid}</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>`;
  const url = `${WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms:RESF`
    + '&SRSNAME=urn:ogc:def:crs:EPSG::4326'
    + `&OUTPUTFORMAT=${encodeURIComponent('application/json; subtype=geojson')}`
    + `&FILTER=${encodeURIComponent(filter)}`;
  const j = await getJSON(url, 'geodienste WFS');
  const f = (j.features || [])[0];
  if (!f) return null;
  const p = f.properties || {};
  return {
    flaeche_m2: p.Flaeche ?? null, nummer: p.Nummer ?? null,
    nbident: p.NBIdent ?? null, bfsnr: p.BFSNr ?? null,
    vollstaendigkeit: p.Vollstaendigkeit ?? null,
    geometrie: f.geometry || null,
  };
}

const vertices = (g) => {
  if (!g || !g.coordinates) return 0;
  const flat = JSON.stringify(g.coordinates).match(/\],\[/g);
  return flat ? flat.length + 1 : 0;
};

async function aufloesen(eintrag) {
  const adresse = typeof eintrag === 'string' ? eintrag : eintrag.adresse;
  const bbl_id = typeof eintrag === 'string' ? null : eintrag.bbl_id;
  const out = { bbl_id, angefragt: adresse, fehler: [] };
  try {
    const g = await geocode(adresse);
    if (!g) { out.fehler.push('keine Adresse gefunden'); return out; }
    Object.assign(out, g);
    await sleep(PAUSE_BGDI);

    try { out.gwr = await gwr(g.lat, g.lon); } catch (e) { out.fehler.push('GWR: ' + e.message); }
    await sleep(PAUSE_BGDI);

    try { out.parzelle = await parzelle(g.lat, g.lon); } catch (e) { out.fehler.push('AV: ' + e.message); }

    if (out.parzelle && out.parzelle.egrid) {
      await sleep(PAUSE_WFS);
      try {
        const f = await flaeche(out.parzelle.egrid);
        if (f) { out.flaeche = f; out.parzelle.geometrie = f.geometrie || out.parzelle.geometrie; }
        else out.fehler.push('WFS: keine Liegenschaft zum EGRID');
      } catch (e) { out.fehler.push('WFS: ' + e.message); }
    }
  } catch (e) { out.fehler.push(e.message); }
  return out;
}

// --- Aufruf -----------------------------------------------------------------
const argv = process.argv.slice(2);
const idxAus = argv.indexOf('--aus');
const ziel = idxAus >= 0 ? argv[idxAus + 1] : null;
if (idxAus >= 0) argv.splice(idxAus, 2);
const idxDatei = argv.indexOf('--datei');
let eintraege;
if (idxDatei >= 0) {
  const { readFileSync } = await import('node:fs');
  eintraege = JSON.parse(readFileSync(argv[idxDatei + 1], 'utf8'));
} else if (argv.length) {
  eintraege = argv;
} else {
  eintraege = ['Bundesplatz 3 Bern', 'Papiermühlestrasse 172 Ittigen', 'Monbijoustrasse 40 Bern'];
}

const ergebnisse = [];
for (const e of eintraege) {
  const r = await aufloesen(e);
  ergebnisse.push(r);
  const p = r.parzelle || {}; const f = r.flaeche || {}; const gw = r.gwr || {};
  console.log(`${String(r.angefragt).padEnd(34)} ${r.label || '—'}`);
  console.log(`   ${r.lat ? r.lat.toFixed(6) + ' / ' + r.lon.toFixed(6) : '—'}`
    + `  EGID ${gw.egid || r.egid_aus_suche || '—'}  EGRID ${p.egrid || '—'}`
    + `  Parz. ${p.nummer || '—'}  ${f.flaeche_m2 != null ? f.flaeche_m2 + ' m²' : '— m²'}`
    + `  BFS ${p.bfsnr || '—'}  Polygon ${vertices(p.geometrie)} Punkte`
    + (r.fehler.length ? `\n   ⚠ ${r.fehler.join(' · ')}` : ''));
}

if (ziel) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(ziel, JSON.stringify(ergebnisse, null, 2));
  console.log(`\n→ ${ziel}`);
}
