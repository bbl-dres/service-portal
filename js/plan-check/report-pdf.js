// PDF check report. Structure follows the reference checker
// (bbl-dres/plan-check): cover with facts and KPI cards, a linked table of
// contents, then one chapter per register, with a plan snapshot above the
// registers that describe geometry.
//
// jsPDF and its AutoTable plugin are loaded on demand through the portal's
// SRI-pinned external-asset loader — the same path Swagger UI, MapLibre and
// bpmn-js already use. Nothing is fetched until someone asks for a PDF, and the
// DWG itself never leaves the browser.

import { loadExternalAssets } from '../core/external-assets.js';
import { fileSlug } from '../export.js';
import { DASH, planCheckReportModel } from './report-model.js';

const JSPDF_VERSION = '2.5.2';
const AUTOTABLE_VERSION = '3.8.4';

const JSPDF_ASSETS = {
  key: 'jspdf',
  globalName: 'jspdf',
  script: {
    url: `https://unpkg.com/jspdf@${JSPDF_VERSION}/dist/jspdf.umd.min.js`,
    integrity: 'sha384-en/ztfPSRkGfME4KIm05joYXynqzUgbsG5nMrj/xEFAHXkeZfO3yMK8QQ+mP7p1/',
  },
  messages: {
    timeout: 'Zeitüberschreitung beim Laden des PDF-Moduls',
    script: 'Das PDF-Modul konnte nicht geladen werden',
    global: 'jsPDF fehlt',
  },
};

const AUTOTABLE_ASSETS = {
  key: 'jspdf-autotable',
  globalName: 'jspdf',
  script: {
    url: `https://unpkg.com/jspdf-autotable@${AUTOTABLE_VERSION}/dist/jspdf.plugin.autotable.min.js`,
    integrity: 'sha384-Xl/CUCfJbzsngMp0CFxkmF0VW/8C160IsGujqeQlIhaGxKz2+JsIGORFqtCPeldF',
  },
  messages: {
    timeout: 'Zeitüberschreitung beim Laden des PDF-Tabellenmoduls',
    script: 'Das PDF-Tabellenmodul konnte nicht geladen werden',
    global: 'jsPDF AutoTable fehlt',
  },
};

// CD Bund palette, expressed as the RGB triples jsPDF needs. These mirror the
// design tokens; the PDF has no stylesheet to read them from.
const INK = [31, 41, 55];
const MUTED = [75, 85, 99];
const LINE = [229, 231, 235];
const ACCENT = [37, 99, 235];
const ACCENT_BG = [239, 246, 255];
const ZEBRA = [248, 250, 252];
const ERROR = [153, 25, 30];
const WARNING = [154, 52, 18];
const SUCCESS = [6, 95, 70];

const PAGE = Object.freeze({ width: 210, height: 297, margin: 14 });
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const RIGHT = PAGE.width - PAGE.margin;

export async function loadPdfEngine() {
  await loadExternalAssets(JSPDF_ASSETS);
  const namespace = await loadExternalAssets(AUTOTABLE_ASSETS);
  const constructor = namespace?.jsPDF;
  if (typeof constructor !== 'function') throw new Error('jsPDF fehlt');
  return constructor;
}

function statusColor(label) {
  if (label === 'Fehler' || label === 'Abgebrochen') return ERROR;
  if (label === 'Warnung') return WARNING;
  if (label === 'Bestanden') return SUCCESS;
  return MUTED;
}

/**
 * Render the report. `snapshot(mode)` returns a PNG data URL of the plan in the
 * given register, or an empty string when no canvas is available — a report
 * without pictures is still a complete report.
 */
export async function buildPlanCheckPdf(result, { snapshot = () => '', generatedAt = new Date() } = {}) {
  const JsPDF = await loadPdfEngine();
  const model = planCheckReportModel(result, { generatedAt });
  // `compress` flate-compresses the content streams. A plan snapshot is line
  // art, which compresses by an order of magnitude: 6.4 MB became 157 KB.
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  const tableBase = {
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2.6, right: 2.6 },
      lineColor: LINE,
      lineWidth: 0.2,
      textColor: INK,
      overflow: 'linebreak',
    },
    headStyles: { fillColor: ACCENT_BG, textColor: ACCENT, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ZEBRA },
    margin: { left: PAGE.margin, right: PAGE.margin },
  };

  const statusCell = (columnIndex) => (data) => {
    if (data.section !== 'body' || data.column.index !== columnIndex) return;
    data.cell.styles.textColor = statusColor(String(data.cell.raw));
  };

  function chapterHeader(title) {
    doc.setFillColor(...ACCENT);
    doc.rect(PAGE.margin, 8, CONTENT_WIDTH, 0.6, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(model.title, PAGE.margin, 13);
    doc.text(model.file.name, RIGHT, 13, { align: 'right', maxWidth: CONTENT_WIDTH * 0.6 });
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.setFont(undefined, 'bold');
    doc.text(title, PAGE.margin, 22);
    doc.setFont(undefined, 'normal');
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(PAGE.margin, 24, RIGHT, 24);
    return 30;
  }

  function subtitle(label, y) {
    doc.setFillColor(...ACCENT_BG);
    doc.rect(PAGE.margin, y - 4.5, CONTENT_WIDTH, 7, 'F');
    doc.setFontSize(9);
    doc.setTextColor(...ACCENT);
    doc.setFont(undefined, 'bold');
    doc.text(label, PAGE.margin + 2.5, y);
    doc.setFont(undefined, 'normal');
    return y + 6.5;
  }

  function addSnapshot(mode, y, maximumHeight) {
    const image = snapshot(mode);
    if (!image) return y;
    let properties = null;
    try { properties = doc.getImageProperties(image); } catch { return y; }
    if (!properties?.width || !properties?.height) return y;
    const aspect = properties.height / properties.width;
    let width = CONTENT_WIDTH;
    let height = width * aspect;
    if (height > maximumHeight) { height = maximumHeight; width = height / aspect; }
    const offsetX = (CONTENT_WIDTH - width) / 2;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.rect(PAGE.margin + offsetX, y, width, height);
    doc.addImage(image, 'PNG', PAGE.margin + offsetX + 0.3, y + 0.3, width - 0.6, height - 0.6);
    return y + height + 6;
  }

  function noteBlock(lines, y) {
    if (!lines.length) return y;
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    let cursor = y;
    for (const line of lines) {
      const wrapped = doc.splitTextToSize(line, CONTENT_WIDTH);
      doc.text(wrapped, PAGE.margin, cursor);
      cursor += wrapped.length * 3.6 + 2;
    }
    return cursor;
  }

  // ── Cover ────────────────────────────────────────────────────────────────
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.setFont(undefined, 'bold');
  doc.text(model.title, PAGE.margin, 24);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(doc.splitTextToSize(model.file.name, CONTENT_WIDTH), PAGE.margin, 32);
  doc.text(`Erstellt am ${model.generatedAtLabel}`, PAGE.margin, 38);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.6);
  doc.line(PAGE.margin, 42, PAGE.margin + 28, 42);

  const cards = [
    { label: `${model.summary.passedRules} von ${model.summary.evaluatedRules} Regeln`, value: model.summary.scoreLabel,
      color: model.summary.errorCount ? ERROR : model.summary.warningCount ? WARNING : SUCCESS },
    { label: 'Räume', value: String(model.summary.rooms), color: ACCENT },
    { label: 'Fehler', value: String(model.summary.errorCount), color: model.summary.errorCount ? ERROR : SUCCESS },
    { label: 'Warnungen', value: String(model.summary.warningCount), color: model.summary.warningCount ? WARNING : SUCCESS },
  ];
  const gap = 3;
  const cardWidth = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
  cards.forEach((card, index) => {
    const x = PAGE.margin + index * (cardWidth + gap);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.rect(x, 48, cardWidth, 17);
    doc.setFontSize(15);
    doc.setTextColor(...card.color);
    doc.setFont(undefined, 'bold');
    doc.text(card.value, x + cardWidth / 2, 57, { align: 'center' });
    doc.setFont(undefined, 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(card.label, x + cardWidth / 2, 62, { align: 'center', maxWidth: cardWidth - 3 });
  });

  doc.autoTable({
    ...tableBase,
    startY: 72,
    head: [['Merkmal', 'Wert']],
    body: model.info,
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
  });

  let coverY = doc.lastAutoTable.finalY + 8;
  coverY = noteBlock(model.notes, coverY);
  coverY += 2;
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.setFont(undefined, 'bold');
  doc.text('Weiterführende Informationen', PAGE.margin, coverY);
  doc.setFont(undefined, 'normal');
  coverY += 4;
  for (const [label, url] of model.links) {
    if (coverY > PAGE.height - 22) break;
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    doc.text(label, PAGE.margin, coverY);
    doc.setFontSize(6.5);
    doc.setTextColor(...ACCENT);
    doc.textWithLink(url, PAGE.margin, coverY + 3.2, { url });
    coverY += 7.5;
  }

  // ── Table of contents (numbers filled in once the chapters exist) ────────
  doc.addPage();
  const tocPage = doc.internal.getNumberOfPages();
  const chapterPages = new Map();

  // -- Chapter 1: validation rules ------------------------------------------
  doc.addPage();
  chapterPages.set('rules', doc.internal.getNumberOfPages());
  let y = chapterHeader(`Prüfregeln (${model.summary.passedRules}/${model.summary.evaluatedRules})`);
  const ruleColumns = { 0: { cellWidth: 22 }, 1: { fontStyle: 'bold', cellWidth: 26 }, 3: { cellWidth: 18, halign: 'right' } };
  const ruleGroups = [
    ['Nicht bestanden', model.rules.failed],
    ['Nicht geprüft', model.rules.notEvaluated],
    ['Bestanden', model.rules.passed],
  ];
  for (const [label, rows] of ruleGroups) {
    if (!rows.length) continue;
    if (y > PAGE.height - 40) { doc.addPage(); y = chapterHeader('Prüfregeln (Fortsetzung)'); }
    y = subtitle(`${label} (${rows.length})`, y);
    doc.autoTable({
      ...tableBase, startY: y, head: [model.rules.head], body: rows,
      columnStyles: ruleColumns, didParseCell: statusCell(0),
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // -- Chapter 2: findings ---------------------------------------------------
  doc.addPage();
  chapterPages.set('errors', doc.internal.getNumberOfPages());
  y = chapterHeader(`Fehlermeldungen (${model.errors.rows.length})`);
  if (!model.errors.rows.length) {
    doc.setFontSize(9);
    doc.setTextColor(...SUCCESS);
    doc.text('Keine Feststellungen. Alle geprüften Regeln sind bestanden.', PAGE.margin, y + 2);
  } else {
    doc.autoTable({
      ...tableBase, startY: y, head: [model.errors.head], body: model.errors.rows,
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 22 }, 2: { cellWidth: 26, fontStyle: 'bold' } },
      didParseCell: statusCell(1),
    });
  }

  // -- Chapter 3: layers ------------------------------------------------------
  doc.addPage();
  chapterPages.set('layers', doc.internal.getNumberOfPages());
  y = chapterHeader(`Layer (${model.layers.rows.length})`);
  y = addSnapshot('layers', y, 95);
  doc.autoTable({
    ...tableBase, startY: y, head: [model.layers.head], body: model.layers.rows,
    columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 24, halign: 'right' }, 3: { cellWidth: 24 } },
  });

  // -- Chapter 4: rooms -------------------------------------------------------
  doc.addPage();
  chapterPages.set('rooms', doc.internal.getNumberOfPages());
  y = chapterHeader(`Räume (${model.rooms.rows.length})`);
  y = addSnapshot('rooms', y, 88);
  if (!model.rooms.rows.length) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('In der Zeichnung wurden keine Raumpolygone erkannt.', PAGE.margin, y + 2);
  } else {
    doc.autoTable({
      ...tableBase, startY: y, head: [model.rooms.head], body: model.rooms.rows,
      columnStyles: {
        0: { cellWidth: 10 }, 1: { cellWidth: 20 }, 3: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' }, 6: { cellWidth: 18 },
      },
      didParseCell: statusCell(1),
    });
  }

  // -- Chapter 5: floor polygons ----------------------------------------------
  doc.addPage();
  chapterPages.set('areas', doc.internal.getNumberOfPages());
  y = chapterHeader(`Flächen (${model.areas.rows.length})`);
  y = addSnapshot('areas', y, 88);
  if (!model.areas.rows.length) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('In der Zeichnung wurden keine Geschosspolygone erkannt.', PAGE.margin, y + 2);
  } else {
    doc.autoTable({
      ...tableBase, startY: y, head: [model.areas.head], body: model.areas.rows,
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 20 }, 3: { cellWidth: 22, halign: 'right' }, 5: { cellWidth: 18 } },
      didParseCell: statusCell(1),
    });
  }

  // -- Chapter 6: key figures ---------------------------------------------------
  doc.addPage();
  chapterPages.set('kpi', doc.internal.getNumberOfPages());
  y = chapterHeader('Kennzahlen');
  const kpiColumns = { 0: { fontStyle: 'bold', cellWidth: 22 }, 2: { cellWidth: 28, halign: 'right' }, 3: { cellWidth: 20, halign: 'right' } };
  const kpiSections = [
    ['Gebäudeflächen', model.kpi.areaHead, model.kpi.areas, kpiColumns],
    ['Gebäudevolumen', model.kpi.volumeHead, model.kpi.volume, kpiColumns],
    ['Flächen nach DIN 277', model.kpi.din277Head, model.kpi.din277, kpiColumns],
    ['Wirtschaftlichkeitskennzahlen', model.kpi.economyHead, model.kpi.economy,
      { 0: { fontStyle: 'bold', cellWidth: 26 }, 2: { cellWidth: 24, halign: 'right' } }],
    ...(model.kpi.entities.length ? [['Entitäten im DWG', model.kpi.entityHead, model.kpi.entities,
      { 0: { fontStyle: 'bold', cellWidth: 34 }, 1: { cellWidth: 20, halign: 'right' } }]] : []),
  ];
  for (const [label, head, rows, columnStyles] of kpiSections) {
    if (y > PAGE.height - 42) { doc.addPage(); y = chapterHeader('Kennzahlen (Fortsetzung)'); }
    y = subtitle(label, y);
    doc.autoTable({ ...tableBase, startY: y, head: [head], body: rows, columnStyles });
    y = doc.lastAutoTable.finalY + 8;
  }
  if (y > PAGE.height - 30) { doc.addPage(); y = chapterHeader('Kennzahlen (Fortsetzung)'); }
  noteBlock(model.notes, y);

  // ── Table of contents ────────────────────────────────────────────────────
  doc.setPage(tocPage);
  chapterHeader('Inhaltsverzeichnis');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Seite', RIGHT, 29, { align: 'right' });
  let tocY = 36;
  model.chapters.forEach((chapter, index) => {
    const page = chapterPages.get(chapter.key);
    doc.setFontSize(11);
    doc.setTextColor(...ACCENT);
    doc.setFont(undefined, 'bold');
    doc.text(String(index + 1), PAGE.margin + 1, tocY);
    doc.textWithLink(chapter.title, PAGE.margin + 10, tocY, { pageNumber: page });
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(chapter.description, PAGE.margin + 10, tocY + 4.6);
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.setFont(undefined, 'bold');
    doc.text(String(page ?? DASH), RIGHT, tocY, { align: 'right' });
    doc.setFont(undefined, 'normal');
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(PAGE.margin, tocY + 7.5, RIGHT, tocY + 7.5);
    tocY += 13.5;
  });

  // ── Footer on every page ─────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(PAGE.margin, PAGE.height - 14, RIGHT, PAGE.height - 14);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text('Bundesamt für Bauten und Logistik · Planprüfung · lokal im Browser erzeugt',
      PAGE.margin, PAGE.height - 10);
    doc.text(`Seite ${page} von ${pageCount}`, RIGHT, PAGE.height - 10, { align: 'right' });
  }

  return doc;
}

export function planCheckPdfFilename(result) {
  const source = String(result?.file?.name || '').replace(/\.[^.]+$/, '');
  return `${fileSlug(source, 'planpruefung')}-pruefbericht.pdf`;
}

export async function downloadPlanCheckPdf(result, options = {}) {
  const doc = await buildPlanCheckPdf(result, options);
  const filename = planCheckPdfFilename(result);
  doc.save(filename);
  return filename;
}
