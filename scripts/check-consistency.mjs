// Computed-value probes from the August 2026 design review. These cover KPI
// typography, panel borders, gutters, listbox chrome, and the purple focus ring
// within the header search field's overflow clipping.
import { launch, openPage, sleep, APP_BASE } from './lib/cdp.mjs';

let fails = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '  ok ' : '  ✗  '} ${label}${detail ? '  (' + detail + ')' : ''}`);
  if (!cond) fails++;
};

const cdp = await launch();

// C8: one large-number recipe; dashboard KPIs match .stat.
{
  const p = await openPage(cdp, APP_BASE + '/app/dataportal/immobilien');
  await sleep(2500);
  const r = JSON.parse(await p.evaluate(`(() => {
    const v = document.querySelector('.kpi__value');
    const cs = v ? getComputedStyle(v) : null;
    const panel = document.querySelector('.filter-panel');
    // Resolve the expected token in the active skin; body--intranet replaces
    // secondary-600, so a fixed hex value would test the wrong skin.
    const probe = document.createElement('span');
    probe.style.color = 'var(--color-secondary-600)';
    document.body.appendChild(probe);
    const expected = getComputedStyle(probe).color;
    probe.remove();
    return JSON.stringify({
      color: cs && cs.color, expected, numeric: cs && cs.fontVariantNumeric,
      panelBorder: panel && getComputedStyle(panel).borderTopColor,
    });
  })()`));
  ok(r.color === r.expected, 'C8 KPI number uses skin-aware secondary-600', `${r.color} = ${r.expected}`);
  ok(/tabular-nums/.test(r.numeric || ''), 'C8 KPI number uses tabular figures', r.numeric);
  ok(r.panelBorder === 'rgb(223, 228, 233)', 'C11 filter panel border equals --panel-border', r.panelBorder);
  await p.closeTarget();
}

// API docs: portal heading above standard Swagger. Former C20/C11 probes were
// retired with the custom implementation; test-apidocs covers Swagger itself.
// This check ensures one portal h1 and no duplicate Swagger information block.
{
  const p = await openPage(cdp, APP_BASE + '/app/api-docs');
  await sleep(2500);
  const r = JSON.parse(await p.evaluate(`(() => JSON.stringify({
    h1: document.querySelectorAll('#main-content h1').length,
    infoHidden: (() => { const i = document.querySelector('.swagger-host .information-container');
      return !i || getComputedStyle(i).display === 'none'; })(),
  }))()`));
  ok(r.h1 === 1, 'api-docs: exactly one portal h1', String(r.h1));
  ok(r.infoHidden, 'api-docs: Swagger information does not duplicate the heading', String(r.infoHidden));
  await p.closeTarget();
}

// C23: focused header search field has an inset purple ring.
{
  const p = await openPage(cdp, APP_BASE + '/');
  await sleep(1500);
  const r = JSON.parse(await p.evaluate(`(async () => {
    document.querySelector('.search__button').click();
    await new Promise((r) => setTimeout(r, 400));
    const input = document.querySelector('.search__form input');
    input.focus();
    await new Promise((r) => setTimeout(r, 100));
    const cs = getComputedStyle(input);
    return JSON.stringify({ focused: document.activeElement === input,
      color: cs.outlineColor, style: cs.outlineStyle, offset: cs.outlineOffset });
  })()`));
  ok(r.focused, 'C23 field is focused');
  ok(r.style === 'solid' && r.color === 'rgb(134, 85, 246)', 'C23 ring uses the purple CD focus colour', `${r.style} ${r.color}`);
  ok(r.offset === '-2px', 'C23 inset ring survives overflow clipping', r.offset);
  await p.closeTarget();
}

// C25: reading measure belongs to the column, not individual text classes.
{
  const p = await openPage(cdp, APP_BASE + '/services/raumbedarf-melden');
  await sleep(2000);
  const r = JSON.parse(await p.evaluate(`(() => {
    const main = document.querySelector('.container__main');
    const para = main && main.querySelector(':scope > p');
    return JSON.stringify({
      mainMax: main && getComputedStyle(main).maxWidth,
      paraMax: para && getComputedStyle(para).maxWidth,
    });
  })()`));
  ok(r.mainMax === '960px', 'C25 container__main measures 60rem', r.mainMax);
  ok(r.paraMax === 'none', 'C25 prose has no isolated 70ch cap', r.paraMax);
  await p.closeTarget();
}

// C7: dataset detail uses dl.kv--ruled instead of .data-rows.
{
  const p = await openPage(cdp, APP_BASE + '/data/catalog/1');
  await sleep(2000);
  const r = JSON.parse(await p.evaluate(`(() => JSON.stringify({
    ruled: document.querySelectorAll('dl.kv--ruled').length,
    dataRows: document.querySelectorAll('.data-rows').length,
  }))()`));
  ok(r.ruled >= 2 && r.dataRows === 0, 'C7 kv--ruled replaces data-rows', `ruled:${r.ruled} data-rows:${r.dataRows}`);
  await p.closeTarget();
}

// C24: stacked boxes follow contextual rhythm. A legacy 1px .box + .box seam
// previously overrode the column rhythm and joined separate sections.
{
  const p = await openPage(cdp, APP_BASE + '/services/raumbedarf-melden');
  await sleep(2200);
  const r = JSON.parse(await p.evaluate(`(() => {
    const boxes = [...document.querySelectorAll('.container__main .box')];
    if (boxes.length < 2) return JSON.stringify({ gap: null });
    const gap = boxes[1].getBoundingClientRect().top - boxes[0].getBoundingClientRect().bottom;
    return JSON.stringify({ gap: Math.round(gap) });
  })()`));
  ok(r.gap === null || r.gap >= 40, 'C24 box gap follows column rhythm', r.gap + 'px');
  await p.closeTarget();
}

// D2/B17: the panel reset uses the canonical German label and action-row wrapper.
{
  const p = await openPage(cdp, APP_BASE + '/services');
  await sleep(1800);
  const r = JSON.parse(await p.evaluate(`(() => {
    const a = [...document.querySelectorAll('.catbar__panel-actions .btn__text')].map((x) => x.textContent.trim());
    return JSON.stringify(a);
  })()`));
  ok(r.includes('Filter zurücksetzen'), 'B17/D2 canonical panel reset', JSON.stringify(r));
  await p.closeTarget();
}

await cdp.close();
console.log(fails ? `\n${fails} probe(s) failed` : '\nAll consistency probes passed.');
process.exit(fails ? 1 : 0);
