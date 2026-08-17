// Reusable CD anchor-navigation layout (detailPageAnchorNav.vue): thematic
// sections with IDs on the left and a sticky table of contents on the right that
// jumps to them. Shared by knowledge-and-resources subject pages
// (js/pages/knowledge.js) and digitalisation subpages.

// `ctx.query.get('section')` jumps directly to a section during render. Why a
// query parameter rather than an anchor: the app is hash-routed, and the router
// cannot split a second `#` (`#/knowledge/it#wi-vorlagen`). It would see the
// segment «it#wi-vorlagen» and show 404. A section is also state WITHIN the page,
// not a separate location (sitemap §1.1).
export function anchorNavPage(ctx, {
  title, lead, intro, sections, back, image = '', tags = '', detailHead = false,
}) {
  const { mount, C } = ctx;
  // `detailHead` keeps the canonical detail anatomy even when a record has no image;
  // supplying an image implies the same anatomy automatically.
  const useDetailHead = detailHead || !!image;

  const sectionHtml = sections.map(s => `
    <section class="anchor-section" id="${s.id}">
      <h2 tabindex="-1" class="anchor-section__title">${C.markLang(s.title)}</h2>
      ${s.html}
    </section>`).join('');

  // Table of contents (CD: card + menu). The angled arrow mirrors each anchor
  // row in detailPageAnchorNav.vue; .menu__item--active marks the current section. Below 768px the table is
  // a collapsed <details>. With container--reverse-mobile it appears BEFORE the
  // content and costs ~48px rather than ~260px. From 768px, CSS hides <summary>
  // and permanently expands the content, leaving the table open in the sidebar.
  const toc = `<nav class="anchor-nav sticky--top" aria-label="Inhaltsverzeichnis">
    <div class="card card--default">
      <div class="card__content"><div class="card__body">
        <details class="anchor-nav__disclosure">
          <summary class="anchor-nav__summary">
            <h2 class="card__title">Inhaltsverzeichnis</h2>
            ${C.icon('ChevronDown', 'anchor-nav__chev')}
          </summary>
          <div class="anchor-nav__body">
            <ul class="menu">
              ${sections.map(s => `<li>
                <a class="menu__item menu__item--border menu__item--condensed" href="#${s.id}" data-anchor="${s.id}">
                  <span>${C.markLang(s.title)}</span>
                  ${C.icon('ArrowAngleBottomLeft', 'menu__item__icon')}
                </a></li>`).join('')}
            </ul>
          </div>
        </details>
      </div></div>
    </div>
  </nav>`;

  mount.innerHTML = `
  <div class="container section">
    ${useDetailHead
      ? C.detailHead({
        backHref: back && back.href,
        backLabel: back && back.label,
        title,
        lead,
        tags,
        image,
      })
      : C.detailBar({ backHref: back && back.href, backLabel: back && back.label })}
    ${/* container--reverse-mobile: below 768px the table of contents previously
          appeared at page end, directly above the footer, only AFTER users had
          scrolled past everything it indexes (CD container.postcss:100-101). */''}
    <div class="container--grid gap--responsive container--reverse-mobile">
      ${useDetailHead ? '' : `<div class="anchor-page__header">
        ${C.pageHeader({ title, lead })}
        ${intro ? `<p class="page-intro muted">${intro}</p>` : ''}
      </div>`}
      <div class="container__main vertical-spacing">
        ${useDetailHead && intro ? `<p class="page-intro muted">${intro}</p>` : ''}
        ${sectionHtml}
      </div>
      <aside class="container__aside">${toc}</aside>
    </div>
  </div>`;

  wireAnchorNav(mount, ctx);

  // Direct jump from a frequently-used shortcut. Run after router focus;
  // otherwise its h1 focus pulls the page back to the top.
  const want = ctx.query && ctx.query.get('section');
  if (want) {
    const target = mount.querySelector('#' + CSS.escape(want));
    if (target) requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
      (target.querySelector('.anchor-section__title') || target).focus({ preventScroll: true });
    });
  }
}

// Wiring: (1) clicking the table of contents scrolls to the section and focuses
// its heading; (2) scroll spy marks the current section with
// .menu__item--active (CD detailPageAnchorNav JS example); (3) content accordions
// are activated. `ctx` is passed through so global listeners are removed on
// route exit. Without it, every anchor-navigation visit added one matchMedia and
// one scroll listener (+1/+1 measured per call, without a limit), and the
// matchMedia closure retained the replaced `mount` subtree
// (docs/code-review.md §4). These are the app's most visited pages: six knowledge
// and five digitalisation pages share this layout.
function wireAnchorNav(mount, ctx) {
  // One AbortController per render, matching js/ui/shell/header.js. Every listener is
  // registered with `signal` and removed by one `abort()`.
  const ac = new AbortController();
  const { signal } = ac;
  if (ctx && ctx.onUnmount) ctx.onUnmount(() => ac.abort());

  // The table of contents is collapsible ONLY below 768px. JS must own the state:
  // browsers now collapse <details> through
  // `::details-content { content-visibility:hidden }`, which a display rule on a
  // child cannot override. Set `open` from 768px (CSS hides <summary> there) and
  // close it below.
  const details = mount.querySelector('.anchor-nav__disclosure');
  if (details && window.matchMedia) {
    const wide = window.matchMedia('(min-width:768px)');
    const sync = () => { details.open = wide.matches; };
    sync();
    // Synchronise on width changes through `change`, not a resize storm.
    wide.addEventListener('change', sync, { signal });
  }

  const links = [...mount.querySelectorAll('.anchor-nav [data-anchor]')];
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = mount.querySelector('#' + CSS.escape(link.getAttribute('data-anchor')));
      if (!target) return;
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      (target.querySelector('.anchor-section__title') || target).focus({ preventScroll: true });
    }, { signal });
  });

  // Scroll spy: activate the most recently passed section. Self-removal on the
  // first scroll after navigation remains as a safety net, but it worked only IF
  // any scrolling occurred after leaving. The controller now cleans up
  // independently.
  const sections = [...mount.querySelectorAll('.anchor-section[id]')];
  if (sections.length) {
    const OFFSET = 140;
    const onScroll = () => {
      if (!mount.querySelector('.anchor-nav')) { ac.abort(); return; }
      const y = window.scrollY || document.documentElement.scrollTop;
      let current = sections[0].id;
      // Here `offsetTop` would be relative to positioned #main-content, while `y`
      // is document-relative. Viewport position plus scroll value shares one
      // coordinate system and remains correct with the shell before it.
      for (const s of sections) {
        const top = s.getBoundingClientRect().top + y;
        if (top - OFFSET <= y) current = s.id;
      }
      links.forEach(a => a.classList.toggle('menu__item--active', a.getAttribute('data-anchor') === current));
    };
    window.addEventListener('scroll', onScroll, { passive: true, signal });
    onScroll();
  }

  // Accordions (for example FAQ on the process page): shared wiring replaces the
  // former copied toggle logic, putting behaviour changes such as CD animation
  // in ONE place. No `signal` is needed: listeners live on nodes within `mount`
  // and disappear with DOM replacement.
  ctx.C.wireAccordion(mount);
}
