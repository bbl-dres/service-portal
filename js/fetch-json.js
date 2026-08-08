// Shared file fetch for mock data sources. Checks `response.ok`, parses JSON and
// optionally validates the root shape; throws on network, HTTP, parse or shape
// errors. Callers (core / dashboard-data / process-engine) catch failures and
// add their own tracking (FAILED registers, fallback values, graceful progress).
// This unifies three previously divergent `fetch→json→fallback` variants
// (code-review D6) and closes the parses-but-has-the-wrong-shape gap (C4).
export async function fetchJSON(url, { shape, signal } = {}) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const json = await response.json();
  if (shape === 'array' && !Array.isArray(json)) throw new Error(`expected an array: ${url}`);
  if (shape === 'object' && (json === null || typeof json !== 'object' || Array.isArray(json))) {
    throw new Error(`expected an object: ${url}`);
  }
  return json;
}
