import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function useFollow(targetId?: string) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [requested, setRequested] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!targetId) return;
    const [{ count: f }, { count: fg }, mine, req] = await Promise.all([
      supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', targetId),
      supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', targetId),
      user ? supabase.from('user_follows').select('id').eq('follower_id', user.id).eq('following_id', targetId).maybeSingle() : Promise.resolve({ data: null }),
      user ? supabase.from('follow_requests').select('id').eq('requester_id', user.id).eq('target_id', targetId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setFollowersCount(f || 0);
    setFollowingCount(fg || 0);
    setIsFollowing(!!mine.data);
    setRequested(!!req.data);
  }, [targetId, user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async () => {
    if (!user) { toast.error('Entre para seguir'); return; }
    if (!targetId || user.id === targetId) return;
    setLoading(true);
    if (isFollowing) {
      const { error } = await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
      if (error) { toast.error(`Não foi possível deixar de seguir: ${error.message}`); setLoading(false); return; }
      setIsFollowing(false);
      setFollowersCount(c => Math.max(0, c - 1));
    } else if (requested) {
      // cancela pedido pendente
      const { error } = await supabase.from('follow_requests').delete().eq('requester_id', user.id).eq('target_id', targetId);
      if (error) { toast.error(`Não foi possível cancelar o pedido: ${error.message}`); setLoading(false); return; }
      setRequested(false);
      toast('Pedido cancelado');
    } else {
      // tenta criar follow_request — o trigger no DB decide se vira follow direto ou fica pendente
      const { error } = await supabase.from('follow_requests').insert({ requester_id: user.id, target_id: targetId });
      if (error && !/duplicate|unique/i.test(error.message)) {
        toast.error('Não foi possível seguir'); setLoading(false); return;
      }
      // re-sincroniza estado (trigger pode ter criado follow direto)
      await refresh();
      toast.success('Seguindo ✨');
    }
    setLoading(false);
  };

  return { isFollowing, requested, followersCount, followingCount, loading, toggle, refresh };
}

export async function getFollowingIds(userId: string): Promise<string[]> {
  const { data } = await supabase.from('user_follows').select('following_id').eq('follower_id', userId);
  return (data || []).map(d => d.following_id);
}
