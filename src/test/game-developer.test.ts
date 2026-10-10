import { describe, expect, it } from 'vitest';
import { mapProdutoToGame } from '@/lib/gameData';

const row = {
  id: 'game-id', title: 'Jogo', image_url: null, price: 20, original_price: 20,
  discount: 0, category: null, platform: null, rating: null, description: null,
  release_date: null, publisher: 'Publicadora diferente', tags: null,
};

describe('linked game developer', () => {
  it('preserves the linked studio separately from its publisher', () => {
    const developer = { id: 'studio-id', name: 'Estúdio', slug: 'estudio', logo_url: null };
    const game = mapProdutoToGame({ ...row, developers: developer });
    expect(game.developer).toEqual(developer);
    expect(game.publisher).toBe('Publicadora diferente');
  });
  it('does not invent a studio for games without a linked developer', () => {
    expect(mapProdutoToGame(row).developer).toBeNull();
    expect(mapProdutoToGame({ ...row, developers: null }).developer).toBeNull();
  });
  it('preserves UUID navigation when the studio has no slug', () => {
    const game = mapProdutoToGame({ ...row, developers: { id: 'studio-id', name: 'Estúdio', slug: null, logo_url: null } });
    expect(game.developer?.slug || game.developer?.id).toBe('studio-id');
  });
});