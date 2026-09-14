import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, ShieldCheck, ArrowLeftRight, SortAsc, SortDesc } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import BuscaInput from '@/components/BuscaInput';
import { Skeleton } from '@/components/ui/skeleton';

import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { timeAgo } from '@/mobile/lib/time';
import DataSaverImage from '@/components/DataSaverImage';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';
import SelectSimples from '@/components/SelectSimples';

interface FavAd {
  id: string; title: string; price: number; ad_type: string; certificate_type: string;
  created_at: string; image: string | null; seller_name: string;
}

// GAP-1032: Opções de ordenação
type SortOption = 'recent' | 'price_asc' | 'price_desc';

export default function MFavoritos() {
  const { user } = useAuth();
  const [ads, setAds] = useState<FavAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  // GAP-1032: Estado de ordenação
  const [sort, setSort] = useState<SortOption>('recent');

  const load = async () => {
    if (!user) { setAds([]); setLoading(false); return; }
    setLoading(true);
    const { data: favs } = await supabase
      .from('favoritos_anuncio').select('anuncio_id').eq('user_id', user.id);
    const ids = (favs || []).map(f => f.anuncio_id);
    if (!ids.length) { setAds([]); setLoading(false); return; }
    const { data: list } = await supabase
      .from('anuncios').select('*').in('id', ids).eq('status', 'active');
    const sellerIds = [...new Set((list || []).map(a => a.seller_id))];
    const [{ data: photos }, { data: profiles }] = await Promise.all([
      supabase.from('fotos_anuncio').select('anuncio_id, image_url, position').in('anuncio_id', ids).order('position'),
      sellerIds.length ? supabase.from('profiles').select('id, display_name').in('id', sellerIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const photo = new Map<string, string>();
    photos?.forEach(p => { if (!photo.has(p.anuncio_id)) photo.set(p.anuncio_id, p.image_url); });
    const seller = new Map((profiles || []).map(p => [p.id, p.display_name || 'Vendedor']));
    setAds((list || []).map(a => ({
      id: a.id, title: a.title, price: Number(a.price), ad_type: a.ad_type,
      certificate_type: a.certificate_type, created_at: a.created_at,
      image: photo.get(a.id) || null, seller_name: seller.get(a.seller_id) || 'Vendedor',
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const remove = async (anuncioId: string) => {
    if (!user) return;
    const { error } = await supabase.from('favoritos_anuncio').delete().eq('user_id', user.id).eq('anuncio_id', anuncioId);
    if (error) {
      toast.error(`Não foi possível remover o favorito: ${error.message}`);
      return;
    }
    setAds(prev => prev.filter(a => a.id !== anuncioId));
  };

  // GAP-1032: Ordenar
  const sortedAds = [...ads].sort((a, b) => {
    switch (sort) {
      case 'price_asc': return a.price - b.price;
      case 'price_desc': return b.price - a.price;
      default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const termo = busca.trim().toLowerCase();
  const visiveis = termo
    ? sortedAds.filter(a => a.title.toLowerCase().includes(termo) || a.seller_name.toLowerCase().includes(termo))
    : sortedAds;

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold gradient-text flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary fill-primary" /> Favoritos
        </h1>
        <span className="text-xs text-muted-foreground">{ads.length} anúncio{ads.length === 1 ? '' : 's'}</span>
      </div>

      {ads.length > 0 && (
        <div className="flex gap-2">
          <BuscaInput value={busca} onChange={setBusca} placeholder="Buscar por jogo ou vendedor" className="flex-1" />
          {/* GAP-1032: Seletor de ordenação */}
          <SelectSimples
            value={sort}
            onChange={(v) => setSort(v as SortOption)}
            label="Ordenar"
            size="sm"
            className="w-32"
            options={[
              { value: 'recent', label: 'Mais recentes' },
              { value: 'price_asc', label: 'Menor preço' },
              { value: 'price_desc', label: 'Maior preço' },
            ]}
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass rounded-xl overflow-hidden">
              <Skeleton className="aspect-[3/4] w-full rounded-none" />
              <div className="p-2.5 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : ads.length === 0 ? (
        <EstadoVazio
          icone={Heart}
          titulo="Nenhum anúncio salvo ainda"
          descricao="Toque no coração de um anúncio para guardá-lo aqui."
          acao={{ label: 'Explorar marketplace', to: '/m/marketplace' }}
        />
      ) : visiveis.length === 0 ? (
        <EstadoVazio
          icone={Heart}
          titulo="Nenhum favorito com esse termo"
          descricao="Tente outro nome de jogo ou vendedor."
          acao={{ label: 'Limpar busca', onClick: () => setBusca('') }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visiveis.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
              <div className="relative glass rounded-xl overflow-hidden">
                <Link to={`/m/marketplace/${a.id}`}>
                  <div className="aspect-[3/4] bg-muted relative overflow-hidden">
                    {a.image
                      ? <DataSaverImage src={a.image} alt={a.title} saverWidth={320} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="h-8 w-8 text-muted-foreground" /></div>}
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                    <div className="absolute top-1.5 left-1.5 right-1.5 flex flex-wrap gap-1">
                      {a.certificate_type !== 'sem_certificado' && (
                        <span className="backdrop-blur-md bg-success/80 text-on-media text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><ShieldCheck className="h-2.5 w-2.5" />Protegido</span>
                      )}
                      {a.ad_type === 'troca' && (
                        <span className="backdrop-blur-md bg-accent/80 text-on-media text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><ArrowLeftRight className="h-2.5 w-2.5" />Troca</span>
                      )}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight min-h-[2rem]">{a.title}</p>
                    <p className="text-base font-bold text-price mt-1">{a.ad_type === 'troca' ? 'Troca' : `${formatCurrency(a.price)}`}</p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{a.seller_name} · {timeAgo(a.created_at)}</p>
                  </div>
                </Link>
                <button onClick={() => remove(a.id)} type="button"
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full overlay-scrim backdrop-blur-md flex items-center justify-center hover:bg-destructive/80 transition-colors"
                  aria-label="Remover dos favoritos">
                  <Heart className="h-3.5 w-3.5 text-on-media fill-on-media" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}