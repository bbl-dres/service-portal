// Dependency-free loader for the few browser libraries that remain CDN-hosted.
// Every URL is pinned by its consumer and must carry an SRI hash. A failed
// attempt removes only the nodes it inserted, allowing a later route visit to
// retry without retaining a rejected promise or a half-loaded stylesheet.

const DEFAULT_TIMEOUT_MS = 12000;

export function createExternalAssetLoader(environment = {}) {
  const documentObject = environment.document || globalThis.document;
  const globalObject = environment.globalObject || globalThis.window || globalThis;
  const scheduleTimeout = environment.setTimeout || globalThis.setTimeout;
  const cancelTimeout = environment.clearTimeout || globalThis.clearTimeout;
  const loads = new Map();

  return function loadExternalAssets(options = {}) {
    const {
      key,
      globalName,
      styles: configuredStyles = [],
      script,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      messages = {},
    } = options;

    const styles = Array.isArray(configuredStyles) ? configuredStyles : [];
    const assets = [...styles, script];
    const validIntegrity = (value) => /^sha384-[A-Za-z0-9+/]{64}$/.test(String(value || ''));
    const validHttpsUrl = (value) => {
      try {
        const url = new URL(String(value));
        return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
      } catch { return false; }
    };
    if (!key || !globalName || !script || !Array.isArray(configuredStyles) || assets.some((asset) => (
      !asset || !validHttpsUrl(asset.url) || !validIntegrity(asset.integrity)
    ))) {
      return Promise.reject(new Error('External assets require a key, global, HTTPS URLs, and SHA-384 integrity'));
    }

    if (loads.has(key)) return loads.get(key);

    const attempt = new Promise((resolve, reject) => {
      const nodes = [];
      let timerId = null;
      let remainingStyles = styles.length;
      let settled = false;

      const clearHandlers = () => {
        for (const node of nodes) {
          node.onload = null;
          node.onerror = null;
        }
      };
      const removeNodes = () => {
        for (const node of nodes) node.remove();
      };
      const fail = (error) => {
        if (settled) return;
        settled = true;
        if (timerId !== null) cancelTimeout(timerId);
        clearHandlers();
        removeNodes();
        reject(error);
      };
      const configureSecurityAttributes = (node, integrity) => {
        node.setAttribute('integrity', integrity);
        node.setAttribute('crossorigin', 'anonymous');
        node.setAttribute('referrerpolicy', 'no-referrer');
      };

      // A stylesheet failure after the script executed cannot undo the
      // library's global side effects. Authenticate and await every style
      // first, then append the executable asset exactly once.
      const appendScript = () => {
        if (settled) return;
        try {
          const scriptNode = documentObject.createElement('script');
          scriptNode.src = script.url;
          scriptNode.async = true;
          configureSecurityAttributes(scriptNode, script.integrity);
          scriptNode.onload = () => {
            if (settled) return;
            const loadedGlobal = globalObject[globalName];
            if (!loadedGlobal) {
              fail(new Error(messages.global || `${globalName} is unavailable`));
              return;
            }
            settled = true;
            if (timerId !== null) cancelTimeout(timerId);
            clearHandlers();
            resolve(loadedGlobal);
          };
          scriptNode.onerror = () => fail(new Error(messages.script || 'External script could not be loaded'));
          nodes.push(scriptNode);
          documentObject.head.appendChild(scriptNode);
        } catch (error) {
          fail(error);
        }
      };

      try {
        for (const asset of styles) {
          const node = documentObject.createElement('link');
          node.rel = 'stylesheet';
          node.href = asset.url;
          configureSecurityAttributes(node, asset.integrity);
          let ready = false;
          node.onload = () => {
            if (ready) return;
            ready = true;
            node.onload = null;
            node.onerror = null;
            remainingStyles -= 1;
            if (remainingStyles === 0) appendScript();
          };
          node.onerror = () => fail(new Error(messages.style || 'External stylesheet could not be loaded'));
          nodes.push(node);
        }

        timerId = scheduleTimeout(
          () => fail(new Error(messages.timeout || 'External assets timed out')),
          timeoutMs,
        );
        for (const node of nodes) documentObject.head.appendChild(node);
        if (!styles.length) appendScript();
      } catch (error) {
        fail(error);
      }
    });

    const retryable = attempt.catch((error) => {
      if (loads.get(key) === retryable) loads.delete(key);
      throw error;
    });
    loads.set(key, retryable);
    return retryable;
  };
}

export const loadExternalAssets = createExternalAssetLoader();
