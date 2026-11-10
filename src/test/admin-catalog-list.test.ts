import { describe, expect, it } from 'vitest';
import { filterCatalogRecords, paginateCatalogRecords } from '@/desktop/lib/catalogList';

describe('Management catalog lists', () => {
  const keys = [{ key_code: 'STEAM-ABC-123' }, { key_code: 'XBOX-DEF-456' }];

  it('matches key codes without case sensitivity and trims the query', () => {
    expect(filterCatalogRecords(keys, ' abc ', key => key.key_code)).toEqual([keys[0]]);
    expect(filterCatalogRecords(keys, 'missing', key => key.key_code)).toEqual([]);
  });

  it('clearing the search restores the loaded records', () => {
    expect(filterCatalogRecords(keys, ' ', key => key.key_code)).toEqual(keys);
  });

  it('filters publishers by name before paginating', () => {
    const publishers = [{ name: 'Capcom' }, { name: 'Nintendo' }, { name: 'CAPCOM Europe' }];
    const filtered = filterCatalogRecords(publishers, 'capcom', publisher => publisher.name);
    expect(paginateCatalogRecords(filtered, 1, 1).items).toEqual([publishers[2]]);
  });

  it('shows all records across pages without duplicates or omissions', () => {
    const records = Array.from({ length: 45 }, (_, id) => ({ id }));
    const pages = [0, 1, 2].map(page => paginateCatalogRecords(records, page, 20));
    expect(pages.map(page => page.items.length)).toEqual([20, 20, 5]);
    expect(pages.flatMap(page => page.items)).toEqual(records);
    expect(pages[0].totalPages).toBe(3);
  });

  it('clamps the page after results shrink and handles an empty list', () => {
    expect(paginateCatalogRecords(keys, 4, 20)).toEqual({ currentPage: 0, totalPages: 1, items: keys });
    expect(paginateCatalogRecords([], 3, 20)).toEqual({ currentPage: 0, totalPages: 1, items: [] });
  });
});