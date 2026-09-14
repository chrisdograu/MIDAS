import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useDeveloper(developerId: string) {
  return useQuery({
    queryKey: ['developer', developerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('developers')
        .select('*, produtos(*)')
        .eq('id', developerId)
        .eq('produtos.is_active', true)
        .maybeSingle();
      if (error) throw error;
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
      const { data, error } = await supabase
        .from('developers')
        .select('*')
        .order('name')
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });
}