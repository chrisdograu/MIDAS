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

export async function fetchProduto(id: string): Promise<Game | null> {
  const { data, error } = await supabase.from('produtos').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const game = mapProdutoToGame(data);
  if (data.developer_id) {
    const { data: developer } = await supabase.from('developers')
      .select('id, name, slug, logo_url').eq('id', data.developer_id).maybeSingle();
    game.developer = developer ?? null;
  }
  return game;
}

export function useProduto(id: string | undefined) {
  return useQuery({
    queryKey: ['produto', id],
    queryFn: async (): Promise<Game | null> => {
      if (!id) return null;
      return fetchProduto(id);
    },
    enabled: !!id,
  });
}
