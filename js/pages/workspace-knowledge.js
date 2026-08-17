import { anchorNavPage } from './anchor-nav.js';
import { swatchHex } from '../floorplan-editor/colors.js';
import { openGallery, restoreGalleryFromQuery } from '../ui/gallery.js';
import {
  AREAS, WORKSPACE_BRANCHES, sectionDomId,
} from '../knowledge-content.js';

const WORKSPACE_ROUTE = '#/knowledge/workspace';
const MODULE_ROUTE = `${WORKSPACE_ROUTE}/multispace`;
const INSPIRATION_ROUTE = `${WORKSPACE_ROUTE}/inspiration`;
const GALLERY_PARAM = 'bild';

export default function render(ctx) {
  const slug = ctx.params[1] || '';
  const branch = WORKSPACE_BRANCHES.find((entry) => entry.slug === slug);
  if (!branch) return workspaceNotFound(ctx);

  if (!slug) {
    return ctx.params.length === 1 ? branchOverview(ctx) : workspaceNotFound(ctx);
  }

  if (slug === 'multispace') {
    if (ctx.params.length === 2) return handbookPage(ctx, branch);
    if (ctx.params.length === 3) return modulePage(ctx, ctx.params[2]);
    return moduleNotFound(ctx);
  }

  if (slug === 'inspiration') {
    if (ctx.params.length === 2) return examplesPage(ctx, branch);
    if (ctx.params.length === 3) return legacyExampleRoute(ctx, branch, ctx.params[2]);
    return inspirationNotFound(ctx);
  }

  if (ctx.params.length !== 2) return workspaceNotFound(ctx);
  return documentPage(ctx, branch);
}

function branchOverview(ctx) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  const area = AREAS.workspace;
  const inspiration = WORKSPACE_BRANCHES.find((entry) => entry.slug === 'inspiration');
  setTitle(area.title);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Wissen und Hilfsmittel', href: '#/knowledge' },
    { label: area.title },
  ]);

  const cards = [
    {
      title: 'Multispace-Handbuch',
      href: MODULE_ROUTE,
      desc: 'Der Ausstattungsstandard mit Modulen, Sub-Modulen, Flächenrichtmassen und Ausstattung.',
    },
    {
      title: 'Planungsbeispiele',
      href: INSPIRATION_ROUTE,
      desc: inspiration?.lead || '',
    },
    {
      title: 'Kreislaufwirtschaft und Occasionsmobiliar',
      href: `${WORKSPACE_ROUTE}/kreislauf`,
      desc: 'Wie Occasionsmobiliar geplant, geliefert, repariert und in den Kreislauf zurückgeführt wird.',
    },
    {
      title: 'Downloads und Vorlagen',
      href: `${WORKSPACE_ROUTE}/downloads`,
      desc: 'Handbuch, CAD-Bausteine, Planungsvorlagen und angekündigte Werkzeuge.',
    },
  ].map((card) => C.card({
    ...card,
    variant: 'highlight',
    footerAction: C.cardAction(),
  })).join('');

  mount.innerHTML = `
    ${C.pageSection({
      body: `${C.pageHeader({ title: area.title, lead: area.lead })}
        ${area.intro ? `<p>${area.intro}</p>` : ''}`,
    })}
    ${C.pageSection({
      title: 'Themen',
      alt: true,
      body: `<div class="grid grid--items-4 gap--responsive">${cards}</div>`,
    })}`;
}

function documentPage(ctx, branch) {
  const { C, setTitle, setCrumbs } = ctx;
  const area = AREAS.workspace;
  setTitle(branch.label);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Wissen und Hilfsmittel', href: '#/knowledge' },
    { label: area.title, href: WORKSPACE_ROUTE },
    { label: branch.label },
  ]);

  const sections = area.sections
    .filter((section) => section.branch === branch.key && !section.indexOnly)
    .map((section) => ({
      id: sectionDomId(section.id),
      title: section.title,
      html: [
        section.intro ? `<p>${C.escape(section.intro)}</p>` : '',
        typeof section.html === 'function' ? section.html(C) : (section.html || ''),
        section.items ? `<ul class="download-items">${section.items.map((item) => C.downloadItem({
          href: '#',
          ...item,
          download: !item.external && !String(item.href || '').startsWith('#'),
          wrapLi: true,
        })).join('')}</ul>` : '',
      ].join(''),
    }));

  anchorNavPage(ctx, {
    title: branch.label,
    lead: branch.lead,
    sections,
    back: { href: WORKSPACE_ROUTE, label: area.title },
  });
}

function moduleImages(module) {
  return Array.isArray(module?.images)
    ? module.images.filter((image) => image && typeof image.src === 'string' && image.src.trim())
    : [];
}

function moduleImageCaption(C, image) {
  const parts = [image.caption, image.credit].filter(Boolean);
  return parts.length ? `<figcaption class="small muted">${C.escape(parts.join(' · '))}</figcaption>` : '';
}

function moduleHeroFigure(C, module) {
  const hero = moduleImages(module)[0];
  if (!hero) return '';
  return `<figure class="wsm-module-detail__figure hero__figure">
    ${C.photo({
      src: hero.src,
      color: swatchHex(module.swatch),
      alt: hero.alt || '',
      w: 1440,
      h: 810,
      loading: 'eager',
      cls: 'wsm-module-detail__photo',
    })}
    ${moduleImageCaption(C, hero)}
  </figure>`;
}

function moduleImageGallery(C, images, swatch) {
  return `<div class="grid grid--responsive-cols-2 wsm-module-detail__gallery">${images.map((image) => `
    <figure class="wsm-module-detail__figure">
      ${C.photo({
        src: image.src,
        color: swatchHex(swatch),
        alt: image.alt || '',
        w: 720,
        h: 405,
        cls: 'wsm-module-detail__photo',
      })}
      ${moduleImageCaption(C, image)}
    </figure>`).join('')}</div>`;
}

function moduleCard(C, module) {
  const areas = module.subModules
    .map((subModule) => subModule.area)
    .filter((value) => value != null);
  const unique = [...new Set(areas.map((value) => String(value).replace('.', ',')))];
  const measure = unique.length === 0
    ? 'ohne Flächenrichtmass'
    : unique.length === 1 ? `Richtmass ${unique[0]} m²` : 'Richtmass je Sub-Modul';
  const count = module.subModules.length;
  const hero = moduleImages(module)[0];
  return C.card({
    href: `${MODULE_ROUTE}/modul-${module.nr}`,
    title: `Modul ${module.nr} · ${module.name}`,
    desc: module.summary || module.description,
    photo: hero ? {
      src: hero.src,
      color: swatchHex(module.swatch),
      alt: '',
      cls: 'wsm-module-card__photo',
    } : null,
    footerInfo: `<span class="small muted">${C.escape(
      `${count} Sub-Modul${count === 1 ? '' : 'e'} · ${measure}`,
    )}</span>`,
    footerAction: C.cardAction(),
    cls: 'wsm-module-card',
  });
}

function handbookPage(ctx, branch) {
  const { mount, C, core, setTitle, setCrumbs } = ctx;
  const fixture = core.multispaceModules();
  const modules = fixture?.modules || [];
  const examples = [...(core.workspaceExamples() || [])]
    .sort((left, right) => String(right.completed).localeCompare(String(left.completed)))
    .slice(0, 3);
  const galleries = exampleGalleries(core, examples);
  setTitle(branch.label);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Wissen und Hilfsmittel', href: '#/knowledge' },
    { label: AREAS.workspace.title, href: WORKSPACE_ROUTE },
    { label: branch.label },
  ]);

  mount.innerHTML = `
    ${C.pageSection({
      body: C.pageHeader({
        title: branch.label,
        lead: `Der Ausstattungsstandard des BBL als Webfassung: ${modules.length} Module, `
          + `Flächenrichtmasse und Ausstattung. Stand ${C.escape(fixture.currentEdition || '')} — `
          + 'dieselbe Quelle, die der Plan-Editor für die Modulzuordnung nutzt.',
      }),
    })}
    ${C.pageSection({
      title: `Die ${modules.length} Module`,
      alt: true,
      body: `<p class="muted">Jedes Modul ist eine funktionale und gestalterische Einheit — ein Mix einzelner Modulelemente wird nicht empfohlen.</p>
        <div class="grid grid--responsive-cols-3">${modules.map((module) => moduleCard(C, module)).join('')}</div>`,
    })}
    ${C.pageSection({
      title: 'Planungsbeispiele',
      body: `<p class="muted">Umgesetzte Multispace-Flächen — als Bildergalerien mit den eingesetzten Modulen.</p>
        ${galleries.length
          ? `<div class="grid grid--responsive-cols-3">${galleries
              .map((gallery) => exampleCard(C, gallery)).join('')}</div>`
          : C.empty('Noch keine Planungsbeispiele erfasst')}`,
      more: { href: INSPIRATION_ROUTE, label: 'Alle Beispiele anzeigen' },
    })}`;
}

function modulePlanningExamplesHTML(C, core, nr) {
  const examples = (core.workspaceExamples?.() || [])
    .filter((example) => (example.modules || []).includes(Number(nr)));
  if (!examples.length) {
    return C.empty('Noch keine Planungsbeispiele für dieses Modul', {
      hint: 'Sobald eine realisierte Fläche mit diesem Modul erfasst ist, erscheint sie hier.',
      action: { href: INSPIRATION_ROUTE, label: 'Alle Planungsbeispiele' },
    });
  }
  return `<ul class="wsm-references">${examples.map((example) => `<li>
    <strong><a href="${C.escape(exampleGalleryHref(example))}" aria-haspopup="dialog">${C.escape(example.title)}</a></strong>
    <span class="small muted">${C.escape(`${example.scope} · ${example.buildingName} · ${example.completed}`)}</span>
    <span class="wsm-references__modules">${(example.modules || [])
      .map((moduleNr) => C.badge(`M${moduleNr}`, Number(moduleNr) === Number(nr) ? 'info' : 'gray'))
      .join('')}</span>
  </li>`).join('')}</ul>`;
}

function modulePage(ctx, slug) {
  const { C, core, setTitle, setCrumbs } = ctx;
  const match = /^modul-(\d+)$/.exec(String(slug));
  if (!match) return moduleNotFound(ctx);
  const nr = Number(match[1]);
  if (String(nr) !== match[1] || nr < 1) return moduleNotFound(ctx);
  const fixture = core.multispaceModules();
  const module = (fixture?.modules || []).find((entry) => entry.nr === nr);
  if (!module) return moduleNotFound(ctx);

  const title = `${module.nr} · ${module.name}`;
  setTitle(title);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Wissen und Hilfsmittel', href: '#/knowledge' },
    { label: AREAS.workspace.title, href: WORKSPACE_ROUTE },
    { label: 'Multispace-Handbuch', href: MODULE_ROUTE },
    { label: title },
  ]);

  const area = (value) => value == null
    ? '—'
    : `${String(value).replace('.', ',')} m²`;
  const subModules = C.table({
    caption: `Sub-Module von Modul ${module.nr}`,
    showCaption: false,
    columns: [
      { key: 'nr', label: 'Sub-Modul' },
      { key: 'name', label: 'Bezeichnung' },
      { key: 'area', label: 'Flächenrichtmass', align: 'right', render: (row) => C.escape(area(row.area)) },
      { key: 'persons', label: 'Personen', align: 'right', render: (row) => C.escape(row.persons == null ? '—' : String(row.persons)) },
    ],
    rows: module.subModules,
  });

  const products = (core.shopProducts?.() || [])
    .filter((product) => (module.equipment || []).includes(product.category))
    .slice(0, 8);
  const elements = products.length
    ? C.table({
      caption: `Ausstattung von Modul ${module.nr}`,
      showCaption: false,
      columns: [
        { key: 'name', label: 'Produkt' },
        { key: 'brand', label: 'Marke' },
        { key: 'id', label: 'Katalog-ID', align: 'right' },
      ],
      rows: products,
    })
    : C.empty('Keine Ausstattung verknüpft', {
      hint: 'Für dieses Modul sind im Prototyp keine Produkte aus dem Möbelkatalog erfasst.',
    });

  const sections = [
    {
      id: sectionDomId('submodule'),
      title: 'Sub-Module und Flächenrichtmass',
      html: `${module.figuresVerified === false
        ? `<p class="notification notification--warning">${C.escape(module.figuresNote || '')}</p>`
        : ''}${subModules}`,
    },
    ...(moduleImages(module).length > 1 ? [{
      id: sectionDomId('bilder'),
      title: 'Weitere Bilder',
      html: moduleImageGallery(C, moduleImages(module).slice(1), module.swatch),
    }] : []),
    {
      id: sectionDomId('elemente'),
      title: 'Ausstattung',
      html: `${elements}<p class="small muted">${C.escape(fixture.confidentiality || '')}</p>`,
    },
    {
      id: sectionDomId('richtlinien'),
      title: 'Einrichtungsrichtlinien',
      html: `<ul class="list--default">${(module.guidelines || [])
        .map((rule) => `<li>${C.escape(rule)}</li>`).join('')}</ul>`,
    },
    {
      id: sectionDomId('beispiele'),
      title: 'Planungsbeispiele',
      html: modulePlanningExamplesHTML(C, core, module.nr),
    },
  ];

  anchorNavPage(ctx, {
    title,
    lead: module.description,
    detailHead: true,
    image: moduleHeroFigure(C, module),
    sections,
    back: { href: MODULE_ROUTE, label: 'Multispace-Handbuch' },
  });
}

function scopedGalleryId(example, mediaId) {
  return `${example.exampleId}:${mediaId}`;
}

function exampleCoverMediaId(example) {
  const ids = Array.isArray(example.mediaIds) ? example.mediaIds : [];
  return ids.includes(example.coverMediaId) ? example.coverMediaId : (ids[0] || '');
}

function exampleGalleryHref(example, mediaId = exampleCoverMediaId(example)) {
  if (!mediaId) return INSPIRATION_ROUTE;
  return `${INSPIRATION_ROUTE}?${GALLERY_PARAM}=${encodeURIComponent(scopedGalleryId(example, mediaId))}`;
}

function isDownloadable(media) {
  // Rights are opt-in: unknown or proprietary labels must never expose a file
  // action merely because they do not match a particular restricted phrase.
  return /^(?:CC0(?: 1\.0)?|CC BY(?:-SA)? \d(?:\.\d)?)$/i.test(String(media.license || '').trim());
}

function exampleGalleries(core, examples) {
  const mediaById = new Map((core.media?.() || []).map((media) => [media.mediaId, media]));
  return examples.map((example) => {
    const media = (example.mediaIds || []).map((id) => mediaById.get(id)).filter(Boolean);
    const items = media.map((shot) => ({
      id: scopedGalleryId(example, shot.mediaId),
      photo: shot.photo || '',
      photoSrc: shot.file || '',
      title: shot.title || example.title,
      meta: [example.title, example.buildingName, shot.date].filter(Boolean).join(' · '),
      type: shot.mediaType || 'photo',
      gray: shot.historicPeriod === 'historisch',
      downloadable: isDownloadable(shot),
      href: `#/app/media-library/${encodeURIComponent(shot.mediaId)}`,
      details: [
        ['Planungsbeispiel', example.title],
        ['Umfang', example.scope],
        ['Gebäude', example.buildingName],
        ['Adresse', example.address || 'nicht erfasst'],
        ['Fläche', example.areaSqm == null ? '' : `${example.areaSqm} m²`],
        ['Arbeitsplätze', example.workplaces == null ? '' : String(example.workplaces)],
        ['Fertigstellung', example.completed],
        ['Module', (example.modules || []).map((number) => `M${number}`).join(', ')],
        ['Aufnahme', shot.title],
        ['Medien-ID', shot.mediaId],
        ['Aufnahmedatum', shot.date],
        ['Fotograf:in', shot.photographer],
        ['Copyright', shot.copyright],
        ['Lizenz', shot.license],
        ['Quelle', shot.sourceUrl],
      ].filter(([, value]) => value != null && String(value).trim()),
    }));
    const coverId = exampleCoverMediaId(example);
    const cover = media.find((shot) => shot.mediaId === coverId) || media[0] || null;
    const start = Math.max(0, items.findIndex((item) => item.id === scopedGalleryId(example, cover?.mediaId || '')));
    return { example, cover, items, start };
  });
}

function workplaceLabel(value) {
  if (value == null) return 'Arbeitsplätze nicht erfasst';
  return `${value} ${Number(value) === 1 ? 'Arbeitsplatz' : 'Arbeitsplätze'}`;
}

function exampleCard(C, gallery) {
  const { example, cover, items } = gallery;
  const facts = [
    example.areaSqm == null ? '' : `${example.areaSqm} m²`,
    workplaceLabel(example.workplaces),
    example.completed,
  ].filter(Boolean).join(' · ');
  const href = items.length ? exampleGalleryHref(example, cover?.mediaId) : INSPIRATION_ROUTE;
  return C.card({
    href,
    dialog: items.length > 0,
    title: example.title,
    desc: example.summary,
    photo: cover ? {
      src: cover.file || '',
      id: cover.photo || '',
      color: cover.color || '',
      alt: '',
      cls: 'wsm-example__photo',
    } : null,
    badges: [
      C.badge(example.scope, 'info'),
      ...(example.modules || []).map((number) => C.badge(`M${number}`, 'gray')),
    ],
    footerInfo: `<span class="small muted">${C.escape(`${example.buildingName} · ${facts}`)}</span>`,
    footerAction: items.length ? C.cardAction() : '',
    cls: 'wsm-example-card',
  });
}

function galleryIdFromHref(href) {
  const query = String(href || '').split('?')[1] || '';
  return new URLSearchParams(query).get(GALLERY_PARAM) || '';
}

function wireExampleCards(ctx, galleries) {
  const byItem = new Map();
  for (const gallery of galleries) {
    gallery.items.forEach((item, index) => byItem.set(item.id, { gallery, index }));
  }
  ctx.mount.querySelectorAll('.wsm-example-card').forEach((card) => {
    const link = card.querySelector('.card__link[aria-haspopup="dialog"]');
    if (!link) return;
    card.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0
        || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const control = event.target.closest?.('a, button, input, select, textarea');
      if (control && control !== link) return;
      const match = byItem.get(galleryIdFromHref(link.getAttribute('href')));
      if (!match) return;
      event.preventDefault();
      // Pointer clicks on the image do not focus the stretched title link by
      // themselves. Focus it explicitly so closing the dialog has a stable,
      // visible return target just like keyboard activation does.
      if (document.activeElement !== link) link.focus({ preventScroll: true });
      openGallery(match.gallery.items, match.index, ctx.C, { param: GALLERY_PARAM });
    }, { capture: true });
  });
}

function restoreRequestedGallery(ctx, galleries) {
  const requested = ctx.query?.get(GALLERY_PARAM) || '';
  if (!requested) return;
  const gallery = galleries.find((entry) => entry.items.some((item) => item.id === requested));
  if (gallery) restoreGalleryFromQuery(ctx.query, gallery.items, ctx.C, { param: GALLERY_PARAM });
}

function examplesPage(ctx, branch) {
  const { mount, C, core, setTitle, setCrumbs } = ctx;
  const examples = [...(core.workspaceExamples() || [])]
    .sort((left, right) => String(right.completed).localeCompare(String(left.completed)));
  const galleries = exampleGalleries(core, examples);
  setTitle(branch.label);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Wissen und Hilfsmittel', href: '#/knowledge' },
    { label: AREAS.workspace.title, href: WORKSPACE_ROUTE },
    { label: branch.label },
  ]);

  mount.innerHTML = `
    ${C.pageSection({ body: C.pageHeader({ title: branch.label, lead: branch.lead }) })}
    ${C.pageSection({
      title: `${examples.length} Beispiele`,
      alt: true,
      body: galleries.length
        ? `<div class="grid grid--responsive-cols-3">${galleries
            .map((gallery) => exampleCard(C, gallery)).join('')}</div>`
        : C.empty('Noch keine Planungsbeispiele erfasst'),
    })}`;

  wireExampleCards(ctx, galleries);
  restoreRequestedGallery(ctx, galleries);
}

function legacyExampleRoute(ctx, branch, slug) {
  const example = (ctx.core.workspaceExamples() || [])
    .find((entry) => entry.slug === String(slug));
  if (!example) return inspirationNotFound(ctx);
  const href = exampleGalleryHref(example);
  ctx.replaceRoute(href);
  const query = new URLSearchParams();
  const coverId = exampleCoverMediaId(example);
  if (coverId) query.set(GALLERY_PARAM, scopedGalleryId(example, coverId));
  return examplesPage({ ...ctx, query }, branch);
}

function workspaceNotFound(ctx) {
  ctx.C.renderNotFound(ctx, {
    thing: 'Diese Seite',
    title: 'Seite nicht gefunden',
    backHref: WORKSPACE_ROUTE,
    backLabel: AREAS.workspace.title,
    crumbs: [
      { label: 'Startseite', href: '#/' },
      { label: 'Wissen und Hilfsmittel', href: '#/knowledge' },
      { label: AREAS.workspace.title, href: WORKSPACE_ROUTE },
    ],
  });
}

function moduleNotFound(ctx) {
  ctx.C.renderNotFound(ctx, {
    thing: 'Dieses Multispace-Modul',
    title: 'Seite nicht gefunden',
    backHref: MODULE_ROUTE,
    backLabel: 'Multispace-Handbuch',
    crumbs: [
      { label: 'Startseite', href: '#/' },
      { label: 'Wissen und Hilfsmittel', href: '#/knowledge' },
      { label: AREAS.workspace.title, href: WORKSPACE_ROUTE },
      { label: 'Multispace-Handbuch', href: MODULE_ROUTE },
    ],
  });
}

function inspirationNotFound(ctx) {
  ctx.C.renderNotFound(ctx, {
    thing: 'Dieses Planungsbeispiel',
    title: 'Seite nicht gefunden',
    backHref: INSPIRATION_ROUTE,
    backLabel: 'Planungsbeispiele',
    crumbs: [
      { label: 'Startseite', href: '#/' },
      { label: 'Wissen und Hilfsmittel', href: '#/knowledge' },
      { label: AREAS.workspace.title, href: WORKSPACE_ROUTE },
      { label: 'Planungsbeispiele', href: INSPIRATION_ROUTE },
    ],
  });
}
