// Own the temporary body class, listener and fallback timer for one print flow.
export function createPrintMode({ className = 'print--plan', timeout = 1000 } = {}) {
  let activeCleanup = null;

  const destroy = () => {
    if (activeCleanup) activeCleanup();
  };

  const print = () => {
    destroy();
    document.body.classList.add(className);
    let timer = null;
    let active = true;
    const cleanup = () => {
      if (!active) return;
      active = false;
      document.body.classList.remove(className);
      window.removeEventListener('afterprint', cleanup);
      if (timer !== null) clearTimeout(timer);
      if (activeCleanup === cleanup) activeCleanup = null;
    };
    activeCleanup = cleanup;
    window.addEventListener('afterprint', cleanup);
    try {
      window.print();
    } catch (error) {
      cleanup();
      throw error;
    }
    if (activeCleanup === cleanup) timer = setTimeout(cleanup, timeout);
  };

  return { print, destroy };
}
