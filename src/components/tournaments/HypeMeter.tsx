import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Sparkles, Trophy, Zap, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Props { 
  value: number; 
  max?: number; 
  label?: string;
  /** GAP-HM03: Contribuição do usuário */
  userContribution?: number;
  /** GAP-HM02: Pico anterior */
  previousPeak?: number;
  /** GAP-HM01: Habilitar partículas */
  enableParticles?: boolean;
}

// GAP-HM01: Componente de partícula
const Particle = ({ delay, x, y }: { delay: number; x: number; y: number }) => (
  <motion.div
    initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
    animate={{ 
      opacity: 0, 
      scale: 0,
      x: x * 40,
      y: y * 40 - 20
    }}
    transition={{ duration: 1.5, delay, ease: 'easeOut' }}
    className="absolute w-1.5 h-1.5 rounded-full bg-warning"
  />
);

export default function HypeMeter({ 
  value, 
  max = 1000, 
  label = 'HYPE',
  userContribution = 0,
  previousPeak = 0,
  enableParticles = true
}: Props) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const [showParticles, setShowParticles] = useState(false);
  const [prevPct, setPrevPct] = useState(0);

  const tier = pct > 80 ? 'LENDÁRIO' : pct > 60 ? 'INSANO' : pct > 40 ? 'QUENTE' : pct > 20 ? 'MORNO' : 'AQUECENDO';
  const tierColor = pct > 80 ? 'text-destructive' : pct > 60 ? 'text-warning' : pct > 40 ? 'text-primary' : 'text-muted-foreground';

  // GAP-HM01: Disparar partículas ao atingir novo pico
  useEffect(() => {
    if (pct > 80 && pct > prevPct && enableParticles) {
      setShowParticles(true);
      const timer = setTimeout(() => setShowParticles(false), 2000);
      return () => clearTimeout(timer);
    }
    setPrevPct(pct);
  }, [pct, prevPct, enableParticles]);

  // GAP-HM03: Porcentagem de contribuição do usuário
  const userPct = value > 0 ? Math.min(100, Math.round((userContribution / value) * 100)) : 0;
  const hasUserContribution = userContribution > 0;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold tracking-[0.2em] uppercase text-warning">
          <Flame className="h-3.5 w-3.5" /> {label}
        </div>
        <div className="flex items-center gap-3">
          {/* GAP-HM02: Pico anterior */}
          {previousPeak > 0 && (
            <span className="text-[9px] text-muted-foreground/60">
              Pico: {previousPeak}
            </span>
          )}
          <span className={cn("text-[10px] tracking-widest font-bold", tierColor)}>
            {tier}
          </span>
        </div>
      </div>
      
      <div className="relative h-2.5 bg-secondary/60 rounded-full overflow-hidden border border-warning/20">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-warning via-warning to-destructive relative"
        >
          <div className="absolute inset-0 bg-foreground/20 animate-pulse" />
          
          {/* GAP-HM01: Partículas */}
          {showParticles && (
            <div className="absolute inset-0 overflow-hidden">
              {Array.from({ length: 12 }).map((_, i) => (
                <Particle 
                  key={i} 
                  delay={i * 0.08} 
                  x={(Math.random() - 0.5) * 2}
                  y={(Math.random() - 0.5) * 2}
                />
              ))}
            </div>
          )}
        </motion.div>
        
        {/* GAP-HM03: Marcador de contribuição do usuário */}
        {hasUserContribution && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute top-0 h-full w-0.5 bg-primary"
            style={{ left: `${userPct}%` }}
          />
        )}
      </div>
      
      {/* GAP-HM03: Contribuição do usuário */}
      {hasUserContribution && (
        <div className="flex justify-between mt-1">
          <span className="text-[8px] text-muted-foreground">
            Sua contribuição: {userContribution} ({userPct}%)
          </span>
          <span className="text-[8px] text-muted-foreground">
            <Users className="h-2.5 w-2.5 inline" /> {value} total
          </span>
        </div>
      )}
    </div>
  );
}