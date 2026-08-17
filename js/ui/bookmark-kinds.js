// Turning a bookmark back into something you can read and click.
//
// A bookmark stores only `{ kind, id }`, so ONE table has to know, per kind,
// which collection holds the record, which fields carry its title and subtitle,
// and how js/links.js addresses it. That table is here. It is deliberately the
// same set of facts the search index builds (js/pages/search.js) — kind, title,
// description, href — minus the scoring, because a bookmark and a search hit are
// the same question asked twice.
//
// A kind also declares the core collection it `needs`. The favourites band reads
// that to load exactly the files the person's own bookmarks require: someone who
// saved two datasets should not pull in 234 KB of rooms to see them.

import * as links from '../links.js';

// `resolve` returns null when the record is gone. That is a normal state, not an
// error: prototype fixtures get regenerated, and a bookmark pointing at a
// vanished id must disappear quietly rather than render a broken tile.
export const KIND_META = {
  service: {
    label: 'Dienstleistung', icon: 'Ticket', need: null,
    resolve: (core, id) => {
      const record = core.service(id);
      return record && { title: record.title, desc: record.short,
        href: links.service(id), icon: record.icon || 'Ticket' };
    },
  },
  application: {
    label: 'Anwendung', icon: 'Apps', need: 'applications',
    resolve: (core, id) => {
      const record = core.application(id);
      return record && { title: record.name, desc: record.description, href: links.application(id) };
    },
  },
  dataset: {
    label: 'Datensatz', icon: 'FileDatabase', need: 'datasets',
    resolve: (core, id) => {
      const record = core.dataset(id);
      // Catalogue titles are language maps; core.t picks the active language.
      return record && { title: core.t(record.title), desc: core.t(record.description),
        href: links.dataset(id) };
    },
  },
  news: {
    label: 'News', icon: 'Bullhorn', need: 'news',
    resolve: (core, id) => {
      const record = core.newsItem(id);
      return record && { title: record.title, desc: record.teaser, href: links.news(id) };
    },
  },
  building: {
    label: 'Liegenschaft', icon: 'Building', need: 'buildings',
    resolve: (core, id) => {
      const record = core.building(id);
      return record && { title: record.name,
        desc: [record.street, [record.zip, record.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        href: links.portfolioItem(id) };
    },
  },
  project: {
    label: 'Bauprojekt', icon: 'Ruler', need: 'projects',
    resolve: (core, id) => {
      const record = core.project(id);
      return record && { title: record.name, desc: record.teaser || record.projectNumber || '',
        href: links.constructionProject(id) };
    },
  },
  tenancy: {
    label: 'Mietverhältnis', icon: 'Key', need: 'tenancies',
    resolve: (core, id) => {
      const record = core.tenancy(id);
      // A tenancy has no name of its own — it is named by the building it rents.
      return record && { title: record.buildingName,
        desc: [record.veName || record.ve, record.city].filter(Boolean).join(' · '),
        href: links.tenancy(id) };
    },
  },
  'shop-product': {
    label: 'Artikel', icon: 'ShoppingCart', need: 'shopProducts',
    resolve: (core, id) => {
      const record = core.shopProduct(id);
      return record && { title: record.name, desc: record.brand || record.subcategory || record.category || '',
        href: links.shopProduct(id) };
    },
  },
  process: {
    label: 'Prozess', icon: 'Stack', need: 'processes',
    resolve: (core, id) => {
      const record = core.processDoc(id);
      return record && { title: record.name, desc: record.groupLabel || record.areaLabel || '',
        href: links.processDocumentation(id, record.branch) };
    },
  },
  room: {
    label: 'Raum', icon: 'Calendar', need: 'spaces',
    resolve: (core, id) => {
      const record = core.spaces().find((space) => space.spaceId === id);
      return record && { title: [record.useLabel, record.roomNumber].filter(Boolean).join(' '),
        desc: record.capacity ? `${record.capacity} Plätze` : '',
        href: links.roomBooking(id) };
    },
  },
};

/** The core collections a list of bookmarks needs before it can be resolved. */
export function bookmarkNeeds(entries) {
  return [...new Set(entries
    .map((entry) => KIND_META[entry.kind]?.need)
    .filter(Boolean))];
}

/**
 * Resolve a bookmark list into renderable rows, dropping whatever no longer
 * exists. Returns `{ rows, missing }` so a caller can SAY that something was
 * dropped instead of silently showing a shorter list.
 */
export function resolveBookmarks(core, entries) {
  const rows = [];
  let missing = 0;
  for (const entry of entries) {
    const meta = KIND_META[entry.kind];
    if (!meta) { missing++; continue; }
    let record = null;
    try { record = meta.resolve(core, entry.id); } catch { record = null; }
    if (!record || !record.title) { missing++; continue; }
    rows.push({ ...entry, ...record, kindLabel: meta.label, icon: record.icon || meta.icon });
  }
  return { rows, missing };
}
