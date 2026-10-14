// Item 3 — seção do Radar Pessoal (coexiste com "Em Alta" geral, não substitui).
import { Link } from 'react-router-dom';
import { Radar, Loader2, Sparkles, Users, Gamepad2, TrendingUp, RefreshCw } from 'lucide-react';
import { useRadarPessoal } from '@/hooks/useRadarPessoal';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { useState } from 'react';

// GAP-RP04: Opções de ordenação
type SortOption = 'relevance' | 'recent' | 'score';

export default function RadarPessoalSection({ limit = 6 }: { limit?: number }) {
  const { user } = useAuth();
  const { data: items = [], isLoading, refetch } = useRadarPessoal(limit);
  // GAP-RP04: Ordenação
  const [sortBy, setSortBy] = useState<SortOption>('relevance');

  const sortedItems = [...items];
  if (sortBy === 'recent') {
    sortedItems.sort((a, b) => (a.recent_date || 0) - (b.recent_date || 0));
  } else if (sortBy === 'score') {
    sortedItems.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  // GAP-RP02: Recarregar
  const handleRefresh = () => refetch();

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  // GAP-RP03: Empty state
  if (!items.length) {
    return (
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-1">
          <Radar className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-bold text-foreground">Seu radar pessoal</h2>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/50 p-6 text-center">
          <Radar className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {user ? 'Adicione jogos à sua biblioteca e siga pessoas para ver recomendações personalizadas aqui.' : 'Faça login para ver seu radar pessoal.'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Seus gêneros favoritos e amigos influenciam o que aparece aqui.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-bold text-foreground">Seu radar pessoal</h2>
          <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
            {items.length} jogos
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* GAP-RP04: Ordenação */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="text-[10px] bg-secondary border border-border rounded px-1.5 py-0.5"
          >
            <option value="relevance">Relevância</option>
            <option value="recent">Recentes</option>
            <option value="score">Pontuação</option>
          </select>
          {/* GAP-RP02: Refresh */}
          <button
            onClick={handleRefresh}
            className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 transition"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Baseado nos gêneros da sua biblioteca e em quem você segue — diferente do "Em Alta", que é geral.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {sortedItems.map(item => {
          // GAP-RP01: Fonte da recomendação
          const SourceIcon = item.source === 'friends' ? Users : 
                             item.source === 'genres' ? Gamepad2 : 
                             item.source === 'trending' ? TrendingUp : Sparkles;
          
          return (
            <Link key={item.product_id} to={`/jogo/${item.product_id}`} className="group">
              <div className="aspect-[3/4] rounded-lg overflow-hidden bg-muted relative">
                {item.image_url
                  ? <img src={item.image_url} alt={item.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  : <div className="w-full h-full flex items-center justify-center"><Gamepad2 className="h-8 w-8 text-muted-foreground/40" /></div>}
                {/* GAP-RP01: Badge da fonte */}
                <div className="absolute top-1 right-1 bg-overlay/60 rounded-full p-0.5">
                  <SourceIcon className="h-3 w-3 text-primary" />
                </div>
              </div>
              <p className="text-xs font-semibold text-foreground mt-1.5 line-clamp-1">{item.title}</p>
              <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight mt-0.5 flex items-center gap-1">
                <SourceIcon className="h-2.5 w-2.5 text-primary/60" />
                {item.evidence}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}