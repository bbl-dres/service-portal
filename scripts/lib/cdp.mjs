// Minimal Chrome DevTools Protocol driver for headless Edge — zero dependencies
// (uses Node's global WebSocket, Node >= 22). Shared by the *.test.mjs scripts in
// this folder so each test is just "open page → evaluate probe → assert".
//
// Why CDP and not puppeteer: this is a no-build vanilla project with no
// node_modules; a ~100-line driver keeps the test tooling as dependency-free as
// the app itself. See scripts/README.md for the approach and gotchas.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Overridable per environment. APP_BASE must point at the app's index so that
// `${APP_BASE}/app/portfolio/BLD-01` resolves — note the trailing `#`. The
// default matches `node scripts/serve.mjs`, which serves the repository root.
export const APP_BASE = process.env.APP_BASE
  || 'http://127.0.0.1:8848/#';

function defaultEdgePath() {
  if (process.platform === 'win32') {
    const programme = process.env['ProgramFiles(x86)'] || process.env.ProgramFiles;
    return programme ? join(programme, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : 'msedge.exe';
  }
  if (process.platform === 'darwin') {
    return '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
  }
  return 'microsoft-edge';
}

export const EDGE = process.env.EDGE_PATH || defaultEdgePath();

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Return whether a debugging endpoint already answers on this port.
async function isPortOccupied(port) {
  try {
    const r = await fetch(`http://localhost:${port}/json/version`, { signal: AbortSignal.timeout(400) });
    return r.ok;
  } catch { return false; }
}

// Launch headless Edge with a throwaway profile and connect to its CDP endpoint.
// `webgl: true` enables SwiftShader so MapLibre/WebGL renders (never --disable-gpu,
// which blanks WebGL). Returns { send, on, close }.
//
// PORT SELECTION: without `port`, `launch()` finds a free one. The former fixed
// port 9333 let concurrent suites attach to another run and inherit its warm
// HTTP cache, which made changed files appear stale. An explicitly requested
// occupied port therefore fails loudly instead of attaching to another browser.
export async function launch({ port, webgl = false } = {}) {
  if (port == null) {
    for (let p = 9400 + Math.floor(Math.random() * 400); ; p++) {
      if (!(await isPortOccupied(p))) { port = p; break; }
    }
  } else if (await isPortOccupied(port)) {
    throw new Error(`A browser already answers on port ${port}. `
      + 'Stop orphaned msedge processes or call launch() without a port.');
  }

  const userDir = mkdtempSync(join(tmpdir(), 'edge-cdp-'));
  const flags = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
    '--no-first-run', '--no-default-browser-check',
    // Disable HTTP caching so the run checks files on disk, not stale profile data.
    '--disable-http-cache',
  ];
  if (webgl) flags.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist');
  const edge = spawn(EDGE, [...flags, 'about:blank'], {
    stdio: 'ignore',
    // On Unix a separate process group lets close() terminate renderers too.
    // Windows uses taskkill /T below instead.
    detached: process.platform !== 'win32',
  });
  let spawnError;
  edge.once('error', (error) => { spawnError = error; });

  let ws;
  let closed = false;
  let id = 0;
  const pending = new Map();
  const listeners = [];

  const close = () => {
    if (closed) return;
    closed = true;
    process.removeListener('exit', close);
    for (const request of pending.values()) request.reject(new Error('CDP browser closed'));
    pending.clear();
    try { ws?.close(); } catch { /* ignore */ }
    // Edge spawns a tree of child processes (renderer/gpu/utility); edge.kill()
    // only signals the root and leaves zombies that pile up across runs and starve
    // the machine. Kill every process of THIS launch — matched by its unique
    // throwaway profile dir (all children carry --user-data-dir=<userDir>).
    try {
      if (process.platform === 'win32') {
        const tag = userDir.split(/[\\/]/).pop();   // e.g. edge-cdp-Abc123 (unique per launch)
        if (edge.pid) spawnSync('taskkill', ['/F', '/T', '/PID', String(edge.pid)], { stdio: 'ignore' });
        spawnSync('powershell', ['-NoProfile', '-Command',
          `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${tag}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`],
          { stdio: 'ignore' });
      } else if (edge.pid) process.kill(-edge.pid, 'SIGKILL');
    } catch { try { edge.kill(); } catch { /* ignore */ } }
    try { rmSync(userDir, { recursive: true, force: true }); } catch { /* Edge may still hold it */ }
  };

  // This synchronous exit hook is the last line of defence for probes that
  // throw before reaching their own finally block or call process.exit().
  process.once('exit', close);

  try {
    let wsUrl;
    for (let i = 0; i < 60 && !spawnError; i++) {
      try {
        const r = await fetch(`http://localhost:${port}/json/version`);
        const j = await r.json();
        if (j.webSocketDebuggerUrl) { wsUrl = j.webSocketDebuggerUrl; break; }
      } catch { /* not up yet */ }
      await sleep(200);
    }
    if (!wsUrl) {
      throw new Error(spawnError
        ? `CDP did not start: ${spawnError.message}`
        : 'CDP did not start — is Edge installed at ' + EDGE + '?');
    }

    ws = new WebSocket(wsUrl);
    await Promise.race([
      new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', () => reject(new Error('CDP websocket failed')), { once: true });
      }),
      sleep(5000).then(() => { throw new Error('CDP websocket timed out'); }),
    ]);

    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id); pending.delete(m.id);
        m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      } else if (m.method) {
        listeners.forEach((fn) => fn(m));
      }
    });
    ws.addEventListener('close', () => {
      if (!closed) close();
    }, { once: true });

    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      if (closed || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('CDP browser is not connected'));
        return;
      }
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      try {
        ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
      } catch (error) {
        pending.delete(mid);
        reject(error);
      }
    });
    const on = (fn) => listeners.push(fn);
    return { send, on, close };
  } catch (error) {
    close();
    throw error;
  }
}

// Open a fresh page (flattened session), collect uncaught exceptions + console
// errors. `evaluate(expr)` runs an async expression in-page and returns its value.
// The demo session as written by js/session.js. Install it before the first app
// script so session.js sees it during module initialization; a later login call
// would otherwise require an avoidable second render.
const DEMO_SESSION = { name: 'Andrea Muster', org: 'Bundesamt für Umwelt BAFU' };

/**
 * `login` controls the session with which the page starts:
 *   true   signed in · false signed out · undefined automatic
 *
 * Automatic mode signs into routes under `#/app/…`. Since August 2026 those
 * micro-apps are behind the router's mock sign-in gate; without a session each
 * app suite would exercise only that gate. Gate tests request `login: false`.
 *
 * The session lives in localStorage for the entire browser profile. Set or
 * remove it on every page creation so signed-out checks cannot inherit state
 * from a preceding check.
 */
export async function openPage(cdp, url, { login, skin } = {}) {
  const wantsLogin = login === undefined ? /#\/app\//.test(String(url)) : !!login;
  const requestedSkin = skin || process.env.APP_SKIN || '';
  if (requestedSkin && !['federal', 'intranet'].includes(requestedSkin)) {
    throw new Error(`APP_SKIN must be "federal" or "intranet", got "${requestedSkin}".`);
  }
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  try {
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `${wantsLogin
      ? `try { localStorage.setItem('bbl_session_v1', ${JSON.stringify(JSON.stringify(DEMO_SESSION))}); } catch (e) {}`
      : `try { localStorage.removeItem('bbl_session_v1'); } catch (e) {}`}
      ${requestedSkin ? `
      (() => {
        const applySkin = () => {
          if (!document.body) return false;
          document.body.classList.toggle('body--intranet', ${JSON.stringify(requestedSkin === 'intranet')});
          document.body.classList.remove('body--freebrand');
          return true;
        };
        if (!applySkin()) {
          const observer = new MutationObserver(() => {
            if (applySkin()) observer.disconnect();
          });
          observer.observe(document, { childList: true, subtree: true });
        }
      })();` : ''}`,
  }, sessionId);
  const exceptions = [];
  const consoleErrors = [];
  let loaded = false;
  // Register listeners and enable Runtime before navigation so the initial load
  // event and startup exceptions cannot escape the probe.
  cdp.on((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Page.loadEventFired') loaded = true;
    else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      exceptions.push(d.exception?.description || d.text);
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.navigate', { url }, sessionId);
  // Wait for the document to finish loading so evaluate() targets the loaded
  // context, not the throwaway initial one (which is destroyed on navigation).
  for (let i = 0; i < 40 && !loaded; i++) await sleep(50);

  // awaitPromise so an `(async () => {...})()` probe resolves before we read it.
  // Retry once if a mid-flight re-render tears down the execution context.
  const evaluate = async (expression) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await cdp.send('Runtime.evaluate',
          { expression, awaitPromise: true, returnByValue: true }, sessionId);
        return r.result.value;
      } catch (e) {
        if (attempt < 1 && /context was destroyed|Cannot find context/i.test(e.message)) { await sleep(300); continue; }
        throw e;
      }
    }
  };
  const closeTarget = () => cdp.send('Target.closeTarget', { targetId });
  // Aggregate "nothing broke" check. `exceptions` alone is insufficient:
  // js/router.js catches render failures, logs them and paints an error
  // notification without triggering Runtime.exceptionThrown. Return [] when
  // clean, otherwise return readable findings.
  const problems = async () => {
    const out = [];
    if (exceptions.length) out.push(`Exception: ${exceptions[0]}`);
    if (consoleErrors.length) out.push(`Console error: ${consoleErrors[0]}`);
    try {
      // .error-summary reports invalid form input; it is not an application
      // defect. Error toasts are also excluded because headless browsers lack
      // clipboard permission and a failed copy correctly uses the error state.
      // Only application-level router or data-loading banners fail this check.
      const err = await evaluate(`(function(){var n=[...document.querySelectorAll('.notification--error:not(.error-summary)')]
          .find(function(x){ return !x.closest('.toast__message'); });
        return n ? (n.innerText||'').replace(/[\\s\\u00a0]+/g,' ').slice(0,120) : '';})()`);
      if (err) out.push(`Error banner: ${err}`);
    } catch { /* page already closed */ }
    return out;
  };
  return { sessionId, evaluate, exceptions, consoleErrors, problems, closeTarget };
  } catch (error) {
    try { await cdp.send('Target.closeTarget', { targetId }); } catch { /* browser already closed */ }
    throw error;
  }
}
