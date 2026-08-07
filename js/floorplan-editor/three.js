// Backwards-compatible entry point. The retained viewer implementation lives
// separately so rendering lifecycle and interaction logic stay isolated.

export { createFloorplanThreeViewer } from './three-viewer.js';
export { createFloorplanThreeViewer as default } from './three-viewer.js';
