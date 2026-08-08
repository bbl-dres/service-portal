#!/usr/bin/env node
// Dependency-free static development server with compression, using node:
// modules only.
//
// Unlike `python -m http.server`, this reflects production-style compressed
// transfer sizes and supplies useful cache headers during local measurements.
//
//   node scripts/serve.mjs [port]        default: 8848
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { createGzip, createBrotliCompress, constants as z } from 'node:zlib';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..'));
const PORT = Number(process.argv[2]) || 8848;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.avif': 'image/avif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
};
// Compress text only; fonts, images and PDFs are already compressed.
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml)|image\/svg)/;

createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(ROOT, path));
  // Prevent path traversal through ../ segments.
  if (!file.startsWith(ROOT + sep) && file !== ROOT) { res.writeHead(403).end('forbidden'); return; }

  let st;
  try { st = statSync(file); } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found'); return; }
  if (st.isDirectory()) { res.writeHead(404).end('not found'); return; }

  const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    // Do not cache during development so edits are immediately visible.
    'Cache-Control': 'no-cache',
  };

  const accept = req.headers['accept-encoding'] || '';
  const stream = createReadStream(file);
  if (COMPRESSIBLE.test(type) && /\bbr\b/.test(accept)) {
    headers['Content-Encoding'] = 'br';
    res.writeHead(200, headers);
    stream.pipe(createBrotliCompress({ params: { [z.BROTLI_PARAM_QUALITY]: 5 } })).pipe(res);
  } else if (COMPRESSIBLE.test(type) && /\bgzip\b/.test(accept)) {
    headers['Content-Encoding'] = 'gzip';
    res.writeHead(200, headers);
    stream.pipe(createGzip({ level: 6 })).pipe(res);
  } else {
    headers['Content-Length'] = st.size;
    res.writeHead(200, headers);
    stream.pipe(res);
  }
}).listen(PORT, () => {
  console.log(`BBL Kundenportal → http://127.0.0.1:${PORT}/  (gzip/brotli enabled)`);
});
