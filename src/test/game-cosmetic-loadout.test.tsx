import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { equipGamePageSlot, useGamePageLoadout } from '@/hooks/useCosmetics';

const mock = vi.hoisted(() => ({ reads: vi.fn(), error: null as null | { message: string } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => {
  const q: any = {
    select: () => { mock.reads(); return q; }, eq: () => q, delete: () => q, upsert: () => q,
    then: (resolve: any) => Promise.resolve({ data: [], error: mock.error }).then(resolve),
  };
  return q;
} } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mock.error = null; });

describe('Atualização de cosméticos por jogo', () => {
  it('atualiza leitores do mesmo usuário e jogo após equipar e remover', async () => {
    renderHook(() => useGamePageLoadout('u', 'p'));
    await waitFor(() => expect(mock.reads).toHaveBeenCalledTimes(1));
    await act(async () => { await equipGamePageSlot('other', 'p', 'theme', 'r'); });
    expect(mock.reads).toHaveBeenCalledTimes(1);
    await act(async () => { await equipGamePageSlot('u', 'p', 'theme', 'r'); });
    await waitFor(() => expect(mock.reads).toHaveBeenCalledTimes(2));
    await act(async () => { await equipGamePageSlot('u', 'p', 'theme', null); });
    await waitFor(() => expect(mock.reads).toHaveBeenCalledTimes(3));
  });
  it('não anuncia atualização quando a gravação falha e informa erro de leitura', async () => {
    mock.error = { message: 'denied' };
    const { result } = renderHook(() => useGamePageLoadout('u', 'p'));
    await waitFor(() => expect(result.current.loadError).toBe(true));
    await act(async () => { await equipGamePageSlot('u', 'p', 'theme', 'r'); });
    expect(mock.reads).toHaveBeenCalledTimes(1);
  });
});