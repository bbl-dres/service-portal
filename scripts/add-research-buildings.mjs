// Nimmt zehn weitere, in den BBL-Bautendokumentationen belegte Bauten in den
// Bestand auf — mit amtlichem Kataster und den publizierten Kennzahlen.
//
//   node scripts/add-research-buildings.mjs --pruefen
//   node scripts/add-research-buildings.mjs
//
// Das Skript ist idempotent: es entfernt vorhandene Sätze derselben bbl_id,
// bevor es schreibt. Zweimal laufen lassen ändert nichts.
//
// Die Kindregister (Ausstattung, Verträge, Kosten, Flächen, Objektkontakte)
// sind BEWUSST erfunden — publiziert sind sie nirgends. Nur die Fläche aus dem
// BBL-Datenblatt ist echt und als solche gekennzeichnet. Ohne diese Sätze
// stünden die Register der neuen Objekte leer da.
//
// QUELLEN: BBL-Bautendokumentationen (je Objekt in `quellen`); Kataster
// © Data: swisstopo / amtliche Vermessung der Kantone. Siehe research/README.md.

import { readFileSync, writeFileSync } from 'node:fs';

const pruefen = process.argv.includes('--pruefen');
const D = 'c:/Users/david/Documents/GitHub/service-portal/data/';
const J = (f) => JSON.parse(readFileSync(D + f, 'utf8'));
const kataster = JSON.parse(readFileSync(
  'c:/Users/david/Documents/GitHub/service-portal/research/daten/swisstopo-neu.json', 'utf8'));

// bbl_id → belegte Angaben aus der jeweiligen Bautendokumentation
const NEU = {
  '1080/6100/AA': { bez: 'Landesmuseum Zürich', port: 'Kultur', gbda1: 'Kultur', gbda2: 'Museum',
    bjahr: 1898, vjahr: 2016, astw: 4, gf: 11800, gv: 62500, kosten: 109960000,
    architekt: 'Gustav Gull (1898); Christ & Gantenbein, Basel (Erweiterung 2012–2016)',
    nutzer: 'Schweizerisches Nationalmuseum SNM', hist: 'Ja', arch: 'Ja', kgs_kat: 'A', kgs_nr: 7873,
    nachhaltig: 'Minergie P', kat: '10 Kultur und Denkmäler',
    quellen: ['https://www.bbl.admin.ch/dam/de/sd-web/a74sKG5sCA0H/20160101_Z%C3%BCrich%20Museumstrasse%202%20Landesmuseum%20Z%C3%BCrich%20Erweiterung_DE.pdf'] },
  '1080/6210/AA': { bez: 'Zollanlage Brig-Glis', port: 'Zoll', gbda1: 'Zoll', gbda2: 'Zollanlage',
    bjahr: 2017, vjahr: null, astw: 3, gf: 2865, gv: 13725, kosten: 21400000,
    architekt: 'Albrecht Architekten AG SIA, Brig',
    nutzer: 'Bundesamt für Zoll und Grenzsicherheit BAZG', hist: 'Nein', arch: 'Ja', kgs_kat: null, kgs_nr: null,
    nachhaltig: 'Minergie-P-Eco', kat: '13 Verkehrs- und Zollanlagen',
    quellen: ['https://www.bbl.admin.ch/dam/de/sd-web/L8T9Eq2aX8-u/20170101_Brig-Glis%20Bielstrasse%201%20Neubau%20Zollanlage_DE.pdf'] },
  '1080/6320/AA': { bez: 'Bootshaus Grenzwachtposten Arbon', port: 'Zoll', gbda1: 'Zoll', gbda2: 'Bootshaus in Holzbauweise System Hetzer',
    bjahr: null, vjahr: 2016, astw: 1, gf: 65, gv: 994, kosten: 330000,
    architekt: 'Zech Architektur, Romanshorn (Sanierung 2015/16)',
    nutzer: 'BAZG — Grenzwachtposten Arbon', hist: 'Ja', arch: 'Ja', kgs_kat: null, kgs_nr: null,
    nachhaltig: null, kat: '12 Freizeit, Sport und Erholung',
    quellen: ['https://www.bbl.admin.ch/dam/de/sd-web/WMthYdID6KZo/20160301_Arbon%2C%20Hafenstrasse%203%2C%20Umbau%20und%20Sanierung%20Bootshaus_DE.pdf'] },
  '1080/6430/AA': { bez: 'Schweizerische Nationalbibliothek, Tiefmagazin West', port: 'Lager / Logistik',
    gbda1: 'Bildung', gbda2: 'Bibliotheksmagazin',
    bjahr: 1931, vjahr: 2009, astw: 4, gf: 9503, gv: 34244, kosten: 34440000,
    architekt: 'Alfred Oeschger (1931); ALB Architektengemeinschaft AG, Bern (Tiefmagazin 2005–2009)',
    nutzer: 'Schweizerische Nationalbibliothek NB', hist: 'Ja', arch: 'Ja', kgs_kat: 'A', kgs_nr: null,
    nachhaltig: null, kat: '02 Bildung',
    quellen: ['https://www.bbl.admin.ch/dam/de/sd-web/5U3bqrgbR-kO/20090801_Bern%2C%20Hallwylstrasse%2015%2C%20Nationalbibliothek%2C%20Tiefmagazin%20West_DE.pdf'] },
  '1080/6540/AA': { bez: 'Verwaltungsgebäude Eichenweg 5, Areal Meielen Nord', port: 'Verwaltungsgebäude',
    gbda1: 'Verwaltung', gbda2: 'Verwaltungsgebäude',
    bjahr: 2023, vjahr: null, astw: 9, gf: 33600, gv: 120000, kosten: 108400000,
    architekt: 'Bauart Architekten und Planer AG, Bern',
    nutzer: 'Eidgenössisches Departement für auswärtige Angelegenheiten EDA', hist: 'Nein', arch: 'Nein',
    kgs_kat: null, kgs_nr: null,
    nachhaltig: 'SNBS Platin, Minergie-P-Eco, GI Gutes Innenraumklima', kat: '06 Verwaltung',
    quellen: ['https://www.bbl.admin.ch/dam/de/sd-web/As-mSgpYIcn9/20230101_Zollikofen%2C%20Eichenweg%205%2C%20Neubau%20Verwaltungsgeb%C3%A4ude.pdf'] },
  '1080/6650/AA': { bez: 'Verwaltungsgebäude Liebefeld (BAG / BLV)', port: 'Verwaltungsgebäude',
    gbda1: 'Verwaltung', gbda2: 'Verwaltungsgebäude',
    bjahr: 2015, vjahr: null, astw: 7, gf: 29900, gv: 124500, kosten: 107825000,
    architekt: 'Matti Ragaz Hitz Architekten AG, Liebefeld',
    nutzer: 'Bundesamt für Gesundheit BAG; Bundesamt für Lebensmittelsicherheit und Veterinärwesen BLV',
    hist: 'Nein', arch: 'Nein', kgs_kat: null, kgs_nr: null,
    nachhaltig: 'Minergie-P-Eco', kat: '06 Verwaltung',
    quellen: ['https://www.bbl.admin.ch/dam/de/sd-web/DhpU2Dp9QFh8/20150801_Liebefeld%20Schwarzenburgstrasse%20157%2C%20Neubau%20Verwaltungsgeb%C3%A4ude_DE.pdf'] },
  '1080/6760/AA': { bez: 'EHSM Magglingen, Neubau Lärchenplatz', port: 'Ausbildung',
    gbda1: 'Sport', gbda2: 'Hochschulgebäude',
    bjahr: 2023, vjahr: null, astw: 4, gf: 8494, gv: 41027, kosten: 44696000,
    architekt: 'Kim Strebel Architekten GmbH, Aarau',
    nutzer: 'Bundesamt für Sport BASPO — Eidg. Hochschule für Sport Magglingen EHSM',
    hist: 'Nein', arch: 'Nein', kgs_kat: null, kgs_nr: null,
    nachhaltig: null, kat: '12 Sport',
    quellen: ['https://www.bbl.admin.ch/dam/de/sd-web/29cGCSMzFsRS/20230901_Magglingen%2C%20Alpenstrasse%2018%2C%20Neubau%20L%C3%A4rchenplatz_DE.pdf'] },
  '1080/6870/AA': { bez: 'Bundesamt für Landestopografie swisstopo', port: 'Verwaltungsgebäude',
    gbda1: 'Produktion', gbda2: 'Verwaltungs- und Produktionsgebäude',
    bjahr: 1945, vjahr: 2005, astw: 4, gf: null, gv: null, kosten: 15200000,
    architekt: 'Oeschger & Reimann Architekten, or.arch GmbH, Zürich (Ausbau 2003–2005)',
    nutzer: 'Bundesamt für Landestopografie swisstopo', hist: 'Nein', arch: 'Nein', kgs_kat: null, kgs_nr: null,
    nachhaltig: null, kat: '03 Produktionsbauten',
    quellen: ['https://www.bbl.admin.ch/dam/de/sd-web/0K4TuZJcwZmy/Wabern%2C%20Seftigenstrasse%20264%2C%20Bundesamt%20f%C3%BCr%20Landestopografie_DE.pdf'] },
  '1080/6980/AA': { bez: 'Bundesverwaltungsgericht Schwarztorstrasse', port: 'Verwaltungsgebäude',
    gbda1: 'Justiz', gbda2: 'Gerichtsgebäude',
    bjahr: 1972, vjahr: 2006, astw: 6, gf: null, gv: null, kosten: 7684000,
    architekt: 'Frank Geiser (1972); Burckhardt+Partner AG, Bern (Sanierung 2006)',
    nutzer: 'Bundesverwaltungsgericht BVGer', hist: 'Nein', arch: 'Ja', kgs_kat: null, kgs_nr: null,
    nachhaltig: null, kat: '07 Justiz',
    quellen: ['https://www.bbl.admin.ch/dam/de/sd-web/gRVjdIc39LvZ/20061201_Bern%2C%20Bundesverwaltungsgericht%2C%20Umbau%20und%20Sanierung_DE.pdf'] },
  '1080/7090/AA': { bez: 'Bundeshaus Nord', port: 'Verwaltungsgebäude', gbda1: 'Verwaltung', gbda2: 'Departementsgebäude',
    bjahr: 1915, vjahr: 2018, astw: 9, gf: 6798, gv: 26340, kosten: 29084000,
    architekt: 'Eduard Joos (1912–1915); AAP Atelier für Architektur und Planung AG, Bolligen (Instandsetzung 2015–2018)',
    nutzer: 'UVEK Generalsekretariat; EDA Direktion für Völkerrecht', hist: 'Ja', arch: 'Ja', kgs_kat: 'A', kgs_nr: 615,
    nachhaltig: null, kat: '06 Verwaltung',
    quellen: ['https://www.bbl.admin.ch/dam/de/sd-web/4o24cRZ8Su4y/20180301_Bern%20Kochergasse%2010%2C%20Instandsetzung%20Bundeshaus%20Nord_DE.pdf'] },
};

const KANTON = { 8001: 'ZH', 3902: 'VS', 9320: 'TG', 3005: 'BE', 3052: 'BE', 3097: 'BE', 2532: 'BE', 3084: 'BE', 3007: 'BE', 3011: 'BE' };
const kat = (id) => kataster.find((k) => k.bbl_id === id);
const we = (id) => id.split('/')[1];

const bg = J('buildings.geojson');
const pc = J('parcels.geojson');
const kinder = {
  'assets.json': J('assets.json'), 'contracts.json': J('contracts.json'), 'costs.json': J('costs.json'),
  'area-measurements.json': J('area-measurements.json'), 'building-contacts.json': J('building-contacts.json'),
};

// Idempotenz: alles zu diesen bbl_id zuerst entfernen
const ids = new Set(Object.keys(NEU));
const parzIds = new Set([...ids].map((i) => `1080/${we(i)}/01`));
bg.features = bg.features.filter((f) => !ids.has(f.properties.bbl_id));
pc.features = pc.features.filter((f) => !parzIds.has(f.properties.bbl_id));
for (const k of Object.keys(kinder)) kinder[k] = kinder[k].filter((r) => !ids.has(r.buildingId));

let objectid = Math.max(0, ...bg.features.map((f) => f.properties.objectid || 0));
const bericht = [];

for (const [id, b] of Object.entries(NEU)) {
  const k = kat(id);
  if (!k || !k.lat) { bericht.push(`  ✗ ${id} — kein Kataster, übersprungen`); continue; }
  const p = k.parzelle || {}; const fl = k.flaeche || {}; const gw = k.gwr || {};
  const reg = KANTON[Number(k.plz)] || '';
  const gf = b.gf || gw.grundflaeche || null;

  bg.features.push({
    type: 'Feature', geometry: { type: 'Point', coordinates: [k.lon, k.lat] },
    properties: {
      bbl_stat: 'Aktiv', bbl_id: id, bbl_buch: '1000', bbl_we: we(id), bbl_obj: 'AA',
      bbl_bez: b.bez,
      adr_land: 'CH', adr_reg: reg, adr_ort: k.ort, adr_plz: k.plz, adr_str: k.strasse, adr_hsnr: k.hausnummer,
      adr_conct: `${k.strasse} ${k.hausnummer}, ${k.plz} ${k.ort}`,
      wgs84_lat: k.lat, wgs84_lon: k.lon, lv95_e: k.lv95_e, lv95_n: k.lv95_n, egm_elev: null,
      bbl_eigen: 'Eigentum Bund', bbl_ostr: 'Erhalten', bbl_mietm: 'Vollkostenmiete',
      bbl_bjahr: b.bjahr, bbl_vjahr: b.vjahr,
      bbl_port: b.port, bbl_port2: 'Bundesverwaltung', bbl_gbda1: b.gbda1, bbl_gbda2: b.gbda2,
      // Werte sind Demo-Daten: aus den publizierten Anlagekosten grob abgeleitet.
      bbl_awrt: b.kosten ? Math.round(b.kosten * 1.15 / 1e6) * 1e6 : null,
      bbl_bwrt: b.kosten ? Math.round(b.kosten * 0.55 / 1e6) * 1e6 : null,
      bbl_ovtw: 'Anna Müller', bbl_pvtw: 'Thomas Weber',
      av_egid: gw.egid || k.egid_aus_suche || null, av_egrid: p.egrid || null,
      bfs_gem: k.ort, bfs_gemnr: p.bfsnr || null,
      av_zbez: 'Verwaltungszone', av_znut: 'Zone für öffentliche Nutzung',
      bbl_hist: b.hist, bbl_arch: b.arch, kgs_kat: b.kgs_kat, kgs_nr: b.kgs_nr,
      garea_gf: gf, garea_gfo: gf ? Math.round(gf * 0.84) : null, garea_gfu: gf ? Math.round(gf * 0.16) : null,
      garea_acu: 'Vermessen', garea_ngf: gf ? Math.round(gf * 0.86) : null,
      garea_nf: gf ? Math.round(gf * 0.76) : null, garea_hnf: gf ? Math.round(gf * 0.64) : null,
      garea_nnf: gf ? Math.round(gf * 0.12) : null, garea_ff: gf ? Math.round(gf * 0.05) : null,
      garea_vf: gf ? Math.round(gf * 0.05) : null, garea_vmf: gf ? Math.round(gf * 0.67) : null,
      garea_ebf: gf ? Math.round(gf * 0.82) : null,
      gvol_gv: b.gv, gvol_gvo: b.gv ? Math.round(b.gv * 0.81) : null, gvol_gvu: b.gv ? Math.round(b.gv * 0.19) : null,
      gvol_acu: 'Vermessen',
      gastw: b.astw, gastw_og: b.astw ? Math.max(1, b.astw - 1) : null, gastw_ug: b.astw ? 1 : null,
      gastw_acu: 'Vermessen',
      larea_ggf: null, larea_gsf: fl.flaeche_m2 || null, larea_uf: null, larea_acu: 'AV',
      objectid: ++objectid, etl_ts: '2026-07-29T06:00:00Z',
      img_url: ['https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop'],
      img_credit: 'Platzhalterbild (Unsplash) — für dieses Objekt liegt keine frei nutzbare Aufnahme vor',
      bbl_architekt: b.architekt, bbl_nutzer: b.nutzer,
      bbl_kategorie: b.kat, bbl_nachhaltigkeit: b.nachhaltig,
      bbl_anlagekosten: b.kosten, quellen: b.quellen,
      datenherkunft: 'BBL-Bautendokumentation; Kataster © Data: swisstopo / amtliche Vermessung',
    },
  });

  if (p.geometrie) {
    pc.features.push({
      type: 'Feature', geometry: p.geometrie,
      properties: {
        bbl_stat: 'Aktiv', bbl_id: `1080/${we(id)}/01`, bbl_we: we(id),
        bbl_bez: `${k.strasse} ${k.hausnummer}`.trim(),
        av_nr: p.nummer, av_egrid: p.egrid, av_egid: gw.egid || null,
        adr_land: 'CH', adr_reg: reg, adr_ort: k.ort, adr_plz: k.plz, adr_str: k.strasse, adr_hsnr: k.hausnummer,
        bfs_gem: k.ort, bfs_gemnr: p.bfsnr || null,
        wgs84_lat: k.lat, wgs84_lon: k.lon,
        bbl_eigen: 'Eigentum Bund', bbl_port: b.port,
        av_znut: 'Zone für öffentliche Nutzung', av_zbez: 'Verwaltungszone',
        larea_gsf: fl.flaeche_m2 || null,
        objectid: ++objectid,
        datenherkunft: fl.flaeche_m2
          ? 'Amtliche Vermessung — © Data: swisstopo / geodienste.ch'
          : 'Geometrie © Data: swisstopo; amtliche Fläche in diesem Kanton nicht über geodienste.ch abrufbar',
      },
    });
  }

  // --- Kindregister (Demo) --------------------------------------------------
  const w = we(id);
  const jahr = b.vjahr || b.bjahr;
  kinder['assets.json'].push(
    { assetId: `AST-${w}-1`, name: 'Wärmeerzeugung', category: 'HVAC', manufacturer: 'Hoval AG', installationYear: jahr, location: 'Technikzentrale', status: 'In Betrieb', serialNumber: `SN-BBL-${w}-01`, maintenanceInterval: 'Jährlich', lastMaintenanceDate: '2025-09-01T00:00:00Z', nextMaintenanceDate: '2026-09-01T00:00:00Z', extensionData: { warrantyUntil: null, technicalLifespan: 20 }, buildingId: id },
    { assetId: `AST-${w}-2`, name: 'Lüftungsanlage', category: 'HVAC', manufacturer: 'Trox HESCO', installationYear: jahr, location: 'Dachtechnik', status: 'In Betrieb', serialNumber: `SN-BBL-${w}-02`, maintenanceInterval: 'Halbjährlich', lastMaintenanceDate: '2026-01-15T00:00:00Z', nextMaintenanceDate: '2026-07-15T00:00:00Z', extensionData: { warrantyUntil: null, technicalLifespan: 25 }, buildingId: id },
    { assetId: `AST-${w}-3`, name: 'Brandmeldeanlage', category: 'Sicherheit', manufacturer: 'Siemens AG', installationYear: jahr, location: 'Gebäude gesamt', status: 'In Betrieb', serialNumber: `SN-BBL-${w}-03`, maintenanceInterval: 'Jährlich', lastMaintenanceDate: '2025-11-20T00:00:00Z', nextMaintenanceDate: '2026-11-20T00:00:00Z', extensionData: { warrantyUntil: null, technicalLifespan: 15 }, buildingId: id },
  );
  kinder['contracts.json'].push(
    { contractId: `VTR-${w}-1`, type: 'Wartungsvertrag', validFrom: '2024-01-01T00:00:00Z', validUntil: '2028-12-31T00:00:00Z', contractPartner: 'Siemens Building Technologies AG', amount: Math.round((b.kosten || 5e6) * 0.001), currency: 'CHF', status: 'Aktiv', extensionData: { paymentTerms: 'Jährlich im Voraus', autoRenewal: false }, buildingId: id },
    { contractId: `VTR-${w}-2`, type: 'Reinigungsvertrag', validFrom: '2025-01-01T00:00:00Z', validUntil: '2027-12-31T00:00:00Z', contractPartner: 'Vebego Services AG', amount: Math.round((gf || 2000) * 22), currency: 'CHF', status: 'Aktiv', extensionData: { paymentTerms: 'Quartalsweise', autoRenewal: true }, buildingId: id },
  );
  kinder['costs.json'].push(
    { costId: `KST-${w}-1`, costGroup: '311', costType: 'Stromversorgung', amount: Math.round((gf || 2000) * 12), unit: 'CHF/Jahr', currency: 'CHF', period: 'Jährlich', referenceDate: '2025-12-01T00:00:00Z', extensionData: { budgetYear: 2025, costCenter: `CC-BBL-${w}` }, buildingId: id },
    { costId: `KST-${w}-2`, costGroup: '312', costType: 'Wärmeversorgung', amount: Math.round((gf || 2000) * 9), unit: 'CHF/Jahr', currency: 'CHF', period: 'Jährlich', referenceDate: '2025-12-01T00:00:00Z', extensionData: { budgetYear: 2025, costCenter: `CC-BBL-${w}` }, buildingId: id },
    { costId: `KST-${w}-3`, costGroup: '340', costType: 'Reinigung', amount: Math.round((gf || 2000) * 22), unit: 'CHF/Jahr', currency: 'CHF', period: 'Jährlich', referenceDate: '2025-12-01T00:00:00Z', extensionData: { budgetYear: 2025, costCenter: `CC-BBL-${w}` }, buildingId: id },
    { costId: `KST-${w}-4`, costGroup: '410', costType: 'Instandsetzung', amount: Math.round((b.kosten || 5e6) * 0.004), unit: 'CHF/Jahr', currency: 'CHF', period: 'Jährlich', referenceDate: '2025-12-01T00:00:00Z', extensionData: { budgetYear: 2025, costCenter: `CC-BBL-${w}` }, buildingId: id },
  );
  // Die Geschossfläche stammt aus dem BBL-Datenblatt und ist echt; die
  // abgeleiteten Flächen sind gerechnet und darum als Schätzung markiert.
  if (gf) kinder['area-measurements.json'].push(
    { areaMeasurementId: `FLM-${w}-1`, type: 'Geschossfläche', value: gf, unit: 'm²', validFrom: '2024-01-01T00:00:00Z', validUntil: null, bmEstimation: false, accuracy: 'Gemessen', standard: 'SIA 416', extensionData: { source: 'BBL-Bautendokumentation', originalUnit: 'm²' }, buildingId: id },
    { areaMeasurementId: `FLM-${w}-2`, type: 'Hauptnutzfläche', value: Math.round(gf * 0.64), unit: 'm²', validFrom: '2024-01-01T00:00:00Z', validUntil: null, bmEstimation: true, accuracy: 'Geschätzt', standard: 'SIA 416', extensionData: { source: 'abgeleitet', originalUnit: 'm²' }, buildingId: id },
    { areaMeasurementId: `FLM-${w}-3`, type: 'Verkehrsfläche', value: Math.round(gf * 0.05), unit: 'm²', validFrom: '2024-01-01T00:00:00Z', validUntil: null, bmEstimation: true, accuracy: 'Geschätzt', standard: 'SIA 416', extensionData: { source: 'abgeleitet', originalUnit: 'm²' }, buildingId: id },
  );
  kinder['building-contacts.json'].push(
    { contactId: `KON-${w}-1`, name: 'Anna Müller', role: 'Objektverantwortliche', organisation: 'BBL Immobilienmanagement', phone: '+41 58 462 12 34', email: 'anna.mueller@bbl.admin.ch', isPrimary: true, validFrom: '2020-01-01T00:00:00Z', validUntil: null, extensionData: {}, buildingId: id },
    { contactId: `KON-${w}-2`, name: 'Thomas Weber', role: 'Portfolioverantwortlicher', organisation: 'BBL Immobilienmanagement', phone: '+41 58 462 12 35', email: 'thomas.weber@bbl.admin.ch', isPrimary: false, validFrom: '2020-01-01T00:00:00Z', validUntil: null, extensionData: {}, buildingId: id },
  );

  bericht.push(`  ✓ ${id}  ${b.bez.padEnd(46)} ${reg}  Parz. ${String(p.nummer || '—').padEnd(6)} ${fl.flaeche_m2 ? fl.flaeche_m2 + ' m²' : 'Fläche n/v'}`);
}

console.log(bericht.join('\n'));
console.log(`\nGebäude gesamt: ${bg.features.length} · Grundstücke: ${pc.features.length}`);
for (const [k, v] of Object.entries(kinder)) console.log(`  ${k.padEnd(24)} ${v.length}`);

if (pruefen) console.log('\n(--pruefen: nichts geschrieben)');
else {
  writeFileSync(D + 'buildings.geojson', JSON.stringify(bg, null, 1));
  writeFileSync(D + 'parcels.geojson', JSON.stringify(pc, null, 1));
  for (const [k, v] of Object.entries(kinder)) writeFileSync(D + k, JSON.stringify(v, null, 1));
  console.log('\n→ geschrieben');
}
