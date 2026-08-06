// Brotkrumen-Präfixe des Portals.
//
// `{ label: 'Startseite', href: '#/' }` stand 36-mal in 24 Dateien; drei Module
// hielten bereits eine private Kopie derselben Kette. Hier stehen die vier
// Wege, die es tatsächlich gibt.
//
// Das LETZTE Glied trägt nie ein `href` — der Router rendert es als
// `<span aria-current="page">` (router.js). Die Startseite selbst setzt
// bewusst eine leere Brotkrume.

const HOME = { label: 'Startseite', href: '#/' };

export const DIENSTLEISTUNGEN = [HOME, { label: 'Dienstleistungen', href: '#/services' }];
export const DATEN = [HOME, { label: 'Daten und Digitalisierung', href: '#/data' }];
export const ANWENDUNGEN = [...DATEN, { label: 'Anwendungen', href: '#/applications' }];

/** trail(ANWENDUNGEN, { label: 'Mietende' }) → volle Kette mit letztem Glied ohne href */
export const trail = (prefix, ...rest) => [...prefix, ...rest];
