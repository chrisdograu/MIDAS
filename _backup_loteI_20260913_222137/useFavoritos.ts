import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { dbWrite } from '@/lib/dbWrite';

export function useFavoritos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: favoritos = [], ...query } = useQuery({
    queryKey: ['favoritos', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('favoritos')
        .select('product_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return data.map(f => f.product_id);
    },
    enabled: !!user,
  });

  const toggleFavorito = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error('Not authenticated');
      const isFav = favoritos.includes(productId);
      if (isFav) {
        await dbWrite(supabase.from('favoritos').delete().eq('user_id', user.id).eq('product_id', productId));
      } else {
        await dbWrite(supabase.from('favoritos').insert({ user_id: user.id, product_id: productId }));
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favoritos'] }),
  });

  return {
    favoritos,
    isFavorito: (id: string) => favoritos.includes(id),
    toggleFavorito: toggleFavorito.mutate,
    loading: query.isLoading,
  };
}
