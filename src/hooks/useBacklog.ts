import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useBacklog() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['backlog', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data } = await supabase
        .from('biblioteca_usuario')
        .select(`
          id,
          product_id,
          status,
          acquired_at,
          game:produtos(*)
        `)
        .eq('user_id', user.id)
        .in('status', ['quero_jogar', 'jogando', 'pausado', 'zerado', 'platinado', 'abandonado'])
        .order('acquired_at', { ascending: false });
      
      return (data || []).map((item) => ({
        ...item,
        game: item.game,
      }));
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  });
}

export function useBacklogStats() {
  const { data: items } = useBacklog();
  
  if (!items) return { total: 0, completed: 0, playing: 0, pending: 0, completionRate: 0 };
  
  const total = items.length;
  const completed = items.filter(i => i.status === 'zerado' || i.status === 'platinado').length;
  const playing = items.filter(i => i.status === 'jogando').length;
  const pending = items.filter(i => i.status === 'quero_jogar' || i.status === 'pausado').length;
  
  return {
    total,
    completed,
    playing,
    pending,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}