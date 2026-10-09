import type { Game } from '@/lib/gameData';

export interface DeveloperGameFilters {
  search: string;
  platform: string;
  category: string;
  year: string;
  price: string;
  rating: string;
  onSale: boolean;
  inStock: boolean;
  sort: string;
}

export const defaultDeveloperFilters: DeveloperGameFilters = {
  search: '', platform: 'all', category: 'all', year: 'all', price: 'all',
  rating: 'all', onSale: false, inStock: false, sort: 'recent',
};

export function releaseYear(game: Game): string {
  return /^\d{4}-\d{2}-\d{2}/.test(game.releaseDate) ? game.releaseDate.slice(0, 4) : '';
}

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
const releaseTime = (game: Game) => {
  const value = Date.parse(game.releaseDate);
  return Number.isFinite(value) ? value : 0;
};

export function filterDeveloperGames(games: Game[], filters: DeveloperGameFilters): Game[] {
  const query = normalize(filters.search);
  return games.filter(game => {
    if (query && !normalize([game.title, ...game.tags].join(' ')).includes(query)) return false;
    if (filters.platform !== 'all' && !game.platform.includes(filters.platform)) return false;
    if (filters.category !== 'all' && game.category !== filters.category) return false;
    if (filters.year !== 'all' && releaseYear(game) !== filters.year) return false;
    if (filters.rating !== 'all' && game.rating < Number(filters.rating)) return false;
    if (filters.price === 'free' && game.price !== 0) return false;
    if (filters.price === '50' && game.price > 50) return false;
    if (filters.price === '100' && game.price > 100) return false;
    if (filters.price === '200' && game.price > 200) return false;
    if (filters.onSale && !(game.originalPrice > game.price)) return false;
    if (filters.inStock && game.stock <= 0) return false;
    return true;
  }).sort((a, b) => {
    let comparison = 0;
    switch (filters.sort) {
      case 'oldest': comparison = (releaseTime(a) || Infinity) - (releaseTime(b) || Infinity); break;
      case 'rating': comparison = b.rating - a.rating; break;
      case 'price': comparison = a.price - b.price; break;
      case 'price-desc': comparison = b.price - a.price; break;
      case 'discount': comparison = (b.originalPrice > 0 ? (b.originalPrice - b.price) / b.originalPrice : 0) - (a.originalPrice > 0 ? (a.originalPrice - a.price) / a.originalPrice : 0); break;
      case 'name': comparison = a.title.localeCompare(b.title, 'pt-BR'); break;
      default: comparison = releaseTime(b) - releaseTime(a);
    }
    return comparison || a.title.localeCompare(b.title, 'pt-BR');
  });
}
