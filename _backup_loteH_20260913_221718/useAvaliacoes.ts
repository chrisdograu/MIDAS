import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useAvaliacoes(productId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get avg rating + total
  const { data: ratingData } = useQuery({
    queryKey: ['rating', productId],
    queryFn: async () => {
      if (!productId) return { avg_rating: 0, total_reviews: 0 };
      const { data, error } = await supabase.rpc('get_product_avg_rating', { p_product_id: productId });
      if (error) throw error;
      const row = data?.[0] || { avg_rating: 0, total_reviews: 0 };
      return { avg_rating: Number(row.avg_rating), total_reviews: Number(row.total_reviews) };
    },
    enabled: !!productId,
  });

  // Get user's own rating
  const { data: userRating } = useQuery({
    queryKey: ['my-rating', productId, user?.id],
    queryFn: async () => {
      if (!user || !productId) return null;
      const { data, error } = await supabase
        .from('avaliacoes')
        .select('id, rating')
        .eq('product_id', productId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!productId,
  });

  const submitRating = useMutation({
    mutationFn: async (rating: number) => {
      if (!user || !productId) throw new Error('Missing data');
      if (userRating) {
        // Update existing
        const { error } = await supabase.from('avaliacoes').update({ rating }).eq('id', userRating.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase.from('avaliacoes').insert({
          user_id: user.id,
          product_id: productId,
          rating,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rating', productId] });
      queryClient.invalidateQueries({ queryKey: ['my-rating', productId] });
    },
  });

  return {
    avgRating: ratingData?.avg_rating ?? 0,
    totalReviews: ratingData?.total_reviews ?? 0,
    userRating: userRating?.rating ?? null,
    submitRating,
  };
}
