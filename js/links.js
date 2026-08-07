// Deep-Links auf die Objekte des Portals — an einer Stelle.
//
// `#/app/portfolio?id=${encodeURIComponent(id)}` wurde an 13 Stellen von Hand
// gebaut. Der Kommentar in core.js nennt dieses Muster einen Vertrag zwischen
// Datenkern und Karte; als Vertrag war es aber nirgends greifbar.
//
// ACHTUNG, die Adressierung ist NICHT einheitlich, und das ist Absicht:
// Liegenschaften und Grundstücke sind ein Zustand der Kartenansicht und hängen
// deshalb an `?id=`; Bauprojekte, Mietverhältnisse, Vorgänge und Datensätze
// sind eigene Orte und tragen ein Pfadsegment. Diese Unterscheidung darf die
// Sammlung sichtbar machen, nicht verwischen.

const q = (v) => encodeURIComponent(String(v ?? ''));

export const objekt = (bblId) => `#/app/portfolio?id=${q(bblId)}`;
export const bauprojekt = (projectId) => `#/app/projects/${q(projectId)}`;
export const mietverhaeltnis = (tenancyId) => `#/app/tenancies/${q(tenancyId)}`;
export const dienstleistung = (serviceId) => `#/services/${q(serviceId)}`;
export const anwendung = (appId) => `#/applications/${q(appId)}`;
export const datensatz = (id) => `#/data/catalog/${q(id)}`;
export const vorgang = (instanceId) => `#/my-cases/${q(instanceId)}`;
export const news = (id) => `#/news/${q(id)}`;
/** Das Archiv filtert über `?q=` — es gibt keine Detailroute je Dokument. */
export const dokument = (titel) => `#/app/document-archive?q=${q(titel)}`;
export const prozess = (processId) => `#/app/process-docs?id=${q(processId)}`;
export const shop = () => '#/app/shop';
export const shopProdukt = (productId) => `#/app/shop/product/${q(productId)}`;
export const shopWarenkorb = () => '#/app/shop/cart';

/**
 * Standalone Plan-Editor. Nur dauerhafte Fachschlüssel gehören in die Übergabe;
 * der Editor leitet seinen sicheren Rücksprung zum Workspace-Portal selbst ab.
 */
export const floorplanEditor = (buildingId, floorId = '') => {
  const params = new URLSearchParams();
  if (buildingId) params.set('building', String(buildingId));
  if (floorId) params.set('floor', String(floorId));
  const query = params.toString();
  return `#/app/floorplan-editor${query ? `?${query}` : ''}`;
};
