import { useEffect, useMemo, useState } from 'react';

export interface AdminTableState {
  search: string;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
  extras: Record<string, string>;
}

const DEFAULT: AdminTableState = {
  search: '', sortKey: 'created_at', sortDir: 'desc', page: 1, pageSize: 20, extras: {},
};

export function useAdminTable(key: string, initial?: Partial<AdminTableState>) {
  const storageKey = `admin_table:${key}`;
  const [state, setState] = useState<AdminTableState>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { ...DEFAULT, ...initial, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULT, ...initial };
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
  }, [storageKey, state]);

  const setSearch = (s: string) => setState(p => ({ ...p, search: s, page: 1 }));
  const setSort = (k: string) => setState(p => ({
    ...p,
    sortKey: k,
    sortDir: p.sortKey === k ? (p.sortDir === 'asc' ? 'desc' : 'asc') : 'desc',
  }));
  const setPage = (n: number) => setState(p => ({ ...p, page: Math.max(1, n) }));
  const setExtra = (k: string, v: string) => setState(p => ({
    ...p, extras: { ...p.extras, [k]: v }, page: 1,
  }));
  const reset = () => setState({ ...DEFAULT, ...initial });

  return { state, setSearch, setSort, setPage, setExtra, reset };
}

export function paginate<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), total, totalPages, page: safePage };
}

export function sortRows<T extends Record<string, any>>(rows: T[], key: string, dir: 'asc' | 'desc'): T[] {
  const mul = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = a?.[key]; const vb = b?.[key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
    return String(va).localeCompare(String(vb)) * mul;
  });
}

export function useFilteredSorted<T extends Record<string, any>>(
  rows: T[],
  state: AdminTableState,
  textFields: string[]
) {
  return useMemo(() => {
    const q = state.search.trim().toLowerCase();
    const filtered = q
      ? rows.filter(r => textFields.some(f => String(r?.[f] ?? '').toLowerCase().includes(q)))
      : rows;
    const sorted = sortRows(filtered, state.sortKey, state.sortDir);
    return paginate(sorted, state.page, state.pageSize);
  }, [rows, state.search, state.sortKey, state.sortDir, state.page, state.pageSize, textFields]);
}
