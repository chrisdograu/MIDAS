import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { usePedidos } from '@/hooks/usePedidos';

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'bruno' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: mock.rpc,
  from: () => {
    const q: any = { select: () => q, eq: () => q, order: async () => ({ data: [], error: null }) };
    return q;
  },
} }));

describe('Entrega da compra na biblioteca', () => {
  it('atualiza a biblioteca do comprador somente após pedido confirmado', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(['biblioteca', 'bruno'], []);
    client.setQueryData(['biblioteca', 'ana'], []);
    const { result } = renderHook(() => usePedidos(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    mock.rpc.mockResolvedValueOnce({ data: { order_id: 'pedido-confirmado', total: 67.91 }, error: null });
    await act(async () => {
      await result.current.criarPedido.mutateAsync({ items: [], total: 67.91, paymentMethod: 'pix', installments: 1, couponCode: 'BEMVINDO10' });
    });
    expect(client.getQueryState(['biblioteca', 'bruno'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['biblioteca', 'ana'])?.isInvalidated).toBe(false);
    client.setQueryData(['biblioteca', 'bruno'], []);
    mock.rpc.mockResolvedValueOnce({ data: null, error: new Error('compra negada') });
    await act(async () => {
      await expect(result.current.criarPedido.mutateAsync({ items: [], total: 67.91, paymentMethod: 'pix', installments: 1, couponCode: null })).rejects.toThrow('compra negada');
    });
    expect(client.getQueryState(['biblioteca', 'bruno'])?.isInvalidated).toBe(false);
  });
});