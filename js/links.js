// Portal deep links in one place.
//
// `#/app/portfolio?id=${encodeURIComponent(id)}` used to be assembled by hand
// in 13 places. A comment in core/index.js calls this pattern a contract between the
// data core and map, but that contract was not represented anywhere.
//
// NOTE: addressing is deliberately NOT uniform. Properties and parcels are map
// view state and therefore use `?id=`; construction projects, tenancies, cases
// and datasets are distinct locations and use a path segment. This collection
// should make that distinction visible, not conceal it.

const q = (v) => encodeURIComponent(String(v ?? ''));

export const portfolioItem = (bblId) => `#/app/portfolio?id=${q(bblId)}`;
export const constructionProject = (projectId) => `#/app/projects/${q(projectId)}`;
export const tenancy = (tenancyId) => `#/app/tenancies/${q(tenancyId)}`;
export const service = (serviceId) => `#/services/${q(serviceId)}`;
export const application = (appId) => `#/applications/${q(appId)}`;
export const dataset = (id) => `#/data/catalog/${q(id)}`;
export const caseDetails = (instanceId) => `#/my-cases/${q(instanceId)}`;
export const news = (id) => `#/news/${q(id)}`;
/** The archive filters through `?q=`; documents do not have individual routes. */
export const documentSearch = (title) => `#/app/document-archive?q=${q(title)}`;
export const processDocumentation = (processId) => `#/app/process-docs?id=${q(processId)}`;
/** Room booking, preselecting one bookable room (js/apps/room-booking.js `?room=`). */
export const roomBooking = (spaceId = '') => `#/app/room-booking${spaceId ? `?room=${q(spaceId)}` : ''}`;
export const shop = () => '#/app/shop';
export const shopProduct = (productId) => `#/app/shop/product/${q(productId)}`;
export const shopCart = () => '#/app/shop/cart';

/**
 * Standalone floor-plan editor. Without a key it opens building navigation,
 * with only a building it opens floor navigation, and with building plus floor
 * it opens the plan. Portal hand-offs and editor breadcrumbs therefore use the
 * same stable URLs without browser-history-dependent return jumps.
 */
export const floorplanEditor = (buildingId, floorId = '') => {
  const params = new URLSearchParams();
  if (buildingId) params.set('building', String(buildingId));
  if (floorId) params.set('floor', String(floorId));
  const query = params.toString();
  return `#/app/floorplan-editor${query ? `?${query}` : ''}`;
};

/**
 * Standalone DWG plan check. Stable domain keys may be handed over, but the
 * selected local CAD file deliberately never becomes URL or storage state.
 */
export const planCheck = (buildingId, floorId = '') => {
  const params = new URLSearchParams();
  if (buildingId) params.set('building', String(buildingId));
  if (floorId) params.set('floor', String(floorId));
  const query = params.toString();
  return `#/app/plan-check${query ? `?${query}` : ''}`;
};
