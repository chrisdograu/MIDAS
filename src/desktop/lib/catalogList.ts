/** Filter only records already authorized and loaded by the management screen. */
export function filterCatalogRecords<T>(records: T[], search: string, value: (record: T) => string): T[] {
  const query = search.trim().toLocaleLowerCase('pt-BR');
  return query ? records.filter(record => value(record).toLocaleLowerCase('pt-BR').includes(query)) : records;
}

/** Clamp the current page when filtering or deletion reduces the result set. */
export function paginateCatalogRecords<T>(records: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));
  return {
    currentPage,
    totalPages,
    items: records.slice(currentPage * pageSize, (currentPage + 1) * pageSize),
  };
}