import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useProdutos } from "@/hooks/useProdutos";
import GameCard from "@/components/GameCard";
import { motion } from "framer-motion";
import { ChevronRight, Flame, TrendingUp, Zap, Sparkles, Clock, Package, PackageSearch, RefreshCw, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import OrbitRadar from "@/components/radar/OrbitRadar";
import RadarPessoalSection from "@/components/radar/RadarPessoalSection";
import { GameCardGridSkeleton } from "@/components/skeletons";
import OnboardingDialog from "@/components/onboarding/OnboardingDialog";
import EstadoVazio from "@/components/EstadoVazio";
import ErroCarregamento from "@/components/ErroCarregamento";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import { formatCurrency } from '@/lib/format';

interface FlashPromo {
  id: string;
  product_id: string;
  discount_percent: number;
  ends_at: string;
}
interface BundleRow {
  id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
}
interface BundleItemRow {
  bundle_id: string;
  product_id: string;
}

// GAP-101: Componente de timestamp
function LastUpdated({ time }: { time: Date }) {
  return (
    <div className="container mx-auto px-4 py-4">
      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
        <RefreshCw className="h-3 w-3" />
        Última atualização: {time.toLocaleString('pt-BR')}
      </p>
    </div>
  );
}

export default function Index() {
  const { data: games = [], isLoading, isError, refetch, isRefetching } = useProdutos();
  const inStock = useMemo(() => games.filter((g) => g.stock > 0), [games]);
  
  // GAP-103, GAP-513: Lançamentos recentes (ordenados por data de lançamento)
  const recentReleases = useMemo(() => {
    return [...inStock]
      .filter((g) => g.releaseDate)
      .sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime())
      .slice(0, 6);
  }, [inStock]);

  const featured = useMemo(() => {
    const curated = inStock.filter((g) => g.featured);
    return (curated.length > 0 ? curated : inStock).slice(0, 3);
  }, [inStock]);
  const bestDeals = useMemo(() => [...inStock].sort((a, b) => b.discount - a.discount).slice(0, 6), [inStock]);
  const topRated = useMemo(() => [...inStock].sort((a, b) => b.rating - a.rating).slice(0, 6), [inStock]);

  // Daily Pick
  const fallbackPick = useMemo(() => {
    if (inStock.length === 0) return null;
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    return inStock[dayOfYear % inStock.length];
  }, [inStock]);
  const [pickOverride, setPickOverride] = useState<{ product_id: string; reason: string | null } | null>(null);
  const dailyPick = useMemo(() => {
    if (pickOverride) return inStock.find((g) => g.id === pickOverride.product_id) ?? fallbackPick;
    return fallbackPick;
  }, [pickOverride, inStock, fallbackPick]);
  const pickReason = pickOverride?.reason ?? null;

  const [now, setNow] = useState(Date.now());

  // Side data
  const sideData = useQuery({
    queryKey: ["home-side-data"],
    staleTime: 60_000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: fp }, { data: po }, { data: bd }, { data: bi }] = await Promise.all([
        supabase
          .from("flash_promotions")
          .select("id, product_id, discount_percent, ends_at")
          .eq("is_active", true)
          .gt("ends_at", new Date().toISOString())
          .order("ends_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("daily_pick_overrides" as any)
          .select("product_id, reason")
          .eq("pick_date", today)
          .maybeSingle(),
        supabase
          .from("bundles" as any)
          .select("id, title, description, price, image_url")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase.from("bundle_items" as any).select("bundle_id, product_id"),
      ]);
      return { fp: fp as FlashPromo | null, po: po as any, bd: (bd as unknown as BundleRow[]) || [], bi: (bi as unknown as BundleItemRow[]) || [] };
    },
  });

  useEffect(() => {
    if (!sideData.data) return;
    setPickOverride(sideData.data.po ?? null);
  }, [sideData.data]);

  useEffect(() => {
    const fp = sideData.data?.fp;
    if (!fp) return;
    const endsAt = new Date(fp.ends_at).getTime();
    if (endsAt <= Date.now()) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [sideData.data?.fp]);

  const flashPromo = useMemo(() => {
    const fp = sideData.data?.fp;
    if (!fp) return null;
    const product = inStock.find((g) => g.id === fp.product_id);
    return product ? { promo: fp, product } : null;
  }, [sideData.data?.fp, inStock]);

  const bundles = useMemo(() => {
    if (!sideData.data) return [];
    const itemsByBundle = new Map<string, string[]>();
    sideData.data.bi.forEach((i) => {
      const arr = itemsByBundle.get(i.bundle_id) || [];
      arr.push(i.product_id);
      itemsByBundle.set(i.bundle_id, arr);
    });
    return sideData.data.bd
      .map((b) => ({
        bundle: b,
        products: (itemsByBundle.get(b.id) || [])
          .map((pid) => inStock.find((g) => g.id === pid))
          .filter(Boolean) as typeof games,
      }))
      .filter((b) => b.products.length >= 2);
  }, [sideData.data, inStock, games]);

  // GAP-100: Estado de erro com retry
  if (isError) {
    return (
      <div className="container mx-auto px-4 py-16">
        <ErroCarregamento
          titulo="Não foi possível carregar a página inicial"
          descricao="Verifique sua conexão e tente novamente."
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <GameCardGridSkeleton count={12} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <OnboardingDialog />
      
      {/* Hero */}
      <section className="relative overflow-hidden bg-background">
        <div className="container mx-auto px-4 py-16 md:py-24 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="font-display text-4xl md:text-6xl font-bold mb-4">
              <span className="gradient-text">MIDIAS</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              Jogos digitais com os melhores preços. Entrega instantânea de chaves.
            </p>
          </motion.div>
        </div>
      </section>
      
      {/* Radar de Órbita */}
      <OrbitRadar limit={4} />
      
      {/* Radar Pessoal */}
      <div className="container mx-auto px-4 pt-8">
        <RadarPessoalSection limit={6} />
      </div>
      
      {/* Flash Promo */}
      {flashPromo &&
        (() => {
          const remainingMs = new Date(flashPromo.promo.ends_at).getTime() - now;
          if (remainingMs <= 0) return null;
          const h = Math.floor(remainingMs / 3600000);
          const m = Math.floor((remainingMs % 3600000) / 60000);
          const s = Math.floor((remainingMs % 60000) / 1000);
          const promoPrice = flashPromo.product.price * (1 - flashPromo.promo.discount_percent / 100);
          return (
            <section className="container mx-auto px-4 pt-8">
              <Link to={`/jogo/${flashPromo.product.id}`} className="block group">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative overflow-hidden rounded-2xl border border-price/30 bg-gradient-to-r from-price/15 via-background to-accent/10"
                >
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 sm:gap-6 p-4 sm:p-5">
                    <img
                      src={flashPromo.product.image}
                      alt={flashPromo.product.title}
                      className="w-20 h-28 sm:w-24 sm:h-32 object-cover rounded-lg shadow-lg"
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="inline-flex items-center gap-1 bg-price text-price-foreground rounded px-2 py-0.5 text-[11px] font-bold tracking-wide">
                          <Zap className="h-3 w-3" /> RELÂMPAGO
                        </span>
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                          −{flashPromo.promo.discount_percent}%
                        </span>
                      </div>
                      <h3 className="font-bold text-base sm:text-lg text-foreground truncate group-hover:text-primary transition-colors">
                        {flashPromo.product.title}
                      </h3>
                      <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                        <span className="text-muted-foreground text-sm line-through">
                          {formatCurrency(flashPromo.product.price)}
                        </span>
                        <span className="text-price font-bold text-xl">{formatCurrency(promoPrice)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] uppercase text-muted-foreground tracking-wider hidden sm:block">
                        Termina em
                      </span>
                      <div className="flex items-center gap-1.5 text-price">
                        <Clock className="h-4 w-4" />
                        <span className="font-mono font-bold text-base sm:text-lg tabular-nums">
                          {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Link>
            </section>
          );
        })()}
      
      {/* Daily Pick */}
      {dailyPick && (
        <section className="container mx-auto px-4 pt-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-accent" />
            <h2 className="text-xl font-bold text-foreground">Escolha do Dia</h2>
          </div>
          <Link
            to={`/jogo/${dailyPick.id}`}
            className="group grid grid-cols-1 md:grid-cols-[1.4fr_1fr] rounded-2xl overflow-hidden border border-border bg-card hover:border-accent/50 transition-colors"
          >
            <div className="relative aspect-[16/9] md:aspect-auto overflow-hidden">
              <img
                src={dailyPick.image}
                alt={dailyPick.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <span className="absolute top-3 left-3 inline-block bg-accent text-accent-foreground text-[11px] font-bold px-2 py-1 rounded tracking-wide">
                PICK DO DIA
              </span>
            </div>
            <div className="p-5 md:p-6 flex flex-col justify-center gap-3">
              <h3 className="text-xl md:text-2xl font-bold text-foreground leading-tight">{dailyPick.title}</h3>
              {pickReason ? (
                <p className="text-sm text-accent/90 italic border-l-2 border-accent/60 pl-3">"{pickReason}"</p>
              ) : (
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Recomendado pela equipe</p>
              )}
              {dailyPick.description && (
                <p className="text-sm text-muted-foreground line-clamp-3">{dailyPick.description}</p>
              )}
              <div className="flex items-center gap-3 mt-1">
                {dailyPick.discount > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded">
                    -{dailyPick.discount}%
                  </span>
                )}
                <span className="text-price font-bold text-xl">{formatCurrency(dailyPick.price)}</span>
              </div>
            </div>
          </Link>
        </section>
      )}
      
      {/* Catálogo vazio */}
      {inStock.length === 0 && (
        <div className="container mx-auto px-4 py-12">
          <EstadoVazio
            icone={PackageSearch}
            titulo="Nenhum jogo disponível no momento"
            descricao="Volte em breve — estamos preparando novidades para você."
            acao={{ label: 'Ver catálogo', to: '/catalogo' }}
          />
        </div>
      )}
      
      {/* Bundles */}
      {bundles.length > 0 && (
        <section className="container mx-auto px-4 pt-12">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Pacotes & Bundles</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bundles.map(({ bundle, products }) => {
              const fullPrice = products.reduce((s, p) => s + p.price, 0);
              const savings = Math.max(0, fullPrice - bundle.price);
              const pct = fullPrice > 0 ? Math.round((savings / fullPrice) * 100) : 0;
              return (
                <Link
                  key={bundle.id}
                  to={`/bundle/${bundle.id}`}
                  className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
                >
                  <div className="relative aspect-[16/9] grid grid-cols-3 bg-secondary/30">
                    {products.slice(0, 3).map((p) => (
                      <img key={p.id} src={p.image} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                    ))}
                    {pct > 0 && (
                      <span className="absolute top-2 right-2 bg-price text-price-foreground text-xs font-bold px-2 py-0.5 rounded">
                        −{pct}%
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-1">
                    <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {bundle.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">{products.length} jogos incluídos</p>
                    <div className="flex items-baseline gap-2 pt-1">
                      {savings > 0 && (
                        <span className="text-xs text-muted-foreground line-through">{formatCurrency(fullPrice)}</span>
                      )}
                      <span className="text-price font-bold text-lg">{formatCurrency(Number(bundle.price))}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
      
      {/* Destaques */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-6">
          <Flame className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Destaques</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {featured.map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link to={`/jogo/${game.id}`} className="group block relative rounded-xl overflow-hidden aspect-[16/9]">
                <img
                  src={game.image}
                  alt={game.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-lg font-bold text-on-media mb-1">{game.title}</h3>
                  <div className="flex items-center gap-2">
                    {game.discount > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded">
                        -{game.discount}%
                      </span>
                    )}
                    <span className="text-price font-bold">{formatCurrency(game.price)}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* GAP-103, GAP-513: Lançamentos Recentes */}
      {recentReleases.length > 0 && (
        <section className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent" />
              <h2 className="text-xl font-bold text-foreground">Lançamentos Recentes</h2>
            </div>
            <Link to="/catalogo" className="text-sm text-primary hover:underline flex items-center gap-1">
              Ver todos <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recentReleases.map((game, i) => (
              <GameCard key={game.id} game={game} index={i} />
            ))}
          </div>
        </section>
      )}
      
      {/* Best Deals */}
      <section className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-price" />
            <h2 className="text-xl font-bold text-foreground">Melhores Ofertas</h2>
          </div>
          <Link to="/ofertas" className="text-sm text-primary hover:underline flex items-center gap-1">
            Ver todas <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {bestDeals.map((game, i) => (
            <GameCard key={game.id} game={game} index={i} />
          ))}
        </div>
      </section>
      
      {/* Top Rated */}
      <section className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-success" />
            <h2 className="text-xl font-bold text-foreground">Mais Bem Avaliados</h2>
          </div>
          <Link to="/catalogo" className="text-sm text-primary hover:underline flex items-center gap-1">
            Ver todos <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {topRated.map((game, i) => (
            <GameCard key={game.id} game={game} index={i} />
          ))}
        </div>
      </section>

      {/* GAP-101: Última atualização */}
      <LastUpdated time={new Date()} />
      
      <ScrollToTopButton />
    </div>
  );
}