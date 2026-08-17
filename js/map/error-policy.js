const CANCELLED_REQUEST = /failed to fetch|aborted|abgebrochen|networkerror|load failed/i;

// Network-looking errors are expected only after this map has lost ownership.
// An active map must keep style and tile failures observable for diagnostics.
export function shouldSuppressMapError(error, { removed = false, connected = true, current = true } = {}) {
  const message = String(error?.message || '');
  return CANCELLED_REQUEST.test(message) && (removed || !connected || !current);
}
