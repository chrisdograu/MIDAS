
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useAdminNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['admin-notifications', user?.id],
    queryFn: async () => {
      if (!user) return { data: [], unreadCount: 0 };

      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Erro ao buscar notificações admin:', error);
        return { data: [], unreadCount: 0 };
      }

      const unreadCount = data?.filter((n) => !n.is_read).length || 0;

      return { data: data || [], unreadCount };
    },
    enabled: !!user,
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

export function useAdminUnreadCount() {
  const { data } = useAdminNotifications();
  return data?.unreadCount || 0;
}