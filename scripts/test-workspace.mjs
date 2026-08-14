// Workspace Management regression: canonical catalogue, CD-aligned object
// detail, and the read-only floor-plan preview shared with Tenancies.
//
// The SVG rooms are intentionally interactive display controls. They are not
// editor geometry: mutations, uploads, validation, and persistence must remain
// unavailable in this portal application.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};

const plannedId = encodeURIComponent('1080/6650/AA');
const legacyId = encodeURIComponent('1080/6210/AA');
const plannedFloor = '1080-6650-AA-eg';
const legacyFloor = '1080-6210-AA-eg';

const ACCESSIBILITY = `(() => {
  const headings = [...document.querySelectorAll('#main-content h1,#main-content h2,#main-content h3')];
  const jumps = [];
  headings.reduce((previous, heading) => {
    const level = Number(heading.tagName[1]);
    if (previous && level > previous + 1) jumps.push(previous + '>' + level);
    return level;
  }, 0);
  return {
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    headingJumps: jumps,
    unlabeledControls: [...document.querySelectorAll('#main-content input,#main-content select')]
      .filter(control => !control.labels?.length && !control.getAttribute('aria-label')).length,
    duplicateIds: [...document.querySelectorAll('[id]')]
      .map(node => node.id).filter((id, index, ids) => ids.indexOf(id) !== index),
  };
})()`;

const CATALOGUE = `(() => {
  const cards = [...document.querySelectorAll('.workspace-card')];
  const first = cards[0];
  return {
    h1: document.querySelector('#main-content h1')?.textContent.trim() || '',
    cards: cards.length,
    views: document.querySelectorAll('.view-switch__btn').length,
    // Seit dem Umzug auf das Seitenbaum-Bauteil (2026-08-14) entstehen Blaetter
    // erst beim Aufklappen — im zugeklappten Baum gibt es sie im DOM nicht.
    // Dieselbe Aussage ohne sie: die Zaehler der obersten Stufe summieren sich
    // auf die Zahl der Objekte, denn jedes liegt in genau einem Land.
    treeLeaves: [...document.querySelectorAll('.workspace-sidebar .pf-tree__section > li > .pf-tree__row .pf-tree__n')]
      .reduce((sum, n) => sum + (Number(n.textContent) || 0), 0),
    count: document.querySelector('#workspace-count')?.textContent.replace(/\\s+/g, ' ').trim() || '',
    firstTitle: first?.querySelector('.card__title')?.textContent.trim() || '',
    firstHref: first?.querySelector('.card__link')?.getAttribute('href') || '',
    sharedCards: cards.filter(card => card.matches('.card.card--default')
      && card.querySelector('.card__image')
      && card.querySelector('.card__footer__info')
      && card.querySelector('.card__footer__action')).length,
    plannedBadges: cards.filter(card => /Multispace geplant/.test(card.textContent)).length,
    previews: document.querySelectorAll('.fp__room').length,
  };
})()`;

async function checkProblems(page, label) {
  const problems = await page.problems();
  check(problems.length === 0, label, problems[0] || '');
}

const cdp = await launch();
try {
  for (const width of [1440, 320]) {
    console.log(`\n■ Workspace catalogue (${width}px)`);
    const page = await openPage(cdp, `${APP_BASE}/app/workspace`);
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    await sleep(900);
    const result = await page.evaluate(CATALOGUE);
    check(result.h1 === 'Workspace Management', 'renders the portal catalogue', result.h1);
    check(result.cards === 7 && result.treeLeaves === 7,
      'uses the seven canonical objects that have floors', `${result.cards} cards / ${result.treeLeaves} tree leaves`);
    check(result.views === 3, 'offers gallery, list, and map views', String(result.views));
    check(/7 von 7 Objekten/.test(result.count) && /1 mit Multispace-Planung/.test(result.count),
      'reports canonical and planned result counts', result.count);
    check(/Liebefeld/.test(result.firstTitle) && /1080%2F6650%2FAA/i.test(result.firstHref),
      'sorts the planned Liebefeld object first', `${result.firstTitle} · ${result.firstHref}`);
    check(result.sharedCards === 7,
      'renders every result with the shared CD card image/footer anatomy', `${result.sharedCards}/7`);
    check(result.plannedBadges === 1, 'keeps planning availability distinct from order status', String(result.plannedBadges));
    check(result.previews === 0, 'defers read-only plan SVGs until an object floor is opened');
    const accessibility = await page.evaluate(ACCESSIBILITY);
    check(accessibility.overflow <= 1, 'catalogue has no document overflow', `${accessibility.overflow}px`);
    check(accessibility.headingJumps.length === 0, 'catalogue heading hierarchy is unbroken', accessibility.headingJumps.join(', ') || 'ok');
    check(accessibility.unlabeledControls === 0, 'catalogue controls have accessible labels');
    check(accessibility.duplicateIds.length === 0, 'catalogue has no duplicate IDs', accessibility.duplicateIds.join(', '));
    await checkProblems(page, 'catalogue has no runtime problems');
    await page.closeTarget();
  }

  console.log('\n■ Planning-availability URL state');
  const filteredPage = await openPage(cdp, `${APP_BASE}/app/workspace?view=list&plan=planned`);
  await sleep(800);
  const filtered = await filteredPage.evaluate(`(() => ({
    rows: document.querySelectorAll('#workspace-main table tbody tr').length,
    title: document.querySelector('#workspace-main table tbody a')?.textContent.trim() || '',
    pressed: document.querySelector('[data-view="list"]')?.getAttribute('aria-pressed'),
    checked: document.querySelector('[data-fdim="plan"][value="planned"]')?.checked || false,
    hash: location.hash,
    text: document.querySelector('#main-content')?.textContent.replace(/\\s+/g, ' ') || '',
  }))()`);
  check(filtered.rows === 1 && /Liebefeld/.test(filtered.title),
    'the planned filter returns only Liebefeld', `${filtered.rows} · ${filtered.title}`);
  check(filtered.pressed === 'true' && filtered.checked,
    'restores list view and the planned availability checkbox from the URL');
  check(/plan=planned/.test(filtered.hash) && /Multispace geplant/.test(filtered.text),
    'keeps the availability filter shareable', filtered.hash);
  await checkProblems(filteredPage, 'filtered catalogue has no runtime problems');
  await filteredPage.closeTarget();

  console.log('\n■ Planned object detail and shared CD composition');
  const detailPage = await openPage(cdp, `${APP_BASE}/app/workspace?id=${plannedId}`);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, detailPage.sessionId);
  await sleep(1100);
  const detail = await detailPage.evaluate(`(() => {
    const mosaic = document.querySelector('#workspace-mosaic');
    const disabled = [...document.querySelectorAll('.fp-svc--disabled[aria-disabled="true"]')];
    const editor = document.querySelector('.fp-svc[href^="#/app/floorplan-editor"]');
    const checker = document.querySelector('.fp-svc[href^="#/app/plan-check"]');
    return {
      h1: document.querySelector('#main-content h1')?.textContent.trim() || '',
      eyebrow: document.querySelector('.eyebrow')?.textContent.trim() || '',
      tabs: [...document.querySelectorAll('.tab__control')].map(node => node.textContent.trim()),
      kpis: [...document.querySelectorAll('.kpi-strip__value')].map(node => node.textContent.replace(/\\s+/g, ' ').trim()),
      floorRows: document.querySelectorAll('#workspace-floor-table tbody tr').length,
      equipmentRows: document.querySelectorAll('#workspace-equipment-table tbody tr').length,
      mosaic: !!mosaic && mosaic.matches('.pf-mosaic.pf-mosaic--map'),
      soloMosaic: !!mosaic && mosaic.matches('.pf-mosaic--solo'),
      mosaicCells: mosaic?.querySelectorAll('.pf-mosaic__cell').length || 0,
      sideCells: mosaic?.querySelectorAll('.pf-mosaic__cell--side').length || 0,
      placeholders: mosaic?.querySelectorAll('.pf-mosaic__cell--empty').length || 0,
      galleryCells: mosaic?.querySelectorAll('[data-gallery]').length || 0,
      heroMap: !!mosaic?.querySelector('.pf-hero__map'),
      heroGeometry: (() => {
        const main = mosaic?.querySelector('.pf-mosaic__cell--main')?.getBoundingClientRect();
        const map = mosaic?.querySelector('.pf-hero__mapcol')?.getBoundingClientRect();
        return main && map ? { mainWidth: main.width, mapWidth: map.width,
          mainHeight: main.height, mapHeight: map.height } : null;
      })(),
      overdue: document.querySelector('.pill-row .badge--error')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      availability: [...document.querySelectorAll('.pill-row .badge')]
        .some(node => /Multispace geplant/.test(node.textContent)),
      disabledLabels: disabled.map(node => node.textContent.replace(/\\s+/g, ' ').trim()),
      editorHref: editor?.getAttribute('href') || '',
      editorTarget: editor?.getAttribute('target') || '',
      editorRel: editor?.getAttribute('rel') || '',
      checkerHref: checker?.getAttribute('href') || '',
      checkerTarget: checker?.getAttribute('target') || '',
      checkerRel: checker?.getAttribute('rel') || '',
      exportEnabled: !document.querySelector('#workspace-export')?.disabled,
      mutationControls: document.querySelectorAll('input[type="file"],[contenteditable="true"],[data-editor-action],[data-checker-action],#workspace-floorplan').length,
      ngf: [...document.querySelectorAll('.workspace-object-facts dt')]
        .find(node => /Nettogeschossfläche/.test(node.textContent))
        ?.nextElementSibling?.textContent.replace(/\\s+/g, ' ').trim() || '',
      spaceRequest: document.querySelector('a[href^="#/app/space-request"]')?.getAttribute('href') || '',
      processLaunches: [...document.querySelectorAll('a.fp-svc[href^="#/app/fault-report"],a.fp-svc[href^="#/app/space-request"]')]
        .map((a) => ({ target: a.getAttribute('target') || '', rel: a.getAttribute('rel') || '' })),
    };
  })()`);
  check(/Liebefeld/.test(detail.h1), 'renders the selected planned object', detail.h1);
  check(/PMB-6650/.test(detail.eyebrow), 'shows project context in the shared eyebrow', detail.eyebrow);
  check(detail.tabs.length === 3 && detail.tabs.some(label => /Grundrisse \(3\)/.test(label))
    && detail.tabs.some(label => /Ausstattung \(187\)/.test(label)),
  'renders the three object registers', detail.tabs.join(' · '));
  check(detail.kpis.length === 4 && detail.kpis.some(value => /262/.test(value))
    && detail.kpis.some(value => /187/.test(value)),
  'derives planning KPIs from canonical floors/spaces', detail.kpis.join(', '));
  check(detail.floorRows === 3 && detail.equipmentRows === 11,
    'renders floor and prototype-equipment registers', `${detail.floorRows}/${detail.equipmentRows}`);
  check(detail.mosaic && detail.soloMosaic && detail.mosaicCells === 1 && detail.sideCells === 0
    && detail.placeholders === 0 && detail.galleryCells === 1 && detail.heroMap,
  'uses the shared sparse-media hero without empty image tiles',
  `${detail.galleryCells} image / ${detail.placeholders} placeholders`);
  check(detail.heroGeometry && detail.heroGeometry.mainWidth > detail.heroGeometry.mapWidth * 1.9
    && Math.abs(detail.heroGeometry.mainHeight - detail.heroGeometry.mapHeight) <= 1,
  'keeps the single image and map aligned at the Tenancies hero height',
  detail.heroGeometry ? `${Math.round(detail.heroGeometry.mainWidth)}×${Math.round(detail.heroGeometry.mainHeight)} / ${Math.round(detail.heroGeometry.mapWidth)}×${Math.round(detail.heroGeometry.mapHeight)}` : 'missing');
  check(detail.availability && /Stichtag überschritten/.test(detail.overdue)
    && /31\.0?3\.2026/.test(detail.overdue),
  'shows availability and overdue order status as separate badges', detail.overdue);
  check(/building=1080%2F6650%2FAA/i.test(detail.editorHref)
    && detail.editorTarget === '_blank' && detail.editorRel.includes('noopener'),
  'hands the selected object to the standalone editor in a new window', detail.editorHref);
  check(/building=1080%2F6650%2FAA/i.test(detail.checkerHref)
    && detail.checkerTarget === '_blank' && detail.checkerRel.includes('noopener'),
  'hands the selected object to the standalone plan check in a new window', detail.checkerHref);
  check(detail.disabledLabels.length === 1
    && detail.disabledLabels.some(label => /SIA-Flächennachweis/.test(label)),
  'keeps only the specialist report as a disabled hand-off', detail.disabledLabels.join(' · '));
  check(detail.mutationControls === 0,
    'does not expose upload, geometry-edit, checker, or persistence controls');
  check(detail.exportEnabled, 'offers the honestly labelled prototype aggregate export');
  check(/25(?:['’])?714/.test(detail.ngf),
    'shows canonical NGF instead of substituting gross floor area', detail.ngf);
  check(/building=1080%2F6650%2FAA/i.test(detail.spaceRequest),
    'preselects the current building in the space-request hand-off', detail.spaceRequest);
  check(detail.processLaunches.length === 2 && detail.processLaunches.every((link) =>
    link.target === '_blank' && link.rel.split(/\s+/).includes('noopener')),
  'opens contextual process launches in a new tab', `${detail.processLaunches.length} links`);
  const detailAccess = await detailPage.evaluate(ACCESSIBILITY);
  check(detailAccess.overflow <= 1, 'detail has no document overflow', `${detailAccess.overflow}px`);
  check(detailAccess.headingJumps.length === 0, 'detail heading hierarchy is unbroken', detailAccess.headingJumps.join(', ') || 'ok');
  check(detailAccess.unlabeledControls === 0, 'detail controls have accessible labels');
  check(detailAccess.duplicateIds.length === 0, 'detail has no duplicate IDs', detailAccess.duplicateIds.join(', '));
  await checkProblems(detailPage, 'planned detail has no runtime problems');
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 320, height: 900, deviceScaleFactor: 1, mobile: false }, detailPage.sessionId);
  await sleep(250);
  const mobileHero = await detailPage.evaluate(`(() => {
    const main = document.querySelector('.pf-mosaic__cell--main')?.getBoundingClientRect();
    const map = document.querySelector('.pf-hero__mapcol')?.getBoundingClientRect();
    return {
      mainWidth: main?.width || 0, mapWidth: map?.width || 0,
      mainBottom: main?.bottom || 0, mapTop: map?.top || 0,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  check(Math.abs(mobileHero.mainWidth - mobileHero.mapWidth) <= 1
    && mobileHero.mapTop > mobileHero.mainBottom && mobileHero.overflow <= 1,
  'stacks the same sparse-media hero cleanly at 320px',
  `${Math.round(mobileHero.mainWidth)}px image / ${Math.round(mobileHero.mapWidth)}px map`);
  await detailPage.closeTarget();

  console.log('\n■ Legacy object read-only floor deep-link');
  const legacyPage = await openPage(cdp,
    `${APP_BASE}/app/workspace?building=${legacyId}&floor=${encodeURIComponent(legacyFloor)}`);
  await sleep(900);
  const legacy = await legacyPage.evaluate(`(() => ({
    h1: document.querySelector('#main-content h1')?.textContent.trim() || '',
    activeTab: document.querySelector('.tab__control--active')?.dataset.tab || '',
    activeFloor: document.querySelector('.fp-floors .tag-item--active')?.dataset.floor || '',
    rooms: document.querySelectorAll('.fp__room').length,
    redundantReadonlyLabel: !!document.querySelector('.workspace-readonly'),
    availability: [...document.querySelectorAll('.pill-row .badge')]
      .map(node => node.textContent.trim()).find(label => /Bestand vor Multispace/.test(label)) || '',
    hero: (() => { const mosaic = document.querySelector('#workspace-mosaic'); return {
      galleryCells: mosaic?.querySelectorAll('[data-gallery]').length || 0,
      sideCells: mosaic?.querySelectorAll('.pf-mosaic__cell--side').length || 0,
      placeholders: mosaic?.querySelectorAll('.pf-mosaic__cell--empty').length || 0,
      solo: mosaic?.classList.contains('pf-mosaic--solo') || false,
    }; })(),
    hash: location.hash,
    mutationControls: document.querySelectorAll('input[type="file"],[contenteditable="true"],[data-editor-action],[data-checker-action],#workspace-floorplan').length,
  }))()`);
  check(/Zollanlage Brig-Glis/.test(legacy.h1), 'opens the canonical legacy object', legacy.h1);
  check(legacy.activeTab === 'floorplans' && legacy.activeFloor === legacyFloor && legacy.rooms === 19,
    'opens its existing canonical floor in the shared preview', `${legacy.activeTab} · ${legacy.activeFloor} · ${legacy.rooms} rooms`);
  check(!legacy.redundantReadonlyLabel,
    'omits the redundant read-only label from the shared viewer header');
  check(legacy.hero.galleryCells === 5 && legacy.hero.sideCells === 4
    && legacy.hero.placeholders === 0 && !legacy.hero.solo,
  'matches the five-image Tenancies hero for the same Brig-Glis object',
  `${legacy.hero.galleryCells} images / ${legacy.hero.sideCells} side`);
  check(!!legacy.availability, 'identifies the object as Bestand vor Multispace', legacy.availability);
  check(/id=1080%2F6210%2FAA/i.test(legacy.hash) && !/[?&]building=/.test(legacy.hash),
    'canonicalises the legacy building alias while preserving the floor', legacy.hash);
  check(legacy.mutationControls === 0, 'legacy preview also contains no editor/checker mutation controls');
  await checkProblems(legacyPage, 'legacy preview has no runtime problems');
  await legacyPage.closeTarget();

  console.log('\n■ Invalid cross-building floor/space state');
  const invalidPage = await openPage(cdp,
    `${APP_BASE}/app/workspace?id=${plannedId}&tab=grundrisse&floor=${encodeURIComponent(legacyFloor)}&space=${encodeURIComponent(`${legacyFloor}-01`)}&color=bogus`);
  await sleep(850);
  const invalid = await invalidPage.evaluate(`(() => ({
    activeTab: document.querySelector('.tab__control--active')?.dataset.tab || '',
    table: !!document.querySelector('#workspace-floor-table table'),
    viewer: !!document.querySelector('#fp-wrap'),
    hash: location.hash,
  }))()`);
  check(invalid.activeTab === 'floorplans' && invalid.table && !invalid.viewer,
    'falls back to the planned object floor table without opening a foreign plan');
  check(!/[?&]floor=/.test(invalid.hash) && !/[?&]space=/.test(invalid.hash)
    && !/[?&]color=/.test(invalid.hash),
  'removes invalid cross-building floor/space/color values from the URL', invalid.hash);
  await checkProblems(invalidPage, 'invalid deep-link fallback has no runtime problems');
  await invalidPage.closeTarget();

  console.log('\n■ Floor preview state, focus, fullscreen, print, and table isolation');
  const viewerPage = await openPage(cdp,
    `${APP_BASE}/app/workspace?id=${plannedId}&floor=${encodeURIComponent(plannedFloor)}`);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, viewerPage.sessionId);
  await sleep(900);

  const prepared = await viewerPage.evaluate(`(async () => {
    const input = document.querySelector('#workspace-equipment-q');
    input.value = 'Interaktive';
    document.querySelector('#workspace-equipment-form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 80));
    window.__workspaceEquipmentSearch = document.querySelector('#workspace-equipment-q');
    window.__workspaceWrap = document.querySelector('#fp-wrap');
    const header = document.querySelector('.fp-head__top');
    const headerChildren = [...(header?.children || [])]
      .filter((node) => getComputedStyle(node).display !== 'none');
    return {
      equipmentRows: document.querySelectorAll('#workspace-equipment-table tbody tr').length,
      equipmentValue: window.__workspaceEquipmentSearch?.value || '',
      floor: document.querySelector('.fp-floors .tag-item--active')?.dataset.floor || '',
      rooms: document.querySelectorAll('.fp__room').length,
      editorHref: document.querySelector('#workspace-plan-editor')?.getAttribute('href') || '',
      editorTarget: document.querySelector('#workspace-plan-editor')?.getAttribute('target') || '',
      editorLabel: document.querySelector('#workspace-plan-editor .btn__text')?.textContent.trim() || '',
      checkerHref: document.querySelector('#workspace-plan-check')?.getAttribute('href') || '',
      checkerTarget: document.querySelector('#workspace-plan-check')?.getAttribute('target') || '',
      checkerRel: document.querySelector('#workspace-plan-check')?.getAttribute('rel') || '',
      checkerLabel: document.querySelector('#workspace-plan-check .btn__text')?.textContent.trim() || '',
      editorCardFirst: document.querySelector('.fp-side')?.firstElementChild?.classList.contains('fp-editor-action') || false,
      headerBackFirst: header?.firstElementChild?.classList.contains('fp-back') || false,
      headerRows: [...new Set(headerChildren.map((node) => {
        const rect = node.getBoundingClientRect();
        return Math.round(rect.top + rect.height / 2);
      }))].length,
      headerOverflow: header ? Math.round(header.scrollWidth - header.clientWidth) : -1,
      actionLabels: [...document.querySelectorAll('.fp-head__actions .btn__text')].map((node) => node.textContent.trim()),
      redundantReadonlyLabel: !!document.querySelector('.workspace-readonly'),
    };
  })()`);
  check(prepared.equipmentRows === 1 && prepared.equipmentValue === 'Interaktive',
    'establishes equipment-table state before plan redraws', `${prepared.equipmentRows} · ${prepared.equipmentValue}`);
  check(prepared.floor === plannedFloor && prepared.rooms === 26,
    'opens the requested planned floor', `${prepared.floor} · ${prepared.rooms} rooms`);
  check(/building=1080%2F6650%2FAA/i.test(prepared.editorHref)
    && prepared.editorHref.includes(`floor=${plannedFloor}`) && prepared.editorTarget === '_blank'
    && prepared.editorLabel === 'Im Plan-Editor bearbeiten' && prepared.editorCardFirst,
  'hands the exact preview floor to the standalone editor from the first sidebar card', prepared.editorHref);
  check(/building=1080%2F6650%2FAA/i.test(prepared.checkerHref)
    && prepared.checkerHref.includes(`floor=${plannedFloor}`) && prepared.checkerTarget === '_blank'
    && prepared.checkerRel.includes('noopener') && prepared.checkerLabel === 'Planprüfung öffnen',
  'hands the exact preview floor to the standalone plan check', prepared.checkerHref);
  check(prepared.headerBackFirst && prepared.headerRows === 1 && prepared.headerOverflow <= 1
    && !prepared.redundantReadonlyLabel,
  'uses one shared desktop viewer-header row without the read-only label',
  `${prepared.headerRows} row · ${prepared.headerOverflow}px overflow`);
  check(prepared.actionLabels.join('|') === 'Vollbild|Drucken',
    'keeps only the shared viewer actions in the header', prepared.actionLabels.join(' · '));

  // Fullscreen requires a user activation; CDP provides it only for this call.
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#fp-wrap').requestFullscreen()`,
    awaitPromise: true, returnByValue: true, userGesture: true,
  }, viewerPage.sessionId);
  await sleep(150);

  const state = await viewerPage.evaluate(`(async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 100));
    const equipmentStable = () => window.__workspaceEquipmentSearch === document.querySelector('#workspace-equipment-q')
      && document.querySelector('#workspace-equipment-q')?.value === 'Interaktive'
      && document.querySelectorAll('#workspace-equipment-table tbody tr').length === 1;
    const wrapStable = () => window.__workspaceWrap === document.querySelector('#fp-wrap');
    const fullscreen = () => document.fullscreenElement?.id || '';
    const first = document.querySelector('.fp__room[data-space]');
    const selectedId = first?.dataset.space || '';

    first?.querySelector('rect')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await pause();
    const afterPick = {
      selected: document.querySelector('.fp__room.is-selected')?.dataset.space || '',
      pressed: document.querySelector('.fp__room.is-selected rect')?.getAttribute('aria-pressed') || '',
      focus: document.activeElement?.closest?.('[data-space]')?.dataset.space || '',
      hash: location.hash, fullscreen: fullscreen(), wrapStable: wrapStable(), equipmentStable: equipmentStable(),
    };

    document.querySelector('[data-space="' + CSS.escape(selectedId) + '"] rect')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await pause();
    const afterToggle = {
      selected: document.querySelectorAll('.fp__room.is-selected').length,
      focus: document.activeElement?.closest?.('[data-space]')?.dataset.space || '',
      hash: location.hash, fullscreen: fullscreen(), wrapStable: wrapStable(), equipmentStable: equipmentStable(),
    };

    document.querySelector('[data-space="' + CSS.escape(selectedId) + '"] rect')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await pause();
    const color = document.querySelector('#fp-color');
    color.value = 'sia';
    color.dispatchEvent(new Event('change', { bubbles: true }));
    await pause();
    const afterColor = {
      selected: document.querySelector('.fp__room.is-selected')?.dataset.space || '',
      color: document.querySelector('#fp-color')?.value || '',
      focus: document.activeElement?.id || '',
      hash: location.hash, fullscreen: fullscreen(), wrapStable: wrapStable(), equipmentStable: equipmentStable(),
    };

    const otherFloor = [...document.querySelectorAll('.fp-floors [data-floor]')]
      .find(link => !link.classList.contains('tag-item--active'));
    const nextFloor = otherFloor?.dataset.floor || '';
    otherFloor?.focus();
    otherFloor?.click();
    await pause();
    const afterFloor = {
      floor: document.querySelector('.fp-floors .tag-item--active')?.dataset.floor || '',
      selected: document.querySelectorAll('.fp__room.is-selected').length,
      focus: document.activeElement?.closest?.('[data-floor]')?.dataset.floor || '',
      color: document.querySelector('#fp-color')?.value || '',
      hash: location.hash, fullscreen: fullscreen(), wrapStable: wrapStable(), equipmentStable: equipmentStable(),
    };
    return { selectedId, nextFloor, afterPick, afterToggle, afterColor, afterFloor };
  })()`);

  check(!!state.selectedId && state.afterPick.selected === state.selectedId
    && state.afterPick.pressed === 'true' && state.afterPick.focus === state.selectedId
    && /[?&]space=/.test(state.afterPick.hash),
  'room selection updates aria state, URL, and focus', state.afterPick.hash);
  check(state.afterToggle.selected === 0 && state.afterToggle.focus === state.selectedId
    && !/[?&]space=/.test(state.afterToggle.hash),
  'selecting the room again clears only the selection and preserves focus', state.afterToggle.hash);
  check(state.afterColor.selected === state.selectedId && state.afterColor.color === 'sia'
    && state.afterColor.focus === 'fp-color' && /color=sia/.test(state.afterColor.hash),
  'color changes preserve the selected room and focus', state.afterColor.hash);
  check(!!state.nextFloor && state.afterFloor.floor === state.nextFloor
    && state.afterFloor.selected === 0 && state.afterFloor.focus === state.nextFloor
    && state.afterFloor.color === 'sia' && !/[?&]space=/.test(state.afterFloor.hash),
  'floor changes preserve color/focus and clear the stale room', state.afterFloor.hash);
  check([state.afterPick, state.afterToggle, state.afterColor, state.afterFloor]
    .every(value => value.fullscreen === 'fp-wrap' && value.wrapStable),
  'partial redraws preserve the native fullscreen wrapper');
  check([state.afterPick, state.afterToggle, state.afterColor, state.afterFloor]
    .every(value => value.equipmentStable),
  'floor-preview redraws preserve the filtered equipment table and its DOM identity');

  if (await viewerPage.evaluate(`!!document.fullscreenElement`)) {
    await viewerPage.evaluate(`document.exitFullscreen()`);
    await sleep(100);
  }

  // Stub print so the test can inspect the print class and stylesheet without
  // opening a native dialog. The actual handler still owns class cleanup.
  const printStart = await viewerPage.evaluate(`(() => {
    window.__workspacePrintCalls = 0;
    window.print = () => { window.__workspacePrintCalls++; };
    document.querySelector('#workspace-floorplan-print')?.click();
    return { active: document.body.classList.contains('print--plan'), calls: window.__workspacePrintCalls };
  })()`);
  check(printStart.active && printStart.calls === 1, 'plan print applies its scoped print class before invoking print');
  await cdp.send('Emulation.setEmulatedMedia', { media: 'print' }, viewerPage.sessionId);
  const printLayout = await viewerPage.evaluate(`(() => {
    const visibility = selector => {
      const node = document.querySelector(selector);
      return node ? getComputedStyle(node).visibility : '';
    };
    const display = selector => {
      const node = document.querySelector(selector);
      return node ? getComputedStyle(node).display : '';
    };
    return {
      main: visibility('#main-content'), body: visibility('.floorplan-body'), plan: visibility('svg.fp'),
      actions: display('.fp-head__actions'), editor: display('.fp-editor-action'), room: display('#fp-room'),
      foot: display('.fp-print-foot'), legend: display('.fp-legend'),
    };
  })()`);
  check(printLayout.main === 'hidden' && printLayout.body === 'visible' && printLayout.plan === 'visible',
    'print media isolates the floor-plan body');
  check(printLayout.actions === 'none' && printLayout.editor === 'none' && printLayout.room === 'none',
    'print media removes interactive chrome');
  check(printLayout.foot === 'block' && printLayout.legend !== 'none',
    'print media keeps the object footer and color legend');
  await viewerPage.evaluate(`window.dispatchEvent(new Event('afterprint'))`);
  await sleep(50);
  await cdp.send('Emulation.setEmulatedMedia', { media: '' }, viewerPage.sessionId);
  const printClean = await viewerPage.evaluate(`!document.body.classList.contains('print--plan')`);
  check(printClean, 'afterprint removes the scoped print class');

  const back = await viewerPage.evaluate(`(async () => {
    document.querySelector('#workspace-floorplan-back')?.click();
    await new Promise(resolve => setTimeout(resolve, 120));
    return {
      table: !!document.querySelector('#workspace-floor-table table'),
      viewer: !!document.querySelector('#fp-wrap'),
      focus: document.activeElement?.closest?.('#workspace-floor-table')?.querySelector
        ? document.activeElement?.textContent.trim() : '',
      hash: location.hash,
      equipmentStable: window.__workspaceEquipmentSearch === document.querySelector('#workspace-equipment-q')
        && document.querySelector('#workspace-equipment-q')?.value === 'Interaktive'
        && document.querySelectorAll('#workspace-equipment-table tbody tr').length === 1,
    };
  })()`);
  check(back.table && !back.viewer && !!back.focus,
    'All floors returns to the table and focuses its first floor link', back.focus);
  check(!/[?&]floor=/.test(back.hash) && !/[?&]space=/.test(back.hash),
    'returning to the table removes floor and room state', back.hash);
  check(back.equipmentStable, 'returning to the table still preserves equipment-table state');
  await checkProblems(viewerPage, 'interactive floor-preview flow has no runtime problems');
  await viewerPage.closeTarget();

  console.log('\n■ Floor preview at 320px');
  const mobilePage = await openPage(cdp,
    `${APP_BASE}/app/workspace?id=${plannedId}&floor=${encodeURIComponent(plannedFloor)}`);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 320, height: 900, deviceScaleFactor: 1, mobile: false }, mobilePage.sessionId);
  await sleep(950);
  const mobile = await mobilePage.evaluate(`(() => {
    const stage = document.querySelector('#fp-stage');
    const tabs = document.querySelector('.tab__controls');
    const actions = document.querySelector('.fp-head__actions');
    const actionButtons = [...(actions?.querySelectorAll('.btn') || [])];
    const editor = document.querySelector('#workspace-plan-editor');
    const checker = document.querySelector('#workspace-plan-check');
    return {
      h1: document.querySelector('#main-content h1')?.textContent.trim() || '',
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      stageScrolls: !!stage && stage.scrollWidth > stage.clientWidth + 1,
      stageTabindex: stage?.getAttribute('tabindex') || '',
      stageRole: stage?.getAttribute('role') || '',
      stageLabel: stage?.getAttribute('aria-label') || '',
      tabsOverflow: !!tabs && tabs.scrollWidth > tabs.clientWidth,
      redundantReadonlyLabel: !!document.querySelector('.workspace-readonly'),
      mutationControls: document.querySelectorAll('input[type="file"],[contenteditable="true"],[data-editor-action],[data-checker-action],#workspace-floorplan').length,
      actionLabels: actionButtons.map((node) => node.textContent.replace(/\s+/g, ' ').trim()),
      actionsOverflow: actions ? Math.round(actions.scrollWidth - actions.clientWidth) : -1,
      editorVisible: !!editor && getComputedStyle(editor).display !== 'none',
      editorLabel: editor?.textContent.replace(/\s+/g, ' ').trim() || '',
      checkerVisible: !!checker && getComputedStyle(checker).display !== 'none',
      checkerLabel: checker?.textContent.replace(/\s+/g, ' ').trim() || '',
    };
  })()`);
  check(/Liebefeld/.test(mobile.h1), 'renders the floor preview on a narrow viewport', mobile.h1);
  check(mobile.overflow <= 1, 'mobile preview has no document overflow', `${mobile.overflow}px`);
  check(mobile.stageScrolls && mobile.stageTabindex === '0' && mobile.stageRole === 'group'
    && /Grundriss/.test(mobile.stageLabel),
  'makes the overflowing plan a named keyboard-scroll region', `${mobile.stageTabindex} · ${mobile.stageRole} · ${mobile.stageLabel}`);
  check(mobile.tabsOverflow, 'keeps the object registers horizontally scrollable');
  check(!mobile.redundantReadonlyLabel && mobile.mutationControls === 0,
    'keeps the mobile preview free of redundant labelling and mutation controls');
  check(mobile.actionLabels.join('|') === 'Vollbild|Drucken' && mobile.actionsOverflow <= 1,
    'keeps both shared viewer actions reachable on mobile', `${mobile.actionLabels.join(' · ')} · ${mobile.actionsOverflow}px overflow`);
  check(mobile.editorVisible && mobile.editorLabel === 'Im Plan-Editor bearbeiten',
    'keeps the separate Plan-Editor action reachable in the mobile sidebar', mobile.editorLabel);
  check(mobile.checkerVisible && mobile.checkerLabel === 'Planprüfung öffnen',
    'keeps the separate plan-check action reachable in the mobile sidebar', mobile.checkerLabel);
  const mobileAccess = await mobilePage.evaluate(ACCESSIBILITY);
  check(mobileAccess.unlabeledControls === 0, 'mobile preview controls have accessible labels');
  check(mobileAccess.duplicateIds.length === 0, 'mobile preview has no duplicate IDs', mobileAccess.duplicateIds.join(', '));
  await checkProblems(mobilePage, 'mobile floor preview has no runtime problems');
  await mobilePage.closeTarget();
} finally {
  cdp.close();
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
