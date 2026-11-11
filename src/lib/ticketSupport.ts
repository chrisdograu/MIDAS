import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type SupportTicket = Tables<'tickets'>;
export type TicketMessage = Tables<'ticket_messages'>;
export type TicketStatus = SupportTicket['status'];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  aberto: 'Aberto', em_andamento: 'Em andamento', aguardando_usuario: 'Aguardando sua resposta', resolvido: 'Resolvido', fechado: 'Fechado',
};
export const isTicketClosed = (status: TicketStatus) => status === 'fechado' || status === 'resolvido';

export async function loadMyTickets(userId: string, page: number, pageSize = 15, status?: TicketStatus) {
  let query = supabase.from('tickets').select('*', { count: 'exact' }).eq('user_id', userId);
  if (status) query = query.eq('status', status);
  const { data, error, count } = await query.order('created_at', { ascending: false }).order('id')
    .range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) throw error;
  return { tickets: data || [], count: count || 0 };
}

export async function loadTicketMessages(ticketId: string) {
  const messages: TicketMessage[] = [];
  // Explicit paging avoids silently losing old messages at the Data API row limit.
  for (let page = 0; ; page++) {
    const { data, error } = await supabase.from('ticket_messages').select('*').eq('ticket_id', ticketId)
      .order('created_at').order('id').range(page * 500, (page + 1) * 500 - 1);
    if (error) throw error;
    messages.push(...(data || []));
    if ((data || []).length < 500) return messages;
  }
}

export async function sendTicketMessage(ticketId: string, content: string, attachments: string[] = []) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Entre na sua conta para responder.');
  if (!content.trim()) throw new Error('Escreva uma mensagem.');
  const payload: TablesInsert<'ticket_messages'> = { ticket_id: ticketId, sender_id: user.id, content: content.trim(), attachments };
  const { data, error } = await supabase.from('ticket_messages').insert(payload).select('*').single();
  if (error) throw error;
  if (!data) throw new Error('A mensagem não foi enviada.');
  return data;
}