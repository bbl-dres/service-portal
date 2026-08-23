// Builds docs/wireframes/260814 - Page Tree Component.html from its source
// template, injecting three things:
//   · the CD-kompakt font and colour tokens, so the study looks like the app;
//   · REAL data out of data/*.json, so the trees are the portal's own and not a
//     fixture that flatters the design. A hand-written fixture had every branch
//     the same shape and every leaf the same depth, which is exactly the tree a
//     layout survives by accident;
//   · nothing else — the template is the artefact and stays editable.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const SP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PICK = {
  // One root-to-selection path per example.
  portfolio: ['Schweiz', 'BE', 'Bern', 'WE 4840'],
  shop: ['Stühle', 'Fauteuil'],
  planeditor: ['Schweiz', 'Bern'],
  process: ['Bewirtschaftung'],
};
// Override when the design-system checkout is not a sibling of this repository.
const DS = resolve(process.env.BBL_DESIGN_SYSTEM_ROOT || join(SP, '..', 'designsystem'));
const SRC = join(SP, 'docs', 'wireframes', '260813 - Catalogue Tabs_CD-compact.html');
const TPL = join(SP, 'scripts', 'seitenbaum-wireframe.src.html');
const OUT = join(SP, 'docs', 'wireframes', '260814 - Page Tree Component.html');

const json = (file) => JSON.parse(readFileSync(join(SP, 'data', file), 'utf8'));
const list = (v) => (Array.isArray(v) ? v : Object.values(v)[0]);
const de = (a, b) => String(a).localeCompare(String(b), 'de');

// --- 1. Properties: flat records grouped along four spatial axes ------------
function portfolio() {
  const rows = json('buildings.geojson').features.map((f) => f.properties);
  const COUNTRY_NAMES = { CH: 'Schweiz', DE: 'Deutschland', US: 'USA', JP: 'Japan', BR: 'Brasilien', AU: 'Australien' };
  const by = (items, key) => items.reduce((m, x) => {
    (m[x[key]] = m[x[key]] || []).push(x); return m;
  }, {});
  const nest = (items, keys, icons, path) => {
    if (!keys.length) {
      return items.sort((a, b) => de(a.bbl_id, b.bbl_id)).map((o) => ({
        id: 'o-' + o.bbl_id, icon: 'house',
        label: o.bbl_id + ' ' + (o.bbl_bez || ''),
      }));
    }
    const [key, ...rest] = keys;
    const [icon, ...restIcons] = icons;
    const groups = by(items, key);
    return Object.keys(groups).sort(de).map((k) => ({
      id: path + '-' + k, icon,
      label: key === 'adr_land' ? (COUNTRY_NAMES[k] || k) : key === 'bbl_we' ? 'WE ' + k : k,
      count: groups[k].length,
      children: nest(groups[k], rest, restIcons, path + '-' + k),
    }));
  };
  return nest(rows, ['adr_land', 'adr_reg', 'adr_ort', 'bbl_we'],
    ['globe', 'pin', 'house', 'stack'], 'pf');
}

// --- 2. Shop: recursive, arbitrary depth -----------------------------------
function shop() {
  const cats = list(json('shop-categories.json'));
  const products = list(json('shop-products.json'));
  const countIn = (id) => products.filter((p) => (p.categories || [p.category]).includes(id)).length;
  // Category children are nested records, not identifier references.
  const build = (c) => {
    const kids = (c.children || []).map(build);
    return {
      id: 'shop-' + c.id, label: c.label,
      // Counts indicate undisclosed content and therefore belong on branches only.
      count: kids.length ? (countIn(c.id) || kids.length) : null,
      children: kids.length ? kids : undefined,
    };
  };
  return cats.map(build);
}

// --- 3. Metadata catalogue: hierarchy with lazily shown record fields -------
function catalog() {
  const objects = list(json('business-objects.json'));
  const tables = list(json('data-tables.json'));
  const domains = list(json('reference-data.json').dataDomains || []);
  const domLabel = (k) => (domains.find((d) => d.key === k) || {}).label || k;

  const groupBy = (items, key) => items.reduce((m, x) => {
    (m[x[key]] = m[x[key]] || []).push(x); return m;
  }, {});

  const objTree = Object.entries(groupBy(objects, 'domain'))
    .sort((a, b) => de(domLabel(a[0]), domLabel(b[0])))
    .map(([k, items]) => ({
      id: 'dom-' + k, label: domLabel(k), count: items.length,
      children: items.map((o) => ({
        id: 'bo-' + o.objectId, label: o.name, count: (o.attributes || []).length,
        split: true, lazy: (o.attributes || []).map((a) => a.name),
      })),
    }));

  const sysTree = Object.entries(groupBy(tables, 'systemName'))
    .sort((a, b) => de(a[0], b[0]))
    .map(([k, items]) => ({
      id: 'sys-' + k.replace(/\W+/g, '-'), label: k, count: items.length,
      children: items.map((t) => ({
        id: 'dt-' + t.tableId, label: t.displayName || t.name, count: (t.fields || []).length,
        split: true, lazy: (t.fields || []).map((f) => f.name),
      })),
    }));

  const ref = json('reference-data.json');
  const REF = [
    ['Katalog und Metadaten', ['objectStatuses', 'classificationTiers', 'mappingMatches', 'dataDomains']],
    ['Bauwerk und Liegenschaft', ['gebaeudearten', 'buildingStatuses', 'teilportfolios']],
  ];
  const refTree = REF.map(([theme, keys]) => ({
    id: 'th-' + theme.replace(/\W+/g, '-'), label: theme, count: keys.length,
    children: keys.map((key) => {
      const values = ref[key] || [];
      return {
        id: 'rl-' + key, label: key, count: values.length, split: true,
        lazy: values.map((v) => String(v.label || v.name || v.id || v.key || v)),
      };
    }),
  }));

  return [
    [{ id: 'kat-root', label: 'Katalog', icon: 'grid',
      count: objects.length + tables.length + REF.reduce((s, r) => s + r[1].length, 0) }],
    [
      { id: 'kat-obj', label: 'Geschäftsobjekte', icon: 'grid', count: objects.length, children: objTree },
      { id: 'kat-sys', label: 'Systeme', icon: 'db', count: tables.length, children: sysTree },
      { id: 'kat-ref', label: 'Referenzdaten', icon: 'list',
        count: REF.reduce((s, r) => s + r[1].length, 0), children: refTree },
    ],
  ];
}

// --- 4. Plan Editor: floors extend one level below each building ------------
function planeditor() {
  const rows = json('buildings.geojson').features.map((f) => f.properties)
    .filter((b) => b.adr_land === 'CH');
  const floors = list(json('floors.json'));
  const forBuilding = (id) => floors.filter((f) => f.buildingId === id || f.bbl_id === id);
  const by = (items, key) => items.reduce((m, x) => {
    (m[x[key]] = m[x[key]] || []).push(x); return m;
  }, {});
  const cities = by(rows, 'adr_ort');
  return [{
    id: 'pe-ch', label: 'Schweiz', icon: 'globe', count: rows.length,
    children: Object.keys(cities).sort(de).map((city) => ({
      id: 'pe-' + city, label: city, icon: 'pin', count: cities[city].length,
      children: cities[city].map((b) => {
        const fl = forBuilding(b.bbl_id);
        return {
          id: 'pe-b-' + b.bbl_id, label: b.bbl_bez || b.bbl_id, icon: 'house',
          count: fl.length || null, split: fl.length > 0,
          children: fl.length
            ? fl.map((f) => ({ id: 'pe-f-' + b.bbl_id + '-' + (f.floorId || f.level),
              label: f.label || f.name || ('Geschoss ' + f.level), icon: 'layer' }))
            : undefined,
        };
      }),
    })),
  }];
}

// --- 5. Process documentation: two levels ----------------------------------
function processTree() {
  const procs = list(json('processes.json'));
  // groupLabel is the real grouping axis; areaLabel has only one value.
  const by = procs.reduce((m, p) => {
    (m[p.groupLabel] = m[p.groupLabel] || []).push(p); return m;
  }, {});
  return Object.keys(by).sort(de).map((area) => ({
    id: 'pr-' + area.replace(/\W+/g, '-'), label: area, count: by[area].length,
    children: by[area].map((p) => ({ id: 'pr-p-' + p.processId, label: p.name })),
  }));
}

// Mark one path and its target per example. Selecting a table must not expand
// all of its potentially dozens of fields into the surrounding filter bar.
function mark(nodes, path) {
  if (!path.length) return false;
  for (const node of nodes) {
    const hit = node.label === path[0] || node.id === path[0];
    if (!hit) continue;
    if (path.length === 1) { node.state = 'active'; return true; }
    if (Array.isArray(node.children) && mark(node.children, path.slice(1))) {
      node.state = 'path';
      return true;
    }
  }
  return false;
}

const DATA = {
  portfolio: portfolio(),
  shop: shop(),
  // Quoted keys are the wireframe template's persisted case contract.
  'katalog': catalog(),
  planeditor: planeditor(),
  'prozess': processTree(),
};

mark(DATA.portfolio, PICK.portfolio);
mark(DATA.shop, PICK.shop);
mark(DATA.planeditor, PICK.planeditor);
mark(DATA['prozess'], PICK.process);
// Select a catalogue table while leaving its field list collapsed.
mark(DATA['katalog'][1], ['Systeme', 'GIS IMMO', 'Gebäude']);

// --- Compose the standalone wireframe --------------------------------------
const src = readFileSync(SRC, 'utf8');
const tokens = src.slice(src.indexOf(':root{'), src.indexOf('*{box-sizing:border-box}'));
const face = (file, weight) => '@font-face{font-family:"Noto Sans";font-style:normal;'
  + 'font-weight:' + weight + ';font-display:swap;src:url(data:font/ttf;base64,'
  + readFileSync(join(DS, 'dist', 'fonts', file), 'base64') + ') format("truetype")}';
const fonts = face('NotoSans-Regular.ttf', 400) + face('NotoSans-Bold.ttf', 700);

const html = readFileSync(TPL, 'utf8')
  .replace('/*FONTS*/', fonts)
  .replace('/*TOKENS*/', tokens)
  .replace('/*DATA*/', 'const DATA = ' + JSON.stringify(DATA) + ';');

// The embedded script must parse, or the page renders as a static skeleton with
// no hint why — the failure mode that cost an afternoon on an earlier wireframe.
const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
new Script(script, { filename: 'seitenbaum-wireframe.inline.js' });

writeFileSync(OUT, html);
const n = (t) => (Array.isArray(t) ? t : []).length;
console.log('written: ' + OUT);
console.log('  ' + Math.round(html.length / 1024) + ' KB, including fonts '
  + Math.round(fonts.length / 1024) + ' KB');
console.log('  real data: properties ' + n(DATA.portfolio) + ' countries · shop '
  + n(DATA.shop) + ' roots · catalogue ' + DATA['katalog'].length + ' sections · Plan Editor '
  + n(DATA.planeditor) + ' · processes ' + n(DATA['prozess']) + ' groups');
