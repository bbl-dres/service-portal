// Client-side export helpers for the Datenportal (no libraries — the portal is
// no-build). Real where the platform allows it: CSV/Excel from a rendered table,
// PNG from an SVG chart, clipboard copy, and mailto share. Whole-dashboard PDF/
// image would need a rasteriser library and stays a simulated affordance.

// Trigger a browser download for a string or Blob.
export function download(content, filename, mime = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Slugify a chart title into a safe file name.
export function fileSlug(s, fallback = 'export') {
  const slug = String(s || '').trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return slug || fallback;
}

// --- table → CSV / Excel -----------------------------------------------------
function tableMatrix(table) {
  return [...table.querySelectorAll('tr')].map((tr) =>
    [...tr.querySelectorAll('th,td')].map((c) => c.textContent.replace(/\s+/g, ' ').trim()));
}

// Semicolon-separated (the delimiter Excel expects in de-CH/de locales), CRLF
// rows, RFC-4180 quoting. UTF-8 BOM so Excel reads umlauts correctly.
export function tableToCsv(table) {
  const cell = (s) => (/[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
  const body = tableMatrix(table).map((r) => r.map(cell).join(';')).join('\r\n');
  return '﻿' + body;
}

// Excel opens a plain HTML table; the .xls + ms-excel mime makes it open directly.
export function tableToXls(table, title = 'Tabelle') {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">`
    + `<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>`
    + `<x:Name>${title.replace(/[<>&]/g, '')}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>`
    + `</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${table.outerHTML}</body></html>`;
}

// --- SVG → PNG ---------------------------------------------------------------
// Rasterise a self-contained SVG (all styles are inline attributes) to a PNG.
// Draws on a white surface at `scale`× so text stays crisp. Returns a Promise.
export function svgToPng(svg, filename, scale = 2) {
  return new Promise((resolve, reject) => {
    const vb = (svg.getAttribute('viewBox') || '0 0 720 300').split(/\s+/).map(Number);
    const w = vb[2] || svg.clientWidth || 720;
    const h = vb[3] || svg.clientHeight || 300;
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    // font-family is inherited from CSS on the page; inline it so the raster matches.
    const font = getComputedStyle(svg).fontFamily || 'Arial, Helvetica, sans-serif';
    clone.setAttribute('font-family', font);
    const xml = new XMLSerializer().serializeToString(clone);
    const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const cx = canvas.getContext('2d');
      cx.fillStyle = '#ffffff';
      cx.fillRect(0, 0, canvas.width, canvas.height);
      cx.setTransform(scale, 0, 0, scale, 0, 0);
      cx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) { download(blob, filename); resolve(true); } else reject(new Error('toBlob failed'));
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('SVG rasterisation failed'));
    img.src = src;
  });
}

// --- share -------------------------------------------------------------------
// Copy text to the clipboard; falls back to a hidden textarea + execCommand for
// insecure contexts (http://<LAN-IP>) where navigator.clipboard is unavailable.
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through to legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

export function shareMail(subject, body) {
  location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
