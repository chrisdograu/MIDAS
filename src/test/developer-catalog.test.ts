import { describe, it, expect } from 'vitest';
import { defaultDeveloperFilters, filterDeveloperGames, releaseYear } from '@/lib/developerCatalog';
import type { Game } from '@/lib/gameData';
const game = (changes: Partial<Game>): Game => ({ id: '1', title: 'Ação', image: '', price: 40, originalPrice: 80, discount: 50, category: 'Aventura', platform: ['PC'], rating: 4.5, description: '', releaseDate: '2024-01-01', publisher: '', tags: ['Exploração'], stock: 3, ...changes });
const games = [game({}), game({ id: '2', title: 'Beta', platform: ['Switch'], price: 0, originalPrice: 0, rating: 3, releaseDate: '2023-01-01', stock: 0 }), game({ id: '3', title: 'Novo', price: 120, originalPrice: 120, releaseDate: '' })];
describe('developer catalog', () => {
  it('searches titles and tags without accents', () => {
    expect(filterDeveloperGames(games, { ...defaultDeveloperFilters, search: 'acao' }).map(g => g.id)).toEqual(['1']);
    expect(filterDeveloperGames(games, { ...defaultDeveloperFilters, search: 'exploracao' })).toHaveLength(3);
  });
  it('combines platform, category, year, price, rating and availability', () => {
    expect(filterDeveloperGames(games, { ...defaultDeveloperFilters, platform: 'PC', category: 'Aventura', year: '2024', price: '50', rating: '4', onSale: true, inStock: true }).map(g => g.id)).toEqual(['1']);
    expect(filterDeveloperGames(games, { ...defaultDeveloperFilters, platform: 'Switch', inStock: true })).toHaveLength(0);
  });
  it('handles free prices and discounts consistently', () => {
    expect(filterDeveloperGames(games, { ...defaultDeveloperFilters, price: 'free' }).map(g => g.id)).toEqual(['2']);
    expect(filterDeveloperGames(games, { ...defaultDeveloperFilters, onSale: true }).map(g => g.id)).toEqual(['1']);
  });
  it('sorts without mutating input and puts unknown releases last', () => {
    expect(filterDeveloperGames(games, { ...defaultDeveloperFilters, sort: 'oldest' }).map(g => g.id)).toEqual(['2', '1', '3']);
    expect(filterDeveloperGames(games, { ...defaultDeveloperFilters, sort: 'price-desc' }).map(g => g.id)).toEqual(['3', '1', '2']);
    expect(games.map(g => g.id)).toEqual(['1', '2', '3']);
    expect(releaseYear(games[2])).toBe('');
  });
  it('restores the whole catalog with default filters', () => {
    expect(filterDeveloperGames(games, defaultDeveloperFilters)).toHaveLength(3);
  });
});
