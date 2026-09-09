import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// Tabela de níveis MIDIAS (1 → 17). Sincronizada com public.xp_levels.
const LEVELS: { level: number; xp: number; title: string }[] = [
  { level: 1, xp: 0, title: 'Novato' },
  { level: 2, xp: 200, title: 'Jogador' },
  { level: 3, xp: 500, title: 'Gamer' },
  { level: 4, xp: 750, title: 'Experiente' },
  { level: 5, xp: 1000, title: 'Veterano' },
  { level: 6, xp: 1500, title: 'Elite' },
  { level: 7, xp: 2000, title: 'Mestre' },
  { level: 8, xp: 2500, title: 'Lendário' },
  { level: 9, xp: 3500, title: 'Herói' },
  { level: 10, xp: 5000, title: 'Boss Final' },
  { level: 11, xp: 5280, title: 'Boss Final +' },
  { level: 12, xp: 5560, title: 'Boss Final ++' },
  { level: 13, xp: 5840, title: 'Boss Final +++' },
  { level: 14, xp: 6120, title: 'Boss Final ++++' },
  { level: 15, xp: 6400, title: 'Boss Final +++++' },
  { level: 16, xp: 6767, title: 'Rei do 67' },
  { level: 17, xp: 7500, title: 'Imperador do 67' },
];

export function xpToLevel(xp: number) {
  const safe = Math.max(0, xp || 0);
  let current = LEVELS[0];
  for (const l of LEVELS) if (safe >= l.xp) current = l;
  const next = LEVELS.find(l => l.xp > safe);
  const range = next ? next.xp - current.xp : 1;
  const progress = next ? Math.min(100, Math.round(((safe - current.xp) / range) * 100)) : 100;
  return {
    level: current.level,
    title: current.title,
    progress,
    currentLevelXp: current.xp,
    nextLevelXp: next?.xp ?? current.xp,
    nextTitle: next?.title ?? null,
  };
}

interface LevelBadgeProps {
  userId: string | null | undefined;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showXp?: boolean;
  className?: string;
  /** GAP-LB01: Mostrar barra de progresso */
  showProgress?: boolean;
  /** GAP-LB02: Cor customizada do texto */
  color?: string;
  /** GAP-LB02: Cor de fundo customizada */
  bgColor?: string;
  /** GAP-LB03: Click handler */
  onClick?: () => void;
  /** GAP-LB02: Cor da barra de progresso */
  progressColor?: string;
}

export default function LevelBadge({ 
  userId, 
  size = 'sm', 
  showXp = false, 
  className,
  showProgress = false,
  color,
  bgColor,
  onClick,
  progressColor = 'bg-gradient-to-r from-primary to-accent',
}: LevelBadgeProps) {
  const [xp, setXp] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('user_xp_totals' as any)
        .select('total_xp')
        .eq('user_id', userId)
        .maybeSingle();
      if (mounted) setXp(((data as any)?.total_xp as number) ?? 0);
    })();
    return () => { mounted = false; };
  }, [userId]);

  if (xp === null) return null;
  
  const { level, title, progress, currentLevelXp, nextLevelXp } = xpToLevel(xp);
  
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
    xl: 'text-base px-4 py-2 gap-2.5',
  }[size];

  // GAP-LB02: Cores customizadas
  const textColor = color || 'text-primary';
  const bgColorClass = bgColor || 'bg-gradient-to-r from-primary/20 to-accent/20';

  // GAP-LB01: Barra de progresso
  const progressBar = showProgress && (
    <div className="w-full h-1 bg-muted/50 rounded-full overflow-hidden mt-1">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={cn("h-full rounded-full", progressColor)}
      />
    </div>
  );

  const content = (
    <div
      className={cn(
        'inline-flex flex-col items-start rounded-full font-bold border border-primary/30',
        bgColorClass,
        sizeClasses,
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={onClick}
      title={`Nível ${level} — ${title} · ${xp} XP · ${progress}% até ${nextLevelXp} XP`}
    >
      <div className="flex items-center gap-1 w-full">
        <span>⭐</span>
        <span className={textColor}>Nv {level}</span>
        {showXp && <span className="text-muted-foreground font-normal">· {xp} XP</span>}
      </div>
      {progressBar}
    </div>
  );

  return content;
}