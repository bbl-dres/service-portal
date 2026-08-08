// Small Fullscreen API boundary shared by map charts and floor-plan viewers.
// Browsers may omit the API or reject a request despite a click (policy,
// permissions, embedded context). Both paths are explicit so callers can
// announce them instead of leaving the control looking unresponsive.
export async function requestFullscreen(element, {
  source = 'fullscreen', onUnavailable = () => {}, onRejected = () => {},
} = {}) {
  if (!element || typeof element.requestFullscreen !== 'function') {
    onUnavailable();
    return false;
  }
  try {
    await element.requestFullscreen();
    return true;
  } catch (error) {
    console.warn(`[${source}] fullscreen request failed`, error);
    onRejected(error);
    return false;
  }
}

export async function exitFullscreen({
  source = 'fullscreen', onUnavailable = () => {}, onRejected = () => {},
  documentObject = globalThis.document,
} = {}) {
  if (!documentObject?.fullscreenElement) return true;
  if (typeof documentObject.exitFullscreen !== 'function') {
    onUnavailable();
    return false;
  }
  try {
    await documentObject.exitFullscreen();
    return true;
  } catch (error) {
    console.warn(`[${source}] fullscreen exit failed`, error);
    onRejected(error);
    return false;
  }
}
