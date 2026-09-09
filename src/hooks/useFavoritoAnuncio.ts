import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function useFavoritoAnuncio(anuncioId?: string) {
  const { user } = useAuth();
  const [isFav, setIsFav] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !anuncioId) { setIsFav(false); return; }
    const { data } = await supabase.from('favoritos_anuncio')
      .select('id').eq('user_id', user.id).eq('anuncio_id', anuncioId).maybeSingle();
    setIsFav(!!data);
  }, [user?.id, anuncioId]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async () => {
    if (!user) { toast.error('Entre para favoritar'); return; }
    if (!anuncioId) return;
    setLoading(true);
    if (isFav) {
      const { error } = await supabase.from('favoritos_anuncio').delete().eq('user_id', user.id).eq('anuncio_id', anuncioId);
      if (error) { toast.error('Não foi possível remover dos favoritos'); setLoading(false); return; }
      setIsFav(false);
    } else {
      const { error } = await supabase.from('favoritos_anuncio').insert({ user_id: user.id, anuncio_id: anuncioId });
      if (error) { toast.error('Não foi possível favoritar'); setLoading(false); return; }
      setIsFav(true);
      toast.success('Salvo nos favoritos ❤');
    }
    setLoading(false);
  };

  return { isFav, loading, toggle };
}
