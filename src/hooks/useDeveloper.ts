import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useDeveloper(developerId: string) {
  return useQuery({
    queryKey: ['developer', developerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('developers')
        .select('*, produtos(*)')
        .eq('id', developerId)
        .maybeSingle();
      return data;
    },
    enabled: !!developerId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDevelopers() {
  return useQuery({
    queryKey: ['developers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('developers')
        .select('*')
        .order('name');
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });
}