#!/usr/bin/env node
// Dependency-free static development server with compression, using node:
// modules only.
//
// Unlike `python -m http.server`, this reflects production-style compressed
// transfer sizes and supplies useful cache headers during local measurements.
//
//   node scripts/serve.mjs [port]        defaults: 127.0.0.1:8848
//   SERVICE_PORTAL_HOST=0.0.0.0 SERVICE_PORTAL_ALLOWED_HOSTS=192.0.2.10 ...
//                                           explicit LAN bind + Host allowlist
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { createGzip, createBrotliCompress, constants as z } from 'node:zlib';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..'));
const requestedPort = process.argv[2] == null ? 8848 : Number(process.argv[2]);
const PORT = Number.isInteger(requestedPort) && requestedPort >= 0 && requestedPort <= 65535
  ? requestedPort
  : 8848;
export const resolveServerHost = (environment = process.env) =>
  environment.SERVICE_PORTAL_HOST || '127.0.0.1';
const HOST = resolveServerHost();
export const resolveAllowedHosts = (environment = process.env) => {
  const hosts = new Set(['127.0.0.1', 'localhost', '::1']);
  const bindHost = resolveServerHost(environment).toLowerCase();
  if (bindHost !== '0.0.0.0' && bindHost !== '::') hosts.add(bindHost);
  String(environment.SERVICE_PORTAL_ALLOWED_HOSTS || '').split(',')
    .map((host) => host.trim().toLowerCase()).filter(Boolean)
    .forEach((host) => hosts.add(host));
  return hosts;
};

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.avif': 'image/avif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.wasm': 'application/wasm', '.dwg': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
};
// Compress text only; fonts, images and PDFs are already compressed.
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml)|image\/svg)/;

export function resolveRequestFile(rawUrl, root = ROOT) {
  let path;
  try {
    path = decodeURIComponent(new URL(rawUrl, 'http://localhost').pathname);
  } catch {
    return { status: 400, message: 'bad request' };
  }
  if (/[\u0000-\u001f\u007f]/.test(path)) return { status: 400, message: 'bad request' };
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(root, path));
  // Prevent path traversal through ../ segments.
  if (!file.startsWith(root + sep) && file !== root) return { status: 403, message: 'forbidden' };
  // The repository is the document root during development, but VCS/editor
  // metadata and future .env-style files are never runtime assets.
  if (path.split(/[\\/]+/).some((segment) => segment.startsWith('.') && segment !== '.' && segment !== '..')) {
    return { status: 404, message: 'not found' };
  }
  return { status: 200, file };
}

function requestHostname(value) {
  if (typeof value !== 'string' || !value || /[@/\\\s]/.test(value)) return '';
  try {
    const hostname = new URL(`http://${value}`).hostname.toLowerCase();
    return hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname;
  } catch { return ''; }
}

function preferredEncoding(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const qualities = new Map();
  for (const part of value.toLowerCase().split(',')) {
    const [rawName, ...parameters] = part.trim().split(';');
    if (!rawName) continue;
    const qParameter = parameters.map((item) => item.trim()).find((item) => item.startsWith('q='));
    const quality = qParameter ? Number(qParameter.slice(2)) : 1;
    qualities.set(rawName, Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0);
  }
  const quality = (name) => qualities.has(name) ? qualities.get(name) : (qualities.get('*') || 0);
  const choices = [
    { name: 'br', q: quality('br'), priority: 2 },
    { name: 'gzip', q: quality('gzip'), priority: 1 },
    { name: '', q: qualities.has('identity') ? qualities.get('identity') : 1, priority: 0 },
  ].filter((choice) => choice.q > 0)
    .sort((a, b) => b.q - a.q || b.priority - a.priority);
  return choices.length ? choices[0].name : null;
}

export function createStaticServer(root = ROOT, { allowedHosts = resolveAllowedHosts() } = {}) {
  return createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' }).end('method not allowed');
      return;
    }
    if (!allowedHosts.has(requestHostname(req.headers.host))) {
      res.writeHead(421, { 'Content-Type': 'text/plain; charset=utf-8' }).end('misdirected request');
      return;
    }
    const requested = resolveRequestFile(req.url, root);
    if (requested.status !== 200) {
      res.writeHead(requested.status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(requested.message);
      return;
    }
    const { file } = requested;

    let st;
    try { st = statSync(file); } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found'); return; }
    if (st.isDirectory()) { res.writeHead(404).end('not found'); return; }

    const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = {
      'Content-Type': type,
      // Do not cache during development so edits are immediately visible.
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    };

    const encoding = COMPRESSIBLE.test(type) ? preferredEncoding(req.headers['accept-encoding']) : '';
    if (COMPRESSIBLE.test(type)) headers.Vary = 'Accept-Encoding';
    if (encoding === null) {
      headers['Content-Type'] = 'text/plain; charset=utf-8';
      res.writeHead(406, headers).end('no acceptable content encoding');
      return;
    }
    const stream = createReadStream(file);
    if (encoding === 'br') {
      headers['Content-Encoding'] = 'br';
      res.writeHead(200, headers);
      stream.pipe(createBrotliCompress({ params: { [z.BROTLI_PARAM_QUALITY]: 5 } })).pipe(res);
    } else if (encoding === 'gzip') {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      stream.pipe(createGzip({ level: 6 })).pipe(res);
    } else {
      headers['Content-Length'] = st.size;
      res.writeHead(200, headers);
      stream.pipe(res);
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const server = createStaticServer();
  server.listen(PORT, HOST, () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : PORT;
    const displayHost = HOST.includes(':') ? `[${HOST}]` : HOST;
    console.log(`BBL Kundenportal → http://${displayHost}:${actualPort}/  (gzip/brotli enabled; allowed hosts: ${[...resolveAllowedHosts()].join(', ')})`);
  });
}
