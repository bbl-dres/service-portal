const compareGerman = (a, b) => String(a).localeCompare(String(b), 'de');
const camel = (value) => String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
const nodeId = (prefix, values) => `${prefix}:${values.map((value) => encodeURIComponent(String(value))).join(':')}`;

// Convert a flat object collection into the node contract consumed by
// sidebarTree. `attr` is the selection-state key; `key` remains the data field.
export function objectsToNodes(objects, { levels, leaf }, selection = {}) {
  const attributes = levels.map((level) => camel(level.attr || level.key));
  const deeperKeys = [...attributes, 'obj', 'sub'];
  const hasValue = (value) => value !== undefined && value !== null && value !== '';

  const stateOf = (pairs) => {
    if (!pairs.every(([attribute, value]) => String(selection[attribute]) === String(value))) return '';
    const current = pairs[pairs.length - 1][0];
    const below = deeperKeys.slice(deeperKeys.indexOf(current) + 1);
    return below.some((key) => hasValue(selection[key])) ? 'path' : 'active';
  };

  const build = (items, depth, pairs) => {
    if (depth === levels.length) {
      const sorted = leaf.sort ? items.slice().sort(leaf.sort) : items;
      return sorted.map((object) => {
        const objectId = leaf.objId(object);
        const own = [...pairs, ['obj', objectId]];
        const children = (leaf.children ? leaf.children(object) : null) || [];
        return {
          id: nodeId('obj', [objectId]),
          label: leaf.label(object),
          idText: leaf.idText ? leaf.idText(object) : '',
          srPrefix: leaf.word || '',
          icon: leaf.icon(object),
          count: leaf.count ? leaf.count(object) : null,
          countUnit: leaf.countWord || '',
          state: stateOf(own),
          sel: Object.fromEntries(own),
          split: children.length > 0,
          hasChildren: children.length > 0,
          children: () => children.map((child) => ({
            id: nodeId('sub', [objectId, child.id]),
            label: child.label,
            idText: child.idText || '',
            srPrefix: leaf.subWord || '',
            icon: child.icon || 'lucide/layers',
            state: stateOf([...own, ['sub', child.id]]),
            sel: Object.fromEntries([...own, ['sub', child.id]]),
          })),
        };
      });
    }

    const definition = levels[depth];
    const attribute = camel(definition.attr || definition.key);
    const groups = new Map();
    for (const object of items) {
      if (!groups.has(object[definition.key])) groups.set(object[definition.key], []);
      groups.get(object[definition.key]).push(object);
    }
    const label = (key, entries) => (definition.label ? definition.label(key, entries) : key);
    return [...groups.keys()]
      .sort(definition.sort || ((a, b) => compareGerman(label(a, groups.get(a)), label(b, groups.get(b)))))
      .map((key) => {
        const entries = groups.get(key);
        const own = [...pairs, [attribute, key]];
        return {
          id: nodeId(attribute, own.map(([, value]) => value)),
          label: label(key, entries),
          idText: definition.idText ? definition.idText(key, entries) : '',
          srPrefix: definition.word || '',
          icon: definition.icon,
          count: entries.length,
          countUnit: definition.countWord || 'Objekte',
          state: stateOf(own),
          sel: Object.fromEntries(own),
          split: true,
          hasChildren: entries.length > 0,
          children: () => build(entries, depth + 1, own),
        };
      });
  };

  return build(Array.isArray(objects) ? objects : [], 0, []);
}
