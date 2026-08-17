import {
  download, fileSlug, rowsToCsv, tableToXls,
} from '../export.js';

export const toCsv = (table) => `${rowsToCsv([table.head, ...table.rows])}\r\n`;

export function toXls(table) {
  const element = document.createElement('table');
  const appendRow = (values, cellName) => {
    const row = document.createElement('tr');
    values.forEach((value) => {
      const cell = document.createElement(cellName);
      cell.textContent = String(value == null ? '' : value);
      row.appendChild(cell);
    });
    element.appendChild(row);
  };
  appendRow(table.head, 'th');
  table.rows.forEach((row) => appendRow(row, 'td'));
  return tableToXls(element, table.name);
}

export const slug = (value, fallback = 'export') => fileSlug(String(value == null ? '' : value)
  .toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss'), fallback);

export function runTableExport(action, table, basename) {
  if (action === 'pdf') {
    window.print();
    return true;
  }
  if (action === 'csv') {
    download(toCsv(table), `${basename}.csv`, 'text/csv;charset=utf-8');
    return true;
  }
  if (action === 'excel') {
    download(toXls(table), `${basename}.xls`, 'application/vnd.ms-excel;charset=utf-8');
    return true;
  }
  return false;
}
