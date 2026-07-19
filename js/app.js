// Bootstrap: load the shared core + process engine, render the federal shell, start the router.
import { core } from './core.js';
import { engine } from './process-engine.js';
import { shell } from './shell.js';
import { initRouter } from './router.js';

async function boot() {
  await Promise.all([core.load(), engine.load()]);
  shell.renderHeader(document.getElementById('main-header'));
  shell.renderFooter(document.getElementById('main-footer'));
  initRouter();
}

boot().catch(e => {
  console.error('[app] boot failed', e);
  document.getElementById('main-content').innerHTML =
    `<div class="container section"><div class="notification notification--error">Die Anwendung konnte nicht gestartet werden: ${e.message}</div></div>`;
});
