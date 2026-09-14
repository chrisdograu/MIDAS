
import { useState, useCallback } from 'react';

interface UseBulkSelectionOptions<T> {
  items: T[];
  getId: (item: T) => string;
}

export function useBulkSelection<T>({ items, getId }: UseBulkSelectionOptions<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds(prev => {
      if (items.length > 0 && items.every(item => prev.has(getId(item)))) {
        return new Set();
      }
      return new Set(items.map(getId));
    });
  }, [items, getId]);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(getId)));
  }, [items, getId]);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const getSelectedItems = useCallback(() => {
    return items.filter((item) => selectedIds.has(getId(item)));
  }, [items, selectedIds, getId]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggle,
    toggleAll,
    clear,
    selectAll,
    isSelected,
    getSelectedItems,
    isAllSelected: items.length > 0 && items.every(item => selectedIds.has(getId(item))),
  };
}