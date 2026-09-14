import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Star, MessageSquare, Camera, Gamepad2, Plus, Pencil, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

type Item = {
  id: string;
  type: 'game' | 'review' | 'review_completa' | 'screenshot' | 'opinion';
  ref_id: string;
  label?: string;
  image?: string | null;
  href?: string;
};

const ICON: Record<string, any> = {
  game: Gamepad2,
  review: Star,
  review_completa: Star,
  opinion: MessageSquare,
  screenshot: Camera,
};

// GAP-HS03: Ícones e cores por tipo
const TYPE_STYLE: Record<string, { icon: any; color: string; bg: string }> = {
  game: { icon: Gamepad2, color: 'text-primary', bg: 'bg-primary/10' },
  review: { icon: Star, color: 'text-warning', bg: 'bg-warning/10' },
  review_completa: { icon: Star, color: 'text-accent', bg: 'bg-accent/10' },
  opinion: { icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  screenshot: { icon: Camera, color: 'text-purple-400', bg: 'bg-purple-400/10' },
};

// GAP-HS01: Estado vazio
const EmptyState = ({ userId, isOwn }: { userId: string; isOwn: boolean }) => (
  <div className="flex flex-col items-center justify-center py-6 border border-dashed border-border rounded-xl bg-card/30">
    <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-2" />
    <p className="text-sm text-muted-foreground">Nenhum destaque ainda</p>
    {isOwn && (
      <Link
        to="/perfil/config?tab=customizacao"
        className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
      >
        <Plus className="h-3 w-3" /> Adicionar destaques
      </Link>
    )}
  </div>
);

interface Props {
  userId: string;
  limit?: number;
  /** GAP-HS04: Mostrar botão de editar */
  showEdit?: boolean;
  className?: string;
}

export default function HighlightsStrip({ userId, limit = 6, showEdit = false, className = '' }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const isOwn = user?.id === userId;

  // GAP-HS02: Animação de entrada
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('profile_highlights')
        .select('id, type, ref_id, position')
        .eq('user_id', userId)
        .order('position', { ascending: true })
        .limit(limit);
      const rows = ((data as any[]) || []) as Item[];

      const gameIds = rows.filter(r => r.type === 'game').map(r => r.ref_id);
      if (gameIds.length) {
        const { data: prods } = await supabase.from('produtos').select('id, title, image').in('id', gameIds);
        const m = new Map((prods || []).map((p: any) => [p.id, p]));
        rows.forEach(r => {
          if (r.type === 'game') {
            const p: any = m.get(r.ref_id);
            r.label = p?.title || 'Jogo';
            r.image = p?.image || null;
            r.href = `/jogo/${r.ref_id}`;
          }
        });
      }
      rows.forEach(r => {
        if (!r.href) r.href = `/perfil/${userId}`;
        if (!r.label) r.label = r.type.replace('_', ' ');
      });
      if (!cancel) { setItems(rows); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [userId, limit]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="h-5 w-24 bg-muted/50 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    // GAP-HS01: Estado vazio
    return (
      <div className={cn("bg-card border border-border rounded-xl p-4 mb-6", className)}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Destaques
          </h2>
          {isOwn && showEdit && (
            <Link to="/perfil/config?tab=customizacao" className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5">
              <Pencil className="h-3 w-3" /> editar
            </Link>
          )}
        </div>
        <EmptyState userId={userId} isOwn={isOwn} />
      </div>
    );
  }

  return (
    <div className={cn("bg-card border border-border rounded-xl p-4 mb-6", className)}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Destaques
          <span className="text-[10px] font-normal text-muted-foreground">({items.length})</span>
        </h2>
        {/* GAP-HS04: Botão de editar */}
        {isOwn && showEdit && (
          <Link
            to="/perfil/config?tab=customizacao"
            className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 transition"
          >
            <Pencil className="h-3 w-3" /> editar
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {items.map((it, index) => {
          const style = TYPE_STYLE[it.type] || TYPE_STYLE.game;
          const Icon = style.icon;

          return (
            <Link
              key={it.id}
              to={it.href!}
              className={cn(
                "group flex flex-col items-center text-center transition-all duration-300",
                // GAP-HS02: Staggered animation
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              )}
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              {it.image ? (
                <div className="relative w-full aspect-[3/4] overflow-hidden rounded-lg">
                  <img
                    src={it.image}
                    alt={it.label}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 group-hover:ring-2 ring-primary"
                    loading="lazy"
                  />
                  {/* GAP-HS03: Ícone de tipo sobreposto */}
                  <div className={cn(
                    "absolute bottom-1 right-1 p-1 rounded-full",
                    style.bg
                  )}>
                    <Icon className={cn("h-3 w-3", style.color)} />
                  </div>
                </div>
              ) : (
                <div className={cn(
                  "w-full aspect-[3/4] rounded-lg flex items-center justify-center transition-all duration-300",
                  "group-hover:ring-2 ring-primary",
                  style.bg
                )}>
                  <Icon className={cn("h-6 w-6", style.color)} />
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1 group-hover:text-foreground transition">
                {it.label}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}