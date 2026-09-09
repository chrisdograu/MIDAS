import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useEffect } from 'react';

export type ActivityState = 'new' | 'seen' | 'liked' | 'saved' | 'hidden';
export type ActivityType = 'library' | 'review' | 'post';

export interface FriendActivityItem {
  id: string;            // stable key (activity_ref_id)
  type: ActivityType;
  friend_id: string;
  friend_name: string | null;
  friend_avatar: string | null;
  product_id?: string;
  product_title?: string;
  product_image?: string | null;
  status?: string;       // for library
  rating?: number;       // for review
  comment?: string | null;
  content?: string;      // for post
  created_at: string;
  state: ActivityState;
}

export function useMutualFriends() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['mutual-friends', user?.id],
    queryFn: async () => {
      if (!user) return [] as string[];
      const { data, error } = await supabase.rpc('get_mutual_friends', { _user_id: user.id });
      if (error) throw error;
      return ((data as any[]) || []).map(r => r.friend_id as string);
    },
    enabled: !!user,
  });
}

export function useFriendActivityStates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['friend-activity-states', user?.id],
    queryFn: async () => {
      if (!user) return {} as Record<string, ActivityState>;
      const { data } = await supabase
        .from('friend_activity_states')
        .select('activity_ref_id, state')
        .eq('user_id', user.id);
      const map: Record<string, ActivityState> = {};
      ((data as any[]) || []).forEach(r => { map[r.activity_ref_id] = r.state; });
      return map;
    },
    enabled: !!user,
  });
}

export function useSetActivityState() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { type: ActivityType; refId: string; friendId: string; state: ActivityState }) => {
      if (!user) throw new Error('not authenticated');
      const { error } = await supabase.from('friend_activity_states').upsert({
        user_id: user.id,
        activity_type: input.type,
        activity_ref_id: input.refId,
        friend_id: input.friendId,
        state: input.state,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,activity_type,activity_ref_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friend-activity-states'] }),
  });
}

// Realtime: refresh on changes
export function useRealtimeActivityStates() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`fas-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_activity_states', filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ['friend-activity-states'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);
}
