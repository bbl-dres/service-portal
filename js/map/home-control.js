// «Ganze Ausdehnung» — the control that puts a map back where it started.
//
// MapLibre ships zoom, compass and fullscreen, but nothing that returns the
// camera to the view a map opened with. Every map here is framed deliberately —
// the estate map fits the bounds of its own points, the location picker opens on
// the object or on the country — and without this the only way back from a
// wrong turn is to leave the route and come back. The fullscreen button made
// that gap conspicuous: a control group that can enlarge a view but not undo a
// pan reads as though the missing half is broken rather than absent.
//
// It restores the camera the caller PASSES rather than one it samples at
// `onAdd`, because the two differ: `fitBounds` resolves asynchronously and a
// sampled camera would freeze whatever half-finished framing existed when the
// control was added.
import { icon } from '../components.js';

/**
 * @param {() => void} onHome  Restore the map's initial framing. Owned by the
 *   caller, which is the only place that knows whether that framing was a
 *   bounds fit or a centre and zoom.
 */
export function createHomeControl(onHome) {
  if (typeof onHome !== 'function') throw new TypeError('Home control needs a reset function.');
  let wrap = null;
  let button = null;
  return {
    onAdd() {
      wrap = document.createElement('div');
      // The MapLibre group classes, so the button inherits the same box, hover,
      // focus ring and touch target as the zoom pair above it — including the
      // portal's own 44px sizing in css/apps/dataportal.css.
      wrap.className = 'maplibregl-ctrl maplibregl-ctrl-group';
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'map-home-btn';
      // Title and accessible name deliberately differ: the tooltip names the
      // ACTION in the short form a hover can carry, the label says what the
      // action does to the map, which is what a screen reader needs from a
      // control sitting in an unlabelled group of three.
      button.title = 'Ganze Ausdehnung';
      button.setAttribute('aria-label', 'Karte auf die ganze Ausdehnung zurücksetzen');
      button.innerHTML = icon('Home', 'icon--md');
      button.addEventListener('click', onHome);
      wrap.appendChild(button);
      return wrap;
    },
    onRemove() {
      button?.removeEventListener('click', onHome);
      wrap?.remove();
      wrap = null;
      button = null;
    },
  };
}
