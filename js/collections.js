// Pure collection preparation shared by catalogue-style views.

const positiveInteger = (value, fallback = 1) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 ? Math.floor(number) : fallback;
};

export function preparePage(items, { compare, page = 1, perPage } = {}) {
  const sorted = [...items];
  if (typeof compare === 'function') sorted.sort(compare);

  const pageSize = positiveInteger(perPage);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(positiveInteger(page), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    sorted,
    visible: sorted.slice(start, start + pageSize),
    page: currentPage,
    totalPages,
  };
}

export function uniqueOptions(rows, key, { locale } = {}) {
  const values = new Set(rows
    .map((row) => String(row?.[key] || ''))
    .filter(Boolean));

  return [...values]
    .sort((left, right) => left.localeCompare(right, locale))
    .map((value) => ({ value, label: value }));
}
