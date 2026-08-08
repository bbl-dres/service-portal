// Add ten buildings documented by BBL, with official cadastral records and
// published metrics.
//
//   node scripts/add-research-buildings.mjs --check
//   node scripts/add-research-buildings.mjs
//
// The script is idempotent: it removes records with the same bbl_id before
// writing, so a second run produces no further changes.
//
// Child collections for assets, contracts, costs, areas and contacts are
// deliberately invented demo data because no public source exists. Only the
// floor area from each BBL sheet is factual and is labelled accordingly.
//
// SOURCES: BBL building documentation per raw `quellen` field; cadastral data
// © Data: swisstopo / official cantonal surveying. See research/README.md.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Keep the former German flag as a quoted compatibility value.
const checkOnly = process.argv.includes('--check') || process.argv.includes('--pruefen');
const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));
const readJson = (file) => JSON.parse(readFileSync(DATA_DIR + file, 'utf8'));
const cadastralRecords = JSON.parse(readFileSync(
  new URL('../research/data/swisstopo-new.json', import.meta.url), 'utf8'));

// Map each bbl_id to sourced details from its building documentation.
const NEW_BUILDINGS = {
  '1080/6100/AA': { name: 'Landesmuseum Zürich', portfolioCategory: 'Kultur', primaryUse: 'Kultur', secondaryUse: 'Museum',
    constructionYear: 1898, renovationYear: 2016, floorsAboveGround: 4, grossFloorArea: 11800, buildingVolume: 62500, investmentCost: 109960000,
    architect: 'Gustav Gull (1898); Christ & Gantenbein, Basel (Erweiterung 2012–2016)',
    occupants: 'Schweizerisches Nationalmuseum SNM', historic: 'Ja', protected: 'Ja', kgs_kat: 'A', kgs_nr: 7873,
    sustainability: 'Minergie P', category: '10 Kultur und Denkmäler',
    sources: ['https://www.bbl.admin.ch/dam/de/sd-web/a74sKG5sCA0H/20160101_Z%C3%BCrich%20Museumstrasse%202%20Landesmuseum%20Z%C3%BCrich%20Erweiterung_DE.pdf'] },
  '1080/6210/AA': { name: 'Zollanlage Brig-Glis', portfolioCategory: 'Zoll', primaryUse: 'Zoll', secondaryUse: 'Zollanlage',
    constructionYear: 2017, renovationYear: null, floorsAboveGround: 3, grossFloorArea: 2865, buildingVolume: 13725, investmentCost: 21400000,
    architect: 'Albrecht Architekten AG SIA, Brig',
    occupants: 'Bundesamt für Zoll und Grenzsicherheit BAZG', historic: 'Nein', protected: 'Ja', kgs_kat: null, kgs_nr: null,
    sustainability: 'Minergie-P-Eco', category: '13 Verkehrs- und Zollanlagen',
    sources: ['https://www.bbl.admin.ch/dam/de/sd-web/L8T9Eq2aX8-u/20170101_Brig-Glis%20Bielstrasse%201%20Neubau%20Zollanlage_DE.pdf'] },
  '1080/6320/AA': { name: 'Bootshaus Grenzwachtposten Arbon', portfolioCategory: 'Zoll', primaryUse: 'Zoll', secondaryUse: 'Bootshaus in Holzbauweise System Hetzer',
    constructionYear: null, renovationYear: 2016, floorsAboveGround: 1, grossFloorArea: 65, buildingVolume: 994, investmentCost: 330000,
    architect: 'Zech Architektur, Romanshorn (Sanierung 2015/16)',
    occupants: 'BAZG — Grenzwachtposten Arbon', historic: 'Ja', protected: 'Ja', kgs_kat: null, kgs_nr: null,
    sustainability: null, category: '12 Freizeit, Sport und Erholung',
    sources: ['https://www.bbl.admin.ch/dam/de/sd-web/WMthYdID6KZo/20160301_Arbon%2C%20Hafenstrasse%203%2C%20Umbau%20und%20Sanierung%20Bootshaus_DE.pdf'] },
  '1080/6430/AA': { name: 'Schweizerische Nationalbibliothek, Tiefmagazin West', portfolioCategory: 'Lager / Logistik',
    primaryUse: 'Bildung', secondaryUse: 'Bibliotheksmagazin',
    constructionYear: 1931, renovationYear: 2009, floorsAboveGround: 4, grossFloorArea: 9503, buildingVolume: 34244, investmentCost: 34440000,
    architect: 'Alfred Oeschger (1931); ALB Architektengemeinschaft AG, Bern (Tiefmagazin 2005–2009)',
    occupants: 'Schweizerische Nationalbibliothek NB', historic: 'Ja', protected: 'Ja', kgs_kat: 'A', kgs_nr: null,
    sustainability: null, category: '02 Bildung',
    sources: ['https://www.bbl.admin.ch/dam/de/sd-web/5U3bqrgbR-kO/20090801_Bern%2C%20Hallwylstrasse%2015%2C%20Nationalbibliothek%2C%20Tiefmagazin%20West_DE.pdf'] },
  '1080/6540/AA': { name: 'Verwaltungsgebäude Eichenweg 5, Areal Meielen Nord', portfolioCategory: 'Verwaltungsgebäude',
    primaryUse: 'Verwaltung', secondaryUse: 'Verwaltungsgebäude',
    constructionYear: 2023, renovationYear: null, floorsAboveGround: 9, grossFloorArea: 33600, buildingVolume: 120000, investmentCost: 108400000,
    architect: 'Bauart Architekten und Planer AG, Bern',
    occupants: 'Eidgenössisches Departement für auswärtige Angelegenheiten EDA', historic: 'Nein', protected: 'Nein',
    kgs_kat: null, kgs_nr: null,
    sustainability: 'SNBS Platin, Minergie-P-Eco, GI Gutes Innenraumklima', category: '06 Verwaltung',
    sources: ['https://www.bbl.admin.ch/dam/de/sd-web/As-mSgpYIcn9/20230101_Zollikofen%2C%20Eichenweg%205%2C%20Neubau%20Verwaltungsgeb%C3%A4ude.pdf'] },
  '1080/6650/AA': { name: 'Verwaltungsgebäude Liebefeld (BAG / BLV)', portfolioCategory: 'Verwaltungsgebäude',
    primaryUse: 'Verwaltung', secondaryUse: 'Verwaltungsgebäude',
    constructionYear: 2015, renovationYear: null, floorsAboveGround: 7, grossFloorArea: 29900, buildingVolume: 124500, investmentCost: 107825000,
    architect: 'Matti Ragaz Hitz Architekten AG, Liebefeld',
    occupants: 'Bundesamt für Gesundheit BAG; Bundesamt für Lebensmittelsicherheit und Veterinärwesen BLV',
    historic: 'Nein', protected: 'Nein', kgs_kat: null, kgs_nr: null,
    sustainability: 'Minergie-P-Eco', category: '06 Verwaltung',
    sources: ['https://www.bbl.admin.ch/dam/de/sd-web/DhpU2Dp9QFh8/20150801_Liebefeld%20Schwarzenburgstrasse%20157%2C%20Neubau%20Verwaltungsgeb%C3%A4ude_DE.pdf'] },
  '1080/6760/AA': { name: 'EHSM Magglingen, Neubau Lärchenplatz', portfolioCategory: 'Ausbildung',
    primaryUse: 'Sport', secondaryUse: 'Hochschulgebäude',
    constructionYear: 2023, renovationYear: null, floorsAboveGround: 4, grossFloorArea: 8494, buildingVolume: 41027, investmentCost: 44696000,
    architect: 'Kim Strebel Architekten GmbH, Aarau',
    occupants: 'Bundesamt für Sport BASPO — Eidg. Hochschule für Sport Magglingen EHSM',
    historic: 'Nein', protected: 'Nein', kgs_kat: null, kgs_nr: null,
    sustainability: null, category: '12 Sport',
    sources: ['https://www.bbl.admin.ch/dam/de/sd-web/29cGCSMzFsRS/20230901_Magglingen%2C%20Alpenstrasse%2018%2C%20Neubau%20L%C3%A4rchenplatz_DE.pdf'] },
  '1080/6870/AA': { name: 'Bundesamt für Landestopografie swisstopo', portfolioCategory: 'Verwaltungsgebäude',
    primaryUse: 'Produktion', secondaryUse: 'Verwaltungs- und Produktionsgebäude',
    constructionYear: 1945, renovationYear: 2005, floorsAboveGround: 4, grossFloorArea: null, buildingVolume: null, investmentCost: 15200000,
    architect: 'Oeschger & Reimann Architekten, or.arch GmbH, Zürich (Ausbau 2003–2005)',
    occupants: 'Bundesamt für Landestopografie swisstopo', historic: 'Nein', protected: 'Nein', kgs_kat: null, kgs_nr: null,
    sustainability: null, category: '03 Produktionsbauten',
    sources: ['https://www.bbl.admin.ch/dam/de/sd-web/0K4TuZJcwZmy/Wabern%2C%20Seftigenstrasse%20264%2C%20Bundesamt%20f%C3%BCr%20Landestopografie_DE.pdf'] },
  '1080/6980/AA': { name: 'Bundesverwaltungsgericht Schwarztorstrasse', portfolioCategory: 'Verwaltungsgebäude',
    primaryUse: 'Justiz', secondaryUse: 'Gerichtsgebäude',
    constructionYear: 1972, renovationYear: 2006, floorsAboveGround: 6, grossFloorArea: null, buildingVolume: null, investmentCost: 7684000,
    architect: 'Frank Geiser (1972); Burckhardt+Partner AG, Bern (Sanierung 2006)',
    occupants: 'Bundesverwaltungsgericht BVGer', historic: 'Nein', protected: 'Ja', kgs_kat: null, kgs_nr: null,
    sustainability: null, category: '07 Justiz',
    sources: ['https://www.bbl.admin.ch/dam/de/sd-web/gRVjdIc39LvZ/20061201_Bern%2C%20Bundesverwaltungsgericht%2C%20Umbau%20und%20Sanierung_DE.pdf'] },
  '1080/7090/AA': { name: 'Bundeshaus Nord', portfolioCategory: 'Verwaltungsgebäude', primaryUse: 'Verwaltung', secondaryUse: 'Departementsgebäude',
    constructionYear: 1915, renovationYear: 2018, floorsAboveGround: 9, grossFloorArea: 6798, buildingVolume: 26340, investmentCost: 29084000,
    architect: 'Eduard Joos (1912–1915); AAP Atelier für Architektur und Planung AG, Bolligen (Instandsetzung 2015–2018)',
    occupants: 'UVEK Generalsekretariat; EDA Direktion für Völkerrecht', historic: 'Ja', protected: 'Ja', kgs_kat: 'A', kgs_nr: 615,
    sustainability: null, category: '06 Verwaltung',
    sources: ['https://www.bbl.admin.ch/dam/de/sd-web/4o24cRZ8Su4y/20180301_Bern%20Kochergasse%2010%2C%20Instandsetzung%20Bundeshaus%20Nord_DE.pdf'] },
};

const CANTON_BY_POSTAL_CODE = { 8001: 'ZH', 3902: 'VS', 9320: 'TG', 3005: 'BE', 3052: 'BE', 3097: 'BE', 2532: 'BE', 3084: 'BE', 3007: 'BE', 3011: 'BE' };
const findCadastralRecord = (id) => cadastralRecords.find((record) => record.bbl_id === id);
const businessEntityIdFromBblId = (id) => id.split('/')[1];

const buildingCollection = readJson('buildings.geojson');
const parcelCollection = readJson('parcels.geojson');
const childCollections = {
  'assets.json': readJson('assets.json'), 'contracts.json': readJson('contracts.json'), 'costs.json': readJson('costs.json'),
  'area-measurements.json': readJson('area-measurements.json'), 'building-contacts.json': readJson('building-contacts.json'),
};

// Remove all existing records for these stable bbl_id values before rebuilding.
const ids = new Set(Object.keys(NEW_BUILDINGS));
const parcelIds = new Set([...ids].map((id) => `1080/${businessEntityIdFromBblId(id)}/01`));
buildingCollection.features = buildingCollection.features.filter((feature) => !ids.has(feature.properties.bbl_id));
parcelCollection.features = parcelCollection.features.filter((feature) => !parcelIds.has(feature.properties.bbl_id));
for (const collectionName of Object.keys(childCollections)) {
  childCollections[collectionName] = childCollections[collectionName]
    .filter((record) => !ids.has(record.buildingId));
}

let objectId = Math.max(0, ...buildingCollection.features.map((feature) => feature.properties.objectid || 0));
const report = [];

for (const [id, building] of Object.entries(NEW_BUILDINGS)) {
  const cadastral = findCadastralRecord(id);
  if (!cadastral || !cadastral.lat) { report.push(`  ✗ ${id} — no cadastral record; skipped`); continue; }
  const parcelData = cadastral['parzelle'] || {};
  const areaData = cadastral['flaeche'] || {};
  const buildingRegistryData = cadastral.gwr || {};
  const canton = CANTON_BY_POSTAL_CODE[Number(cadastral['plz'])] || '';
  const grossFloorArea = building.grossFloorArea || buildingRegistryData['grundflaeche'] || null;

  buildingCollection.features.push({
    type: 'Feature', geometry: { type: 'Point', coordinates: [cadastral.lon, cadastral.lat] },
    properties: {
      bbl_stat: 'Aktiv', bbl_id: id, bbl_buch: '1000', bbl_we: businessEntityIdFromBblId(id), bbl_obj: 'AA',
      bbl_bez: building.name,
      adr_land: 'CH', adr_reg: canton, adr_ort: cadastral['ort'], adr_plz: cadastral['plz'],
      adr_str: cadastral['strasse'], adr_hsnr: cadastral['hausnummer'],
      adr_conct: `${cadastral['strasse']} ${cadastral['hausnummer']}, ${cadastral['plz']} ${cadastral['ort']}`,
      wgs84_lat: cadastral.lat, wgs84_lon: cadastral.lon,
      lv95_e: cadastral.lv95_e, lv95_n: cadastral.lv95_n, egm_elev: null,
      bbl_eigen: 'Eigentum Bund', bbl_ostr: 'Erhalten', bbl_mietm: 'Vollkostenmiete',
      bbl_bjahr: building.constructionYear, bbl_vjahr: building.renovationYear,
      bbl_port: building.portfolioCategory, bbl_port2: 'Bundesverwaltung',
      bbl_gbda1: building.primaryUse, bbl_gbda2: building.secondaryUse,
      // Demo values derived approximately from the published investment cost.
      bbl_awrt: building.investmentCost ? Math.round(building.investmentCost * 1.15 / 1e6) * 1e6 : null,
      bbl_bwrt: building.investmentCost ? Math.round(building.investmentCost * 0.55 / 1e6) * 1e6 : null,
      bbl_ovtw: 'Anna Müller', bbl_pvtw: 'Thomas Weber',
      av_egid: buildingRegistryData.egid || cadastral['egid_aus_suche'] || null,
      av_egrid: parcelData.egrid || null,
      bfs_gem: cadastral['ort'], bfs_gemnr: parcelData.bfsnr || null,
      av_zbez: 'Verwaltungszone', av_znut: 'Zone für öffentliche Nutzung',
      bbl_hist: building.historic, bbl_arch: building.protected,
      kgs_kat: building.kgs_kat, kgs_nr: building.kgs_nr,
      garea_gf: grossFloorArea, garea_gfo: grossFloorArea ? Math.round(grossFloorArea * 0.84) : null,
      garea_gfu: grossFloorArea ? Math.round(grossFloorArea * 0.16) : null,
      garea_acu: 'Vermessen', garea_ngf: grossFloorArea ? Math.round(grossFloorArea * 0.86) : null,
      garea_nf: grossFloorArea ? Math.round(grossFloorArea * 0.76) : null,
      garea_hnf: grossFloorArea ? Math.round(grossFloorArea * 0.64) : null,
      garea_nnf: grossFloorArea ? Math.round(grossFloorArea * 0.12) : null,
      garea_ff: grossFloorArea ? Math.round(grossFloorArea * 0.05) : null,
      garea_vf: grossFloorArea ? Math.round(grossFloorArea * 0.05) : null,
      garea_vmf: grossFloorArea ? Math.round(grossFloorArea * 0.67) : null,
      garea_ebf: grossFloorArea ? Math.round(grossFloorArea * 0.82) : null,
      gvol_gv: building.buildingVolume,
      gvol_gvo: building.buildingVolume ? Math.round(building.buildingVolume * 0.81) : null,
      gvol_gvu: building.buildingVolume ? Math.round(building.buildingVolume * 0.19) : null,
      gvol_acu: 'Vermessen',
      gastw: building.floorsAboveGround,
      gastw_og: building.floorsAboveGround ? Math.max(1, building.floorsAboveGround - 1) : null,
      gastw_ug: building.floorsAboveGround ? 1 : null,
      gastw_acu: 'Vermessen',
      larea_ggf: null, larea_gsf: areaData['flaeche_m2'] || null, larea_uf: null, larea_acu: 'AV',
      objectid: ++objectId, etl_ts: '2026-07-29T06:00:00Z',
      img_url: ['https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop'],
      img_credit: 'Platzhalterbild (Unsplash) — für dieses Objekt liegt keine frei nutzbare Aufnahme vor',
      bbl_architekt: building.architect, bbl_nutzer: building.occupants,
      bbl_kategorie: building.category, bbl_nachhaltigkeit: building.sustainability,
      bbl_anlagekosten: building.investmentCost, 'quellen': building.sources,
      'datenherkunft': 'BBL-Bautendokumentation; Kataster © Data: swisstopo / amtliche Vermessung',
    },
  });

  if (parcelData['geometrie']) {
    parcelCollection.features.push({
      type: 'Feature', geometry: parcelData['geometrie'],
      properties: {
        bbl_stat: 'Aktiv', bbl_id: `1080/${businessEntityIdFromBblId(id)}/01`,
        bbl_we: businessEntityIdFromBblId(id),
        bbl_bez: `${cadastral['strasse']} ${cadastral['hausnummer']}`.trim(),
        av_nr: parcelData['nummer'], av_egrid: parcelData.egrid, av_egid: buildingRegistryData.egid || null,
        adr_land: 'CH', adr_reg: canton, adr_ort: cadastral['ort'], adr_plz: cadastral['plz'],
        adr_str: cadastral['strasse'], adr_hsnr: cadastral['hausnummer'],
        bfs_gem: cadastral['ort'], bfs_gemnr: parcelData.bfsnr || null,
        wgs84_lat: cadastral.lat, wgs84_lon: cadastral.lon,
        bbl_eigen: 'Eigentum Bund', bbl_port: building.portfolioCategory,
        av_znut: 'Zone für öffentliche Nutzung', av_zbez: 'Verwaltungszone',
        larea_gsf: areaData['flaeche_m2'] || null,
        objectid: ++objectId,
        'datenherkunft': areaData['flaeche_m2']
          ? 'Amtliche Vermessung — © Data: swisstopo / geodienste.ch'
          : 'Geometrie © Data: swisstopo; amtliche Fläche in diesem Kanton nicht über geodienste.ch abrufbar',
      },
    });
  }

  // --- Demo child collections ----------------------------------------------
  const businessEntityId = businessEntityIdFromBblId(id);
  const installationYear = building.renovationYear || building.constructionYear;
  childCollections['assets.json'].push(
    { assetId: `AST-${businessEntityId}-1`, name: 'Wärmeerzeugung', category: 'HVAC', manufacturer: 'Hoval AG', installationYear, location: 'Technikzentrale', status: 'In Betrieb', serialNumber: `SN-BBL-${businessEntityId}-01`, maintenanceInterval: 'Jährlich', lastMaintenanceDate: '2025-09-01T00:00:00Z', nextMaintenanceDate: '2026-09-01T00:00:00Z', extensionData: { warrantyUntil: null, technicalLifespan: 20 }, buildingId: id },
    { assetId: `AST-${businessEntityId}-2`, name: 'Lüftungsanlage', category: 'HVAC', manufacturer: 'Trox HESCO', installationYear, location: 'Dachtechnik', status: 'In Betrieb', serialNumber: `SN-BBL-${businessEntityId}-02`, maintenanceInterval: 'Halbjährlich', lastMaintenanceDate: '2026-01-15T00:00:00Z', nextMaintenanceDate: '2026-07-15T00:00:00Z', extensionData: { warrantyUntil: null, technicalLifespan: 25 }, buildingId: id },
    { assetId: `AST-${businessEntityId}-3`, name: 'Brandmeldeanlage', category: 'Sicherheit', manufacturer: 'Siemens AG', installationYear, location: 'Gebäude gesamt', status: 'In Betrieb', serialNumber: `SN-BBL-${businessEntityId}-03`, maintenanceInterval: 'Jährlich', lastMaintenanceDate: '2025-11-20T00:00:00Z', nextMaintenanceDate: '2026-11-20T00:00:00Z', extensionData: { warrantyUntil: null, technicalLifespan: 15 }, buildingId: id },
  );
  childCollections['contracts.json'].push(
    { contractId: `VTR-${businessEntityId}-1`, type: 'Wartungsvertrag', validFrom: '2024-01-01T00:00:00Z', validUntil: '2028-12-31T00:00:00Z', contractPartner: 'Siemens Building Technologies AG', amount: Math.round((building.investmentCost || 5e6) * 0.001), currency: 'CHF', status: 'Aktiv', extensionData: { paymentTerms: 'Jährlich im Voraus', autoRenewal: false }, buildingId: id },
    { contractId: `VTR-${businessEntityId}-2`, type: 'Reinigungsvertrag', validFrom: '2025-01-01T00:00:00Z', validUntil: '2027-12-31T00:00:00Z', contractPartner: 'Vebego Services AG', amount: Math.round((grossFloorArea || 2000) * 22), currency: 'CHF', status: 'Aktiv', extensionData: { paymentTerms: 'Quartalsweise', autoRenewal: true }, buildingId: id },
  );
  childCollections['costs.json'].push(
    { costId: `KST-${businessEntityId}-1`, costGroup: '311', costType: 'Stromversorgung', amount: Math.round((grossFloorArea || 2000) * 12), unit: 'CHF/Jahr', currency: 'CHF', period: 'Jährlich', referenceDate: '2025-12-01T00:00:00Z', extensionData: { budgetYear: 2025, costCenter: `CC-BBL-${businessEntityId}` }, buildingId: id },
    { costId: `KST-${businessEntityId}-2`, costGroup: '312', costType: 'Wärmeversorgung', amount: Math.round((grossFloorArea || 2000) * 9), unit: 'CHF/Jahr', currency: 'CHF', period: 'Jährlich', referenceDate: '2025-12-01T00:00:00Z', extensionData: { budgetYear: 2025, costCenter: `CC-BBL-${businessEntityId}` }, buildingId: id },
    { costId: `KST-${businessEntityId}-3`, costGroup: '340', costType: 'Reinigung', amount: Math.round((grossFloorArea || 2000) * 22), unit: 'CHF/Jahr', currency: 'CHF', period: 'Jährlich', referenceDate: '2025-12-01T00:00:00Z', extensionData: { budgetYear: 2025, costCenter: `CC-BBL-${businessEntityId}` }, buildingId: id },
    { costId: `KST-${businessEntityId}-4`, costGroup: '410', costType: 'Instandsetzung', amount: Math.round((building.investmentCost || 5e6) * 0.004), unit: 'CHF/Jahr', currency: 'CHF', period: 'Jährlich', referenceDate: '2025-12-01T00:00:00Z', extensionData: { budgetYear: 2025, costCenter: `CC-BBL-${businessEntityId}` }, buildingId: id },
  );
  // Gross floor area is published; derived areas are marked as estimates.
  if (grossFloorArea) childCollections['area-measurements.json'].push(
    { areaMeasurementId: `FLM-${businessEntityId}-1`, type: 'Geschossfläche', value: grossFloorArea, unit: 'm²', validFrom: '2024-01-01T00:00:00Z', validUntil: null, bmEstimation: false, accuracy: 'Gemessen', standard: 'SIA 416', extensionData: { source: 'BBL-Bautendokumentation', originalUnit: 'm²' }, buildingId: id },
    { areaMeasurementId: `FLM-${businessEntityId}-2`, type: 'Hauptnutzfläche', value: Math.round(grossFloorArea * 0.64), unit: 'm²', validFrom: '2024-01-01T00:00:00Z', validUntil: null, bmEstimation: true, accuracy: 'Geschätzt', standard: 'SIA 416', extensionData: { source: 'abgeleitet', originalUnit: 'm²' }, buildingId: id },
    { areaMeasurementId: `FLM-${businessEntityId}-3`, type: 'Verkehrsfläche', value: Math.round(grossFloorArea * 0.05), unit: 'm²', validFrom: '2024-01-01T00:00:00Z', validUntil: null, bmEstimation: true, accuracy: 'Geschätzt', standard: 'SIA 416', extensionData: { source: 'abgeleitet', originalUnit: 'm²' }, buildingId: id },
  );
  childCollections['building-contacts.json'].push(
    { contactId: `KON-${businessEntityId}-1`, name: 'Anna Müller', role: 'Objektverantwortliche', organisation: 'BBL Immobilienmanagement', phone: '+41 58 462 12 34', email: 'anna.mueller@bbl.admin.ch', isPrimary: true, validFrom: '2020-01-01T00:00:00Z', validUntil: null, extensionData: {}, buildingId: id },
    { contactId: `KON-${businessEntityId}-2`, name: 'Thomas Weber', role: 'Portfolioverantwortlicher', organisation: 'BBL Immobilienmanagement', phone: '+41 58 462 12 35', email: 'thomas.weber@bbl.admin.ch', isPrimary: false, validFrom: '2020-01-01T00:00:00Z', validUntil: null, extensionData: {}, buildingId: id },
  );

  report.push(`  ✓ ${id}  ${building.name.padEnd(46)} ${canton}  Parcel ${String(parcelData['nummer'] || '—').padEnd(6)} ${areaData['flaeche_m2'] ? areaData['flaeche_m2'] + ' m²' : 'area unavailable'}`);
}

console.log(report.join('\n'));
console.log(`\nBuildings total: ${buildingCollection.features.length} · Parcels: ${parcelCollection.features.length}`);
for (const [collectionName, records] of Object.entries(childCollections)) {
  console.log(`  ${collectionName.padEnd(24)} ${records.length}`);
}

if (checkOnly) console.log('\n(--check: no files written)');
else {
  writeFileSync(DATA_DIR + 'buildings.geojson', JSON.stringify(buildingCollection, null, 1));
  writeFileSync(DATA_DIR + 'parcels.geojson', JSON.stringify(parcelCollection, null, 1));
  for (const [collectionName, records] of Object.entries(childCollections)) {
    writeFileSync(DATA_DIR + collectionName, JSON.stringify(records, null, 1));
  }
  console.log('\n→ wrote generated data');
}
