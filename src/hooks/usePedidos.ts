import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CartItem } from '@/lib/cartContext';

export interface Pedido {
  id: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  payment_method: string | null;
  installments: number | null;
  coupon_code: string | null;
  created_at: string;
  itens_pedido?: {
    id: string;
    product_id: string;
    quantity: number;
    price_at_purchase: number;
    produtos?: { title: string; image_url: string | null };
  }[];
}

export function usePedidos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pedidos = [], ...query } = useQuery({
    queryKey: ['pedidos', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('pedidos')
        .select('*, itens_pedido(*, produtos:product_id(title, image_url))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Pedido[];
    },
    enabled: !!user,
  });

  // Criação de pedido via RPC segura (server-side price + stock lock)
  const criarPedido = useMutation({
    mutationFn: async ({
      items, total, paymentMethod, installments, couponCode,
    }: {
      items: (CartItem & { bundleId?: string | null })[];
      // Mantidos por compat, mas o servidor ignora e recalcula
      subtotal?: number;
      discountAmount?: number;
      total: number;
      paymentMethod: string;
      installments: number;
      couponCode: string | null;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const payload = items.map(it => ({
        product_id: it.game.id,
        quantity: it.quantity,
        bundle_id: (it as any).bundleId ?? null,
      }));
      const { data, error } = await (supabase as any).rpc('create_order_secure', {
        _items: payload,
        _payment_method: paymentMethod,
        _installments: installments,
        _coupon_code: couponCode,
        _client_total: total,
      });
      if (error) throw error;
      return { id: (data as any)?.order_id, ...(data as any) };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pedidos'] }),
  });

  return { pedidos, criarPedido, isLoading: query.isLoading };
}
