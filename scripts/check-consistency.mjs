// Konsistenz-Proben der Design-Review-Welle (docs/design-review.md, Aug 2026):
// misst die riskanten COMPUTED-Werte statt Markup — Grossziffer-Typografie,
// Panel-Randton, Rinnenbreiten, Listbox-Chrome und den Nutzerbefund C23
// (purpurner Fokusring am Kopf-Suchfeld trotz overflow:hidden).
import { launch, openPage, sleep, APP_BASE } from './lib/cdp.mjs';

let fails = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '  ok ' : '  ✗  '} ${label}${detail ? '  (' + detail + ')' : ''}`);
  if (!cond) fails++;
};

const cdp = await launch();

// --- C8: EINE Grossziffer-Typografie (Dashboard-KPI = .stat-Rezept) ----------
{
  const p = await openPage(cdp, APP_BASE + '/app/dataportal/immobilien');
  await sleep(2500);
  const r = JSON.parse(await p.evaluate(`(() => {
    const v = document.querySelector('.kpi__value');
    const cs = v ? getComputedStyle(v) : null;
    const panel = document.querySelector('.filter-panel');
    // Erwartungswert TOKENBASIERT auflösen — der Skin (body--intranet) tauscht
    // secondary-600; ein fester Hex prüfte sonst den falschen Skin.
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
  ok(r.color === r.expected, 'C8 KPI-Ziffer in secondary-600 (skin-bewusst)', `${r.color} = ${r.expected}`);
  ok(/tabular-nums/.test(r.numeric || ''), 'C8 KPI-Ziffer mit Tabellenziffern', r.numeric);
  ok(r.panelBorder === 'rgb(223, 228, 233)', 'C11 Filterpanel-Rand = --panel-border', r.panelBorder);
  await p.closeTarget();
}

// --- C20/C11: api-docs — Rinnenbreite wie die Geschwister-Rails, Panel-Rand --
{
  const p = await openPage(cdp, APP_BASE + '/app/api-docs');
  await sleep(2000);
  const r = JSON.parse(await p.evaluate(`(() => {
    const l = document.querySelector('.api-layout');
    const m = document.querySelector('.api-meta');
    return JSON.stringify({
      gap: l && getComputedStyle(l).columnGap,
      metaBorder: m && getComputedStyle(m).borderTopColor,
    });
  })()`));
  ok(r.gap === '20px', 'C20 .api-layout-Rinne = 1.25rem wie pf-/dashboard-layout', r.gap);
  ok(r.metaBorder === 'rgb(223, 228, 233)', 'C11 .api-meta-Rand = --panel-border', r.metaBorder);
  await p.closeTarget();
}

// --- C23 (Nutzerbefund): Kopf-Suchfeld fokussiert = purpurner INSET-Ring -----
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
  ok(r.focused, 'C23 Feld ist fokussiert');
  ok(r.style === 'solid' && r.color === 'rgb(134, 85, 246)', 'C23 Fokusring purpur (CD focus-ring)', `${r.style} ${r.color}`);
  ok(r.offset === '-2px', 'C23 Ring INSET (übersteht das overflow:hidden)', r.offset);
  await p.closeTarget();
}

// --- C7: Datensatz-Detail nutzt dl.kv (kv--ruled) statt .data-rows -----------
{
  const p = await openPage(cdp, APP_BASE + '/data/catalog/1');
  await sleep(2000);
  const r = JSON.parse(await p.evaluate(`(() => JSON.stringify({
    ruled: document.querySelectorAll('dl.kv--ruled').length,
    dataRows: document.querySelectorAll('.data-rows').length,
  }))()`));
  ok(r.ruled >= 2 && r.dataRows === 0, 'C7 kv--ruled statt data-rows', `ruled:${r.ruled} data-rows:${r.dataRows}`);
  await p.closeTarget();
}

// --- C24 (Nutzerbefund): gestapelte Kästen folgen dem Kontextrhythmus --------
// «Das brauchen Sie» + «So läuft es ab» klebten als EIN Block zusammen — das
// 1px-Naht-Fossil (.box + .box) schlug den Spaltenrhythmus.
{
  const p = await openPage(cdp, APP_BASE + '/services/raumbedarf-melden');
  await sleep(2200);
  const r = JSON.parse(await p.evaluate(`(() => {
    const boxes = [...document.querySelectorAll('.container__main .box')];
    if (boxes.length < 2) return JSON.stringify({ gap: null });
    const gap = boxes[1].getBoundingClientRect().top - boxes[0].getBoundingClientRect().bottom;
    return JSON.stringify({ gap: Math.round(gap) });
  })()`));
  ok(r.gap === null || r.gap >= 40, 'C24 Kasten-Abstand = Spaltenrhythmus (kein 1px-Fossil)', r.gap + 'px');
  await p.closeTarget();
}

// --- D2/B17: Panel-Reset heisst «Filter zurücksetzen» und sitzt im Aktionszeilen-Wrapper
{
  const p = await openPage(cdp, APP_BASE + '/services');
  await sleep(1800);
  const r = JSON.parse(await p.evaluate(`(() => {
    const a = [...document.querySelectorAll('.catbar__panel__actions .btn__text')].map((x) => x.textContent.trim());
    return JSON.stringify(a);
  })()`));
  ok(r.includes('Filter zurücksetzen'), 'B17/D2 kanonischer Panel-Reset', JSON.stringify(r));
  await p.closeTarget();
}

await cdp.close();
console.log(fails ? `\n✗ ${fails} Probe(n) FEHLGESCHLAGEN` : '\nAlle Konsistenz-Proben grün.');
process.exit(fails ? 1 : 0);
