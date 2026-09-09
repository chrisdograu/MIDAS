import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useCuratedLists() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['curated-lists', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('curated_lists')
        .select(`
          *,
          creator:profiles!created_by(display_name),
          items:curated_list_items(count),
          follows:curated_list_follows(count)
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false });
      
      return (data || []).map((item) => ({
        ...item,
        item_count: item.items?.[0]?.count || 0,
        follow_count: item.follows?.[0]?.count || 0,
        creator_name: item.creator?.display_name || 'Usuário',
        is_following: user ? item.follows?.some((f) => f.user_id === user.id) : false,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCuratedList(listId: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['curated-list', listId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('curated_lists')
        .select(`
          *,
          creator:profiles!created_by(display_name),
          items:curated_list_items(
            *,
            game:produtos(*)
          ),
          follows:curated_list_follows(count)
        `)
        .eq('id', listId)
        .maybeSingle();
      
      if (!data) return null;
      
      return {
        ...data,
        item_count: data.items?.length || 0,
        follow_count: data.follows?.[0]?.count || 0,
        creator_name: data.creator?.display_name || 'Usuário',
        is_following: user ? data.follows?.some((f) => f.user_id === user.id) : false,
        items: data.items || [],
      };
    },
    enabled: !!listId,
    staleTime: 2 * 60 * 1000,
  });
}