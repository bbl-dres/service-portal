// Spreadsheet exports have a second interpretation context after HTML/CSV
// escaping: office applications execute formula-looking cell values. This
// pure-Node probe uses a small DOM-shaped table to lock the neutralisation
// contract without introducing a browser or DOM dependency.
import { rowsToCsv, tableToCsv, tableToXls } from '../js/export.js';

let failures = 0;
const check = (condition, label, actual = '') => {
  console.log(`${condition ? '✓' : '✗'} ${label}${actual ? ` (${actual})` : ''}`);
  if (!condition) failures++;
};

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

class Cell {
  constructor(tag, text, markup = '') {
    this.tag = tag;
    this._text = text;
    this.markup = markup;
  }

  get textContent() { return this._text; }
  set textContent(value) { this._text = String(value); this.markup = ''; }
  clone() { return new Cell(this.tag, this._text, this.markup); }
  get outerHTML() {
    return `<${this.tag}>${this.markup || escapeHtml(this._text)}</${this.tag}>`;
  }
}

class Row {
  constructor(cells) { this.cells = cells; }
  querySelectorAll(selector) { return selector === 'th,td' ? this.cells : []; }
  clone() { return new Row(this.cells.map((cell) => cell.clone())); }
  get outerHTML() { return `<tr>${this.cells.map((cell) => cell.outerHTML).join('')}</tr>`; }
}

class Table {
  constructor(rows) { this.rows = rows; }
  querySelectorAll(selector) {
    if (selector === 'tr') return this.rows;
    if (selector === 'th,td') return this.rows.flatMap((row) => row.cells);
    return [];
  }
  cloneNode() { return new Table(this.rows.map((row) => row.clone())); }
  get outerHTML() { return `<table>${this.rows.map((row) => row.outerHTML).join('')}</table>`; }
}

const table = new Table([
  new Row([new Cell('th', 'Value'), new Cell('th', 'Safe')]),
  new Row([new Cell('td', '=HYPERLINK("https://attacker.invalid")'), new Cell('td', '-123.45')]),
  new Row([new Cell('td', '+cmd'), new Cell('td', 'ordinary text')]),
  new Row([new Cell('td', '-1+2'), new Cell('td', 'semi;colon')]),
  new Row([new Cell('td', '@SUM(A1:A2)'), new Cell('td', '<literal>')]),
  new Row([new Cell('td', '\t=WEBSERVICE("https://attacker.invalid")'),
    new Cell('td', '=linked', '<a href="javascript:alert(1)">=linked</a>')]),
]);

const csv = tableToCsv(table);
check(csv.startsWith('\ufeff'), 'CSV retains its UTF-8 BOM');
check(csv.includes(`'=HYPERLINK`) && csv.includes(`'+cmd`)
  && csv.includes(`'-1+2`) && csv.includes(`'@SUM`) && csv.includes(`'=WEBSERVICE`),
  'CSV neutralises formula-leading and control-prefixed cells');
check(csv.includes('-123.45') && !csv.includes("'-123.45"),
  'plain negative numbers remain ordinary values');
check(csv.includes('"semi;colon"'), 'CSV delimiter quoting remains intact');

const matrixCsv = rowsToCsv([['Object', 'Name'], ['=WEBSERVICE("https://attacker.invalid")', '+cmd']]);
check(matrixCsv.includes(`'=WEBSERVICE`) && matrixCsv.includes(`'+cmd`),
  'non-table CSV exports use the same neutralisation boundary');
check(rowsToCsv([['A', 'B']], { quoteAll: true }).includes('"A";"B"'),
  'callers can preserve an existing quote-all CSV contract');

const xls = tableToXls(table, 'A&B/<quarter>');
check(xls.includes(`'=HYPERLINK`) && xls.includes(`'+cmd`)
  && xls.includes(`'-1+2`) && xls.includes(`'@SUM`) && xls.includes(`'=WEBSERVICE`),
  'HTML-XLS neutralises the same formula families');
check(!xls.includes('javascript:') && !xls.includes('<a '),
  'HTML-XLS removes data-controlled markup and active links');
check(xls.includes('&lt;literal&gt;'), 'HTML-XLS escapes cell text after removing markup');
check(xls.includes('<x:Name>A&amp;B&lt;quarter&gt;</x:Name>'),
  'worksheet names are length-limited, cleaned, and XML-escaped');

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
