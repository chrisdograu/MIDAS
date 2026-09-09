
import { useState, useCallback } from 'react';

interface UseBulkSelectionOptions<T> {
  items: T[];
  getId: (item: T) => string;
}

export function useBulkSelection<T>({ items, getId }: UseBulkSelectionOptions<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }, [selectedIds]);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(getId)));
    }
  }, [selectedIds, items, getId]);

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
    isAllSelected: selectedIds.size === items.length && items.length > 0,
  };
}