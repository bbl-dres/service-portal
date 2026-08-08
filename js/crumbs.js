// Portal breadcrumb prefixes.
//
// `{ label: 'Startseite', href: '#/' }` appeared 36 times in 24 files; three
// modules already kept private copies of the same trail. These are the four
// paths that actually exist.
//
// The LAST item never carries an `href`; the router renders it as
// `<span aria-current="page">` (router.js). The home page deliberately sets an
// empty breadcrumb.

const HOME = { label: 'Startseite', href: '#/' };

export const SERVICES = [HOME, { label: 'Dienstleistungen', href: '#/services' }];
export const DATA = [HOME, { label: 'Daten und Digitalisierung', href: '#/data' }];
export const APPLICATIONS = [...DATA, { label: 'Anwendungen', href: '#/applications' }];

/** trail(APPLICATIONS, { label: 'Mietende' }) → full trail with a final item without href */
export const trail = (prefix, ...rest) => [...prefix, ...rest];
