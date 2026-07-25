// Gemeinsamer Datei-Fetch für die (gemockten) Datenquellen. Prüft `r.ok`, parst
// JSON und validiert optional die Grundform; wirft bei Netz-/HTTP-/Parse-/Form-
// Fehler. Die Aufrufer (core / dashboard-data / process-engine) fangen selbst und legen ihr
// Tracking darüber (FAILED-Merkliste, Fallback-Werte, stilles Weiterlaufen).
// Vereinheitlicht die zuvor drei divergenten `fetch→json→fallback`-Varianten
// (code-review D6) und schliesst die Form-Lücke (parst-aber-falsch-geformt, C4).
export async function fetchJSON(url, { shape } = {}) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const json = await r.json();
  if (shape === 'array' && !Array.isArray(json)) throw new Error(`erwartet Array: ${url}`);
  if (shape === 'object' && (json === null || typeof json !== 'object' || Array.isArray(json))) {
    throw new Error(`erwartet Objekt: ${url}`);
  }
  return json;
}
