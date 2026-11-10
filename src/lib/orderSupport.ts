import { supabase } from '@/integrations/supabase/client';

// A request is not a refund: only the trusted staff workflow changes order state.
export async function requestOrderRefund(orderId: string, reason: string) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Faça login para solicitar atendimento.');
  const { data: order, error: orderError } = await supabase.from('pedidos').select('id, status')
    .eq('id', orderId).eq('user_id', user.id).single();
  if (orderError) throw orderError;
  if (order.status === 'refunded' || order.status === 'cancelled') throw new Error('Este pedido já foi encerrado.');
  const { data, error } = await supabase.from('tickets').insert({ user_id: user.id, channel: 'web',
    subject: `Solicitação de reembolso — pedido ${orderId}`, body: reason.trim() }).select('id').single();
  if (error) throw error;
  return data.id;
}