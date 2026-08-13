import {
  badge, escape, icon, loading, markLang, photo, photoUrl, preserveFocus,
  safeDecode, statusBadge, wireScrollRegions,
} from './primitives.js';
import {
  actionCard, activeFilters, card, cardAction, contactBox, contactCard, detailBar,
  detailHead, detailSection, domainTile, downloadItem, downloadLink, empty,
  heroFigure, pageHeader, pageSection, renderNotFound, sourceBox, table,
} from './content.js';
import {
  announce, flashError, mountBanner, notification, notificationHtml, processDone, toast,
} from './feedback.js';
import {
  acquireOverlayLock, closeOverlays, openModal, openShareModal, registerOverlay,
  trapFocus, wireShare,
} from './overlays.js';
import {
  accordion, backLink, menu, pagination, pipeline, tabBar, tabPanels,
  wireAccordion, wireMenu, wirePagination, wireTabs,
} from './navigation.js';
import {
  accessCard, contextLine, errorSummary, field, focusProcessDone,
  focusWizardStep, loginGate, readForm, select, selectBox, val, wireErrorSummary,
  wireFieldErrors, wireLogin, wizardHead,
} from './forms.js';
import {
  announceCatalogue, catalogueBar, catalogueHash, catalogueResults,
  catalogueState, catalogueView, filterGroup, mountDataTable, panelReset, wireCatalogue,
  wireCatalogueState, wireTableRows,
} from './catalogue.js';

export {
  accessCard, accordion, acquireOverlayLock, actionCard, activeFilters, announce,
  announceCatalogue, backLink, badge, card, cardAction, catalogueBar,
  catalogueHash, catalogueResults, catalogueState, catalogueView, closeOverlays, contactBox,
  contactCard, contextLine, detailBar, detailHead, detailSection, domainTile,
  downloadItem, downloadLink, empty, errorSummary, escape, field, filterGroup,
  flashError, focusProcessDone, focusWizardStep, heroFigure, icon, loading,
  loginGate, markLang, menu, mountBanner, mountDataTable, notification, openModal,
  openShareModal, pageHeader, pageSection, pagination, panelReset, photo,
  photoUrl, pipeline, preserveFocus, processDone, readForm, registerOverlay,
  renderNotFound, safeDecode, select, selectBox, statusBadge, tabBar, table,
  tabPanels, toast, trapFocus, val, wireAccordion, wireCatalogue,
  wireCatalogueState, wireErrorSummary, wireFieldErrors, wireLogin, wireMenu,
  wirePagination, wireScrollRegions, wireShare, wireTableRows, wireTabs,
  wizardHead,
};

const C = {
  icon, escape, badge, statusBadge, loading, pageHeader, card, table, empty,
  openModal, openShareModal, domainTile, announce, trapFocus,
  acquireOverlayLock, registerOverlay, closeOverlays,
  renderNotFound, activeFilters, detailBar, detailHead, detailSection, markLang, accordion, wireAccordion,
  catalogueResults, announceCatalogue, catalogueHash, catalogueBar, catalogueView, filterGroup, wireCatalogue, pipeline,
  catalogueState, wireCatalogueState, panelReset, wireFieldErrors, focusProcessDone, wizardHead, focusWizardStep, contextLine,
  tabBar, tabPanels, wireTabs, menu, wireMenu, toast,
  notification, notificationHtml, flashError, safeDecode, backLink, photo, photoUrl, select, selectBox, field, val, readForm, downloadItem, contactBox, downloadLink,
  actionCard, contactCard,
  pagination, wirePagination, loginGate, accessCard,
  preserveFocus, wireScrollRegions, errorSummary, wireErrorSummary, processDone,
  mountDataTable, wireTableRows, cardAction, pageSection, heroFigure, sourceBox,
};
export default C;
