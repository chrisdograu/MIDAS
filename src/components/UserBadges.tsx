import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Star, Diamond, Shield, Share2, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface BadgeRow {
  badge_id: string;
  awarded_at: string;
  badge_catalog: { 
    name: string; 
    description: string; 
    icon: string; 
    category: string;
    rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  } | null;
}

// GAP-UB03: Configurações por raridade
const rarityConfigs: Record<string, { color: string; bg: string; label: string; icon: typeof Trophy }> = {
  common: { 
    color: 'text-gray-400', 
    bg: 'bg-gray-400/10', 
    label: 'Comum',
    icon: Star,
  },
  uncommon: { 
    color: 'text-green-400', 
    bg: 'bg-green-400/10', 
    label: 'Incomum',
    icon: Star,
  },
  rare: { 
    color: 'text-blue-400', 
    bg: 'bg-blue-400/10', 
    label: 'Raro',
    icon: Diamond,
  },
  epic: { 
    color: 'text-purple-400', 
    bg: 'bg-purple-400/10', 
    label: 'Épico',
    icon: Shield,
  },
  legendary: { 
    color: 'text-yellow-400', 
    bg: 'bg-yellow-400/10', 
    label: 'Lendário',
    icon: Trophy,
  },
};

// GAP-UB02: Categorias
const categoryLabels: Record<string, string> = {
  achievement: '🏆 Conquistas',
  tournament: '🏅 Torneios',
  special: '⭐ Especiais',
  seasonal: '🎄 Sazonais',
  community: '👥 Comunidade',
};

interface Props {
  userId: string | null | undefined;
  max?: number;
  className?: string;
  /** GAP-UB02: Filtrar por categoria */
  category?: string;
  /** GAP-UB01: Permitir expandir */
  expandable?: boolean;
  /** GAP-UB04: Habilitar compartilhamento */
  enableShare?: boolean;
}

// GAP-UB01: Modal de detalhes do badge
function BadgeDetailModal({ 
  badge, 
  onClose 
}: { 
  badge: BadgeRow; 
  onClose: () => void;
}) {
  const catalog = badge.badge_catalog;
  if (!catalog) return null;

  const rarity = catalog.rarity || 'common';
  const rarityConfig = rarityConfigs[rarity] || rarityConfigs.common;

  // GAP-UB04: Compartilhar
  const handleShare = async () => {
    const text = `🎖️ Acabei de conquistar "${catalog.name}" na MIDIAS!\n${catalog.description}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Badge MIDIAS', text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Texto copiado!');
      }
    } catch {
      // Usuário cancelou
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <div className="text-center py-4">
          <div className={cn(
            "w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl",
            rarityConfig.bg
          )}>
            <span>{catalog.icon || '🏆'}</span>
          </div>
          
          <h3 className="text-lg font-bold mt-3">{catalog.name}</h3>
          <p className="text-sm text-muted-foreground mt-1">{catalog.description}</p>
          
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", rarityConfig.bg, rarityConfig.color)}>
              {rarityConfig.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {categoryLabels[catalog.category] || catalog.category}
            </span>
          </div>
          
          <p className="text-xs text-muted-foreground mt-3">
            Conquistado em {new Date(badge.awarded_at).toLocaleDateString()}
          </p>
          
          <div className="flex gap-2 mt-4">
            {navigator.share && (
              <button
                onClick={handleShare}
                className="flex-1 py-2 rounded-lg bg-secondary text-sm font-semibold flex items-center justify-center gap-2 hover:bg-secondary/70 transition-colors"
              >
                <Share2 className="h-4 w-4" /> Compartilhar
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Fechar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function UserBadges({ 
  userId, 
  max = 12, 
  className,
  category,
  expandable = true,
  enableShare = true,
}: Props) {
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<BadgeRow | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(category || null);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    (async () => {
      let query = supabase
        .from('user_badges' as any)
        .select('badge_id, awarded_at, badge_catalog(name, description, icon, category, rarity)')
        .eq('user_id', userId)
        .order('awarded_at', { ascending: false });

      if (filterCategory) {
        query = query.eq('badge_catalog.category', filterCategory);
      }

      const { data } = await query.limit(max || 100);
      if (mounted) setBadges((data as any) || []);
    })();
    return () => { mounted = false; };
  }, [userId, max, filterCategory]);

  // GAP-UB02: Categorias disponíveis
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    badges.forEach(b => {
      if (b.badge_catalog?.category) {
        cats.add(b.badge_catalog.category);
      }
    });
    return Array.from(cats);
  }, [badges]);

  if (!badges.length) return null;

  // GAP-UB03: Ordenar por raridade
  const sortedBadges = useMemo(() => {
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
    return [...badges].sort((a, b) => {
      const rarityA = a.badge_catalog?.rarity || 'common';
      const rarityB = b.badge_catalog?.rarity || 'common';
      return (rarityOrder[rarityA as keyof typeof rarityOrder] || 0) - 
             (rarityOrder[rarityB as keyof typeof rarityOrder] || 0);
    });
  }, [badges]);

  return (
    <>
      <div className={cn('space-y-2', className)}>
        {/* GAP-UB02: Filtro por categoria */}
        {availableCategories.length > 1 && !category && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setFilterCategory(null)}
              className={cn(
                "text-xs px-2 py-0.5 rounded-full transition-colors whitespace-nowrap",
                !filterCategory 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              )}
            >
              Todos
            </button>
            {availableCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full transition-colors whitespace-nowrap",
                  filterCategory === cat 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                )}
              >
                {categoryLabels[cat] || cat}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {sortedBadges.slice(0, max).map(b => {
            const catalog = b.badge_catalog;
            if (!catalog) return null;
            
            const rarity = catalog.rarity || 'common';
            const rarityConfig = rarityConfigs[rarity] || rarityConfigs.common;

            return (
              <motion.button
                key={b.badge_id}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedBadge(b)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                  rarityConfig.bg,
                  rarityConfig.color,
                  "border-transparent hover:border-current"
                )}
                title={`${catalog.name} (${rarityConfig.label})`}
              >
                <span>{catalog.icon || '🏆'}</span>
                <span className="font-medium">{catalog.name}</span>
                {/* GAP-UB03: Indicador de raridade */}
                <span className="text-[8px] opacity-60">{rarityConfig.label.charAt(0)}</span>
              </motion.button>
            );
          })}
        </div>

        {/* GAP-UB03: Legenda de raridades */}
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
          {Object.entries(rarityConfigs).map(([key, config]) => (
            <span key={key} className="flex items-center gap-0.5 text-[8px] text-muted-foreground">
              <span className={cn("w-1.5 h-1.5 rounded-full", config.bg)} />
              <span className={cn("font-medium", config.color)}>
                {config.label.charAt(0)}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* GAP-UB01: Modal de detalhes */}
      {selectedBadge && expandable && (
        <BadgeDetailModal 
          badge={selectedBadge} 
          onClose={() => setSelectedBadge(null)} 
        />
      )}
    </>
  );
}