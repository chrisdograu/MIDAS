import { useEffect, useState, useCallback } from 'react';
import { ArrowUp, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// GAP-ST03: Posições
type Position = 'bottom-right' | 'bottom-left';

// GAP-ST01: Variantes de cor
type ColorVariant = 'primary' | 'secondary' | 'ghost';

const colorClasses: Record<ColorVariant, string> = {
  primary: 'bg-primary text-primary-foreground shadow-lg glow-primary hover:opacity-90',
  secondary: 'bg-secondary text-secondary-foreground shadow-lg hover:bg-secondary/80',
  ghost: 'bg-card/80 backdrop-blur-sm text-foreground border border-border shadow-lg hover:bg-card',
};

interface ScrollToTopButtonProps {
  /** GAP-ST01: Cor do botão */
  color?: ColorVariant;
  /** GAP-ST02: Desabilitar animação */
  disableAnimation?: boolean;
  /** GAP-ST03: Posição do botão */
  position?: Position;
  /** GAP-ST04: Mostrar progresso de scroll */
  showProgress?: boolean;
  /** GAP-ST04: Tamanho do progresso */
  progressSize?: number;
  /** GAP-ST01: Classes customizadas */
  className?: string;
  /** GAP-ST02: Delay da animação em ms */
  animationDelay?: number;
  /** GAP-ST04: Cor do progresso */
  progressColor?: string;
}

export default function ScrollToTopButton({
  color = 'primary',
  disableAnimation = false,
  position = 'bottom-right',
  showProgress = false,
  progressSize = 44,
  className,
  animationDelay = 300,
  progressColor = 'hsl(var(--primary))',
}: ScrollToTopButtonProps) {
  const [visible, setVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // GAP-ST04: Calcular progresso do scroll
  const updateProgress = useCallback(() => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    setScrollProgress(Math.min(100, progress));
    setVisible(scrollTop > 300);
  }, []);

  useEffect(() => {
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    return () => window.removeEventListener('scroll', updateProgress);
  }, [updateProgress]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // GAP-ST03: Posição
  const positionClass = position === 'bottom-left' 
    ? 'bottom-6 left-6' 
    : 'bottom-6 right-6';

  // GAP-ST02: Animação
  const animationProps = disableAnimation ? {} : {
    initial: { opacity: 0, scale: 0.8, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.8, y: 20 },
    transition: { duration: 0.3, delay: animationDelay / 1000 },
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          aria-label="Voltar ao topo"
          onClick={scrollToTop}
          className={cn(
            "fixed z-40 flex items-center justify-center rounded-full",
            positionClass,
            colorClasses[color],
            "transition-transform hover:scale-105 active:scale-95",
            className
          )}
          style={{ width: progressSize, height: progressSize }}
          {...animationProps}
        >
          {/* GAP-ST04: Progresso circular */}
          {showProgress ? (
            <div className="relative flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="40%"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  opacity={0.15}
                />
                <circle
                  cx="50%"
                  cy="50%"
                  r="40%"
                  fill="none"
                  stroke={progressColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${scrollProgress * 2.51} 251`}
                  className="transition-[stroke-dashoffset] duration-300"
                />
              </svg>
              <ArrowUp className="h-5 w-5 relative z-10" />
            </div>
          ) : (
            <ArrowUp className="h-5 w-5" />
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// GAP-ST01: Variantes pré-configuradas
export function PrimaryScrollButton(props: Omit<ScrollToTopButtonProps, 'color'>) {
  return <ScrollToTopButton {...props} color="primary" />;
}

export function GhostScrollButton(props: Omit<ScrollToTopButtonProps, 'color'>) {
  return <ScrollToTopButton {...props} color="ghost" />;
}

// GAP-ST04: Botão com progresso
export function ScrollToTopWithProgress(props: Omit<ScrollToTopButtonProps, 'showProgress'>) {
  return <ScrollToTopButton {...props} showProgress={true} />;
}