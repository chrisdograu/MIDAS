import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { mapProdutoToGame, Game } from '@/lib/gameData';

export function useProdutos() {
  return useQuery({
    queryKey: ['produtos'],
    queryFn: async (): Promise<Game[]> => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, title, image_url, price, original_price, discount, platform, category, rating, stock, release_date, tags, publisher, description, featured, is_active')
        .eq('is_active', true)
        .eq('awaiting_first_stock', false)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []).map(mapProdutoToGame);
    },
    staleTime: 5 * 60_000,
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
    staleTime: 5 * 60_000,
  });
}