# Vendored browser dependencies

## Three.js

- Version: r184 (`0.184.0`)
- Source: `https://github.com/mrdoob/three.js/tree/r184/build`
- Files: `three.module.min.js`, `three.core.min.js`
- License: MIT; the upstream text is preserved in `three.LICENSE.txt`.

The Plan-Editor imports this pinned local build so its 3D and walk views also
work without a runtime CDN request. Update both build files together because
the module build imports the matching core build by relative URL.
