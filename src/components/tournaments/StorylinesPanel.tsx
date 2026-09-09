import { motion } from 'framer-motion';
import { Swords, Crown, Zap, TrendingUp, History, Heart, Flame, Shield, Target, Users, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Storyline { 
  id: string; 
  kind: string; 
  narrative: string; 
  created_at: string;
  /** GAP-ST04: Contagem de curtidas */
  likes?: number;
  /** GAP-ST04: Usuário já curtiu */
  liked_by_me?: boolean;
}

// GAP-ST03: Expandir tipos de narrativa
const ICONS: Record<string, any> = {
  rivalry: Swords, 
  revenge: History, 
  underdog: TrendingUp, 
  streak: Zap, 
  record: Crown,
  upset: Shield,
  comeback: Flame,
  domination: Target,
  teamwork: Users,
  legendary: Sparkles,
};

const COLORS: Record<string, string> = {
  rivalry: 'from-destructive/20 to-destructive/10 border-destructive/30 text-destructive',
  revenge: 'from-accent/20 to-accent/10 border-accent/30 text-accent',
  underdog: 'from-success/20 to-success/10 border-success/30 text-success',
  streak: 'from-warning/20 to-warning/10 border-warning/30 text-warning',
  record: 'from-warning/20 to-warning/10 border-warning/30 text-warning',
  upset: 'from-purple-500/20 to-purple-500/10 border-purple-500/30 text-purple-500',
  comeback: 'from-orange-500/20 to-orange-500/10 border-orange-500/30 text-orange-500',
  domination: 'from-blue-500/20 to-blue-500/10 border-blue-500/30 text-blue-500',
  teamwork: 'from-green-500/20 to-green-500/10 border-green-500/30 text-green-500',
  legendary: 'from-yellow-500/20 to-yellow-500/10 border-yellow-500/30 text-yellow-500',
};

// GAP-ST02: Verificar se é recente (últimas 24h)
const isRecent = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  return diff < 24 * 60 * 60 * 1000;
};

interface Props {
  items: Storyline[];
  /** GAP-ST04: Callback para like */
  onLike?: (id: string) => Promise<void>;
  /** GAP-ST01: Desabilitar animação */
  disableAnimation?: boolean;
}

export default function StorylinesPanel({ items, onLike, disableAnimation = false }: Props) {
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());

  if (!items.length) return null;

  const handleLike = async (id: string) => {
    if (likedItems.has(id)) {
      toast.info('Você já curtiu esta narrativa');
      return;
    }
    if (onLike) {
      await onLike(id);
      setLikedItems(prev => new Set(prev).add(id));
    } else {
      // Fallback: like local
      setLikedItems(prev => new Set(prev).add(id));
      toast.success('Narrativa curtida!');
    }
  };

  // GAP-ST01: Variantes de animação
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Narrativas do evento
        </h2>
        <span className="text-[10px] text-muted-foreground">{items.length} histórias</span>
      </div>
      
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
        initial="hidden"
        animate="visible"
        variants={disableAnimation ? undefined : containerVariants}
      >
        {items.map((s, i) => {
          const Icon = ICONS[s.kind] || Swords;
          const col = COLORS[s.kind] || COLORS.rivalry;
          const recent = isRecent(s.created_at);
          const isLiked = likedItems.has(s.id) || s.liked_by_me;
          const likesCount = (s.likes || 0) + (isLiked && !s.liked_by_me ? 1 : 0);
          
          return (
            <motion.div
              key={s.id}
              variants={disableAnimation ? undefined : itemVariants}
              className={`relative bg-gradient-to-br ${col} border rounded-xl p-4 backdrop-blur-sm overflow-hidden group transition-all hover:scale-[1.01]`}
            >
              {/* GAP-ST02: Badge "Novo" */}
              {recent && (
                <span className="absolute top-2 right-2 text-[8px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full animate-pulse">
                  NOVO
                </span>
              )}
              
              <Icon className="absolute -right-4 -top-4 h-20 w-20 opacity-10" />
              
              <div className="flex items-start gap-3 relative">
                <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm leading-relaxed">{s.narrative}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    
                    {/* GAP-ST04: Botão de like */}
                    <button
                      onClick={() => handleLike(s.id)}
                      className={cn(
                        "flex items-center gap-1 text-[10px] transition-colors",
                        isLiked ? "text-primary" : "text-muted-foreground hover:text-primary"
                      )}
                      disabled={isLiked}
                    >
                      <Heart className={cn("h-3.5 w-3.5", isLiked && "fill-current")} />
                      {likesCount > 0 && <span>{likesCount}</span>}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}