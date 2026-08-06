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

// Ist auf diesem Port schon ein Debug-Endpunkt erreichbar?
async function portBelegt(port) {
  try {
    const r = await fetch(`http://localhost:${port}/json/version`, { signal: AbortSignal.timeout(400) });
    return r.ok;
  } catch { return false; }
}

// Launch headless Edge with a throwaway profile and connect to its CDP endpoint.
// `webgl: true` enables SwiftShader so MapLibre/WebGL renders (never --disable-gpu,
// which blanks WebGL). Returns { send, on, close }.
//
// PORTWAHL: ohne `port` sucht `launch()` selbst einen freien. Vorher stand hier
// die feste Vorgabe 9333 — drei Suiten teilten sie sich, und weil die Schleife
// unten sich mit dem verbindet, was auf dem Port ANTWORTET, übernahm ein Lauf
// den Browser eines anderen Laufs mitsamt dessen warmem HTTP-Cache. Ergebnis
// waren Phantomfehler: geänderte Dateien kamen im Test nie an. Zweimal
// aufgetreten (29./30. Juli), zweimal als vermeintlicher Code-Fehler gejagt.
//
// Wird ein Port ausdrücklich genannt und ist er belegt, bricht `launch()` ab,
// statt sich anzuhängen — lieber ein lauter Fehler als ein stiller Fremdbrowser.
export async function launch({ port, webgl = false } = {}) {
  if (port == null) {
    for (let p = 9400 + Math.floor(Math.random() * 400); ; p++) {
      if (!(await portBelegt(p))) { port = p; break; }
    }
  } else if (await portBelegt(port)) {
    throw new Error(`Auf Port ${port} antwortet bereits ein Browser. `
      + 'Verwaiste msedge-Prozesse beenden oder launch() ohne Port aufrufen.');
  }

  const userDir = mkdtempSync(join(tmpdir(), 'edge-cdp-'));
  const flags = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
    '--no-first-run', '--no-default-browser-check',
    // Kein HTTP-Cache: der Testlauf soll die Dateien auf der Platte prüfen,
    // nicht eine ältere Fassung aus dem Profil.
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
// Die Demo-Sitzung, wie js/session.js sie schreibt. Wird VOR dem ersten
// Anwendungsskript in den localStorage gelegt, damit `session.js` sie beim
// Modulstart schon vorfindet — ein späteres window.__login() käme für die
// erste Zeichnung zu spät und die Seite müsste neu gezeichnet werden.
const DEMO_SESSION = { name: 'Andrea Muster', org: 'Bundesamt für Umwelt BAFU' };

/**
 * `login` steuert die Sitzung, mit der die Seite STARTET:
 *   true   angemeldet · false  abgemeldet · undefined  automatisch
 *
 * Automatisch heisst: Routen unter `#/app/…` starten angemeldet. Die
 * Fachanwendungen liegen seit 2026-08 hinter einer Anmeldesperre (js/router.js);
 * ohne Sitzung prüfte sonst jede App-Suite nur noch das Anmeldeband. Wer die
 * SPERRE selbst prüfen will, verlangt `login: false` ausdrücklich.
 *
 * Die Sitzung liegt im localStorage und gilt für das ganze Profil — deshalb
 * wird sie hier bei JEDEM Seitenaufbau gesetzt bzw. gelöscht und nicht nur
 * beim ersten; sonst erbte eine abgemeldete Prüfung die Sitzung ihrer
 * Vorgängerin.
 */
export async function openPage(cdp, url, { login } = {}) {
  const wantsLogin = login === undefined ? /#\/app\//.test(String(url)) : !!login;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  try {
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: wantsLogin
      ? `try { localStorage.setItem('bbl_session_v1', ${JSON.stringify(JSON.stringify(DEMO_SESSION))}); } catch (e) {}`
      : `try { localStorage.removeItem('bbl_session_v1'); } catch (e) {}`,
  }, sessionId);
  const exceptions = [];
  const consoleErrors = [];
  let loaded = false;
  // Horcher und Runtime.enable stehen VOR der Navigation: sonst feuert das
  // Ladeereignis der Zielseite ins Leere, und Ausnahmen des Startlaufs — genau
  // die interessanten — zählte niemand mit.
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
      // Falscheingabe, sie IST kein Defekt. Ebenso ausgenommen: error-Toasts
      // (.toast__message) — seit der Sprach-Review trägt ein fehlgeschlagenes
      // Kopieren korrekt die error-Variante (Design-Review D5); headless gibt es
      // keine Clipboard-Berechtigung, der Toast ist dort also ERWARTET. Nur
      // Bannern der Anwendung selbst (Router, Datenladen) darf ein Test
      // widersprechen.
      const err = await evaluate(`(function(){var n=[...document.querySelectorAll('.notification--error:not(.error-summary)')]
          .find(function(x){ return !x.closest('.toast__message'); });
        return n ? (n.innerText||'').replace(/\s+/g,' ').slice(0,120) : '';})()`);
      if (err) out.push(`Fehlerbanner: ${err}`);
    } catch { /* Seite bereits zu */ }
    return out;
  };
  return { sessionId, evaluate, exceptions, consoleErrors, problems, closeTarget };
  } catch (error) {
    try { await cdp.send('Target.closeTarget', { targetId }); } catch { /* browser already closed */ }
    throw error;
  }
}
