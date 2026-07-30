// Der Strukturbaum der Seitenspalte (`.pf-tree`) — Portfolio, Bauprojekte und
// Mietende bauen ihn nach demselben Bauplan: ein <li class="pf-tree__item"> je
// Ebene, dessen Knopf die Ebenen als `data-land` / `data-region` / `data-city` /
// `data-we` trägt, die Zahl rechts in `<span class="pf-tree__n">`, und Blätter
// mit `data-obj`.
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
