// Aus einer FLACHEN Objektliste eine Hierarchie machen — und sonst nichts.
//
// Bis zum 14.08.2026 stand hier auch das Zeichnen: eigenes Markup, eigene
// Markierung, eigene Klickverdrahtung, eigene Wiederherstellung aus der
// Adresse. Acht Oberflaechen benutzten das, das Seitenbaum-Bauteil
// (js/ui/components/sidebar-tree.js) konnte dasselbe besser, und zwei
// Implementierungen desselben Dings laufen zuverlaessig auseinander — sie
// waren es bereits: 94 Pflichtsymbole, eine Trennlinie je Zeile, und ein Kind,
// das acht Pixel LINKS von seinem Elter stand.
//
// Geblieben ist der Teil, den das Bauteil nicht hat und nicht haben soll: das
// Gruppieren ueber `levels`. Heraus kommen Knoten, die C.sidebarTree zeichnet.
//
// `sel` ist die Auswahl in der Form, die frueher `wireTree` lieferte
// ({country, region, city, businessEntity, obj, sub}). Daraus faellt die
// Markierung ab: passt sie genau, ist der Knoten «active»; passt sie als
// Anfangsstueck, liegt er auf dem Weg dorthin. Damit erledigen sich markTree
// und restoreTreeSelection — beides heisst jetzt «mit dem Zustand zeichnen».

const compareGerman = (a, b) => String(a).localeCompare(String(b), 'de');

// `attr` hiess frueher: SO heisst das data-Attribut im Markup. Gelesen wurde es
// aber ueber `dataset`, und das macht aus `data-business-entity` von selbst
// `businessEntity` — den Schluessel, unter dem die Anwendung ihre Auswahl fuehrt.
// Diese Umwandlung ist also Teil des Vertrags, nicht Beiwerk des DOM: ohne sie
// bekam das Portfolio `'business-entity'`, einen Schluessel, den `inSel` nie
// liest — die Wirtschaftseinheit sah gewaehlt aus und filterte nichts.
//
// Bei den Mietverhaeltnissen zeigt sich die andere Haelfte: dort ist `key`
// (`canton`) das Datenfeld und `attr` (`region`) der Zustandsschluessel. Beide
// Faelle trifft dieselbe Regel.
const camel = (s) => String(s).replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export function objectsToNodes(objects, { levels, leaf }, sel = {}) {
  const attrs = levels.map((l) => camel(l.attr || l.key));
  const deeperKeys = [...attrs, 'obj', 'sub'];
  const has = (v) => v !== undefined && v !== null && v !== '';

  const stateOf = (pairs) => {
    if (!pairs.every(([a, v]) => String(sel[a]) === String(v))) return '';
    // Auf dem Weg, wenn unterhalb noch etwas gewaehlt ist; sonst ist DIES die
    // Auswahl.
    const below = deeperKeys.slice(deeperKeys.indexOf(pairs[pairs.length - 1][0]) + 1);
    return below.some((k) => has(sel[k])) ? 'path' : 'active';
  };

  const build = (items, depth, pairs) => {
    if (depth === levels.length) {
      const sorted = leaf.sort ? items.slice().sort(leaf.sort) : items;
      return sorted.map((o) => {
        const own = [...pairs, ['obj', leaf.objId(o)]];
        // Die Ebene UNTER dem Blatt — die Geschosse im Plan-Editor, die einzige
        // Stelle, an der das Gewaehlte im Objekt steckt statt daneben. Sie
        // trifft genau auf die Funktions-Kinder, die das Bauteil fuer die langen
        // Attributlisten des Katalogs schon hat: dieselbe Mechanik, zwei Anlaesse.
        const kids = (leaf.children ? leaf.children(o) : null) || [];
        return {
          id: `obj:${leaf.objId(o)}`,
          label: leaf.label(o),
          idText: leaf.idText ? leaf.idText(o) : '',
          srPrefix: leaf.word || '',
          icon: leaf.icon(o),
          count: leaf.count ? leaf.count(o) : null,
          countUnit: leaf.countWord || '',
          state: stateOf(own),
          sel: Object.fromEntries(own),
          split: kids.length > 0,
          hasChildren: kids.length > 0,
          children: () => kids.map((c) => ({
            id: `sub:${leaf.objId(o)}:${c.id}`,
            label: c.label,
            idText: c.idText || '',
            srPrefix: leaf.subWord || '',
            icon: c.icon || 'tree/layers',
            state: stateOf([...own, ['sub', c.id]]),
            sel: Object.fromEntries([...own, ['sub', c.id]]),
          })),
        };
      });
    }
    const def = levels[depth];
    const attribute = camel(def.attr || def.key);
    const groups = new Map();
    for (const o of items) {
      if (!groups.has(o[def.key])) groups.set(o[def.key], []);
      groups.get(o[def.key]).push(o);
    }
    const label = (k, es) => (def.label ? def.label(k, es) : k);
    return [...groups.keys()]
      .sort(def.sort || ((a, b) => compareGerman(label(a, groups.get(a)), label(b, groups.get(b)))))
      .map((key) => {
        const entries = groups.get(key);
        const own = [...pairs, [attribute, key]];
        return {
          id: `${attribute}:${own.map(([, v]) => v).join('▸')}`,
          label: label(key, entries),
          idText: def.idText ? def.idText(key, entries) : '',
          srPrefix: def.word || '',
          icon: def.icon,
          count: entries.length,
          countUnit: def.countWord || 'Objekte',
          state: stateOf(own),
          sel: Object.fromEntries(own),
          split: true,
          hasChildren: entries.length > 0,
          children: () => build(entries, depth + 1, own),
        };
      });
  };

  return build(objects, 0, []);
}
