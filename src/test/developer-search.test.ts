import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  const chain = {
    select: vi.fn(), ilike: vi.fn(), order: vi.fn(), range: vi.fn(),
  };
  return { chain, from: vi.fn() };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: db.from } }));

import { developerSearchLink, searchDevelopers } from '@/lib/developerSearch';

const studio = { id: 'studio-id', name: 'Team Cherry', slug: 'team-cherry', logo_url: null };

describe('Busca de desenvolvedores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.from.mockReturnValue(db.chain);
    db.chain.select.mockReturnValue(db.chain);
    db.chain.ilike.mockReturnValue(db.chain);
    db.chain.order.mockReturnValue(db.chain);
    db.chain.range.mockResolvedValue({ data: [studio], error: null });
  });

  it('abre o perfil público por slug ou UUID', () => {
    expect(developerSearchLink(studio)).toBe('/desenvolvedor/team-cherry');
    expect(developerSearchLink({ ...studio, slug: null })).toBe('/desenvolvedor/studio-id');
  });

  it('direciona o desktop ao cadastro filtrado pelo nome', () => {
    expect(developerSearchLink(studio, true)).toBe('/desktop/desenvolvedores?q=Team%20Cherry');
  });

  it('não consulta para termos menores que dois caracteres', async () => {
    expect(await searchDevelopers(' a ')).toEqual([]);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('busca os registros existentes, escapando curingas e paginando', async () => {
    expect(await searchDevelopers(' Team% ', 20, 20)).toEqual([studio]);
    expect(db.from).toHaveBeenCalledWith('developers');
    expect(db.chain.ilike).toHaveBeenCalledWith('name', '%Team\\%%');
    expect(db.chain.range).toHaveBeenCalledWith(20, 39);
  });

  it('propaga falhas em vez de retornar dados inventados', async () => {
    db.chain.range.mockResolvedValue({ data: null, error: new Error('indisponível') });
    await expect(searchDevelopers('Team')).rejects.toThrow('indisponível');
  });
});