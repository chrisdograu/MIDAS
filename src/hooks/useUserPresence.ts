import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useUserPresence(userId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-presence', userId, user?.id], enabled: Boolean(userId && user), refetchInterval: 30_000,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.rpc('get_user_presence', { _user_id: userId });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}