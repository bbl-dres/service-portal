// Der Strukturbaum der Seitenspalte (`.pf-tree`) — Portfolio, Bauprojekte und
// Mietende bauen ihn nach demselben Bauplan: ein <li class="pf-tree__item"> je
// Ebene, dessen Knopf die Ebenen als `data-land` / `data-region` / `data-city` /
// `data-we` trägt, die Zahl rechts in `<span class="pf-tree__n">`, und Blätter
// mit `data-obj`.
//
// Seit der Konsistenz-Review (docs/design-review.md, A1) wohnt hier der GANZE
// Bauplan, nicht nur die Zähler: Aufbau (treeHTML), Zweiton-Markierung
// (markTree: `is-active` auf dem gewählten Knoten, `is-path` auf den Vorfahren),
// Klick-Verdrahtung (wireTree) und URL-Wiederherstellung (restoreTreeSelection).
// Vorher trugen die drei Explorer je eine fast wortgleiche Kopie — und die
// Kopie im Mietendenportal war bereits abgedriftet: sie markierte mit
// `is-selected`, wofür am Baum keine CSS-Regel existiert, die Auswahl blieb
// dort also unsichtbar. Die vierte, bewusst andere Link-Variante des
// Metadatenkatalogs (Hash-Links statt Buttons, dort dokumentiert) bleibt eigen.
//
// Der Baum wird EINMAL gerendert und danach nie neu — sonst gingen aufgeklappte
// Äste und die Auswahl verloren. Deshalb werden die Zahlen nachgeführt statt
// neu erzeugt.

// Zahlen und Sichtbarkeit an die aktuelle Filterlage angleichen.
//
// `sichtbar` ist die Liste, die NACH Suche und Facetten übrig bleibt — aber
// BEWUSST ohne die Auswahl im Baum selbst: sonst bliebe nach einem Klick nur
// der geklickte Ast mit einer «1» stehen, und der Baum wäre keine Navigation
// mehr, sondern eine Sackgasse.
//
// `ebenen(eintrag)` liefert je Eintrag die Ebenenwerte in der Reihenfolge
// land · region · city · we (kürzere Bäume geben entsprechend weniger zurück),
// `idOf(eintrag)` die ID, die an den Blättern in `data-obj` steht.
export function syncTreeCounts(root, sichtbar, ebenen, idOf) {
  if (!root) return;
  // Ein Zähler je Pfadpräfix: «CH», «CH▸BE», «CH▸BE▸Bern», …
  const zaehler = new Map();
  for (const e of sichtbar) {
    const stufen = ebenen(e);
    for (let i = 0; i < stufen.length; i++) {
      const k = stufen.slice(0, i + 1).join('▸');
      zaehler.set(k, (zaehler.get(k) || 0) + 1);
    }
  }
  const ids = new Set(sichtbar.map(idOf));

  root.querySelectorAll('.pf-tree__node').forEach((btn) => {
    const d = btn.dataset;
    const stufen = [d.land, d.region, d.city, d.we].filter((x) => x !== undefined);
    const n = zaehler.get(stufen.join('▸')) || 0;
    const feld = btn.querySelector('.pf-tree__n');
    if (feld) feld.textContent = String(n);
    // Leere Äste ausblenden statt eine «0» anzubieten, die ins Nichts führt.
    btn.closest('.pf-tree__item').hidden = n === 0;
  });
  root.querySelectorAll('.pf-tree__leaf').forEach((btn) => {
    btn.closest('.pf-tree__item').hidden = !ids.has(btn.dataset.obj);
  });
}

// --- Aufbau ------------------------------------------------------------------
// `levels` beschreibt die Gruppierungsstufen von aussen nach innen:
//   { key: 'land', attr: 'land', icon: 'Globe', label: (wert, eintraege) => …,
//     idText: (wert, eintraege) => …, sort: (a, b, label) => … }
// `attr` ist der data-Attributname (Standard: key) — Mietende gruppiert nach
// `canton`, trägt ihn aber als `data-region`, damit die Auswahl-Schlüssel über
// alle drei Explorer gleich heissen. `leaf` beschreibt das Blatt:
//   { icon: (o) => …, idText: (o) => …, label: (o) => …, objId: (o) => …, sort }
// Blätter tragen automatisch die data-Attribute ALLER Vorfahrenstufen plus
// `data-obj` — genau die Form, die syncTreeCounts/wireTree/restore lesen.
const byDe = (a, b) => String(a).localeCompare(String(b), 'de');

export function treeHTML(C, objects, { levels, leaf }) {
  const esc = C.escape;
  const rowContent = (ic, idText, label) => `${C.icon(ic, 'pf-tree__ico')}${
    idText ? `<span class="pf-tree__id">${esc(idText)}</span>` : ''}<span class="pf-tree__label">${esc(label)}</span>`;
  const nodeHTML = (content, count, attrs, children) => `<li class="pf-tree__item">
      <button type="button" class="pf-tree__node interactive-control" ${attrs} aria-expanded="false">
        ${C.icon('ChevronRight', 'pf-tree__chev')}${content}<span class="pf-tree__n">${count}</span>
      </button>
      <ul class="pf-tree__children" hidden>${children}</ul></li>`;

  const attrPairs = (pairs) => pairs.map(([a, v]) => `data-${a}="${esc(v)}"`).join(' ');

  const build = (items, depth, ancestors) => {
    if (depth === levels.length) {
      const sorted = leaf.sort ? items.slice().sort(leaf.sort) : items;
      return sorted.map((o) => `<li class="pf-tree__item"><button type="button" class="pf-tree__leaf interactive-control" ${
        attrPairs([...ancestors, ['obj', leaf.objId(o)]])}>${
        rowContent(leaf.icon(o), leaf.idText ? leaf.idText(o) : '', leaf.label(o))}</button></li>`).join('');
    }
    const lv = levels[depth];
    const attr = lv.attr || lv.key;
    const groups = new Map();
    for (const o of items) {
      const k = o[lv.key];
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(o);
    }
    const label = (k, es) => (lv.label ? lv.label(k, es) : k);
    const keys = [...groups.keys()].sort(lv.sort || ((a, b) => byDe(label(a, groups.get(a)), label(b, groups.get(b)))));
    return keys.map((k) => {
      const es = groups.get(k);
      const pairs = [...ancestors, [attr, k]];
      return nodeHTML(rowContent(lv.icon, lv.idText ? lv.idText(k, es) : '', label(k, es)), es.length,
        attrPairs(pairs), build(es, depth + 1, pairs));
    }).join('');
  };
  return `<ul class="pf-tree">${build(objects, 0, [])}</ul>`;
}

// Zweiton-Markierung: der gewählte Knoten ist «aktiv» (blaue Innenkante), sein
// Vorfahrenpfad (Land › Region › Stadt › WE) «Pfad» (helles Grau) — die
// Drill-down-Kette ist damit auf einen Blick sichtbar, obwohl der Einzug flach ist.
export function markTree(sidebar, activeNode) {
  sidebar.querySelectorAll('.pf-tree__node, .pf-tree__leaf').forEach((n) => n.classList.remove('is-active', 'is-path'));
  if (!activeNode) return;
  activeNode.classList.add('is-active');
  let li = activeNode.closest('.pf-tree__item');
  while (li) {
    const ul = li.parentElement;
    if (!ul || !ul.classList.contains('pf-tree__children')) break;   // oberste Liste erreicht
    const parentNode = ul.parentElement.querySelector(':scope > .pf-tree__node');
    if (parentNode) parentNode.classList.add('is-path');
    li = ul.parentElement;
  }
}

// Klick-Verdrahtung: Knoten klappen auf/zu und wählen ihre Ebene aus, Blätter
// wählen das Objekt (`sel.id`). `onSelect(sel, node)` erhält die Auswahl als
// Objekt über den `attrs`-Schlüsseln; markTree und der Auswahl-zurücksetzen-
// Knopf (`clearBtn`, versteckt bei leerer Auswahl) werden hier gepflegt.
export function wireTree(sidebar, { attrs = ['land', 'region', 'city', 'we'], onSelect, clearBtn } = {}) {
  const select = (sel, node) => {
    markTree(sidebar, node);
    if (clearBtn) clearBtn.hidden = !Object.keys(sel).length;
    onSelect(sel, node);
  };
  sidebar.addEventListener('click', (e) => {
    const leafBtn = e.target.closest('.pf-tree__leaf');
    if (leafBtn) {   // Blatt: auf das Objekt filtern (+ ggf. Karten-Popup) — kein Detail-Sprung
      const sel = {};
      for (const k of attrs) if (leafBtn.dataset[k]) sel[k] = leafBtn.dataset[k];
      sel.id = leafBtn.dataset.obj;
      select(sel, leafBtn);
      return;
    }
    const nd = e.target.closest('.pf-tree__node'); if (!nd) return;
    const item = nd.closest('.pf-tree__item');
    const kids = item.querySelector(':scope > .pf-tree__children');
    const expanded = nd.getAttribute('aria-expanded') === 'true';
    nd.setAttribute('aria-expanded', String(!expanded));
    if (kids) kids.hidden = expanded;
    const sel = {};
    for (const k of attrs) if (nd.dataset[k] != null) sel[k] = nd.dataset[k];
    select(sel, nd);
  });
  if (clearBtn) clearBtn.addEventListener('click', () => select({}, null));
}

// Baum-Auswahl aus der URL wiederherstellen: den passenden Knoten suchen, seinen
// Pfad aufklappen und markieren. Die FILTERUNG wirkt über den App-Zustand
// ohnehin — hier geht es um die sichtbare Hervorhebung im Baum. Vergleich über
// dataset statt Attribut-Selektor, weil die SAP-ids «/» enthalten.
export function restoreTreeSelection(sidebar, sel, { attrs = ['land', 'region', 'city', 'we'], clearBtn } = {}) {
  if (!sel || !Object.keys(sel).length) return null;
  const btn = sel.id
    ? [...sidebar.querySelectorAll('.pf-tree__leaf')].find((n) => n.dataset.obj === sel.id)
    : [...sidebar.querySelectorAll('.pf-tree__node')].find((n) =>
        attrs.every((k) => (n.dataset[k] || '') === (sel[k] || '')));
  if (!btn) return null;
  let li = btn.closest('.pf-tree__item');
  while (li) {
    const ul = li.parentElement;
    if (!ul || !ul.classList.contains('pf-tree__children')) break;
    ul.hidden = false;
    const pn = ul.parentElement.querySelector(':scope > .pf-tree__node');
    if (pn) pn.setAttribute('aria-expanded', 'true');
    li = ul.parentElement;
  }
  // Wie beim Klick: ein wiederhergestellter Knoten zeigt auch seine Kinder.
  if (btn.classList.contains('pf-tree__node')) {
    const kids = btn.closest('.pf-tree__item').querySelector(':scope > .pf-tree__children');
    btn.setAttribute('aria-expanded', 'true');
    if (kids) kids.hidden = false;
  }
  markTree(sidebar, btn);
  if (clearBtn) clearBtn.hidden = false;
  return btn;
}
