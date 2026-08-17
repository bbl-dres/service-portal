import { catalogueNodeId, readState } from '../js/apps/metadata-catalog.js';
import { landscapeKey, landscapeState } from '../js/ui/landscape-state.js';
import { objectsToNodes } from '../js/ui/spatial-tree.js';

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};

let objects = [];
const core = {
  businessObjects: () => objects,
  businessObject: (id) => objects.find((item) => item.objectId === id),
  dataDomains: () => [{ key: 'property', label: 'Property' }],
  contacts: () => [],
  ref: () => ({ objectStatuses: [] }),
};
const query = new URLSearchParams('kind=objekt');
check(readState({ query, core }).rows.length === 0, 'an initially empty collection stays renderable');
objects = [{ objectId: 'building', name: 'Building', domain: 'property', attributes: [] }];
check(readState({ query, core }).rows.length === 1,
  'a later render observes a recovered collection on the same core instance');
const recordState = readState({ query: new URLSearchParams('id=building'), core });
check(recordState.lvl === 3 && recordState.tab === 'uebersicht',
  'record deep links default to the information overview');
check(readState({ query: new URLSearchParams('id=building&tab=tabelle'), core }).tab === 'tabelle',
  'an explicit record table view remains supported');
const failedState = readState({
  query: new URLSearchParams('id=building'),
  core: { ...core, available: (key) => key !== 'businessObjects' },
});
check(!failedState.available && !failedState.missing && failedState.rows.length === 0,
  'a failed branch remains unavailable instead of masquerading as an empty or missing record');

const firstKey = landscapeKey('branch:objects', 'axis', 'same label');
const secondKey = landscapeKey('branch:systems', 'axis', 'same label');
const thirdKey = landscapeKey('branch:objects', 'status', 'same label');
check(firstKey !== secondKey && firstKey !== thirdKey,
  'landscape fold keys include scope and grouping axis');
check(firstKey.includes('%3A'), 'landscape key parts encode separators', firstKey);
check(catalogueNodeId('record', 'objekt', 'shared')
  !== catalogueNodeId('record', 'tabelle', 'shared'),
  'tree record identifiers include their dataset branch');
check(catalogueNodeId('attr', 'objekt', 'shared', 'name:part').includes('name%3Apart'),
  'tree attribute identifiers encode delimiter-bearing names');

const folds = landscapeState(`test-${Date.now()}`);
check(folds.isOpen(firstKey), 'landscape boxes default open');
folds.setAll([firstKey, secondKey], false);
check(!folds.isOpen(firstKey) && !folds.isOpen(secondKey), 'bulk folding updates every requested key');
folds.toggle(firstKey);
check(folds.isOpen(firstKey) && !folds.isOpen(secondKey), 'single-box folding stays independent');

const nodes = objectsToNodes([
  { group: 'a:b', id: 'x:y', name: 'Encoded' },
], {
  levels: [{ key: 'group' }],
  leaf: {
    objId: (item) => item.id, label: (item) => item.name,
    icon: () => 'lucide/boxes',
  },
});
check(nodes[0].id === 'group:a%3Ab' && nodes[0].children()[0].id === 'obj:x%3Ay',
  'spatial-tree identifiers encode delimiter-bearing data');
check(objectsToNodes(null, { levels: [], leaf: {} }).length === 0,
  'spatial-tree conversion tolerates a missing collection');

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
