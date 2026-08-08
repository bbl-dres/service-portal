// The dependency-free development server is still an HTTP boundary. A
// malformed percent escape must yield a client error instead of throwing out
// of the request callback and terminating the process.
import { request as httpRequest } from 'node:http';
import { createStaticServer, resolveAllowedHosts, resolveRequestFile, resolveServerHost } from './serve.mjs';

let failures = 0;
const check = (condition, label, actual = '') => {
  console.log(`${condition ? '✓' : '✗'} ${label}${actual ? ` (${actual})` : ''}`);
  if (!condition) failures++;
};

const request = (port, path, options = {}) => new Promise((resolve, reject) => {
  const req = httpRequest({
    hostname: '127.0.0.1', port, path, method: options.method || 'GET', headers: options.headers || {},
  }, (res) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => resolve({
      status: res.statusCode,
      type: res.headers['content-type'] || '',
      headers: res.headers,
      body: Buffer.concat(chunks).toString('utf8'),
    }));
  });
  req.on('error', reject);
  req.end();
});

check(resolveRequestFile('/%').status === 400, 'malformed percent escape resolves to 400');
check(resolveRequestFile('/safe%0d%0aInjected:value').status === 400,
  'decoded control characters resolve to 400');
check(resolveRequestFile('/%2e%2e%2foutside').status === 403,
  'encoded path traversal remains outside the served root');
check(resolveRequestFile('/.git/HEAD').status === 404
  && resolveRequestFile('/.%67it/config').status === 404
  && resolveRequestFile('/.env').status === 404,
  'hidden repository and environment paths are never runtime assets');
check(resolveRequestFile('/?cache-bust=1').file?.endsWith('index.html'),
  'root requests still resolve to the app entry point');
check(resolveServerHost({}) === '127.0.0.1', 'server defaults to the loopback interface');
check(resolveServerHost({ SERVICE_PORTAL_HOST: '0.0.0.0' }) === '0.0.0.0',
  'LAN binding requires an explicit host opt-in');
check(resolveAllowedHosts({ SERVICE_PORTAL_HOST: '0.0.0.0', SERVICE_PORTAL_ALLOWED_HOSTS: 'portal.test, 192.0.2.10' }).has('portal.test')
  && !resolveAllowedHosts({ SERVICE_PORTAL_HOST: '0.0.0.0' }).has('0.0.0.0'),
  'wildcard binding does not wildcard the HTTP Host allowlist');

const server = createStaticServer();
const loopback = resolveServerHost({});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, loopback, resolve);
});

try {
  const address = server.address();
  check(address.address === loopback, 'ephemeral test server binds only to loopback', address.address);
  const malformed = await request(address.port, '/%');
  check(malformed.status === 400 && malformed.type.startsWith('text/plain'),
    'HTTP boundary returns a plain-text 400 for malformed encoding', String(malformed.status));

  const healthy = await request(address.port, '/index.html');
  check(healthy.status === 200 && /<!doctype html>/i.test(healthy.body),
    'server remains alive and serves the next request', String(healthy.status));

  const traversal = await request(address.port, '/%2e%2e%2foutside');
  check(traversal.status === 403, 'HTTP boundary rejects encoded traversal', String(traversal.status));

  const metadata = await request(address.port, '/.git/HEAD');
  check(metadata.status === 404, 'HTTP boundary does not expose Git metadata', String(metadata.status));

  const rebound = await request(address.port, '/index.html', { headers: { Host: 'attacker.example' } });
  check(rebound.status === 421, 'HTTP boundary rejects an unapproved Host header', String(rebound.status));

  const ipv6Loopback = await request(address.port, '/index.html', { headers: { Host: '[::1]:8848' } });
  check(ipv6Loopback.status === 200,
    'Host validation canonicalises the bracketed IPv6 loopback form', String(ipv6Loopback.status));

  const post = await request(address.port, '/index.html', { method: 'POST' });
  check(post.status === 405 && post.headers.allow === 'GET, HEAD',
    'static server permits only GET and HEAD', `${post.status}/${post.headers.allow}`);

  const noGzip = await request(address.port, '/index.html', { headers: { 'Accept-Encoding': 'gzip;q=0' } });
  check(!noGzip.headers['content-encoding'] && noGzip.headers.vary === 'Accept-Encoding'
    && noGzip.headers['x-content-type-options'] === 'nosniff',
  'quality-zero compression is respected and responses declare negotiation/nosniff');

  const gzip = await request(address.port, '/index.html', { headers: { 'Accept-Encoding': 'br;q=0, gzip;q=1' } });
  check(gzip.headers['content-encoding'] === 'gzip',
    'quality-aware negotiation selects the accepted encoding', String(gzip.headers['content-encoding']));

  const unacceptable = await request(address.port, '/index.html', {
    headers: { 'Accept-Encoding': 'identity;q=0, gzip;q=0, br;q=0, *;q=0' },
  });
  check(unacceptable.status === 406 && unacceptable.headers.vary === 'Accept-Encoding',
    'server rejects a request that disallows every supported encoding', String(unacceptable.status));
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
