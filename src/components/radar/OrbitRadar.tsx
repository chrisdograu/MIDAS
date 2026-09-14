import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Satellite, Loader2, Filter, Gamepad2, MessageSquare, ShoppingBag, Sparkles } from 'lucide-react';
import { useRadarDelta } from '@/hooks/useRadarDelta';
import { useAuth } from '@/hooks/useAuth';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  limit?: number;
  compact?: boolean;
}

type SignalType = 'all' | 'reviews' | 'forum' | 'marketplace';

// GAP-OR04: Mapear cor do jogo para glow
const getGameColor = (game: any): string => {
  if (game.theme_color) return game.theme_color;
  if (game.category === 'Ação') return '#EF4444';
  if (game.category === 'RPG') return '#A855F7';
  if (game.category === 'Estratégia') return '#3B82F6';
  if (game.category === 'Esportes') return '#22C55E';
  return '#14B8A6';
};

// GAP-OR03: Fallback para imagem
const ImageWithFallback = ({ src, alt, className }: { src?: string | null; alt: string; className?: string }) => {
  const [error, setError] = useState(false);
  return (
    <div className={cn("relative w-full h-full bg-muted flex items-center justify-center", className)}>
      {src && !error ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" onError={() => setError(true)} />
      ) : (
        <Gamepad2 className="h-8 w-8 text-muted-foreground/40" />
      )}
    </div>
  );
};

export default function OrbitRadar({ limit = 4, compact = false }: Props) {
  const { user } = useAuth();
  const { data, isLoading } = useRadarDelta(limit);
  const items = useMemo(() => (data ?? []).slice(0, limit), [data, limit]);
  const storageKey = `radar-seen-${user?.id ?? 'guest'}`;
  const [seen, setSeen] = useState<Set<string>>(new Set());
  // GAP-OR05: Filtro por tipo
  const [signalFilter, setSignalFilter] = useState<SignalType>('all');

  useEffect(() => {
    try { setSeen(new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'))); } catch { /* noop */ }
  }, [storageKey]);

  const markSeen = (id: string) => {
    setSeen(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  };

  // GAP-OR05: Filtrar por tipo de sinal
  const filteredItems = useMemo(() => {
    if (signalFilter === 'all') return items;
    return items.filter(item => {
      const evidence = item.evidence?.toLowerCase() || '';
      if (signalFilter === 'reviews') return evidence.includes('review') || evidence.includes('avaliação');
      if (signalFilter === 'forum') return evidence.includes('fórum') || evidence.includes('post') || evidence.includes('discussão');
      if (signalFilter === 'marketplace') return evidence.includes('anúncio') || evidence.includes('venda') || evidence.includes('troca');
      return true;
    });
  }, [items, signalFilter]);

  const stamp = useMemo(() => formatTime(Date.now()), [data]);

  // GAP-OR01: Staggered animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // GAP-OR05: Filtros disponíveis
  const filterOptions: { value: SignalType; label: string; icon: any }[] = [
    { value: 'all', label: 'Todos', icon: Sparkles },
    { value: 'reviews', label: 'Reviews', icon: MessageSquare },
    { value: 'forum', label: 'Fórum', icon: MessageSquare },
    { value: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
  ];

  return (
    <section className={compact ? '' : 'container mx-auto px-4 pt-6'}>
      <header className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-display text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
          <Satellite className="h-4 w-4 text-primary" /> Na sua órbita hoje
        </h2>
        <div className="flex items-center gap-2">
          {/* GAP-OR05: Filtros */}
          <div className="flex items-center gap-1">
            <Filter className="h-3 w-3 text-muted-foreground" />
            {filterOptions.map(f => {
              const Icon = f.icon;
              const active = signalFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setSignalFilter(f.value)}
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded transition flex items-center gap-0.5",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {f.label}
                </button>
              );
            })}
          </div>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground">
            🛰️ {stamp}
          </span>
        </div>
      </header>

      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="shrink-0 w-56 h-32 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card/50 p-4 text-sm text-muted-foreground italic">
          {items.length > 0 && signalFilter !== 'all' 
            ? `🛰️ Nenhum sinal do tipo "${signalFilter}" no momento.`
            : '🛰️ Você está em dia. Sem novos sinais nas últimas 72h.'}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-thin -mx-4 px-4 pb-2 snap-x">
          {filteredItems.map((item, index) => {
            const isSeen = seen.has(item.product_id);
            const isNew = !isSeen;
            const gameColor = getGameColor(item);
            
            return (
              <Link
                key={item.product_id}
                to={`/jogo/${item.product_id}`}
                onClick={() => markSeen(item.product_id)}
                className={cn(
                  "shrink-0 w-56 sm:w-64 snap-start rounded-xl overflow-hidden border transition-all bg-card group",
                  "duration-300",
                  isSeen
                    ? 'border-border/40 opacity-80'
                    : 'border-primary/40 hover:border-primary/70 hover:-translate-y-0.5',
                  // GAP-OR01: Staggered animation
                  mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                )}
                style={{ transitionDelay: `${index * 80}ms` }}
              >
                <div className="relative aspect-[16/9] bg-muted">
                  <ImageWithFallback src={item.image_url} alt={item.title} className="w-full h-full" />
                  
                  {/* GAP-OR04: Glow com cor do jogo */}
                  <div 
                    className="absolute inset-0 pointer-events-none opacity-30 group-hover:opacity-50 transition-opacity"
                    style={{
                      background: `radial-gradient(circle at 50% 30%, ${gameColor}44, transparent 70%)`
                    }}
                  />
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  
                  {/* GAP-OR02: Badge "Novo" */}
                  {isNew && (
                    <span className="absolute top-2 left-2 text-[8px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full animate-pulse">
                      NOVO
                    </span>
                  )}
                  
                  <span
                    className={cn(
                      "absolute top-2 right-2 h-3 w-3 rounded-full border transition-all",
                      isSeen
                        ? 'border-muted-foreground/60 bg-transparent'
                        : 'border-primary bg-primary shadow-[0_0_10px_hsl(var(--primary))]'
                    )}
                    aria-label={isSeen ? 'já visualizado' : 'sinal novo'}
                  />
                  
                  <div className="absolute bottom-2 left-2 right-2">
                    <h3 className="text-sm font-bold text-primary-foreground line-clamp-1">{item.title}</h3>
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    <span className="text-primary font-semibold">▲ {item.score}</span> · {item.evidence}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}