import { useState, ReactNode, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle, Eye, Trophy, ShieldAlert, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  /** Spoiler manual: qualquer leitor precisa clicar para revelar. */
  isSpoiler?: boolean;
  /** Spoiler vinculado a uma conquista (por nome). Quem possuir vê direto com badge. */
  achievementName?: string | null;
  /** Produto da conquista — usado para casar com user_achievements. */
  productId?: string | null;
  /** GAP-SG03: Compat antigo (UUID) — suportar ambos. */
  achievementLockId?: string | null;
  children: ReactNode;
  className?: string;
  /** GAP-SG01: Desabilitar animação */
  disableAnimation?: boolean;
}

/**
 * Fase 1 — Filtro de spoilers do fórum/reviews.
 * Três comportamentos:
 *  1. Spoiler manual (isSpoiler): blur + overlay âmbar "Toque para revelar".
 *  2. Spoiler de conquista (achievementName) e viewer NÃO possui:
 *     blur intenso + overlay vermelho com nome da conquista e CTA reforçado.
 *  3. Spoiler de conquista e viewer possui: conteúdo aberto, com badge dourado
 *     "🏆 Liberado por <conquista>" — nenhum bloqueio.
 */
export default function SpoilerGuard({
  isSpoiler,
  achievementName,
  productId,
  achievementLockId,
  children,
  className = '',
  disableAnimation = false,
}: Props) {
  const { user } = useAuth();
  const [revealed, setRevealed] = useState(false);
  // GAP-SG04: Já revelado antes
  const [wasRevealed, setWasRevealed] = useState(false);

  // GAP-SG03: Suporte a ambos os formatos de achievement
  const effectiveAchievementName = achievementName || null;
  const effectiveAchievementId = achievementLockId || null;

  const hasAchByName = useQuery({
    queryKey: ['ach-by-name', user?.id, productId, effectiveAchievementName],
    queryFn: async () => {
      if (!user || !effectiveAchievementName || !productId) return false;
      const { data } = await supabase
        .from('user_achievements')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .eq('achievement_name', effectiveAchievementName)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!effectiveAchievementName && !!productId,
    staleTime: 60_000,
  });

  const hasAchById = useQuery({
    queryKey: ['ach-by-id', user?.id, effectiveAchievementId],
    queryFn: async () => {
      if (!user || !effectiveAchievementId) return false;
      const { data } = await supabase
        .from('user_achievements')
        .select('id')
        .eq('user_id', user.id)
        .eq('id', effectiveAchievementId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!effectiveAchievementId && !effectiveAchievementName,
    staleTime: 60_000,
  });

  // Preferência global "Sempre ocultar spoilers"
  const alwaysHide = useQuery({
    queryKey: ['always-hide-spoilers', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('profiles')
        .select('always_hide_spoilers')
        .eq('id', user.id)
        .maybeSingle();
      return !!(data as any)?.always_hide_spoilers;
    },
    enabled: !!user,
    staleTime: 300_000,
  });

  const isAchievementLocked = !!effectiveAchievementName || !!effectiveAchievementId;
  const hasAchievement = effectiveAchievementName ? hasAchByName.data : hasAchById.data;

  // GAP-SG04: Marcar como revelado
  const handleReveal = () => {
    setRevealed(true);
    setWasRevealed(true);
  };

  // GAP-SG01: Efeito de revelação
  useEffect(() => {
    if (revealed && !disableAnimation) {
      const timer = setTimeout(() => setRevealed(true), 300);
      return () => clearTimeout(timer);
    }
  }, [revealed, disableAnimation]);

  // Caso 3: tem a conquista → libera com badge (a menos que o usuário tenha optado por sempre ocultar)
  if (isAchievementLocked && hasAchievement && !alwaysHide.data) {
    return (
      <div className={cn("relative", className)}>
        <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-warning/20 to-warning/20 border border-warning/40 text-warning text-[10px] font-bold uppercase tracking-wider">
          <Trophy className="h-3 w-3" />
          Liberado por: {effectiveAchievementName || 'Conquista'}
          <Check className="h-3 w-3 text-success" />
        </div>
        {children}
      </div>
    );
  }

  const gated = (isSpoiler || isAchievementLocked || (alwaysHide.data && (isSpoiler || isAchievementLocked))) && !revealed;
  
  if (!gated) return <div className={cn(className, wasRevealed && "opacity-100")}>{children}</div>;

  // GAP-SG04: Badge "Revelado" após clicar
  const isRevealed = revealed && !disableAnimation;

  // GAP-SG01: Variantes de animação
  const overlayVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  };

  const contentVariants = {
    hidden: { filter: 'blur(22px) saturate(0.6)' },
    visible: { filter: 'blur(0px) saturate(1)' },
  };

  // Caso 2: spoiler de conquista (viewer não tem) — vermelho/intenso
  if (isAchievementLocked) {
    return (
      <div className={cn("relative overflow-hidden rounded-lg border-2 border-destructive/60 bg-destructive/10", className)}>
        <AnimatePresence mode="wait">
          <motion.div
            key={revealed ? 'revealed' : 'hidden'}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={!disableAnimation ? contentVariants : undefined}
            transition={{ duration: 0.4 }}
            className="pointer-events-none select-none"
            style={{ filter: revealed ? 'blur(0px)' : 'blur(22px) saturate(0.6)' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
        
        <AnimatePresence>
          {!revealed && (
            <motion.button
              type="button"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={!disableAnimation ? overlayVariants : undefined}
              transition={{ duration: 0.3 }}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleReveal(); }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-md hover:bg-background/50 transition-colors p-4 text-center z-10"
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/30 border border-destructive/70 text-destructive-foreground shadow-lg shadow-destructive/30">
                <ShieldAlert className="h-4 w-4" />
                <span className="text-xs font-black uppercase tracking-widest">Spoiler crítico de conquista</span>
              </div>
              {effectiveAchievementName && (
                <span className="text-xs text-foreground/90 font-semibold">
                  🏆 Vinculado a: <span className="text-destructive-foreground">{effectiveAchievementName}</span>
                </span>
              )}
              <span className="text-[11px] text-muted-foreground max-w-xs">
                Você ainda não desbloqueou essa conquista. Pode atrapalhar sua experiência.
              </span>
              <span className="mt-1 text-xs text-foreground/90 flex items-center gap-1.5 font-semibold">
                <Eye className="h-3.5 w-3.5" /> Revelar mesmo assim
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* GAP-SG04: Indicador de revelado */}
        {revealed && (
          <div className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur px-2 py-0.5 rounded-full text-[9px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" /> Revelado
          </div>
        )}
      </div>
    );
  }

  // Caso 1: spoiler manual — âmbar padrão
  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-warning/40 bg-warning/5", className)}>
      <AnimatePresence mode="wait">
        <motion.div
          key={revealed ? 'revealed' : 'hidden'}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={!disableAnimation ? contentVariants : undefined}
          transition={{ duration: 0.4 }}
          className="pointer-events-none select-none"
          style={{ filter: revealed ? 'blur(0px)' : 'blur(14px)' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {!revealed && (
          <motion.button
            type="button"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={!disableAnimation ? overlayVariants : undefined}
            transition={{ duration: 0.3 }}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleReveal(); }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/40 backdrop-blur-sm hover:bg-background/30 transition-colors z-10"
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-warning/20 border border-warning/60 text-warning">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Alerta de spoiler</span>
            </div>
            <span className="text-xs text-foreground/90 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Toque para revelar
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* GAP-SG04: Indicador de revelado */}
      {revealed && (
        <div className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur px-2 py-0.5 rounded-full text-[9px] text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary" /> Revelado
        </div>
      )}
    </div>
  );
}