// Retrieves official coordinates, EGID, EGRID, parcel numbers, areas, and
// parcel geometry for Swiss addresses from keyless federal and cantonal APIs.
//
// docs/swisstopo-api.md documents every request with a real response; this is
// the executable version of that recipe.
//
//   node scripts/fetch-swisstopo.mjs                          default addresses
//   node scripts/fetch-swisstopo.mjs "Bundesplatz 3 Bern"     arbitrary addresses
//   node scripts/fetch-swisstopo.mjs --file addresses.json   [{bbl_id, adresse}, ...]
//
// Results go to stdout and, with --output <path>, to a file. The German keys in
// the input and output records are a compatibility contract with the research
// snapshots consumed by apply-research-data.mjs.
//
// ATTRIBUTION: (c) Data: swisstopo (Federal Spatial Data Infrastructure) and
// official cadastral surveying by the cantons (geodienste.ch). Both APIs are
// keyless but require attribution; see section 8 of docs/swisstopo-api.md.

const FEDERAL_API = 'https://api3.geo.admin.ch/rest/services';
const CADASTRAL_WFS = 'https://geodienste.ch/db/av_0/deu';

// Fair use: 40 federal API requests per minute and only 10 WFS requests per
// minute at 1 MB. WFS is the bottleneck, hence the longer pause before it.
const FEDERAL_PAUSE_MS = 400;
const WFS_PAUSE_MS = 6500;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url, subject) {
  const response = await fetch(url, { headers: { 'User-Agent': 'bbl-service-portal-prototype/1.0 (demo data)' } });
  if (!response.ok) throw new Error(`${subject}: HTTP ${response.status}`);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${subject}: response is not JSON (${text.slice(0, 120)})`);
  }
}

// (A) Address to coordinates. The response's attrs.x is northing and attrs.y
// is easting, which is the reverse of their usual visual order.
async function geocode(address) {
  const url = `${FEDERAL_API}/api/SearchServer?searchText=${encodeURIComponent(address)}`
    + '&type=locations&origins=address&sr=2056&limit=1';
  const response = await getJson(url, 'SearchServer');
  const hit = (response.results || [])[0];
  if (!hit) return null;
  const attributes = hit.attrs;
  const label = String(attributes.label || '').replace(/<[^>]+>/g, '').trim();
  // Parse the German label into street, number, postcode, and place.
  const match = label.match(/^(.*?)\s+(\d+[a-zA-Z]?)\s+(\d{4})\s+(.+)$/);
  return {
    label,
    'strasse': match ? match[1] : label,
    'hausnummer': match ? match[2] : '',
    'plz': match ? match[3] : '',
    'ort': match ? match[4] : '',
    lat: attributes.lat,
    lon: attributes.lon,
    'lv95_e': attributes.y,
    'lv95_n': attributes.x,
    'egid_aus_suche': String(attributes.featureId || '').split('_')[0] || null,
  };
}

// (B) Federal Register of Buildings and Dwellings: EGID and characteristics.
async function loadBuildingRegister(lat, lon) {
  // tolerance > 0 requires mapExtent and imageDisplay. The service responds
  // with HTTP 400 if either is omitted; only tolerance=0 permits omission.
  const delta = 0.0005; // Approximately 50 m around the point.
  const extent = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  const url = `${FEDERAL_API}/api/MapServer/identify?geometry=${lon},${lat}`
    + '&geometryType=esriGeometryPoint&layers=all:ch.bfs.gebaeude_wohnungs_register'
    + `&sr=4326&tolerance=5&returnGeometry=false&mapExtent=${extent}&imageDisplay=100,100,96`;
  const response = await getJson(url, 'GWR');
  const result = (response.results || [])[0];
  if (!result) return null;
  const attributes = result.attributes || result.properties || {};
  return {
    egid: attributes.egid || null,
    'baujahr': attributes.gbauj || null,
    'geschosse': attributes.gastw || null,
    'grundflaeche': attributes.garea || null,
    'kategorie': attributes.gkat || null,
    status: attributes.gstat || null,
    'egrid_aus_gwr': attributes.egrid || null,
    'parzelle_aus_gwr': attributes.lparz || null,
    'gemeindenr': attributes.ggdenr || null,
  };
}

// (C1) Official cadastral survey: EGRID, parcel number, municipality number,
// canton, and WGS 84 polygon.
async function loadParcel(lat, lon) {
  const url = `${FEDERAL_API}/all/MapServer/identify?geometry=${lon},${lat}`
    + '&geometryType=esriGeometryPoint&layers=all:ch.swisstopo-vd.amtliche-vermessung'
    + '&sr=4326&tolerance=0&returnGeometry=true&geometryFormat=geojson';
  const response = await getJson(url, 'Official cadastral survey');
  const result = (response.results || [])[0];
  if (!result) return null;
  const properties = result.properties || result.attributes || {};
  return {
    egrid: properties.egris_egrid || null,
    'nummer': properties.number || properties.name || null,
    'bfsnr': properties.bfsnr || null,
    'kanton': properties.ak || null,
    identnd: properties.identnd || null,
    'geometrie': result.geometry || null,
  };
}

// (C2) Official area. The federal API omits this value, so it comes from the
// cantonal WFS. Filtering by EGRID selects exactly one real-estate parcel.
async function loadArea(egrid) {
  const filter = `<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0">`
    + `<fes:PropertyIsEqualTo><fes:ValueReference>EGRIS_EGRID</fes:ValueReference>`
    + `<fes:Literal>${egrid}</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>`;
  const url = `${CADASTRAL_WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms:RESF`
    + '&SRSNAME=urn:ogc:def:crs:EPSG::4326'
    + `&OUTPUTFORMAT=${encodeURIComponent('application/json; subtype=geojson')}`
    + `&FILTER=${encodeURIComponent(filter)}`;
  const response = await getJson(url, 'geodienste WFS');
  const feature = (response.features || [])[0];
  if (!feature) return null;
  const properties = feature.properties || {};
  return {
    'flaeche_m2': properties.Flaeche ?? null,
    'nummer': properties.Nummer ?? null,
    nbident: properties.NBIdent ?? null,
    'bfsnr': properties.BFSNr ?? null,
    'vollstaendigkeit': properties.Vollstaendigkeit ?? null,
    'geometrie': feature.geometry || null,
  };
}

const countVertices = (geometry) => {
  if (!geometry || !geometry.coordinates) return 0;
  const separators = JSON.stringify(geometry.coordinates).match(/\],\[/g);
  return separators ? separators.length + 1 : 0;
};

async function resolveEntry(entry) {
  const address = typeof entry === 'string' ? entry : entry['adresse'];
  const buildingId = typeof entry === 'string' ? null : entry['bbl_id'];
  const output = { 'bbl_id': buildingId, 'angefragt': address, 'fehler': [] };
  try {
    const geocoded = await geocode(address);
    if (!geocoded) {
      output['fehler'].push('address not found');
      return output;
    }
    Object.assign(output, geocoded);
    await sleep(FEDERAL_PAUSE_MS);

    try {
      output.gwr = await loadBuildingRegister(geocoded.lat, geocoded.lon);
    } catch (error) {
      output['fehler'].push('GWR: ' + error.message);
    }
    await sleep(FEDERAL_PAUSE_MS);

    try {
      output['parzelle'] = await loadParcel(geocoded.lat, geocoded.lon);
    } catch (error) {
      output['fehler'].push('cadastral survey: ' + error.message);
    }

    if (output['parzelle']?.egrid) {
      await sleep(WFS_PAUSE_MS);
      try {
        const area = await loadArea(output['parzelle'].egrid);
        if (area) {
          output['flaeche'] = area;
          output['parzelle']['geometrie'] = area['geometrie'] || output['parzelle']['geometrie'];
        } else {
          output['fehler'].push('WFS: no parcel found for EGRID');
        }
      } catch (error) {
        output['fehler'].push('WFS: ' + error.message);
      }
    }
  } catch (error) {
    output['fehler'].push(error.message);
  }
  return output;
}

// Command-line entry point. German flag spellings remain accepted as legacy
// compatibility values, while all documentation uses the English forms.
const args = process.argv.slice(2);
const outputFlagIndex = Math.max(args.indexOf('--output'), args.indexOf('--aus'));
const target = outputFlagIndex >= 0 ? args[outputFlagIndex + 1] : null;
if (outputFlagIndex >= 0) args.splice(outputFlagIndex, 2);
const fileFlagIndex = Math.max(args.indexOf('--file'), args.indexOf('--datei'));
let entries;
if (fileFlagIndex >= 0) {
  const { readFileSync } = await import('node:fs');
  entries = JSON.parse(readFileSync(args[fileFlagIndex + 1], 'utf8'));
} else if (args.length) {
  entries = args;
} else {
  entries = ['Bundesplatz 3 Bern', 'Papiermühlestrasse 172 Ittigen', 'Monbijoustrasse 40 Bern'];
}

const results = [];
for (const entry of entries) {
  const result = await resolveEntry(entry);
  results.push(result);
  const parcel = result['parzelle'] || {};
  const area = result['flaeche'] || {};
  const building = result.gwr || {};
  console.log(`${String(result['angefragt']).padEnd(34)} ${result.label || '-'}`);
  console.log(`   ${result.lat ? result.lat.toFixed(6) + ' / ' + result.lon.toFixed(6) : '-'}`
    + `  EGID ${building.egid || result['egid_aus_suche'] || '-'}  EGRID ${parcel.egrid || '-'}`
    + `  parcel ${parcel['nummer'] || '-'}  ${area['flaeche_m2'] != null ? area['flaeche_m2'] + ' m2' : '- m2'}`
    + `  BFS ${parcel['bfsnr'] || '-'}  polygon ${countVertices(parcel['geometrie'])} points`
    + (result['fehler'].length ? `\n   warning ${result['fehler'].join(' / ')}` : ''));
}

if (target) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(target, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${target}`);
}
