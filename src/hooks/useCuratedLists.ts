import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useCuratedLists() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['curated-lists', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('curated_lists')
        .select(`
          *,
          creator:profiles!created_by(display_name),
          items:curated_list_items(count)
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const listIds = (data || []).map(item => item.id);
      const [counts, follows] = await Promise.all([
        supabase.rpc('curated_list_follow_counts', { _list_ids: listIds }),
        user ? supabase.from('curated_list_follows').select('list_id').eq('user_id', user.id).in('list_id', listIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (counts.error) throw counts.error;
      if (follows.error) throw follows.error;
      const followingIds = new Set((follows.data || []).map(f => f.list_id));
      
      return (data || []).map((item) => ({
        ...item,
        item_count: item.items?.[0]?.count || 0,
        follow_count: Number(counts.data?.find(c => c.list_id === item.id)?.follow_count || 0),
        creator_name: item.creator?.display_name || 'Usuário',
        is_following: followingIds.has(item.id),
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
      const { data, error } = await supabase
        .from('curated_lists')
        .select(`
          *,
          creator:profiles!created_by(display_name),
          items:curated_list_items(
            *,
            game:produtos(*)
          )
        `)
        .eq('id', listId)
        .maybeSingle();
      if (error) throw error;
      
      if (!data) return null;
      const [counts, follow] = await Promise.all([
        supabase.rpc('curated_list_follow_counts', { _list_ids: [listId] }),
        user ? supabase.from('curated_list_follows').select('id').eq('list_id', listId).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      if (counts.error) throw counts.error;
      if (follow.error) throw follow.error;
      
      return {
        ...data,
        item_count: data.items?.length || 0,
        follow_count: Number(counts.data?.[0]?.follow_count || 0),
        creator_name: data.creator?.display_name || 'Usuário',
        is_following: Boolean(follow.data),
        items: data.items || [],
      };
    },
    enabled: !!listId,
    staleTime: 2 * 60 * 1000,
  });
}