import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function useFavoritoAnuncio(anuncioId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: isFav = false, isLoading } = useQuery({
    queryKey: ['favorito-anuncio', user?.id, anuncioId],
    queryFn: async () => {
      if (!user || !anuncioId) return false;
      const { data, error } = await supabase
        .from('favoritos_anuncio')
        .select('id')
        .eq('user_id', user.id)
        .eq('anuncio_id', anuncioId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user && !!anuncioId,
    staleTime: 60_000,
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Entre para favoritar');
      if (!anuncioId) throw new Error('Anúncio inválido');
      if (isFav) {
        const { error } = await supabase
          .from('favoritos_anuncio')
          .delete()
          .eq('user_id', user.id)
          .eq('anuncio_id', anuncioId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('favoritos_anuncio')
          .upsert(
            { user_id: user.id, anuncio_id: anuncioId },
            { onConflict: 'user_id,anuncio_id' }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorito-anuncio', user?.id, anuncioId] });
      if (!isFav) toast.success('Salvo nos favoritos ❤');
    },
    onError: (e: any) => {
      toast.error(e?.message || 'Não foi possível atualizar o favorito');
    },
  });

  return {
    isFav,
    loading: isLoading || toggle.isPending,
    toggle: toggle.mutateAsync,
  };
}