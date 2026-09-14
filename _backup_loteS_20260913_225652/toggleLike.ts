import { supabase } from '@/integrations/supabase/client';

/**
 * Curtir/descurtir de forma atômica (Etapa 5 da Rodada 31).
 * Antes cada tela fazia delete + insert em duas etapas: se a segunda falhasse,
 * a curtida era perdida silenciosamente. Agora tudo acontece numa única RPC.
 */
export type LikeKind = 'forum_post' | 'forum_reply' | 'review' | 'opinion' | 'screenshot';

export type LikeResult = { liked: boolean; total: number };

export async function toggleLike(kind: LikeKind, targetId: string): Promise<LikeResult | null> {
  const { data, error } = await supabase.rpc('toggle_like', { p_kind: kind, p_target: targetId });
  if (error) return null;
  const r = (data ?? {}) as { liked?: boolean; total?: number };
  return { liked: !!r.liked, total: Number(r.total ?? 0) };
}

/** Reação de emoji em mensagem, atômica. Retorna o emoji final (null = removida). */
export async function toggleMessageReaction(messageId: string, emoji: string): Promise<{ emoji: string | null } | null> {
  const { data, error } = await supabase.rpc('toggle_message_reaction', {
    p_message_id: messageId,
    p_emoji: emoji,
  });
  if (error) return null;
  const r = (data ?? {}) as { emoji?: string | null };
  return { emoji: r.emoji ?? null };
}
