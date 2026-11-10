import { supabase } from '@/integrations/supabase/client';

export async function claimPriceAlerts() {
  const { data, error } = await supabase.rpc('claim_price_alerts');
  if (error) throw error;
  return data || [];
}