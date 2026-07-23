// Datenportal — Analyse-Dashboards über den Kennzahlen des BBL.
//
// Modelled on data.finance.admin.ch (Apache Superset): a landing page of topic
// cards, each opening a dashboard of charts. The query layer is mocked in
// js/sql.js — every chart declares a query spec, so the "Abfrage anzeigen"
// panel can show the SQL a real Superset dataset would have run.
// Analysis only: no write-back, no drill-through to source systems.

import { sql } from '../sql.js';
import { chart, wireCharts } from '../charts.js';

const CRUMB_BASE = [
  { label: 'Startseite', href: '#/' },
  { label: 'Daten und Digitalisierung', href: '#/data' },
];

export default async function render(ctx) {
  const { params } = ctx;
  await sql.load();
  if (params[0]) return dashboardView(ctx, params[0]);
  return overview(ctx);
}

/* ------------------------------------------------------------- overview ---- */
function overview(ctx) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  setTitle('Datenportal');
  setCrumbs([...CRUMB_BASE, { label: 'Datenportal' }]);

  const topics = sql.topics();
  const boards = sql.dashboards();

  const topicCard = (t) => {
    const board = boards.find(b => b.topicId === t.id);
    const n = board ? board.charts.length : 0;
    return `<a class="card card--universal card--clickable" href="#/app/dataportal/${encodeURIComponent(t.id)}">
      <div class="card__content"><div class="card__body">
        <span class="domain-tile__icon">${C.icon(t.icon, 'icon--2xl')}</span>
        <div class="card__title">${C.escape(t.title)}</div>
        <p class="card__description">${C.escape(t.desc)}</p>
      </div>
      <div class="card__footer">
        <span>${n} ${n === 1 ? 'Auswertung' : 'Auswertungen'}</span>
        <span class="btn btn--link">Dashboard öffnen ${C.icon('ArrowRight', 'icon--base')}</span>
      </div></div>
    </a>`;
  };

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Datenportal',
      lead: 'Auswertungen zu den Kennzahlen des BBL — Energie und Klima, Immobilienportfolio, Beschaffung, Personal, Logistik und Mobilität.',
    })}
    ${C.notification(
      '<strong>Analyse-Ansicht mit Demo-Daten.</strong> Die Kennzahlen für 2025 stammen aus dem BBL-Nachhaltigkeitsbericht 2025; frühere Jahre sind für den Prototyp interpoliert. Die Abfrage-Schicht ist simuliert (kein Superset, keine Datenbank).',
      'hint', 'InfoCircle')}
    <div class="grid grid--3 mt-8">${topics.map(topicCard).join('')}</div>
  </div>`;
}

/* ------------------------------------------------------------ dashboard ---- */
function dashboardView(ctx, id) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  const board = sql.dashboard(id);
  if (!board) {
    setTitle('Dashboard nicht gefunden');
    setCrumbs([...CRUMB_BASE, { label: 'Datenportal', href: '#/app/dataportal' }]);
    mount.innerHTML = `<div class="container section">
      ${C.backLink('#/app/dataportal', 'Datenportal')}
      <div class="page-header mt-4"><h1 tabindex="-1">Dashboard nicht gefunden</h1></div>
      <p class="muted">Dieses Dashboard existiert nicht. <a href="#/app/dataportal">Zur Übersicht «Datenportal»</a></p>
    </div>`;
    return;
  }
  setTitle(board.title);
  setCrumbs([...CRUMB_BASE, { label: 'Datenportal', href: '#/app/dataportal' }, { label: board.title }]);

  const hero = board.hero ? `
    <div class="dash-hero box">
      <div class="dash-hero__label">${C.escape(board.hero.label)}</div>
      <div class="dash-hero__value">${C.escape(board.hero.value)}<span class="dash-hero__unit">${C.escape(board.hero.unit || '')}</span></div>
      ${board.hero.deltaLabel ? `<div class="dash-hero__delta${board.hero.deltaGood ? ' is-good' : ''}">${C.escape(board.hero.deltaLabel)}</div>` : ''}
    </div>` : '';

  const charts = board.charts.map(spec => chart(spec, sql.query(spec.query))).join('');

  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/app/dataportal', 'Datenportal')}
    ${C.pageHeader({ title: board.title, lead: board.lead })}
    <p class="meta-info">
      <span class="meta-info__item">Quelle: ${C.escape(board.source)}</span>
      <span class="meta-info__item">Stand: ${C.escape(board.updated)}</span>
      <span class="meta-info__item">Demo-Daten</span>
    </p>
    ${hero}
    <div class="dash-grid mt-8">${charts}</div>
  </div>`;

  wireCharts(mount);
}
