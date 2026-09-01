// Template helpers accept text by default. The few author-owned raw-markup
// slots must be explicitly named so data and user input cannot drift into an
// innerHTML sink unnoticed.
import C from '../js/components.js';
import { floorplanSvg } from '../js/ui/floorplan.js';

let failures = 0;
const check = (condition, label, actual = '') => {
  console.log(`${condition ? '✓' : '✗'} ${label}${actual ? ` (${actual})` : ''}`);
  if (!condition) failures++;
};

const payload = '<img src=x onerror="globalThis.compromised=true">';
const notice = C.notification(payload, 'error');
check(notice.includes('&lt;img') && !notice.includes('<img') && !notice.includes('onerror="'),
  'notification treats its content as text');

const hostileNoticeVariant = C.notification('Notice', `error" onclick="alert(1)`);
check(hostileNoticeVariant.includes('notification--info') && !hostileNoticeVariant.includes('onclick='),
  'notification variants use the component enum');

const authorNotice = C.notificationHtml('<strong>Author-owned notice</strong>', 'info');
check(authorNotice.includes('<strong>Author-owned notice</strong>'),
  'notificationHtml is the explicit author-markup contract');

const gate = C.loginGate(payload);
check(gate.includes('&lt;img') && !gate.includes('<img'), 'login gate text is escaped');

const empty = C.empty('Nothing', { hint: payload });
check(empty.includes('&lt;img') && !empty.includes('<img'), 'empty-state hints are escaped');

const catalogueNote = C.catalogueResults({
  visible: [], count: 0, card: () => '', listView: () => '', unit: 'Einträge', note: payload,
});
const catalogueNoteHtml = C.catalogueResults({
  visible: [], count: 0, card: () => '', listView: () => '', unit: 'Einträge',
  noteHtml: '<a href="#/safe">Author note</a>',
});
check(catalogueNote.includes('&lt;img') && !catalogueNote.includes('<img')
  && catalogueNoteHtml.includes('<a href="#/safe">Author note</a>'),
  'catalogue notes default to text and expose an explicit author-markup slot');

const completed = C.processDone({
  instance: { reference: 'R-1' }, lead: 'Saved', title: 'Done', text: payload,
});
check(completed.includes('&lt;img') && !completed.includes('<img'),
  'process completion explanatory text is escaped');

const hostileCompleted = C.processDone({
  instance: { reference: 'R-1' }, lead: 'Saved', title: 'Done', text: 'Text',
  heading: 'h1><img src=x onerror=alert(1)>',
  actions: [{ href: 'javascript:alert(1)', label: 'Unsafe', variant: 'filled" onclick="alert(1)' }],
});
check(hostileCompleted.includes('<h1 tabindex="-1"')
  && hostileCompleted.includes('aria-disabled="true"')
  && !hostileCompleted.includes('javascript:') && !hostileCompleted.includes('onclick='),
  'process completion constrains heading, button modifier, and action URL');

const header = C.pageHeader({ title: 'Title', lead: payload });
const authorHeader = C.pageHeader({ title: 'Title', leadHtml: '<a href="#/safe">Safe</a>' });
check(header.includes('&lt;img') && !header.includes('<img')
  && authorHeader.includes('<a href="#/safe">Safe</a>'),
  'page headers separate text leads from explicit author markup');

const photo = C.photo({ src: 'assets/images/social-preview.jpg', alt: 'Image' });
check(photo.includes('data-photo-fallback') && !photo.includes('onerror='),
  'photo fallback uses delegated handling rather than executable inline attributes');
check(photo.includes('loading="lazy"') && !photo.includes('fetchpriority='),
  'ordinary photos remain lazy and do not claim high fetch priority');
const eagerPhoto = C.photo({ src: 'assets/images/social-preview.jpg', alt: 'Image', loading: 'eager' });
check(eagerPhoto.includes('loading="eager"') && eagerPhoto.includes('fetchpriority="high"'),
  'above-the-fold photos can opt into eager high-priority loading');

const hostileIcon = C.icon(`ArrowRight');color:red/*`, `icon--base" onmouseover="alert(1)`);
check(hostileIcon.includes('InfoCircle.svg') && hostileIcon.includes('class="icon icon--base"')
  && !hostileIcon.includes('onmouseover') && !hostileIcon.includes('color:red'),
  'icon names and class tokens cannot escape markup or inline CSS');

const pipeline = C.pipeline([
  { label: 'Eingereicht' }, { label: 'In Prüfung' }, { label: 'Erledigt' },
], 1, { label: 'Status des Vorgangs' });
const pipelineTodo = pipeline.match(/<li class="pipeline__step pipeline__step--todo"[^>]*>([\s\S]*?)<\/li>/)?.[1] || '';
check((pipeline.match(/pipeline__step--done/g) || []).length === 1
  && (pipeline.match(/pipeline__step--active/g) || []).length === 1
  && (pipeline.match(/pipeline__step--todo/g) || []).length === 1,
  'pipeline renders the exact completed, current, and upcoming state sequence');
check(pipeline.includes('assets/icons/lucide/circle-check-big.svg')
  && pipeline.includes('assets/icons/lucide/clock-3.svg')
  && (pipeline.match(/class="icon icon--md pipeline__glyph"/g) || []).length === 2
  && (pipeline.match(/aria-hidden="true"/g) || []).length === 2
  && !pipelineTodo.includes('pipeline__glyph'),
  'pipeline uses medium decorative Lucide glyphs only for completed and current steps');
check(pipeline.includes('role="group" aria-label="Status des Vorgangs"')
  && (pipeline.match(/aria-current="step"/g) || []).length === 1
  && pipeline.includes('<span class="sr-only">Erledigt: </span>')
  && pipeline.includes('<span class="sr-only">Aktueller Schritt: </span>'),
  'pipeline exposes one current step and textual state equivalents');

const hostilePhoto = C.photo({
  src: 'assets/images/social-preview.jpg', cls: `safe-class bad" onclick="alert(1)`,
  color: 'red;background-image:url(https://attacker.invalid)',
  overlayHtml: '<span>Author overlay</span>',
});
check(hostilePhoto.includes('class="photo safe-class"')
  && hostilePhoto.includes('background-color:var(--color-secondary-600)')
  && !hostilePhoto.includes('onclick=') && !hostilePhoto.includes('attacker.invalid')
  && hostilePhoto.includes('<span>Author overlay</span>'),
  'photo classes and colours are constrained while overlayHtml stays explicit');
check(!C.photo({ src: 'assets/images/../../data/applications.json' }).includes('<img'),
  'photo sources cannot traverse outside the local asset tree');

const hostileBadge = C.badge('State', `error" onclick="alert(1)`, `sm" title="x`);
check(hostileBadge.includes('badge--gray') && !hostileBadge.includes('onclick=') && !hostileBadge.includes('title='),
  'badge modifier values are constrained to the component enum');

const hostileSelect = C.select({
  id: 'safe', label: 'Safe', options: [], size: `sm" onclick="alert(1)`,
  variant: `negative" autofocus`, wrapClass: `safe-wrap bad" onclick="alert(1)`,
  message: 'No', messageType: `error" onclick="alert(1)`,
});
check(hostileSelect.includes('input--outline input--base')
  && hostileSelect.includes('class="form__group__select safe-wrap"')
  && hostileSelect.includes('badge--error') && !hostileSelect.includes('onclick='),
  'select sizes, variants, wrappers, and message variants are constrained');

const hostileFloorplan = floorplanSvg({
  floor: { label: '<image href=x>', extent: ['4000" onload="alert(1)', 1440] },
  spaces: [{
    spaceId: 'safe-space', roomNumber: '1.01', useLabel: 'Office', area: 12,
    group: 'x"><image href=x onerror=alert(1)>', sia: 'HNF', rect: ['0" onload="alert(1)', 0, 400, 500],
  }],
  statuses: { 'safe-space': 'available" onload="alert(1)' },
});
check(hostileFloorplan.includes('fp__room--infra')
  && hostileFloorplan.includes('viewBox="-40 -40 4080 1520"')
  && hostileFloorplan.includes('<rect x="0" y="0" width="400" height="500"')
  && !hostileFloorplan.includes('<image') && !hostileFloorplan.includes('onload='),
  'floor-plan SVG constrains class tokens and coerces geometry to finite numbers');

const hostileTabs = C.tabBar({
  items: [{ id: 'x\" autofocus onfocus="alert(1)', label: 'Unsafe' }],
  active: 'x\" autofocus onfocus="alert(1)', idPrefix: 'tabs\" onclick="alert(1)',
  controlsClass: 'safe bad\" onclick="alert(1)',
});
check(hostileTabs.includes('id="tab-item-0"') && hostileTabs.includes('class="tab__controls safe"')
  && hostileTabs.includes('data-tab="x&quot; autofocus onfocus=&quot;alert(1)"')
  && !hostileTabs.includes(' autofocus="') && !hostileTabs.includes(' onfocus="')
  && !hostileTabs.includes('onclick='),
  'tab identifiers and utility classes cannot create DOM attributes');

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
