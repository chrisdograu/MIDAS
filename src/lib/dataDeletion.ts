import { supabase } from '@/integrations/supabase/client';

export async function requestMyDataDeletion() {
  const { data, error } = await supabase.rpc('request_my_data_deletion');
  if (error) throw error;
  return data;
}