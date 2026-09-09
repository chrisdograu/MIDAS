import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { mapProdutoToGame, Game } from '@/lib/gameData';

export function useProdutos() {
  return useQuery({
    queryKey: ['produtos'],
    queryFn: async (): Promise<Game[]> => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('is_active', true)
        .eq('awaiting_first_stock', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapProdutoToGame);
    },
  });
}

export function useProduto(id: string | undefined) {
  return useQuery({
    queryKey: ['produto', id],
    queryFn: async (): Promise<Game | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? mapProdutoToGame(data) : null;
    },
    enabled: !!id,
  });
}
