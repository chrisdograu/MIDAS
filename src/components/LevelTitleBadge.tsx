import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { xpToLevel } from './LevelBadge';
import { cn } from '@/lib/utils';
import { Sparkles, User } from 'lucide-react';
import { motion } from 'framer-motion';

interface LevelTitleBadgeProps {
  userId: string | null | undefined;
  className?: string;
  variant?: 'inline' | 'card';
  /** GAP-LB04: Fallback quando sem título */
  fallbackText?: string;
  /** GAP-LB03: Click handler */
  onClick?: () => void;
}

/**
 * Hierarchical display: "Nv X · Título Ativo".
 * Reads profiles.active_title_id → user_titles.name and XP via user_xp_totals.
 */
export default function LevelTitleBadge({ 
  userId, 
  className, 
  variant = 'inline',
  fallbackText = 'Sem título',
  onClick,
}: LevelTitleBadgeProps) {
  const [xp, setXp] = useState<number | null>(null);
  const [titleName, setTitleName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);
    
    (async () => {
      const [{ data: xpRow }, { data: prof }] = await Promise.all([
        supabase.from('user_xp_totals' as any).select('total_xp').eq('user_id', userId).maybeSingle(),
        supabase.from('profiles').select('active_title_id').eq('id', userId).maybeSingle(),
      ]);
      
      if (!alive) return;
      setXp(((xpRow as any)?.total_xp as number) ?? 0);
      
      const tid = (prof as any)?.active_title_id;
      if (tid) {
        const { data: t } = await supabase.from('user_titles' as any).select('name').eq('id', tid).maybeSingle();
        if (alive) setTitleName((t as any)?.name || null);
      } else {
        setTitleName(null);
      }
      setLoading(false);
    })();
    
    return () => { alive = false; };
  }, [userId]);

  if (loading) {
    return (
      <div className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 animate-pulse",
        variant === 'card' ? 'min-w-[120px]' : 'min-w-[80px]'
      )}>
        <div className="h-4 w-4 rounded-full bg-muted" />
        <div className="h-3 w-16 bg-muted rounded" />
      </div>
    );
  }

  if (xp === null) return null;
  
  const { level } = xpToLevel(xp);
  const hasTitle = !!titleName;

  // GAP-LB04: Fallback quando sem título
  if (!hasTitle && variant === 'inline') {
    return (
      <span 
        className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground', className)}
        onClick={onClick}
      >
        <User className="h-3 w-3" />
        <span>Nv {level}</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="italic">{fallbackText}</span>
      </span>
    );
  }

  if (!hasTitle && variant === 'card') {
    return (
      <div 
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50',
          className
        )}
        onClick={onClick}
      >
        <User className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-bold text-muted-foreground text-sm">Nv {level}</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="text-sm text-muted-foreground italic">{fallbackText}</span>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/15 via-accent/10 to-primary/15 border border-primary/30 backdrop-blur',
          onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
          className
        )}
        onClick={onClick}
      >
        <span className="font-bold text-primary text-sm">Nv {level}</span>
        {titleName && (
          <>
            <span className="text-muted-foreground/60">·</span>
            <span className="inline-flex items-center gap-1 text-sm font-medium gradient-text">
              <Sparkles className="h-3 w-3" />
              {titleName}
            </span>
          </>
        )}
      </motion.div>
    );
  }

  return (
    <span 
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={onClick}
    >
      <span className="font-bold text-primary">Nv {level}</span>
      {titleName && (
        <>
          <span className="text-muted-foreground/50">·</span>
          <span className="gradient-text font-semibold">{titleName}</span>
        </>
      )}
    </span>
  );
}