import { supabase } from '@/integrations/supabase/client';

export async function loadListPreferences(listId: string, userId: string) {
  const [follow, saved] = await Promise.all([
    supabase.from('curated_list_follows').select('id').eq('list_id', listId).eq('user_id', userId).maybeSingle(),
    supabase.from('saved_lists').select('id').eq('list_id', listId).eq('user_id', userId).maybeSingle(),
  ]);
  if (follow.error) throw follow.error;
  if (saved.error) throw saved.error;
  return { following: Boolean(follow.data), saved: Boolean(saved.data) };
}

export async function setListPreference(table: 'saved_lists' | 'curated_list_follows', listId: string, userId: string, enabled: boolean) {
  const result = enabled
    ? await supabase.from(table).insert({ list_id: listId, user_id: userId }).select('id').single()
    : await supabase.from(table).delete().eq('list_id', listId).eq('user_id', userId).select('id');
  if (result.error) throw result.error;
  return enabled;
}