import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useUnreadNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['unread-notifications', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) {
        console.error('Erro ao buscar notificações não lidas:', error);
        return 0;
      }
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
    staleTime: 15000,
  });
}