// Enforce the repository's code-language boundary without treating German UI
// copy, route/query values or raw data keys as implementation identifiers.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SOURCE_ROOTS = ['js', 'scripts', 'css'];
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.css']);

const FORBIDDEN_IDENTIFIERS = [
  'objekt', 'objekte', 'bauprojekt', 'mietverhaeltnis', 'dienstleistung',
  'anwendung', 'datensatz', 'vorgang', 'vorgaenge', 'dokument', 'prozess',
  'shopProdukt', 'shopWarenkorb', 'datum', 'dateiGroesse', 'katalog',
  'DIENSTLEISTUNGEN', 'DATEN', 'ANWENDUNGEN', 'LAND', 'land', 'landName',
  'weOf', 'veSlots', 'gebaeude', 'grundstueck', 'laenge', 'hoehe', 'breite',
  'zeilen', 'spalten', 'pruefen', 'bilder', 'quellen', 'architekt', 'nutzer',
  'flaeche', 'parzelle', 'bericht', 'fehlend', 'treffer', 'vorher',
  'zurueck', 'auswahl', 'anzahl', 'wert', 'werte', 'titel', 'inhalt', 'liste',
  'seite', 'seiten', 'zeile', 'spalte', 'quelle', 'bild', 'datei', 'ordner',
  'eintrag', 'eintraege', 'ergebnis', 'ergebnisse', 'fehler', 'versuch', 'laden',
  'schreiben', 'ziel', 'echt', 'platz', 'favoriten', 'umbenennen', 'adresse',
  'adressen', 'nummer', 'kanton', 'geometrie', 'vollstaendigkeit', 'gemeinde',
  'gemeindenr', 'strasse', 'hausnummer', 'ort', 'plz', 'baujahr', 'geschosse',
  'grundflaeche', 'kategorie', 'beschreibung', 'dringlichkeit', 'termin',
  'begruendung', 'uebersicht', 'diagramm', 'schritte', 'raeume', 'raum',
  'geschoss', 'gewaehlt', 'sichtbar', 'offen', 'geschlossen', 'aktiv',
  'markiert', 'summe', 'wurzeln', 'blaetter', 'nachher', 'halter', 'knopf',
  'karte', 'karten', 'luecke', 'buendig', 'reiter', 'reiterleiste', 'meldung',
  'referenz', 'erfolg', 'knoepfe', 'felder', 'setzen', 'setz', 'zaehler',
  'breiten', 'soll', 'ist', 'unbekannt', 'schlaf', 'mietende', 'weisung',
  'raumbuchung', 'belegung', 'stoerung', 'stoerungsmeldung', 'beschaffung',
  'publikation', 'mediathek', 'ausstattung', 'kosten', 'kontakte', 'flaechen',
  'vertraege', 'kennzahlen', 'metadaten', 'grundriss', 'grundrisse',
];

const FORBIDDEN_IDENTIFIER_PARTS = [
  'objekt', 'bauprojekt', 'mietverhaeltnis', 'dienstleistung', 'anwendung',
  'datensatz', 'vorgang', 'dokument', 'prozess', 'katalog', 'gebaeude',
  'grundstueck', 'flaeche', 'parzelle', 'weisung', 'raumbedarf',
  'stoerungsmeldung', 'raumbuchung', 'datum', 'datei', 'laenge', 'hoehe',
  'breite', 'zeile', 'spalte', 'bilder', 'quellen', 'nutzer', 'treffer',
  'zurueck', 'auswahl', 'anzahl', 'titel', 'inhalt', 'liste', 'seite',
  'quelle', 'bild', 'ordner', 'eintrag', 'ergebnis', 'fehler', 'adresse',
  'geometrie', 'vollstaendigkeit', 'gemeinde', 'strasse', 'hausnummer',
  'baujahr', 'geschoss', 'grundflaeche', 'kategorie', 'beschreibung',
  'dringlichkeit', 'termin', 'begruendung', 'uebersicht', 'diagramm',
  'schritt', 'raum', 'sichtbar', 'markiert', 'summe', 'wurzel', 'blatt',
  'nachher', 'halter', 'knopf', 'karte', 'luecke', 'reiter', 'meldung',
  'referenz', 'erfolg', 'feld', 'zaehler',
];

const FORBIDDEN_HOOKS = [
  'fp-vollbild', 'fp-drucken', 'fp-zurueck',
  'bc-bez', 'bc-gebart', 'bc-baujahr',
  'mt-dt-vertraege', 'mt-dt-vertrag', 'mt-dt-geschosse',
  'mt-dt-vorgaenge', 'mt-dt-vorgang', 'mt-grundriss__body',
  'pf-dt-flaechen', 'pf-dt-ausstattung', 'pf-dt-vertraege',
  'pf-dt-kosten', 'pf-dt-kontakte', 'pf-dt-dokumente',
  'pf-card__land', 'data-we', 'fp-ve',
];

// Stable German route/query values remain quoted compatibility data, but they
// must not leak back into internal tab/panel identifiers.
const FORBIDDEN_INTERNAL_HOOK_VALUES = [
  'uebersicht', 'ueberblick', 'flaechen', 'ausstattung', 'vertraege',
  'kosten', 'dokumente', 'kontakte', 'bodenbedeckung', 'grundriss',
  'grundrisse', 'vertrag', 'metadaten', 'kennzahlen', 'diagramm',
  'schritte', 'gebaeude', 'grundstuecke', 'entwicklung', 'energiepfad',
  'vergleich', 'felder', 'realisierung',
];

const GERMAN_COMMENT = new RegExp(
  String.raw`(?:[äöüÄÖÜß]|\b(?:der|die|das|den|dem|des|ein(?:e|en|em|er|es)?|`
  + String.raw`und|oder|nicht|nur|bei|beim|mit|ohne|wenn|dann|damit|darum|sonst|`
  + String.raw`wird|werden|wurde|wurden|für|zur|zum|auf|aus|über|unter|vor|nach|`
  + String.raw`bereits|bleibt|muss|soll|kann|kein(?:e|en|em|er|es)?|jede(?:r|s)?|`
  + String.raw`alle|dies(?:e|er|es)|vorgang|liegenschaft|wirtschaftseinheit|weisung|`
  + String.raw`raumbedarf|störungsmeldung|gebäude|grundstück|mietverhältnis|`
  + String.raw`dienstleistung|anwendung|datensatz|bild|suche|seite|fehler|zurück)\b)`,
  'iu',
);

// English comments may identify a quoted compatibility term or provide the one
// requested German-domain gloss. The prose surrounding that term still has to
// be English.
const COMMENT_TERM_EXEMPTION = /(?:German UI(?: term)?|raw (?:field|key)|compatibility (?:value|key|field)|route value|query value|tab value|persisted (?:key|value))\s*[:`]/iu;
const COMMENT_RE = /\/\*[\s\S]*?\*\/|(?<!:)\/\/[^\r\n]*/g;

function listFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const rel = relative(ROOT, path).replaceAll('\\', '/');
    if (rel === 'js/vendor' || rel.startsWith('js/vendor/')) continue;
    if (statSync(path).isDirectory()) files.push(...listFiles(path));
    else if (SOURCE_EXTENSIONS.has(extname(path))) files.push(path);
  }
  return files;
}

function lineAt(source, offset) {
  return source.slice(0, offset).split(/\r?\n/).length;
}

function mask(source, pattern) {
  return source.replace(pattern, (value) => value.replace(/[^\r\n]/g, ' '));
}

function maskJavaScriptLiterals(source) {
  const input = source;
  // String indices are UTF-16 code units; split('') preserves that indexing
  // even when earlier UI literals contain astral symbols.
  const output = input.split('');
  const blank = (index) => {
    if (input[index] !== '\r' && input[index] !== '\n') output[index] = ' ';
  };

  const scanQuoted = (start, quote) => {
    blank(start);
    let index = start + 1;
    while (index < input.length) {
      const character = input[index];
      blank(index);
      if (character === '\\') {
        index++;
        if (index < input.length) blank(index);
      } else if (character === quote) {
        return index + 1;
      }
      index++;
    }
    return index;
  };

  const scanLineComment = (start) => {
    let index = start;
    while (index < input.length && input[index] !== '\r' && input[index] !== '\n') blank(index++);
    return index;
  };

  const scanBlockComment = (start) => {
    let index = start;
    while (index < input.length) {
      blank(index);
      if (input[index] === '*' && input[index + 1] === '/') {
        blank(index + 1);
        return index + 2;
      }
      index++;
    }
    return index;
  };

  const scanExpression = (start) => {
    let depth = 1;
    let index = start;
    while (index < input.length) {
      const character = input[index];
      if (character === '/' && input[index + 1] === '/') {
        index = scanLineComment(index);
        continue;
      }
      if (character === '/' && input[index + 1] === '*') {
        index = scanBlockComment(index);
        continue;
      }
      if (character === "'" || character === '"') {
        index = scanQuoted(index, character);
        continue;
      }
      if (character === '`') {
        index = scanTemplate(index);
        continue;
      }
      if (character === '{') depth++;
      if (character === '}' && --depth === 0) {
        blank(index);
        return index + 1;
      }
      index++;
    }
    return index;
  };

  function scanTemplate(start) {
    blank(start);
    let index = start + 1;
    while (index < input.length) {
      const character = input[index];
      if (character === '\\') {
        blank(index++);
        if (index < input.length) blank(index++);
        continue;
      }
      if (character === '`') {
        blank(index);
        return index + 1;
      }
      if (character === '$' && input[index + 1] === '{') {
        blank(index);
        blank(index + 1);
        index = scanExpression(index + 2);
        continue;
      }
      blank(index++);
    }
    return index;
  }

  let index = 0;
  while (index < input.length) {
    const character = input[index];
    if (character === '/' && input[index + 1] === '/') index = scanLineComment(index);
    else if (character === '/' && input[index + 1] === '*') index = scanBlockComment(index);
    else if (character === "'" || character === '"') index = scanQuoted(index, character);
    else if (character === '`') index = scanTemplate(index);
    else index++;
  }
  return output.join('');
}

const violations = [];
const sourceFiles = SOURCE_ROOTS.flatMap((root) => listFiles(join(ROOT, root)));
sourceFiles.push(join(ROOT, 'index.html'));

for (const file of sourceFiles) {
  const source = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file).replaceAll('\\', '/');

  for (const match of source.matchAll(COMMENT_RE)) {
    const comment = match[0];
    if (GERMAN_COMMENT.test(comment) && !COMMENT_TERM_EXEMPTION.test(comment)) {
      violations.push(`${rel}:${lineAt(source, match.index)} German comment/JSDoc`);
    }
  }

  if (file.endsWith('.js') || file.endsWith('.mjs')) {
    const code = maskJavaScriptLiterals(source);
    for (const identifier of FORBIDDEN_IDENTIFIERS) {
      const pattern = new RegExp(String.raw`\b${identifier}\b`, 'gu');
      for (const match of code.matchAll(pattern)) {
        violations.push(`${rel}:${lineAt(source, match.index)} forbidden identifier ${identifier}`);
      }
    }

    for (const part of FORBIDDEN_IDENTIFIER_PARTS) {
      const capitalised = part[0].toUpperCase() + part.slice(1);
      const patterns = [
        new RegExp(String.raw`\b${part}(?=[A-Z_])`, 'gu'),
        new RegExp(String.raw`(?<=[A-Za-z0-9_$])${capitalised}(?=[A-Z_]|\b)`, 'gu'),
      ];
      for (const pattern of patterns) {
        for (const match of code.matchAll(pattern)) {
          violations.push(`${rel}:${lineAt(source, match.index)} forbidden identifier part ${match[0]}`);
        }
      }
    }

    if (rel.startsWith('scripts/')) {
      source.split(/\r?\n/).forEach((line, index) => {
        if (/(?:console\.(?:log|warn|error)|throw new Error|new Error)\s*\(/.test(line)
          && GERMAN_COMMENT.test(line)) {
          violations.push(`${rel}:${index + 1} German developer-facing diagnostic`);
        }
      });
    }

    if (rel !== 'scripts/check-english-code.mjs') {
      for (const value of FORBIDDEN_INTERNAL_HOOK_VALUES) {
        const pattern = new RegExp(String.raw`\bid\s*:\s*(['"])${value}\1`, 'gu');
        for (const match of source.matchAll(pattern)) {
          violations.push(`${rel}:${lineAt(source, match.index)} forbidden internal hook value ${value}`);
        }
      }
    }
  }

  if (rel !== 'scripts/check-english-code.mjs') {
    const hookSource = mask(source, COMMENT_RE);
    for (const hook of FORBIDDEN_HOOKS) {
      const offset = hookSource.indexOf(hook);
      if (offset !== -1) violations.push(`${rel}:${lineAt(source, offset)} forbidden DOM/CSS hook ${hook}`);
    }
  }
}

const uniqueViolations = [...new Set(violations)];

if (uniqueViolations.length) {
  console.error(`English-code check failed (${uniqueViolations.length} findings):`);
  uniqueViolations.forEach((violation) => console.error(`- ${violation}`));
  process.exitCode = 1;
} else {
  console.log(`English-code check passed (${sourceFiles.length} maintained source files).`);
}
