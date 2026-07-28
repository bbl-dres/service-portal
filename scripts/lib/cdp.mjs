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
// `${APP_BASE}/app/portfolio/BLD-01` resolves — note the trailing `#`. The dev
// server (python http.server) is often rooted at the user's home dir, so the app
// lives under /Documents/GitHub/service-portal/; if you serve from the repo root
// instead, set APP_BASE=http://localhost:8000/#
export const APP_BASE = process.env.APP_BASE
  || 'http://localhost:8000/Documents/GitHub/service-portal/#';
export const EDGE = process.env.EDGE_PATH
  || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Launch headless Edge with a throwaway profile and connect to its CDP endpoint.
// `webgl: true` enables SwiftShader so MapLibre/WebGL renders (never --disable-gpu,
// which blanks WebGL). Returns { send, on, close }.
export async function launch({ port = 9333, webgl = false } = {}) {
  const userDir = mkdtempSync(join(tmpdir(), 'edge-cdp-'));
  const flags = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
    '--no-first-run', '--no-default-browser-check',
  ];
  if (webgl) flags.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist');
  const edge = spawn(EDGE, [...flags, 'about:blank'], { stdio: 'ignore' });

  let wsUrl;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl) { wsUrl = j.webSocketDebuggerUrl; break; }
    } catch { /* not up yet */ }
    await sleep(200);
  }
  if (!wsUrl) { edge.kill(); throw new Error('CDP did not start — is Edge installed at ' + EDGE + '?'); }

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('CDP websocket failed')), { once: true });
  });

  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    } else if (m.method) {
      listeners.forEach((fn) => fn(m));
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const on = (fn) => listeners.push(fn);
  const close = () => {
    try { ws.close(); } catch { /* ignore */ }
    // Edge spawns a tree of child processes (renderer/gpu/utility); edge.kill()
    // only signals the root and leaves zombies that pile up across runs and starve
    // the machine. Kill every process of THIS launch — matched by its unique
    // throwaway profile dir (all children carry --user-data-dir=<userDir>).
    try {
      if (process.platform === 'win32') {
        const tag = userDir.split(/[\\/]/).pop();   // e.g. edge-cdp-Abc123 (unique per launch)
        spawnSync('taskkill', ['/F', '/T', '/PID', String(edge.pid)], { stdio: 'ignore' });
        spawnSync('powershell', ['-NoProfile', '-Command',
          `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${tag}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`],
          { stdio: 'ignore' });
      } else edge.kill();
    } catch { try { edge.kill(); } catch { /* ignore */ } }
    try { rmSync(userDir, { recursive: true, force: true }); } catch { /* Edge may still hold it */ }
  };
  return { send, on, close };
}

// Open a fresh page (flattened session), collect uncaught exceptions + console
// errors. `evaluate(expr)` runs an async expression in-page and returns its value.
export async function openPage(cdp, url) {
  const { targetId } = await cdp.send('Target.createTarget', { url });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const exceptions = [];
  const consoleErrors = [];
  let loaded = false;
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
  await cdp.send('Page.enable', {}, sessionId);
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
  // Sammelprüfung «nichts kaputt». WICHTIG: `exceptions` allein genügt NICHT —
  // js/router.js fängt jeden Render-Fehler ab, loggt ihn auf console.error und
  // malt eine .notification--error. Nichts davon erreicht Runtime.exceptionThrown,
  // eine geworfene Ansicht lieferte also ein grünes «keine Ausnahmen».
  // Liefert [] wenn sauber, sonst die Befunde als Text.
  const problems = async () => {
    const out = [];
    if (exceptions.length) out.push(`Ausnahme: ${exceptions[0]}`);
    if (consoleErrors.length) out.push(`Konsolenfehler: ${consoleErrors[0]}`);
    try {
      // .error-summary ist die Fehlerübersicht eines Formulars — sie MELDET eine
      // Falscheingabe, sie IST kein Defekt. Nur Bannern der Anwendung selbst
      // (Router, Datenladen, Startfehler) darf ein Test widersprechen.
      const err = await evaluate(`(function(){var n=document.querySelector('.notification--error:not(.error-summary)');
        return n ? (n.innerText||'').replace(/\s+/g,' ').slice(0,120) : '';})()`);
      if (err) out.push(`Fehlerbanner: ${err}`);
    } catch { /* Seite bereits zu */ }
    return out;
  };
  return { sessionId, evaluate, exceptions, consoleErrors, problems, closeTarget };
}
