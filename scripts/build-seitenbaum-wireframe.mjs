// Injects the CD-kompakt fonts and token block into the tree wireframe, so the
// styling is byte-for-byte the one that file already carries.
import { readFileSync, writeFileSync } from 'node:fs';

const SP = 'c:/Users/david/Documents/GitHub/service-portal/';
const DS = 'C:/Users/david/Documents/GitHub/designsystem/';
const SRC = SP + 'docs/wireframes/260813 - Katalog mit Reitern_CD-kompakt.html';
const OUT = SP + 'docs/wireframes/260814 - Seitenbaum als Bauteil.html';
const TPL = 'C:/Users/david/AppData/Local/Temp/claude/c--Users-david-Documents-GitHub-service-portal/'
  + '58c1a3f6-de33-405c-92eb-8a001c38b2d0/scratchpad/tree-wf.html';

const src = readFileSync(SRC, 'utf8');
const tokens = src.slice(src.indexOf(':root{'), src.indexOf('*{box-sizing:border-box}'));

const face = (file, weight) => '@font-face{font-family:"Noto Sans";font-style:normal;'
  + 'font-weight:' + weight + ';font-display:swap;src:url(data:font/ttf;base64,'
  + readFileSync(DS + 'dist/fonts/' + file, 'base64') + ') format("truetype")}';
const fonts = face('NotoSans-Regular.ttf', 400) + face('NotoSans-Bold.ttf', 700);

let html = readFileSync(TPL, 'utf8')
  .replace('/*FONTS*/', fonts)
  .replace('/*TOKENS*/', tokens);

// The script must parse, or the page renders as a static skeleton with no hint
// why — the failure mode that cost an afternoon on the last wireframe.
const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
writeFileSync(SP + 'scripts/.tmp-tree-wf-check.mjs', script);

writeFileSync(OUT, html);
console.log('geschrieben: ' + OUT);
console.log('  ' + Math.round(html.length / 1024) + ' KB, davon Schrift '
  + Math.round(fonts.length / 1024) + ' KB');
